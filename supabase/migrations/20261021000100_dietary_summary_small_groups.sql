-- =============================================================================
-- Organizers see anonymous dietary counts. With only a few people sharing, a
-- count can still point to one person (one RSVP plus "1 severe peanut
-- allergy"). For callers who can't see names, the breakdown now stays hidden
-- until at least 5 people share their details. Kitchen staff and admins still
-- get the full summary and the named report. Same function, same grants.
-- =============================================================================

create or replace function public.event_dietary_summary(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not (public.can_manage_events() or public.can_view_dietary()) then
    raise exception 'forbidden';
  end if;

  with attendees as (
    select r.user_id, r.status, r.guest_count, r.guest_status,
           coalesce(dp.share_with_kitchen, true) as shared, dp.diets, dp.carries_epinephrine,
           (nullif(trim(coalesce(dp.other_restrictions, '')), '') is not null
             or nullif(trim(coalesce(dp.notes_for_kitchen, '')), '') is not null) as has_notes,
           nullif(trim(coalesce(mp.guest_dietary_notes, '')), '') is not null as has_guest_notes
    from public.rsvps r
    left join public.dietary_profiles dp on dp.user_id = r.user_id
    left join public.event_meal_preferences mp on mp.event_id = r.event_id and mp.user_id = r.user_id
    where r.event_id = p_event_id and r.status in ('going', 'pending', 'waitlist')
  )
  select jsonb_build_object(
    'attendees', (select count(*) from attendees),
    'shared', (select count(*) from attendees where shared),
    'hidden', false,
    'going', (select count(*) from attendees where status = 'going'),
    'approved_guests', (select coalesce(sum(guest_count), 0) from attendees where status = 'going' and guest_status = 'approved'),
    'not_shared', (select count(*) from attendees where not shared),
    'with_notes', (select count(*) from attendees where shared and has_notes),
    'with_guest_notes', (select count(*) from attendees where has_guest_notes),
    'carries_epinephrine', (select count(*) from attendees where shared and carries_epinephrine),
    'allergens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', a.code, 'label', a.label,
        'intolerance', x.intolerance, 'allergy', x.allergy, 'severe', x.severe
      ) order by a.sort_order)
      from public.allergens a
      join (
        select ua.allergen_code,
          count(*) filter (where ua.severity = 'intolerance') as intolerance,
          count(*) filter (where ua.severity = 'allergy') as allergy,
          count(*) filter (where ua.severity = 'severe') as severe
        from public.user_allergens ua
        join attendees t on t.user_id = ua.user_id and t.shared
        group by ua.allergen_code
      ) x on x.allergen_code = a.code
    ), '[]'::jsonb),
    'diets', coalesce((
      select jsonb_agg(jsonb_build_object('diet', d.diet, 'count', d.n) order by d.diet)
      from (
        select unnest(t.diets) as diet, count(*) as n
        from attendees t where t.shared
        group by 1
      ) d
    ), '[]'::jsonb)
  ) into v_result;

  -- Organizers who can't see names get no breakdown until 5 people share, so a count can't point to one person.
  if not public.can_view_dietary() and (v_result ->> 'shared')::int < 5 then
    v_result := v_result || jsonb_build_object(
      'hidden', true, 'allergens', '[]'::jsonb, 'diets', '[]'::jsonb,
      'carries_epinephrine', null, 'with_notes', null, 'with_guest_notes', null);
  end if;

  return v_result;
end;
$$;
