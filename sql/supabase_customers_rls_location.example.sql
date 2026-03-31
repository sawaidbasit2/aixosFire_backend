-- Optional: run in Supabase SQL editor after confirming your auth model.
-- Canonical location columns: location_lat, location_lng (double precision).
-- Do NOT send lat/lng in PostgREST PATCH bodies unless you add those columns.

-- Example RLS: customers.id equals auth.uid() (typical when profile id = user id)
-- alter table customers enable row level security;

-- create policy "customers_update_own_row"
-- on public.customers
-- for update
-- to authenticated
-- using (id = auth.uid())
-- with check (id = auth.uid());

-- If your app links customers via a separate auth_user_id column, replace id with that column in the policy.
