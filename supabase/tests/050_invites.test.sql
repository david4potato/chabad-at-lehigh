-- In-app event invitations.
begin;
select plan(8);

create temp table ids (name text primary key, id uuid) on commit drop;
grant select on ids to anon, authenticated;
insert into ids values
  ('member', tests.create_user('inv-member@lehigh.edu')),
  ('going', tests.create_user('inv-going@lehigh.edu')),
  ('organizer', tests.create_user('inv-organizer@example.com'));
select tests.add_role((select id from ids where name = 'organizer'), 'organizer');

insert into public.events (slug, title, status, starts_at) values
  ('inv-event', 'Invite test', 'published', now() + interval '3 days'),
  ('inv-draft', 'Draft invite test', 'draft', now() + interval '3 days');
insert into ids select slug, id from public.events where slug like 'inv-%';
insert into public.rsvps (event_id, user_id, status)
  values ((select id from ids where name = 'inv-event'), (select id from ids where name = 'going'), 'going');

select tests.as_user((select id from ids where name = 'member'));
select throws_ok(
  format('select * from public.staff_invite_to_event(%L, array[''x@example.com''])', (select id from ids where name = 'inv-event')),
  'P0001', 'forbidden', 'students cannot send invitations');

select tests.as_user((select id from ids where name = 'organizer'));
create temp table r on commit drop as
  select * from public.staff_invite_to_event(
    (select id from ids where name = 'inv-event'),
    array['INV-member@lehigh.edu', 'inv-going@lehigh.edu', 'nobody@example.com', 'not-an-email', 'inv-member@lehigh.edu'],
    'Hope you can come!');
select is((select result from r where email = 'inv-member@lehigh.edu'), 'invited', 'a member gets invited (email is case-insensitive)');
select is((select result from r where email = 'inv-going@lehigh.edu'), 'already_rsvped', 'people already going are skipped');
select is((select result from r where email = 'nobody@example.com'), 'no_account', 'addresses without an account are reported back');
select is((select result from r where email = 'not-an-email'), 'invalid', 'invalid addresses are reported back');
select is((select count(*)::int from r), 4, 'duplicates are only processed once');
select is(
  (select result from public.staff_invite_to_event((select id from ids where name = 'inv-event'), array['inv-member@lehigh.edu'])),
  'already_invited', 'an unread invitation is not sent twice');
select throws_ok(
  format('select * from public.staff_invite_to_event(%L, array[''inv-member@lehigh.edu''])', (select id from ids where name = 'inv-draft')),
  'P0001', 'event_not_found', 'drafts cannot be invited to');

select * from finish();
rollback;
