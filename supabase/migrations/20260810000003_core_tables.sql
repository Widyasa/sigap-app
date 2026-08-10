CREATE TYPE user_role AS ENUM (
  'citizen', 'verifier', 'dinas_staff', 'dinas_head', 'emergency_operator', 'admin'
);

CREATE TABLE dinas (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  categories     TEXT[] NOT NULL DEFAULT '{}',
  contact_phone  TEXT,
  contact_email  TEXT,
  head_name      TEXT,
  sla_hours_p0   INT NOT NULL DEFAULT 24,
  sla_hours_p1   INT NOT NULL DEFAULT 72,
  sla_hours_p2   INT NOT NULL DEFAULT 168
);

-- CATATAN v2.0: profiles.id sekarang menunjuk ke public.users, BUKAN auth.users.
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  phone       TEXT,                     -- opsional, tidak dipakai untuk login
  avatar_url  TEXT,
  role        user_role NOT NULL DEFAULT 'citizen',
  dinas_id    TEXT REFERENCES dinas(id),
  kelurahan   TEXT,
  kecamatan   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX profiles_kelurahan_idx ON profiles (kelurahan);

CREATE TABLE complaints (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title             TEXT,
  description       TEXT NOT NULL,
  category          TEXT,
  assigned_dinas    TEXT REFERENCES dinas(id),
  urgency           TEXT CHECK (urgency IN ('P0','P1','P2')),
  ai_summary        TEXT,
  ai_confidence     REAL CHECK (ai_confidence BETWEEN 0 AND 1),
  location_lat      DOUBLE PRECISION NOT NULL,
  location_lng      DOUBLE PRECISION NOT NULL,
  location_address  TEXT,
  kelurahan         TEXT,
  kecamatan         TEXT,
  status            TEXT NOT NULL DEFAULT 'pending_classification'
                    CHECK (status IN ('pending_classification','pending','verified',
                                      'in_progress','resolved','rejected')),
  rejection_reason  TEXT,
  upvote_count      INT NOT NULL DEFAULT 0,
  image_urls        TEXT[] NOT NULL DEFAULT '{}',
  embedding         VECTOR(384),
  duplicate_of      UUID REFERENCES complaints(id),
  sla_due_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ
);

CREATE INDEX complaints_geo_idx
  ON complaints USING GIST (ll_to_earth(location_lat, location_lng));
CREATE INDEX complaints_status_idx    ON complaints (status);
CREATE INDEX complaints_dinas_idx     ON complaints (assigned_dinas);
CREATE INDEX complaints_user_idx      ON complaints (user_id, created_at DESC);
CREATE INDEX complaints_kelurahan_idx ON complaints (kelurahan);
CREATE INDEX complaints_embedding_idx
  ON complaints USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE complaint_timeline (
  id           BIGSERIAL PRIMARY KEY,
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  actor_id     UUID REFERENCES profiles(id),
  event_type   TEXT NOT NULL,   -- created | ai_classified | verified | rejected
                                -- | assigned | in_progress | progress_photo
                                -- | resolved | reopened | citizen_comment
  note         TEXT,
  photo_urls   TEXT[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX complaint_timeline_complaint_idx
  ON complaint_timeline (complaint_id, created_at DESC);

CREATE TABLE complaint_upvotes (
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (complaint_id, user_id)
);
