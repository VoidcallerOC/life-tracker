-- Life OS schema. Row-per-record storage replacing the whole-document JSON blobs.
--
-- Everything lives in a dedicated `life_os` schema rather than `public`, so this
-- database can host other applications without name collisions.
--
-- Every mutable entity carries `version`, bumped by trigger on each UPDATE. Writers
-- send the version they read; a mismatch means someone else changed the row first and
-- the write is rejected instead of silently overwriting them.

CREATE SCHEMA IF NOT EXISTS life_os;

CREATE TABLE IF NOT EXISTS life_os.schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION life_os.bump_version() RETURNS trigger AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS life_os.clients (
  id             text PRIMARY KEY,
  name           text NOT NULL DEFAULT '',
  business_type  text NOT NULL DEFAULT '',
  status         text NOT NULL DEFAULT 'Potential'
                 CHECK (status IN ('Potential', 'Pending', 'Paid', 'Lost')),
  contacted      boolean NOT NULL DEFAULT false,
  contact_name   text NOT NULL DEFAULT '',
  phone          text NOT NULL DEFAULT '',
  email          text NOT NULL DEFAULT '',
  address        text NOT NULL DEFAULT '',
  quoted         numeric(12, 2),
  deposit        numeric(12, 2),
  paid           numeric(12, 2),
  paid_date      date,
  github_repo    text NOT NULL DEFAULT '',
  live_url       text NOT NULL DEFAULT '',
  domain         text NOT NULL DEFAULT '',
  next_action    text NOT NULL DEFAULT '',
  due_date       date,
  notes          text NOT NULL DEFAULT '',
  last_contacted date,
  snooze_until   date,
  lost_reason    text NOT NULL DEFAULT '',
  version        integer NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);

CREATE TABLE IF NOT EXISTS life_os.animals (
  id                text PRIMARY KEY,
  name              text NOT NULL DEFAULT '',
  species           text NOT NULL DEFAULT '',
  enclosure         text NOT NULL DEFAULT '',
  last_fed          date,
  last_cleaned      date,
  next_care_due     date,
  feed_every_days   integer NOT NULL DEFAULT 7 CHECK (feed_every_days >= 1),
  clean_every_days  integer NOT NULL DEFAULT 7 CHECK (clean_every_days >= 1),
  notes             text NOT NULL DEFAULT '',
  snooze_until      date,
  version           integer NOT NULL DEFAULT 1,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

CREATE TABLE IF NOT EXISTS life_os.tasks (
  id            text PRIMARY KEY,
  title         text NOT NULL DEFAULT '',
  lane          text NOT NULL CHECK (lane IN ('content', 'personal')),
  deadline      date,
  status        text NOT NULL DEFAULT 'Todo' CHECK (status IN ('Todo', 'Done')),
  priority      text NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High', 'Medium', 'Low')),
  platform      text NOT NULL DEFAULT '',
  category      text NOT NULL DEFAULT '',
  notes         text NOT NULL DEFAULT '',
  snooze_until  date,
  completed_at  timestamptz,
  version       integer NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

-- Free-form app settings (week pin, coach dismissal) that used to require a code edit.
CREATE TABLE IF NOT EXISTS life_os.settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Opaque session tokens. Only the SHA-256 of the token is stored, so a database
-- leak does not hand out live sessions.
CREATE TABLE IF NOT EXISTS life_os.sessions (
  token_hash   text PRIMARY KEY,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  user_agent   text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS life_os.push_subscriptions (
  endpoint    text PRIMARY KEY,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz,
  failure_count integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS clients_live_idx ON life_os.clients (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS clients_due_idx ON life_os.clients (due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS animals_due_idx ON life_os.animals (next_care_due) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS tasks_due_idx ON life_os.tasks (deadline) WHERE deleted_at IS NULL AND status <> 'Done';
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON life_os.sessions (expires_at);

DROP TRIGGER IF EXISTS clients_version ON life_os.clients;
CREATE TRIGGER clients_version BEFORE UPDATE ON life_os.clients
  FOR EACH ROW EXECUTE FUNCTION life_os.bump_version();

DROP TRIGGER IF EXISTS animals_version ON life_os.animals;
CREATE TRIGGER animals_version BEFORE UPDATE ON life_os.animals
  FOR EACH ROW EXECUTE FUNCTION life_os.bump_version();

DROP TRIGGER IF EXISTS tasks_version ON life_os.tasks;
CREATE TRIGGER tasks_version BEFORE UPDATE ON life_os.tasks
  FOR EACH ROW EXECUTE FUNCTION life_os.bump_version();
