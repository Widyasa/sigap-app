import { assertEquals, assertThrows } from 'jsr:@std/assert';
import { parseClassification, computeSlaDueAt, type DinasRow } from './classification.ts';

const DINAS_LIST: DinasRow[] = [
  {
    id: 'pupr',
    name: 'Dinas Pekerjaan Umum & Penataan Ruang',
    categories: ['jalan_rusak', 'jembatan'],
    slaHoursP0: 24,
    slaHoursP1: 72,
    slaHoursP2: 168,
  },
  {
    id: 'lainnya',
    name: 'Belum Terklasifikasi',
    categories: ['lainnya'],
    slaHoursP0: 24,
    slaHoursP1: 72,
    slaHoursP2: 168,
  },
];

Deno.test('parseClassification menerima respons valid', () => {
  const raw = JSON.stringify({
    title: 'Jalan berlubang di depan pasar',
    category: 'jalan_rusak',
    assignedDinas: 'pupr',
    urgency: 'P1',
    summary: 'Ada lubang besar yang membahayakan pengendara motor.',
    confidence: 0.92,
  });
  const result = parseClassification(raw, DINAS_LIST);
  assertEquals(result.title, 'Jalan berlubang di depan pasar');
  assertEquals(result.category, 'jalan_rusak');
  assertEquals(result.assignedDinas, 'pupr');
  assertEquals(result.urgency, 'P1');
  assertEquals(result.confidence, 0.92);
});

Deno.test('parseClassification menolak JSON tidak valid', () => {
  assertThrows(() => parseClassification('bukan json', DINAS_LIST));
});

Deno.test('parseClassification menolak dinas di luar katalog', () => {
  const raw = JSON.stringify({
    title: 'x', category: 'jalan_rusak', assignedDinas: 'dinas_hantu',
    urgency: 'P1', summary: 'y', confidence: 0.5,
  });
  assertThrows(() => parseClassification(raw, DINAS_LIST));
});

Deno.test('parseClassification menolak kategori yang tidak ditangani dinas tsb', () => {
  const raw = JSON.stringify({
    title: 'x', category: 'sampah', assignedDinas: 'pupr',
    urgency: 'P1', summary: 'y', confidence: 0.5,
  });
  assertThrows(() => parseClassification(raw, DINAS_LIST));
});

Deno.test('parseClassification menolak urgensi di luar P0/P1/P2', () => {
  const raw = JSON.stringify({
    title: 'x', category: 'jalan_rusak', assignedDinas: 'pupr',
    urgency: 'P9', summary: 'y', confidence: 0.5,
  });
  assertThrows(() => parseClassification(raw, DINAS_LIST));
});

Deno.test('parseClassification mem-clamp confidence ke rentang 0..1', () => {
  const raw = JSON.stringify({
    title: 'x', category: 'jalan_rusak', assignedDinas: 'pupr',
    urgency: 'P1', summary: 'y', confidence: 1.5,
  });
  const result = parseClassification(raw, DINAS_LIST);
  assertEquals(result.confidence, 1);
});

Deno.test('parseClassification menerima dinas "lainnya" sebagai fallback', () => {
  const raw = JSON.stringify({
    title: 'x', category: 'lainnya', assignedDinas: 'lainnya',
    urgency: 'P2', summary: 'y', confidence: 0.3,
  });
  const result = parseClassification(raw, DINAS_LIST);
  assertEquals(result.assignedDinas, 'lainnya');
});

Deno.test('computeSlaDueAt menghitung tenggat sesuai urgensi', () => {
  const from = new Date('2026-01-01T00:00:00Z');
  assertEquals(computeSlaDueAt(DINAS_LIST[0], 'P0', from).toISOString(), '2026-01-02T00:00:00.000Z');
  assertEquals(computeSlaDueAt(DINAS_LIST[0], 'P1', from).toISOString(), '2026-01-04T00:00:00.000Z');
  assertEquals(computeSlaDueAt(DINAS_LIST[0], 'P2', from).toISOString(), '2026-01-08T00:00:00.000Z');
});
