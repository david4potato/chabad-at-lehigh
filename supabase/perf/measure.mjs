// Times the app's busiest queries on the synthetic database from
// supabase/perf/scale_seed.sql. LOCAL COPIES ONLY: see supabase/perf/README.md.
//
// Each query runs the way PostgREST runs it: as the anon or authenticated role
// with the person's JWT claims, so row level security applies. Every run is
// inside a transaction that is rolled back, so writes (RSVP, delete account)
// leave nothing behind. Each query runs 3 times; the median is reported.
// Rolled-back writes still leave dead rows, which production's autovacuum would
// clear, so the script vacuums first and again before each run of a write.
//
//   PERF_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/perf \
//     node supabase/perf/measure.mjs [out.json] [name-filter]
import { writeFileSync } from "node:fs";
import pg from "pg";

const url = process.env.PERF_DATABASE_URL;
if (!url) {
  console.error("Set PERF_DATABASE_URL to a local copy of the database (never the live project).");
  process.exit(1);
}
const [outFile, filter] = process.argv.slice(2);
const RUNS = 3;

const USERS = {
  student: "aaaaaaaa-0000-4000-8000-000000000001",
  organizer: "aaaaaaaa-0000-4000-8000-000000000002",
  kitchen: "aaaaaaaa-0000-4000-8000-000000000003",
  admin: "aaaaaaaa-0000-4000-8000-000000000004",
};

const client = new pg.Client({ connectionString: url });
await client.connect();
const one = async (sql, params = []) => (await client.query(sql, params)).rows[0];
const all = async (sql, params = []) => (await client.query(sql, params)).rows;

