CREATE EXTENSION IF NOT EXISTS "vector";         -- kemiripan semantik
CREATE EXTENSION IF NOT EXISTS "cube";           -- prasyarat earthdistance
CREATE EXTENSION IF NOT EXISTS "earthdistance";  -- radius geografis
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- pencarian teks toleran salah ketik
CREATE EXTENSION IF NOT EXISTS "citext";         -- email case-insensitive
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- gen_random_uuid, digest
