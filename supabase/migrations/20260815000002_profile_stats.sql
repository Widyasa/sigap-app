-- RPC untuk mengambil ringkasan profil warga dalam satu panggilan.
CREATE OR REPLACE FUNCTION get_profile_stats(target_user UUID)
RETURNS TABLE (
  total_points INT,
  kelurahan_rank INT,
  complaint_count BIGINT,
  aspiration_count BIGINT,
  upvote_count BIGINT,
  joined_at TIMESTAMPTZ
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT SUM(points) FROM point_ledger WHERE user_id = target_user), 0)::INT AS total_points,
    COALESCE((
      SELECT r.rank FROM (
        SELECT user_id, RANK() OVER (ORDER BY total_points DESC) AS rank
        FROM citizen_leaderboard
        WHERE kelurahan = (SELECT kelurahan FROM profiles WHERE id = target_user)
      ) r
      WHERE r.user_id = target_user
    ), 0)::INT AS kelurahan_rank,
    (SELECT COUNT(*) FROM complaints WHERE user_id = target_user) AS complaint_count,
    (SELECT COUNT(*) FROM aspirations WHERE user_id = target_user) AS aspiration_count,
    (SELECT COUNT(*) FROM complaint_upvotes WHERE user_id = target_user) AS upvote_count,
    (SELECT email_verified_at FROM users WHERE id = target_user) AS joined_at;
$$;

GRANT EXECUTE ON FUNCTION get_profile_stats(UUID) TO authenticated, anon;
