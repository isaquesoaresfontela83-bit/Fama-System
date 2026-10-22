-- Applied through Supabase on 2026-10-04. Preserves existing records.
SET lock_timeout = '5s';
SET statement_timeout = '15s';
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check,
  ADD CONSTRAINT appointments_status_check CHECK
    (status IN ('agendado', 'confirmado', 'em_rota', 'concluido', 'remarcado', 'cancelado')) NOT VALID;
ALTER TABLE public.appointments VALIDATE CONSTRAINT appointments_status_check;
