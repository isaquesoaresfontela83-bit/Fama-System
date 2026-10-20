-- Explicit default-deny policies document that only authenticated server APIs may access chat storage.
create policy fama_internal_server_only on public.fama_internal_threads for all to anon,authenticated using(false) with check(false);
create policy fama_internal_server_only on public.fama_internal_participants for all to anon,authenticated using(false) with check(false);
create policy fama_internal_server_only on public.fama_internal_messages for all to anon,authenticated using(false) with check(false);
create policy fama_internal_server_only on public.fama_internal_reads for all to anon,authenticated using(false) with check(false);