const { db } = await one("select current_database() as db");
const { n } = await one("select count(*)::int as n from auth.users where email like 'perf-%'");
if (n < 1000) {
  console.error(`No synthetic data in database "${db}". Load supabase/perf/scale_seed.sql first.`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Fixtures: the same kinds of rows the pages would use.
// ---------------------------------------------------------------------------
const HOUR = 3600_000;
const now = new Date();
const nowIso = now.toISOString();
const graceIso = new Date(now.getTime() - 3 * HOUR).toISOString();
const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
const monthEarliest = new Date(Date.parse(monthStart) - 14 * 24 * HOUR).toISOString();
// Same as semesterStart() in src/lib/stats.ts (August 1 or January 1, site time).
const semester = `${now.getUTCFullYear()}-${now.getUTCMonth() >= 7 ? "08-01T04" : "01-01T05"}:00:00.000Z`;
const upcoming = `(ends_at >= '${nowIso}' or (ends_at is null and starts_at >= '${graceIso}'))`;
const past = `(ends_at < '${nowIso}' or (ends_at is null and starts_at < '${graceIso}'))`;

const nextShabbat = await one(
  `select id, slug from public.events where category = 'shabbat_dinner' and status = 'published' and starts_at > now()
   order by starts_at limit 1`,
);
const pastShabbat = await one(
  `select e.id, e.slug from public.events e where e.category = 'shabbat_dinner' and e.status = 'published'
     and e.starts_at < now() - interval '1 day'
     and exists (select 1 from public.menu_versions v where v.event_id = e.id and v.status = 'published')
   order by e.starts_at desc limit 1`,
);
const homeIds = (await all(
  `select id from public.events where status in ('published','cancelled') and ${upcoming} order by starts_at limit 5`,
)).map((r) => r.id);
const upcomingIds = (await all(
  `select id from public.events where status in ('published','cancelled') and ${upcoming} order by starts_at limit 60`,
)).map((r) => r.id);
const pastIds = (await all(
  `select id from public.events where status <> 'draft' and ${past} order by starts_at desc limit 100`,
)).map((r) => r.id);
const draftIds = (await all(`select id from public.events where status = 'draft' order by starts_at limit 100`)).map((r) => r.id);
const shiftIds = (await all(`select id from public.volunteer_shifts where event_id = $1`, [nextShabbat.id])).map((r) => r.id);
const openShiftIds = (await all(
  `select id from public.volunteer_shifts where status in ('open','closed') and starts_at >= now() - interval '1 hour'
   order by starts_at limit 100`,
)).map((r) => r.id);
const busyShift = await one(
  `select shift_id as id from public.volunteer_signups group by shift_id order by count(*) desc, shift_id limit 1`,
);
const peopleIds = (await all(`select id from public.profiles order by created_at desc limit 50`)).map((r) => r.id);
const regularIds = (await all(
  `select user_id as id from public.rsvps where status = 'going' group by user_id order by count(*) desc, user_id limit 50`,
)).map((r) => r.id);
const goingRsvp = await one(
  `select id from public.rsvps where event_id = $1 and status = 'going' and checked_in_at is null order by id limit 1`,
  [nextShabbat.id],
);
const inviteEmails = (await all(
  `select email from public.profiles where email like 'perf-s%@lehigh.edu' order by email limit 50`,
)).map((r) => r.email);

const arr = (ids) => `array[${ids.map((i) => `'${i}'`).join(",")}]::uuid[]`;
const textArr = (xs) => `array[${xs.map((x) => `'${x}'`).join(",")}]::text[]`;

const SUMMARY = "id, slug, title, summary, category, status, starts_at, ends_at, location_name, capacity, rsvp_enabled, rsvp_deadline";
const DETAIL = `${SUMMARY}, description, visibility, location_address, approval_mode, max_guests_per_rsvp, has_meal, menu_voting_open, contact_name, contact_email, contact_phone`;
const SHIFT = `s.id, s.event_id, s.title, s.description, s.starts_at, s.ends_at, s.slots, s.status, s.is_demo, ev.*`;
const SHIFT_EVENT = `left join lateral (select e.id as e_id, e.title as e_title, e.slug, e.status as e_status, e.starts_at as e_starts
                     from public.events e where e.id = s.event_id) ev on true`;

// [name, page, who[], sql]. SQL follows what PostgREST runs for each
// supabase-js call: same filters, order and limit; embeds become lateral joins.
const QUERIES = [
  ["get_my_context", "every page (header)", ["student", "organizer", "admin"], `select public.get_my_context()`],
  ["next_shabbat", "home", ["anon", "student"],
    `select ${DETAIL} from public.events where category = 'shabbat_dinner' and status = any('{published,cancelled}')
     and ${upcoming} order by starts_at limit 1`],
  ["upcoming_events_60", "/events", ["anon", "student"],
    `select ${SUMMARY} from public.events where status = any('{published,cancelled}') and ${upcoming}
     order by starts_at limit 60`],
  ["past_events_20", "/events?past", ["anon"],
    `select ${SUMMARY} from public.events where status = 'published' and ${past} order by starts_at desc limit 20`],
  ["month_events", "/events?view=month", ["anon"],
    `select ${SUMMARY} from public.events where status = any('{published,cancelled}') and starts_at >= '${monthEarliest}'
     and starts_at < '${monthEnd}' and (starts_at >= '${monthStart}' or ends_at > '${monthStart}') order by starts_at limit 200`],
  ["calendar_feed", "/events/calendar.ics", ["anon"],
    `select id, slug, title, summary, starts_at, ends_at, location_name, location_address from public.events
     where status = 'published' and visibility = 'public' and starts_at >= now() - interval '30 days'
     and starts_at <= now() + interval '6 months' order by starts_at limit 500`],
  ["announcements_50", "home, /announcements", ["anon"],
    `select a.id, a.title, a.body, a.is_pinned, a.is_urgent, a.publish_at, ev.slug, ev.title as event_title
     from public.announcements a left join lateral (select e.slug, e.title from public.events e where e.id = a.event_id) ev on true
     where a.status = 'published' and a.publish_at <= '${nowIso}' and (a.expires_at is null or a.expires_at > '${nowIso}')
     order by a.is_pinned desc, a.publish_at desc limit 50`],
  ["event_counts_5", "home", ["anon"], `select * from public.get_event_counts(${arr(homeIds)})`],
  ["event_counts_60", "/events", ["anon", "student"], `select * from public.get_event_counts(${arr(upcomingIds)})`],
  ["my_rsvps_60", "/events", ["student"],
    `select event_id, status, guest_count, guest_names, guest_status, note from public.rsvps
     where user_id = '${USERS.student}' and event_id = any(${arr(upcomingIds)})`],
  ["urgent_notifications", "home", ["student"],
    `select id, title, body, link from public.notifications where user_id = '${USERS.student}' and is_urgent
     and read_at is null order by created_at desc limit 3`],
  ["event_by_slug", "event page", ["anon"], `select ${DETAIL} from public.events where slug = '${nextShabbat.slug}'`],
  ["event_shifts", "event page", ["anon"],
    `select ${SHIFT} from public.volunteer_shifts s ${SHIFT_EVENT}
     where s.status = any('{open,closed}') and s.starts_at >= '${new Date(now.getTime() - HOUR).toISOString()}'
     and s.event_id = '${nextShabbat.id}' order by s.starts_at limit 100`],
  ["volunteer_counts", "event page", ["anon"], `select * from public.get_volunteer_counts(${arr(shiftIds)})`],
  ["event_menu_upcoming", "event page", ["anon", "student"], `select public.get_event_menu('${nextShabbat.id}')`],
  ["event_menu_past", "event page", ["anon"], `select public.get_event_menu('${pastShabbat.id}')`],
  ["vote_counts_general", "event page, Dishes", ["anon", "student"], `select * from public.get_dish_vote_counts()`],
  ["vote_counts_event", "event page", ["student"], `select * from public.get_dish_vote_counts('${nextShabbat.id}')`],
  ["menu_options", "event page", ["student"],
    `select o.dish_id, o.note, d.* from public.event_menu_options o
     left join lateral (select x.id, x.name, x.description from public.dishes x where x.id = o.dish_id) d on true
     where o.event_id = '${nextShabbat.id}'`],
  ["my_allergens", "event page", ["student"],
    `select allergen_code, severity from public.user_allergens where user_id = '${USERS.student}'`],
  ["my_events", "/my-events", ["student"],
    `select r.event_id, r.status, r.guest_count, r.guest_names, r.guest_status, r.note, ev.*
     from public.rsvps r join lateral (select ${SUMMARY} from public.events e where e.id = r.event_id) ev on true
     where r.user_id = '${USERS.student}'`],
  ["get_my_stats", "/my-events, /profile", ["student", "organizer"], `select public.get_my_stats()`],
  ["notifications_50", "/notifications", ["student"],
    `select id, title, body, link, is_urgent, read_at, created_at from public.notifications
     where user_id = '${USERS.student}' order by created_at desc limit 50`],
  ["mark_notifications_read", "/notifications", ["student"], `select public.mark_notifications_read()`],
  ["open_shifts", "/volunteer", ["anon"],
    `select ${SHIFT} from public.volunteer_shifts s ${SHIFT_EVENT}
     where s.status = any('{open,closed}') and s.starts_at >= '${new Date(now.getTime() - HOUR).toISOString()}'
     order by s.starts_at limit 100`],
  ["volunteer_counts_page", "/volunteer", ["anon", "student"], `select * from public.get_volunteer_counts(${arr(openShiftIds)})`],
  ["set_rsvp", "RSVP button", ["student"], `select public.set_rsvp('${nextShabbat.id}', 'going', 0, null, null)`],

  ["admin_next_5", "Dashboard", ["organizer"],
    `select id, title, starts_at, capacity, status, has_meal from public.events where status <> 'draft' and ${upcoming}
     order by starts_at limit 5`],
  ["admin_published_upcoming", "Dashboard", ["organizer"],
    `select id from public.events where status = 'published' and ${upcoming} limit 500`],
  ["new_suggestions_count", "Dashboard", ["kitchen"], `select count(*) from public.dish_suggestions where status = 'new'`],
  ["get_staff_stats", "Dashboard", ["organizer"], `select public.get_staff_stats('${semester}')`],
  ["admin_events_past_100", "Dashboard → Events", ["organizer"],
    `select id, slug, title, status, category, starts_at, ends_at, capacity, has_meal from public.events
     where status <> 'draft' and ${past} order by starts_at desc limit 100`],
  ["event_counts_100", "Dashboard → Events", ["organizer"], `select * from public.get_event_counts(${arr(pastIds)})`],
  ["event_counts_drafts", "Dashboard → Events → Drafts", ["organizer"], `select * from public.get_event_counts(${arr(draftIds)})`],
  ["attendees", "Attendees", ["organizer"],
    `select r.id, r.user_id, r.status, r.guest_count, r.guest_names, r.guest_status, r.note, r.created_at,
       r.status_changed_at, r.checked_in_at, p.*
     from public.rsvps r left join lateral (
       select x.full_name, x.preferred_name, x.email, x.phone,
         (select coalesce(json_agg(ur.role), '[]') from public.user_roles ur where ur.user_id = x.id) as roles
       from public.profiles x where x.id = r.user_id) p on true
     where r.event_id = '${pastShabbat.id}' order by r.created_at`],
  ["dietary_summary", "Dietary", ["organizer"], `select public.event_dietary_summary('${pastShabbat.id}')`],
  ["dietary_report", "Dietary", ["kitchen"], `select * from public.event_dietary_report('${pastShabbat.id}')`],
  ["menu_editor_dishes", "Menu editor", ["kitchen"],
    `select id, name, category, status from public.dishes where status <> 'archived' order by name`],
  ["event_menu_draft", "Menu editor", ["kitchen"], `select public.get_event_menu('${nextShabbat.id}', true)`],
  ["people_50", "People & roles", ["admin"],
    `select p.id, p.email, p.full_name, p.preferred_name, p.affiliation, p.created_at,
       (select coalesce(json_agg(ur.role), '[]') from public.user_roles ur where ur.user_id = p.id) as roles
     from public.profiles p order by p.created_at desc limit 50`],
  ["people_count", "People & roles", ["admin"], `select count(*) from public.profiles`],
  ["people_search", "People & roles", ["admin"],
    `select p.id, p.email, p.full_name from public.profiles p
     where p.email ilike '%cohen%' or p.full_name ilike '%cohen%' or p.preferred_name ilike '%cohen%'
     order by p.created_at desc limit 50`],
  ["get_people_activity", "People & roles", ["admin"], `select * from public.get_people_activity(${arr(peopleIds)})`],
  ["get_people_activity_regulars", "People & roles (search)", ["admin"],
    `select * from public.get_people_activity(${arr(regularIds)})`],
  ["get_person_history", "Person", ["admin"], `select public.get_person_history('${USERS.student}')`],
  ["audit_latest_200", "Audit log", ["admin"],
    `select a.id, a.action, a.entity_type, a.entity_id, a.details, a.created_at, a.actor_ref, p.*
     from public.audit_events a left join lateral (select x.full_name, x.email from public.profiles x where x.id = a.actor_id) p on true
     order by a.created_at desc limit 200`],
  ["audit_filter_events", "Audit log", ["admin"],
    `select a.id, a.action, a.entity_type, a.entity_id, a.created_at from public.audit_events a
     where a.entity_type = 'events' order by a.created_at desc limit 200`],
  ["audit_filter_rare", "Audit log", ["admin"],
    `select a.id, a.action, a.entity_type, a.entity_id, a.created_at from public.audit_events a
     where a.entity_type = 'app_settings' order by a.created_at desc limit 200`],
  ["audit_filter_dietary", "Audit log", ["admin"],
    `select a.id, a.action, a.entity_type, a.entity_id, a.created_at from public.audit_events a
     where a.action = 'dietary_report.viewed' order by a.created_at desc limit 200`],
  ["suggestions_declined", "Suggestions", ["kitchen"],
    `select s.id, s.kind, s.title, s.details, s.status, s.staff_response, s.created_at, ev.title as event_title
     from public.dish_suggestions s left join lateral (select e.title from public.events e where e.id = s.event_id) ev on true
     where s.status = 'declined' order by s.created_at desc limit 100`],
  ["dishes_200", "Dishes", ["kitchen"],
    `select id, name, category, kosher_type, status from public.dishes where status = 'active' order by name limit 200`],
  ["dish_allergens_all", "Dishes", ["kitchen"], `select dish_id, allergen_code from public.dish_allergens`],
  ["ingredients_300", "Ingredients", ["kitchen"],
    `select i.id, i.name, i.notes, (select coalesce(json_agg(ia.allergen_code), '[]') from public.ingredient_allergens ia
       where ia.ingredient_id = i.id) as allergens from public.ingredients i order by i.name limit 300`],
  ["ingredient_picker", "Dish page", ["kitchen"], `select id, name from public.ingredients order by name`],
  ["admin_shifts_past", "Dashboard → Volunteers", ["organizer"],
    `select ${SHIFT} from public.volunteer_shifts s ${SHIFT_EVENT}
     where s.starts_at < '${graceIso}' order by s.starts_at desc limit 200`],
  ["shift_signups", "Volunteer shift", ["organizer"],
    `select v.user_id, v.created_at, p.* from public.volunteer_signups v
     left join lateral (select x.full_name, x.preferred_name, x.email from public.profiles x where x.id = v.user_id) p on true
     where v.shift_id = '${busyShift.id}' order by v.created_at`],
  ["check_in", "Attendees (check-in)", ["organizer"], `select public.staff_set_check_in('${goingRsvp.id}', true)`],
  ["invite_50", "Invite people", ["organizer"],
    `select * from public.staff_invite_to_event('${nextShabbat.id}', ${textArr(inviteEmails)}, null)`],
  ["event_time_change", "Edit event (notifies)", ["organizer"],
    `update public.events set starts_at = starts_at + interval '30 minutes', ends_at = ends_at + interval '30 minutes'
     where id = '${nextShabbat.id}'`],
  ["delete_my_account_student", "Delete account", ["student"], `select public.delete_my_account()`],
  ["delete_my_account_organizer", "Delete account", ["organizer"], `select public.delete_my_account()`],
  ["delete_past_event", "Delete event", ["admin"], `delete from public.events where id = '${pastShabbat.id}'`],
];

// Per-constraint cost of the account-deletion cascade (as the table owner).
const BREAKDOWNS = [
  ["cascade_student", `delete from auth.users where id = '${USERS.student}'`],
  ["cascade_organizer", `delete from auth.users where id = '${USERS.organizer}'`],
  ["cascade_event", `delete from public.events where id = '${pastShabbat.id}'`],
];

async function explain(sql, who, timing = false) {
  await client.query("begin");
  try {
    await client.query("set local statement_timeout = '120s'");
    if (who === "anon") {
      await client.query("set local role anon");
      await client.query(`select set_config('request.jwt.claims', '{"role":"anon"}', true)`);
    } else if (who !== "owner") {
      await client.query("set local role authenticated");
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: USERS[who], role: "authenticated" }),
      ]);
    }
    const res = await client.query(`explain (analyze, buffers, timing ${timing ? "on" : "off"}, format json) ${sql}`);
    return res.rows[0]["QUERY PLAN"][0];
  } finally {
    await client.query("rollback");
  }
}

