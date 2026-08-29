import { assert, assertEquals, assertMatch, assertNotEquals } from 'jsr:@std/assert';
import {
  generateVerificationCode,
  buildVerificationUrl,
  formatLetterFields,
  SERVICE_TITLES,
} from './servicePdf.ts';

Deno.test('generateVerificationCode menghasilkan kode 10 karakter alfanumerik unik', () => {
  const a = generateVerificationCode();
  const b = generateVerificationCode();
  assertEquals(a.length, 10);
  assertMatch(a, /^[0-9A-F]{10}$/);
  assertNotEquals(a, b);
});

Deno.test('buildVerificationUrl menautkan kode ke rute /verify/<code>', () => {
  const url = buildVerificationUrl('https://sigap.example.com', 'ABC1234567');
  assertEquals(url, 'https://sigap.example.com/verify/ABC1234567');
});

Deno.test('buildVerificationUrl menghapus trailing slash pada base URL', () => {
  const url = buildVerificationUrl('https://sigap.example.com/', 'ABC1234567');
  assertEquals(url, 'https://sigap.example.com/verify/ABC1234567');
});

Deno.test('formatLetterFields domisili memakai label baku dan mengisi "-" untuk field kosong', () => {
  const fields = formatLetterFields('domisili', { fullName: 'Budi', nik: '123' });
  assertEquals(fields.find((f) => f.label === 'Nama')?.value, 'Budi');
  assertEquals(fields.find((f) => f.label === 'Keperluan')?.value, '-');
});

Deno.test('formatLetterFields izin_keramaian memakai katalog field izin_keramaian, bukan domisili', () => {
  const fields = formatLetterFields('izin_keramaian', { eventName: 'Konser Warga' });
  assert(fields.some((f) => f.label === 'Nama Acara' && f.value === 'Konser Warga'));
  assert(!fields.some((f) => f.label === 'Keperluan'));
});

Deno.test('formatLetterFields mengabaikan value non-string (mis. angka) sebagai "-"', () => {
  const fields = formatLetterFields('domisili', { fullName: 42 as unknown as string });
  assertEquals(fields.find((f) => f.label === 'Nama')?.value, '-');
});

Deno.test('SERVICE_TITLES mencakup seluruh 7 service_type dari CHECK constraint DB', () => {
  // Daftar ini harus persis sama dengan SERVICE_CATALOG
  // (packages/shared/src/constants.ts) dan CHECK constraint
  // `service_requests_service_type_check` sesudah
  // 20260814000001_extend_service_catalog.sql.
  const keys = Object.keys(SERVICE_TITLES).sort();
  assertEquals(keys, [
    'domisili',
    'izin_keramaian',
    'kelahiran',
    'kematian',
    'pengantar_nikah',
    'sktm',
    'usaha',
  ]);
});

Deno.test('formatLetterFields tidak melempar untuk kelahiran/kematian', () => {
  for (const t of ['kelahiran', 'kematian'] as const) {
    const fields = formatLetterFields(t, {});
    assertEquals(fields.length > 0, true);
    assertEquals(fields.every((f) => f.value === '-'), true);
  }
});


Deno.test('formatLetterFields menerima key berprefiks ktp_/kk_ (bentuk penyimpanan formData UI warga)', () => {
  const fields = formatLetterFields('domisili', {
    ktp_fullName: 'Budi Santoso',
    ktp_nik: '3273010101990001',
    ktp_address: 'Jl. Merdeka No. 10',
  });
  assertEquals(fields.find((f) => f.label === 'Nama')?.value, 'Budi Santoso');
  assertEquals(fields.find((f) => f.label === 'NIK')?.value, '3273010101990001');
  assertEquals(fields.find((f) => f.label === 'Alamat')?.value, 'Jl. Merdeka No. 10');
});

Deno.test('formatLetterFields memprioritaskan key polos di atas key berprefiks bila keduanya ada', () => {
  const fields = formatLetterFields('domisili', { fullName: 'Nama Polos', ktp_fullName: 'Nama Prefiks' });
  assertEquals(fields.find((f) => f.label === 'Nama')?.value, 'Nama Polos');
});