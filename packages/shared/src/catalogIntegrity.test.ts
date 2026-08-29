import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EMERGENCY_TYPES, SERVICE_CATALOG } from './constants';

/**
 * Katalog di berkas ini adalah konstanta TypeScript, sementara nilai yang
 * sama juga dikunci oleh CHECK constraint di basis data. Keduanya sudah
 * pernah lepas sinkron: `kelahiran`/`kematian` ditambahkan ke
 * `SERVICE_CATALOG` dan ke constraint DB, tapi tidak ke
 * `supabase/functions/_shared/servicePdf.ts` — akibatnya warga bisa
 * mengajukan dua jenis surat yang PDF-nya tidak akan pernah bisa terbit.
 *
 * Uji ini membaca constraint langsung dari berkas migrasi (teks biasa) dan
 * membandingkannya dengan katalog, jadi penambahan jenis baru yang lupa
 * disebar ke semua tempat langsung gagal di CI.
 */
const MIGRATIONS_DIR = join(__dirname, '../../../supabase/migrations');

function readAllMigrations(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
    .join('\n');
}

/** Mengambil daftar nilai dari CHECK (<column> IN ('a','b',...)) TERAKHIR untuk kolom itu. */
function checkConstraintValues(sql: string, column: string): string[] {
  const pattern = new RegExp(`CHECK\\s*\\(\\s*${column}\\s+IN\\s*\\(([^)]*)\\)`, 'gi');
  let last: RegExpExecArray | null = null;
  for (let m = pattern.exec(sql); m !== null; m = pattern.exec(sql)) last = m;
  if (!last) throw new Error(`CHECK constraint untuk kolom "${column}" tidak ditemukan di migrasi`);
  return [...last[1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!).sort();
}

describe('katalog konstanta vs CHECK constraint basis data', () => {
  const sql = readAllMigrations();

  it('SERVICE_CATALOG cocok dengan service_requests.service_type', () => {
    expect(SERVICE_CATALOG.map((s) => s.id).sort()).toEqual(
      checkConstraintValues(sql, 'service_type'),
    );
  });

  it('EMERGENCY_TYPES cocok dengan emergency_alerts.emergency_type', () => {
    expect(EMERGENCY_TYPES.map((e) => e.id).sort()).toEqual(
      checkConstraintValues(sql, 'emergency_type'),
    );
  });
});
