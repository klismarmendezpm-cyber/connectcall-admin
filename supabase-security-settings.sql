-- Optional support for Settings > Security > Audit Log Retention.
-- Your original dump has no audit_log.created_at column, so retention cleanup
-- cannot delete by age until this column exists.

alter table public.audit_log
add column if not exists created_at timestamp without time zone not null default now();
