-- Early-access waitlist. Applied by `npm run db:migrate`; safe to re-run.
create table if not exists waitlist_signups (
  id            bigserial primary key,
  email         text not null,
  organisation  text not null,
  role          text not null,
  country       text not null,
  notes         text,
  ip            text,
  user_agent    text,
  confirmed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create unique index if not exists waitlist_signups_email_key on waitlist_signups (lower(email));
