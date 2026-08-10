ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_otp_codes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE dinas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints         ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_upvotes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE aspirations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE aspiration_votes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE voting_periods     ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_alerts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_ledger       ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements      ENABLE ROW LEVEL SECURITY;

-- Fungsi bantu. SECURITY DEFINER agar tidak memicu rekursi policy pada profiles.
CREATE OR REPLACE FUNCTION current_role_name() RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION current_dinas_id() RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT dinas_id FROM profiles WHERE id = auth.uid();
$$;

-- ---------- users: hanya pemilik, dan hanya baca ----------
CREATE POLICY users_self_read ON users FOR SELECT
  USING (id = auth.uid());
CREATE POLICY users_admin_read ON users FOR SELECT
  USING (current_role_name() = 'admin');
-- Tidak ada policy INSERT/UPDATE/DELETE. Baris users hanya ditulis oleh
-- find_or_create_user() lewat service role key di dalam Edge Function.

-- ---------- auth_otp_codes: TIDAK ADA POLICY SAMA SEKALI ----------
-- RLS aktif tanpa policy = tidak ada satu pun klien yang dapat menyentuhnya,
-- termasuk untuk membaca. Ini disengaja (aturan T4). Hanya service role
-- yang boleh, dan itu hanya terjadi di dalam Edge Function auth-*.

-- ---------- auth_sessions: pemilik boleh melihat & mencabut perangkatnya ----------
CREATE POLICY sessions_self_read ON auth_sessions FOR SELECT
  USING (user_id = auth.uid());
-- Pencabutan dilakukan lewat Edge Function auth-signout, bukan UPDATE langsung,
-- agar rotasi & alasan pencabutan tercatat konsisten.

-- ---------- dinas ----------
CREATE POLICY dinas_read ON dinas FOR SELECT USING (true);
CREATE POLICY dinas_admin_write ON dinas FOR ALL
  USING (current_role_name() = 'admin') WITH CHECK (current_role_name() = 'admin');

-- ---------- profiles ----------
CREATE POLICY profiles_read ON profiles FOR SELECT USING (true);
CREATE POLICY profiles_self_update ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = current_role_name());  -- role terkunci
CREATE POLICY profiles_admin_all ON profiles FOR ALL
  USING (current_role_name() = 'admin') WITH CHECK (current_role_name() = 'admin');

-- ---------- complaints ----------
CREATE POLICY complaints_read ON complaints FOR SELECT USING (true);
CREATE POLICY complaints_insert_own ON complaints FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY complaints_owner_update ON complaints FOR UPDATE
  USING (user_id = auth.uid() AND status IN ('pending_classification','pending'))
  WITH CHECK (user_id = auth.uid());
CREATE POLICY complaints_verifier_update ON complaints FOR UPDATE
  USING (current_role_name() IN ('verifier','admin'))
  WITH CHECK (current_role_name() IN ('verifier','admin'));
CREATE POLICY complaints_dinas_update ON complaints FOR UPDATE
  USING (current_role_name() IN ('dinas_staff','dinas_head')
         AND assigned_dinas = current_dinas_id())
  WITH CHECK (current_role_name() IN ('dinas_staff','dinas_head')
         AND assigned_dinas = current_dinas_id());

-- ---------- complaint_timeline ----------
CREATE POLICY timeline_read ON complaint_timeline FOR SELECT USING (true);
CREATE POLICY timeline_insert ON complaint_timeline FOR INSERT
  WITH CHECK (
    actor_id = auth.uid()
    AND ( current_role_name() IN ('verifier','dinas_staff','dinas_head','admin')
          OR EXISTS (SELECT 1 FROM complaints c
                     WHERE c.id = complaint_id AND c.user_id = auth.uid()) )
  );

-- ---------- upvotes: satu warga satu suara ----------
CREATE POLICY upvotes_read ON complaint_upvotes FOR SELECT USING (true);
CREATE POLICY upvotes_insert_own ON complaint_upvotes FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY upvotes_delete_own ON complaint_upvotes FOR DELETE
  USING (user_id = auth.uid());

-- ---------- aspirations ----------
CREATE POLICY aspirations_read ON aspirations FOR SELECT USING (true);
CREATE POLICY aspirations_insert_own ON aspirations FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY aspirations_owner_update ON aspirations FOR UPDATE
  USING (user_id = auth.uid() AND status = 'voting')
  WITH CHECK (user_id = auth.uid());
CREATE POLICY aspirations_admin_update ON aspirations FOR UPDATE
  USING (current_role_name() IN ('admin','dinas_head'))
  WITH CHECK (current_role_name() IN ('admin','dinas_head'));

-- Memilih hanya boleh untuk aspirasi di kelurahan sendiri dan periode aktif.
CREATE POLICY votes_read ON aspiration_votes FOR SELECT USING (true);
CREATE POLICY votes_insert_own ON aspiration_votes FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM aspirations a
      JOIN profiles p ON p.id = auth.uid()
      LEFT JOIN voting_periods vp ON vp.id = a.voting_period_id
      WHERE a.id = aspiration_id
        AND a.kelurahan = p.kelurahan
        AND a.status = 'voting'
        AND (vp.id IS NULL OR (vp.is_active AND NOW() BETWEEN vp.starts_at AND vp.ends_at))
    )
  );
CREATE POLICY votes_delete_own ON aspiration_votes FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY periods_read ON voting_periods FOR SELECT USING (true);
CREATE POLICY periods_admin ON voting_periods FOR ALL
  USING (current_role_name() = 'admin') WITH CHECK (current_role_name() = 'admin');

-- ---------- budget: transparansi penuh, tulis hanya admin ----------
CREATE POLICY budget_read ON budget_items FOR SELECT USING (true);
CREATE POLICY budget_admin_write ON budget_items FOR ALL
  USING (current_role_name() = 'admin') WITH CHECK (current_role_name() = 'admin');

-- ---------- service_requests: PRIVAT, hanya pemilik dan petugas ----------
CREATE POLICY service_owner_read ON service_requests FOR SELECT
  USING (user_id = auth.uid()
         OR current_role_name() IN ('verifier','dinas_staff','dinas_head','admin'));
CREATE POLICY service_insert_own ON service_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY service_staff_update ON service_requests FOR UPDATE
  USING (current_role_name() IN ('verifier','dinas_staff','dinas_head','admin'))
  WITH CHECK (current_role_name() IN ('verifier','dinas_staff','dinas_head','admin'));

-- ---------- emergency: pelapor + operator ----------
CREATE POLICY emergency_read ON emergency_alerts FOR SELECT
  USING (user_id = auth.uid()
         OR current_role_name() IN ('emergency_operator','admin'));
CREATE POLICY emergency_insert_own ON emergency_alerts FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY emergency_operator_update ON emergency_alerts FOR UPDATE
  USING (current_role_name() IN ('emergency_operator','admin'))
  WITH CHECK (current_role_name() IN ('emergency_operator','admin'));

-- ---------- point_ledger: baca publik untuk leaderboard, tulis hanya server ----------
CREATE POLICY points_read ON point_ledger FOR SELECT USING (true);
-- Tidak ada policy INSERT/UPDATE/DELETE. Poin hanya ditulis oleh
-- Edge Function memakai service role key, yang melewati RLS.

-- ---------- announcements ----------
CREATE POLICY announcements_read ON announcements FOR SELECT USING (true);
CREATE POLICY announcements_staff_write ON announcements FOR ALL
  USING (current_role_name() IN ('admin','dinas_head'))
  WITH CHECK (current_role_name() IN ('admin','dinas_head'));