// "RI_ConstraintTrigger_a_123" -> "rsvps.decided_by (set null)"
const fkLabels = new Map(
  (await all(
    `select t.tgname, c.conrelid::regclass::text || '.' || a.attname || ' (' ||
       case c.confdeltype when 'c' then 'cascade' when 'n' then 'set null' else 'check' end || ')' as label
     from pg_trigger t join pg_constraint c on c.oid = t.tgconstraint
     join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where t.tgname like 'RI_ConstraintTrigger_a_%'`,
  )).map((r) => [r.tgname, r.label]),
);

// Queries that write (inside the rolled-back transaction).
const WRITES = new Set([
  "mark_notifications_read", "set_rsvp", "check_in", "invite_50", "event_time_change",
  "delete_my_account_student", "delete_my_account_organizer", "delete_past_event", "dietary_report",
]);
const tables = (await all(
  `select format('%I.%I', n.nspname, c.relname) as t from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where c.relkind = 'r' and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname = 'users'))`,
)).map((r) => r.t);
const vacuum = (analyze = false) => client.query(`vacuum ${analyze ? "(analyze) " : ""}${tables.join(", ")}`);
await vacuum(true);

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const results = [];

for (const [name, page, whos, sql] of QUERIES) {
  if (filter && !name.includes(filter)) continue;
  for (const who of whos) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) {
      if (WRITES.has(name)) await vacuum();
      runs.push(await explain(sql, who));
    }
    const p = runs[0].Plan;
    const row = {
      name,
      page,
      who,
      rows: p["Actual Rows"] * (p["Actual Loops"] || 1),
      execMs: +median(runs.map((r) => r["Execution Time"])).toFixed(2),
      planMs: +median(runs.map((r) => r["Planning Time"])).toFixed(2),
      buffers: median(runs.map((r) => (r.Plan["Shared Hit Blocks"] ?? 0) + (r.Plan["Shared Read Blocks"] ?? 0))),
      runsMs: runs.map((r) => +r["Execution Time"].toFixed(2)),
    };
    results.push(row);
    console.log(
      `${name.padEnd(28)} ${who.padEnd(9)} rows=${String(row.rows).padStart(5)} exec=${String(row.execMs).padStart(8)} ms` +
        ` plan=${String(row.planMs).padStart(6)} ms buffers=${row.buffers}`,
    );
  }
}

