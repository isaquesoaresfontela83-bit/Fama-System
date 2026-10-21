-- Accept every CRM stage offered by Fama System; preserve existing records.
SET lock_timeout = '5s';
SET statement_timeout = '15s';
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_status_check,
  ADD CONSTRAINT leads_status_check CHECK
    (status IN ('novo', 'contato', 'visita', 'proposta', 'negociacao', 'ganho', 'perdido')) NOT VALID;
ALTER TABLE public.leads VALIDATE CONSTRAINT leads_status_check;
