-- ===== M3 ANGGARAN (dibuat lebih dulu: direferensikan aspirations) =====
CREATE TABLE budget_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year       INT NOT NULL,
  dinas_id          TEXT REFERENCES dinas(id),
  program_name      TEXT NOT NULL,
  activity_name     TEXT,
  budget_allocated  BIGINT NOT NULL CHECK (budget_allocated >= 0),
  budget_realized   BIGINT NOT NULL DEFAULT 0 CHECK (budget_realized >= 0),
  location_lat      DOUBLE PRECISION,
  location_lng      DOUBLE PRECISION,
  location_address  TEXT,
  kelurahan         TEXT,
  kecamatan         TEXT,
  progress_percent  SMALLINT NOT NULL DEFAULT 0
                    CHECK (progress_percent BETWEEN 0 AND 100),
  contractor        TEXT,
  photo_urls        TEXT[] NOT NULL DEFAULT '{}',
  embedding         VECTOR(384),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX budget_items_year_dinas_idx ON budget_items (fiscal_year, dinas_id);
CREATE INDEX budget_items_kelurahan_idx  ON budget_items (kelurahan);
CREATE INDEX budget_items_embedding_idx
  ON budget_items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ===== M2 ASPIRASI =====
CREATE TABLE voting_periods (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  fiscal_year  INT NOT NULL,
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (ends_at > starts_at)
);

CREATE TABLE aspirations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title                   TEXT NOT NULL,
  description             TEXT NOT NULL,
  category                TEXT,
  estimated_beneficiaries INT CHECK (estimated_beneficiaries > 0),
  estimated_cost          BIGINT,
  location_lat            DOUBLE PRECISION,
  location_lng            DOUBLE PRECISION,
  kelurahan               TEXT NOT NULL,
  kecamatan               TEXT NOT NULL,
  vote_count              INT NOT NULL DEFAULT 0,
  status                  TEXT NOT NULL DEFAULT 'voting'
                          CHECK (status IN ('voting','musrenbang','approved',
                                            'budgeted','realized','rejected')),
  musrenbang_rank         INT,
  linked_budget_item_id   UUID REFERENCES budget_items(id),
  voting_period_id        UUID REFERENCES voting_periods(id),
  image_urls              TEXT[] NOT NULL DEFAULT '{}',
  embedding               VECTOR(384),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX aspirations_kelurahan_idx ON aspirations (kelurahan, status);
CREATE INDEX aspirations_period_idx    ON aspirations (voting_period_id, vote_count DESC);

CREATE TABLE aspiration_votes (
  aspiration_id UUID NOT NULL REFERENCES aspirations(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (aspiration_id, user_id)
);

-- ===== M4 LAYANAN =====
CREATE TABLE service_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_type      TEXT NOT NULL
                    CHECK (service_type IN ('domisili','sktm','pengantar_nikah',
                                            'izin_keramaian','usaha')),
  form_data         JSONB NOT NULL,
  document_urls     TEXT[] NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'submitted'
                    CHECK (status IN ('submitted','verifying','signing','ready',
                                      'rejected','collected')),
  rejection_reason  TEXT,
  handled_by        UUID REFERENCES profiles(id),
  output_pdf_url    TEXT,
  verification_code TEXT UNIQUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX service_requests_user_idx   ON service_requests (user_id, created_at DESC);
CREATE INDEX service_requests_status_idx ON service_requests (status);

-- ===== M5 DARURAT =====
CREATE TABLE emergency_alerts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emergency_type   TEXT NOT NULL
                   CHECK (emergency_type IN ('fire','medical','flood','crime','tree','other')),
  location_lat     DOUBLE PRECISION NOT NULL,
  location_lng     DOUBLE PRECISION NOT NULL,
  location_address TEXT,
  audio_url        TEXT,
  note             TEXT,
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','responding','resolved','false_alarm')),
  responded_by     UUID REFERENCES profiles(id),
  responded_at     TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX emergency_active_idx ON emergency_alerts (status, created_at DESC);

-- ===== M6 INFO & KOMUNITAS =====
CREATE TABLE point_ledger (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points     INT NOT NULL,          -- boleh negatif untuk pembatalan
  reason     TEXT NOT NULL,         -- report_created | report_verified | ...
  ref_table  TEXT,
  ref_id     UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX point_ledger_user_idx ON point_ledger (user_id, created_at DESC);

CREATE TABLE announcements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  dinas_id     TEXT REFERENCES dinas(id),
  kelurahan    TEXT,                -- NULL berarti berlaku untuk seluruh wilayah
  image_url    TEXT,
  is_pinned    BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ,
  created_by   UUID REFERENCES profiles(id)
);

CREATE INDEX announcements_published_idx
  ON announcements (published_at DESC);
