-- Event visibility and the RSVP rules (capacity, waitlist, approvals, guests,
-- deadlines, check-in, declines, rate limiting).
begin;
select plan(34);

create temp table ids (name text primary key, id uuid) on commit drop;
grant select on ids to anon, authenticated;

insert into ids values
  ('a', tests.create_user('rsvp-a@lehigh.edu')),
  ('b', tests.create_user('rsvp-b@lehigh.edu')),
  ('c', tests.create_user('rsvp-c@example.com')),       -- community guest
  ('r', tests.create_user('rsvp-ratelimit@lehigh.edu')),
  ('organizer', tests.create_user('rsvp-organizer@example.com')),
  ('admin', tests.create_user('rsvp-admin@example.com'));
select tests.add_role((select id from ids where name = 'organizer'), 'organizer');
select tests.add_role((select id from ids where name = 'admin'), 'admin');

insert into public.events (slug, title, status, visibility, starts_at, capacity, approval_mode, max_guests_per_rsvp, rsvp_deadline) values
  ('t-small', 'Small auto event', 'published', 'public', now() + interval '3 days', 2, 'auto', 1, null),
  ('t-draft', 'Draft event', 'draft', 'public', now() + interval '3 days', null, 'auto', 0, null),
  ('t-members', 'Members event', 'published', 'members', now() + interval '3 days', null, 'auto', 0, null),
  ('t-approval', 'Guests need approval', 'published', 'public', now() + interval '3 days', 10, 'guests_need_approval', 2, null),
  ('t-deadline', 'Deadline passed', 'published', 'public', now() + interval '3 days', null, 'auto', 0, now() - interval '1 hour'),
  ('t-full', 'Exactly full', 'published', 'public', now() + interval '3 days', 2, 'auto', 2, null),
  ('t-many', 'Rate limit target', 'published', 'public', now() + interval '3 days', null, 'auto', 0, null);
insert into ids select slug, id from public.events where slug like 't-%';

-- ---------------------------------------------------------------------------
-- Visibility
-- ---------------------------------------------------------------------------
select tests.as_anon();
select is((select count(*)::int from public.events where slug = 't-small'), 1, 'anonymous visitors see published public events');
select is((select count(*)::int from public.events where slug = 't-draft'), 0, 'anonymous visitors cannot see drafts');
select is((select count(*)::int from public.events where slug = 't-members'), 0, 'anonymous visitors cannot see members-only events');
select throws_ok(
  format('select public.set_rsvp(%L, ''going'')', (select id from ids where name = 't-small')),
  '42501', null, 'anonymous visitors cannot RSVP');

select tests.as_user((select id from ids where name = 'a'));
select is((select count(*)::int from public.events where slug = 't-members'), 1, 'signed-in members see members-only events');
select is((select count(*)::int from public.events where slug = 't-draft'), 0, 'students cannot see drafts');
select throws_ok(
  $$ insert into public.events (slug, title, starts_at) values ('t-hack', 'Hack', now()) $$,
  '42501', null, 'students cannot create events');
select is(tests.rows_affected($$ update public.events set title = 'Hacked' where slug = 't-small' $$), 0,
  'students cannot edit events');
select throws_ok(
  format('insert into public.rsvps (event_id, user_id, status) values (%L, %L, ''going'')',
    (select id from ids where name = 't-small'), (select id from ids where name = 'a')),
  '42501', null, 'RSVPs cannot be inserted directly (only through set_rsvp)');

-- ---------------------------------------------------------------------------
-- Capacity + waitlist (capacity 2, auto confirm)
-- ---------------------------------------------------------------------------
select is((public.set_rsvp((select id from ids where name = 't-small'), 'going')).status, 'going'::public.rsvp_status, 'first person is confirmed');
select tests.as_user((select id from ids where name = 'b'));
select is((public.set_rsvp((select id from ids where name = 't-small'), 'going')).status, 'going'::public.rsvp_status, 'second person is confirmed');
select tests.as_user((select id from ids where name = 'c'));
select is((public.set_rsvp((select id from ids where name = 't-small'), 'going')).status, 'waitlist'::public.rsvp_status, 'third person joins the waitlist when full');
select is((select count(*)::int from public.rsvps), 1, 'people only see their own RSVPs');

select is(
  (select seats_taken from public.get_event_counts(array[(select id from ids where name = 't-small')])), 2,
  'counts show 2 seats taken');

select tests.as_user((select id from ids where name = 'a'));
select is((public.set_rsvp((select id from ids where name = 't-small'), 'not_going')).status, 'not_going'::public.rsvp_status, 'changing to not going works');
reset role;
select is(
  (select status from public.rsvps where event_id = (select id from ids where name = 't-small') and user_id = (select id from ids where name = 'c')),
  'going'::public.rsvp_status, 'the waitlisted person is promoted automatically');
select ok(
  exists (select 1 from public.notifications where user_id = (select id from ids where name = 'c') and kind = 'rsvp_promoted'),
  'the promoted person gets a notification');

