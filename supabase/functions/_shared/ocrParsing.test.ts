import { assert, assertEquals, assertThrows } from 'jsr:@std/assert';
import { buildOcrPrompt, parseOcrResponse, isLowConfidence, LOW_CONFIDENCE_THRESHOLD } from './ocrParsing.ts';

Deno.test('buildOcrPrompt KTP menyertakan seluruh field KTP yang diharapkan', () => {
  const prompt = buildOcrPrompt('ktp');
  assert(prompt.includes('"nik"'));
  assert(prompt.includes('"fullName"'));
  assert(prompt.includes('"kelurahan"'));
  assert(prompt.includes('KTP'));
});

Deno.test('buildOcrPrompt KK menyertakan field KK, bukan field khusus KTP', () => {
  const prompt = buildOcrPrompt('kk');
  assert(prompt.includes('"nomorKK"'));
  assert(prompt.includes('"kepalaKeluarga"'));
  assert(!prompt.includes('"nik"'));
});

Deno.test('parseOcrResponse mem-parsing JSON valid dan menghitung overallConfidence', () => {
  const raw = JSON.stringify({
    fields: {
      nik: { value: '3273010101990001', confidence: 0.95 },
      fullName: { value: 'BUDI SANTOSO', confidence: 0.9 },
      birthPlace: { value: '', confidence: 0 },
      birthDate: { value: '', confidence: 0 },
      gender: { value: '', confidence: 0 },
      address: { value: '', confidence: 0 },
      rt: { value: '', confidence: 0 },
      rw: { value: '', confidence: 0 },
      kelurahan: { value: '', confidence: 0 },
      kecamatan: { value: '', confidence: 0 },
      religion: { value: '', confidence: 0 },
      maritalStatus: { value: '', confidence: 0 },
      occupation: { value: '', confidence: 0 },
    },
  });
  const result = parseOcrResponse(raw, 'ktp');
  assertEquals(result.fields.nik.value, '3273010101990001');
  assertEquals(result.fields.nik.confidence, 0.95);
  // rata-rata hanya dari field berisi nilai: (0.95 + 0.9) / 2
  assertEquals(result.overallConfidence, 0.925);
});

Deno.test('parseOcrResponse mengisi field yang hilang dari model dengan value kosong, confidence 0', () => {
  const raw = JSON.stringify({ fields: { nik: { value: '123', confidence: 0.8 } } });
  const result = parseOcrResponse(raw, 'ktp');
  assertEquals(result.fields.fullName.value, '');
  assertEquals(result.fields.fullName.confidence, 0);
});

Deno.test('parseOcrResponse menjepit confidence di luar rentang [0,1]', () => {
  const raw = JSON.stringify({ fields: { nik: { value: '123', confidence: 5 } } });
  const result = parseOcrResponse(raw, 'ktp');
  assertEquals(result.fields.nik.confidence, 1);
});

Deno.test('parseOcrResponse menolak JSON tidak valid', () => {
  assertThrows(() => parseOcrResponse('bukan json', 'ktp'));
});

Deno.test('parseOcrResponse menolak respons tanpa objek "fields"', () => {
  assertThrows(() => parseOcrResponse(JSON.stringify({ foo: 'bar' }), 'ktp'));
});

Deno.test('parseOcrResponse KK memakai katalog field KK, bukan KTP', () => {
  const raw = JSON.stringify({ fields: { nomorKK: { value: '1234567890123456', confidence: 0.8 } } });
  const result = parseOcrResponse(raw, 'kk');
  assertEquals(result.fields.nomorKK.value, '1234567890123456');
  assertEquals(result.fields.nik, undefined);
});

Deno.test('isLowConfidence true bila rata-rata di bawah ambang', () => {
  const raw = JSON.stringify({ fields: { nik: { value: '123', confidence: 0.2 } } });
  const result = parseOcrResponse(raw, 'ktp');
  assert(result.overallConfidence < LOW_CONFIDENCE_THRESHOLD);
  assert(isLowConfidence(result));
});

Deno.test('isLowConfidence false bila rata-rata di atas ambang', () => {
  const raw = JSON.stringify({ fields: { nik: { value: '123', confidence: 0.9 } } });
  const result = parseOcrResponse(raw, 'ktp');
  assert(!isLowConfidence(result));
});

Deno.test('isLowConfidence true bila tidak ada field terisi sama sekali (overallConfidence 0)', () => {
  const raw = JSON.stringify({ fields: {} });
  const result = parseOcrResponse(raw, 'ktp');
  assertEquals(result.overallConfidence, 0);
  assert(isLowConfidence(result));
});