const breakdowns = [];
for (const [name, sql] of BREAKDOWNS) {
  if (filter && !name.includes(filter)) continue;
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    await vacuum();
    runs.push(await explain(sql, "owner", true));
  }
  const mid = runs.find((r) => r["Execution Time"] === median(runs.map((x) => x["Execution Time"])));
  const triggers = (mid.Triggers ?? [])
    .map((t) => ({
      trigger: fkLabels.get(t["Trigger Name"]) ?? `${t["Trigger Name"]} on ${t.Relation}`,
      ms: +t.Time.toFixed(2),
      calls: t.Calls,
    }))
    .sort((a, b) => b.ms - a.ms);
  breakdowns.push({ name, execMs: +mid["Execution Time"].toFixed(2), triggers });
  console.log(`\n${name}: ${mid["Execution Time"].toFixed(2)} ms`);
  for (const t of triggers.slice(0, 15)) console.log(`  ${t.ms.toFixed(2).padStart(8)} ms  ${String(t.calls).padStart(4)}x  ${t.trigger}`);
}

const sizes = await all(
  `select c.relname as table, pg_total_relation_size(c.oid) as bytes, pg_relation_size(c.oid) as heap_bytes,
     pg_indexes_size(c.oid) as index_bytes, c.reltuples::bigint as est_rows
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' order by pg_total_relation_size(c.oid) desc`,
);
const { dbBytes } = await one("select pg_database_size(current_database()) as \"dbBytes\"");
await client.end();

if (outFile) writeFileSync(outFile, JSON.stringify({ measuredAt: nowIso, db, results, breakdowns, sizes, dbBytes }, null, 2));
console.log(`\nDatabase size: ${(dbBytes / 1024 / 1024).toFixed(1)} MB`);