select tests.as_user((select id from ids where name = 'a'));
select is(
  (public.set_rsvp((select id from ids where name = 't-small'), 'going', 1)).status, 'waitlist'::public.rsvp_status,
  'a person plus a guest who no longer fit goes to the waitlist (guests count toward capacity)');
select throws_ok(
  format('select public.set_rsvp(%L, ''going'', 5)', (select id from ids where name = 't-small')),
  'P0001', 'too_many_guests', 'cannot bring more guests than the event allows');

-- ---------------------------------------------------------------------------
-- Approval mode: guests and community members need approval
-- ---------------------------------------------------------------------------
select tests.as_user((select id from ids where name = 'a'));
select ok(
  (select status = 'going' and guest_status = 'pending' from public.set_rsvp((select id from ids where name = 't-approval'), 'going', 1)),
  'a student is confirmed but their guest waits for approval');
select tests.as_user((select id from ids where name = 'c'));
select is((public.set_rsvp((select id from ids where name = 't-approval'), 'going')).status, 'pending'::public.rsvp_status,
  'a community guest waits for approval');
select tests.as_user((select id from ids where name = 'b'));
select is((public.set_rsvp((select id from ids where name = 't-approval'), 'going')).status, 'going'::public.rsvp_status,
  'a student alone is confirmed');

-- Staff-only functions
select throws_ok(
  format('select public.staff_decide_rsvp(%L, ''approve'')',
    (select id from public.rsvps where event_id = (select id from ids where name = 't-approval') limit 1)),
  'P0001', 'forbidden', 'students cannot approve RSVPs');

reset role;
create temp table rs on commit drop as
  select user_id, id from public.rsvps where event_id = (select id from ids where name = 't-approval');
grant select on rs to authenticated;

select tests.as_user((select id from ids where name = 'organizer'));
select is(
  (public.staff_decide_rsvp((select id from rs where user_id = (select id from ids where name = 'c')), 'approve')).status,
  'going'::public.rsvp_status, 'an organizer can approve a pending RSVP');
select is(
  (public.staff_decide_guests((select id from rs where user_id = (select id from ids where name = 'a')), 'approve')).guest_status,
  'approved'::public.guest_status, 'an organizer can approve guests');
select is(
  (public.staff_decide_rsvp((select id from rs where user_id = (select id from ids where name = 'b')), 'decline')).status,
  'declined'::public.rsvp_status, 'an organizer can decline an RSVP');
select ok(
  (public.staff_set_check_in((select id from rs where user_id = (select id from ids where name = 'a')), true)).checked_in_at is not null,
  'an organizer can check someone in');

select tests.as_user((select id from ids where name = 'b'));
select throws_ok(
  format('select public.set_rsvp(%L, ''going'')', (select id from ids where name = 't-approval')),
  'P0001', 'rsvp_declined', 'a declined person cannot simply RSVP again');
select throws_ok(
  format('select public.staff_set_check_in(%L, true)', (select id from rs where user_id = (select id from ids where name = 'b'))),
  'P0001', 'forbidden', 'students cannot check people in');

-- ---------------------------------------------------------------------------
-- Deadlines and keeping a confirmed seat
-- ---------------------------------------------------------------------------
select throws_ok(
  format('select public.set_rsvp(%L, ''going'')', (select id from ids where name = 't-deadline')),
  'P0001', 'rsvp_deadline_passed', 'RSVPs are refused after the deadline');

select tests.as_user((select id from ids where name = 'a'));
select public.set_rsvp((select id from ids where name = 't-full'), 'going');
select tests.as_user((select id from ids where name = 'b'));
select public.set_rsvp((select id from ids where name = 't-full'), 'going');
select tests.as_user((select id from ids where name = 'a'));
select throws_ok(
  format('select public.set_rsvp(%L, ''going'', 1)', (select id from ids where name = 't-full')),
  'P0001', 'not_enough_capacity', 'adding a guest to a full event is refused');
select ok(
  (select status = 'going' and guest_count = 0 from public.rsvps where event_id = (select id from ids where name = 't-full')),
  'the confirmed seat is kept unchanged after a refused change');

-- ---------------------------------------------------------------------------
-- Admin-only delete, rate limiting
-- ---------------------------------------------------------------------------
select tests.as_user((select id from ids where name = 'organizer'));
select is(tests.rows_affected($$ delete from public.events where slug = 't-many' $$), 0,
  'organizers cannot delete events (they cancel them instead)');

select tests.as_user((select id from ids where name = 'r'));
do $$
begin
  for i in 1..30 loop
    perform public.set_rsvp((select id from ids where name = 't-many'), case when i % 2 = 0 then 'going' else 'not_going' end);
  end loop;
end;
$$;
select throws_ok(
  format('select public.set_rsvp(%L, ''going'')', (select id from ids where name = 't-many')),
  'P0001', 'rate_limited', 'rapid repeated RSVP changes are rate limited');

select * from finish();
rollback;
