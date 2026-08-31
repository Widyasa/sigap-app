-- Periode voting bawaan seed.sql sudah kedaluwarsa (ends_at di masa lalu),
-- sehingga policy votes_insert_own menolak setiap suara baru.
-- Perpanjang periode voting aktif bawaan agar demo tetap bisa dipakai.
UPDATE voting_periods
SET starts_at = NOW() - INTERVAL '1 DAY',
    ends_at = NOW() + INTERVAL '14 DAYS',
    is_active = TRUE
WHERE id = 'dddddddd-0000-0000-0000-000000000000';
