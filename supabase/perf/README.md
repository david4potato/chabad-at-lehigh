# Performance measurement (local only)

These files load a large fake campus into a **local copy** of the database and time the app's busiest queries.
The results are in [docs/SCALING.md](../../docs/SCALING.md#measured-on-19-oct-2026).

**Never run them on the live Supabase project or on any database people use.** The data is fake (5,000 accounts,
three years of events, 150,000 notifications) and would mix with real data. `scale_seed.sql` refuses to run unless the
session sets `perf.local_only = 'yes'`, and refuses to run twice. Never use a service-role key for this.

| File | What it does |
| --- | --- |
| `scale_seed.sql` | Adds the fake data in one transaction (about 40 seconds). Repeatable: choices come from md5 hashes of fixed keys; dates are relative to the day you run it. The top of the file lists the four triggers it turns off while loading, and why. |
| `measure.mjs` | Runs each hot query as the real role (anon or a signed-in person) with row level security, 3 times, and prints the median. Every run is rolled back. It vacuums first, as autovacuum would. |

## Run it

1. Start the local stack (`npm run db:start`). Make a copy of the local database in a separate database, for
   example named `perf`, with your usual Postgres tools. Use the copy only: e2e tests use the `postgres` database.
2. Load the fake data:

   ```sh
   psql "postgresql://postgres:postgres@127.0.0.1:54322/perf" -v ON_ERROR_STOP=1 \
     -c "set perf.local_only = 'yes'" -f supabase/perf/scale_seed.sql
   ```

3. Measure (writes a JSON file you can compare later):

   ```sh
   PERF_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/perf \
     node supabase/perf/measure.mjs before.json
   ```

4. To test a schema change, apply the migration file to the copy with `psql -f`, measure again, and compare.
5. When done, drop the copy.

Four fixed accounts make the numbers comparable between runs: `perf-student@lehigh.edu` (comes almost every week),
`perf-organizer@example.com`, `perf-kitchen@example.com` and `perf-admin@example.com`.

Times come from Docker on a laptop or a cloud machine, not Supabase's servers, and vary by about 30% from run to run.
The buffer counts (pages read) are steady, so use them to tell a real change from noise.
