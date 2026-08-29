import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SERVICE_CATALOG } from './constants';
import {
  SERVICE_LETTER_FIELDS,
  isValidNik,
  missingLetterFields,
  type ServiceTypeId,
} from './serviceLetterFields';

/**
 * `servicePdf.ts` berjalan di Deno dan tidak bisa mengimpor paket ini, jadi
 * kecocokan keduanya dijaga dengan membaca `FIELD_LABELS` langsung dari
 * berkasnya. Persis kelas cacat inilah yang membuat setiap surat terbit
 * dengan seluruh isian bernilai "-".
 */
const SERVICE_PDF = join(__dirname, '../../../supabase/functions/_shared/servicePdf.ts');

function fieldLabelKeysFromEdgeFunction(): Record<string, string[]> {
  const src = readFileSync(SERVICE_PDF, 'utf8');
  const start = src.indexOf('const FIELD_LABELS');
  expect(start, 'FIELD_LABELS tidak ditemukan di servicePdf.ts').toBeGreaterThan(-1);
  const end = src.indexOf('\n};', start);
  const block = src.slice(start, end);

  const result: Record<string, string[]> = {};
  // Setiap entri: `  domisili: {\n    fullName: 'Nama', nik: 'NIK', ...\n  },`
  for (const m of block.matchAll(/\n {2}(\w+): \{([\s\S]*?)\n {2}\},/g)) {
    result[m[1]!] = [...m[2]!.matchAll(/(\w+):\s*'/g)].map((k) => k[1]!);
  }
  return result;
}

describe('SERVICE_LETTER_FIELDS', () => {
  const fromEdge = fieldLabelKeysFromEdgeFunction();

  it('mencakup setiap jenis layanan di katalog', () => {
    expect(Object.keys(SERVICE_LETTER_FIELDS).sort()).toEqual(
      SERVICE_CATALOG.map((s) => s.id).sort(),
    );
  });

  it('key-nya sama persis dengan FIELD_LABELS di servicePdf.ts', () => {
    for (const service of SERVICE_CATALOG) {
      const formKeys = SERVICE_LETTER_FIELDS[service.id]!.map((f) => f.key).sort();
      expect(fromEdge[service.id], `FIELD_LABELS.${service.id}`).toBeDefined();
      expect(formKeys, `isian surat ${service.id}`).toEqual(fromEdge[service.id]!.sort());
    }
  });

  it('setiap isian punya label dan key unik', () => {
    for (const [id, fields] of Object.entries(SERVICE_LETTER_FIELDS)) {
      const keys = fields.map((f) => f.key);
      expect(new Set(keys).size, `key duplikat di ${id}`).toBe(keys.length);
      expect(fields.every((f) => f.label.length > 0)).toBe(true);
    }
  });
});

describe('missingLetterFields', () => {
  const id: ServiceTypeId = 'domisili';

  it('melaporkan seluruh isian saat form kosong', () => {
    expect(missingLetterFields(id, {}).map((f) => f.key)).toEqual([
      'fullName',
      'nik',
      'address',
      'purpose',
    ]);
  });

  it('spasi saja tetap dihitung kosong', () => {
    expect(missingLetterFields(id, { fullName: '   ' }).map((f) => f.key)).toContain('fullName');
  });

  it('kosong saat semua terisi', () => {
    expect(
      missingLetterFields(id, {
        fullName: 'Budi',
        nik: '3273010101990001',
        address: 'Jl. Merdeka 10',
        purpose: 'Pendaftaran sekolah',
      }),
    ).toEqual([]);
  });
});

describe('isValidNik', () => {
  it('menerima 16 digit', () => {
    expect(isValidNik('3273010101990001')).toBe(true);
    expect(isValidNik(' 3273010101990001 ')).toBe(true);
  });

  it('menolak panjang salah atau ada huruf', () => {
    expect(isValidNik('327301010199000')).toBe(false);
    expect(isValidNik('32730101019900012')).toBe(false);
    expect(isValidNik('32730101019900A1')).toBe(false);
    expect(isValidNik('')).toBe(false);
  });
});
