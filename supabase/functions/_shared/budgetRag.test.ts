import { assert, assertEquals, assertThrows } from 'jsr:@std/assert';
import { buildBudgetRagPrompt, parseBudgetRagResponse, type BudgetRagItem } from './budgetRag.ts';

const ITEMS: BudgetRagItem[] = [
  {
    id: 'item-1',
    programName: 'Perbaikan Drainase Jalan Merdeka',
    activityName: 'Normalisasi saluran air',
    dinasId: 'pupr',
    budgetAllocated: 1500000000,
    budgetRealized: 900000000,
    kelurahan: 'Sukamaju',
    progressPercent: 60,
  },
  {
    id: 'item-2',
    programName: 'Renovasi Puskesmas Ciumbuleuit',
    activityName: null,
    dinasId: 'dinkes',
    budgetAllocated: 6800000000,
    budgetRealized: 3400000000,
    kelurahan: 'Ciumbuleuit',
    progressPercent: 50,
  },
];

Deno.test('buildBudgetRagPrompt menyertakan seluruh data item apa adanya', () => {
  const prompt = buildBudgetRagPrompt('Berapa anggaran drainase Jalan Merdeka?', ITEMS);
  assert(prompt.includes('Perbaikan Drainase Jalan Merdeka'));
  assert(prompt.includes('1500000000'));
  assert(prompt.includes('900000000'));
  assert(prompt.includes('item-1'));
  assert(prompt.includes('Renovasi Puskesmas Ciumbuleuit'));
  assert(prompt.includes('6800000000'));
  assert(prompt.includes('item-2'));
  assert(prompt.includes('Berapa anggaran drainase Jalan Merdeka?'));
});

Deno.test('parseBudgetRagResponse menerima respons JSON yang valid', () => {
  const raw = JSON.stringify({
    answer: 'Anggaran drainase Jalan Merdeka adalah Rp 1.500.000.000.',
    citedItemIds: ['item-1'],
  });
  const result = parseBudgetRagResponse(raw, ['item-1', 'item-2']);
  assertEquals(result.answer, 'Anggaran drainase Jalan Merdeka adalah Rp 1.500.000.000.');
  assertEquals(result.citedItemIds, ['item-1']);
});

Deno.test('parseBudgetRagResponse membuang citedItemIds di luar konteks (anti-fabrikasi)', () => {
  const raw = JSON.stringify({
    answer: 'Jawaban dengan id yang tidak ada dalam konteks.',
    citedItemIds: ['item-1', 'item-hantu'],
  });
  const result = parseBudgetRagResponse(raw, ['item-1', 'item-2']);
  assertEquals(result.citedItemIds, ['item-1']);
});

Deno.test('parseBudgetRagResponse mengembalikan citedItemIds kosong bila semua id tidak valid', () => {
  const raw = JSON.stringify({
    answer: 'Jawaban tanpa kutipan valid.',
    citedItemIds: ['item-hantu-1', 'item-hantu-2'],
  });
  const result = parseBudgetRagResponse(raw, ['item-1', 'item-2']);
  assertEquals(result.citedItemIds, []);
});

Deno.test('parseBudgetRagResponse menolak JSON tidak valid', () => {
  assertThrows(() => parseBudgetRagResponse('bukan json', ['item-1']));
});

Deno.test('parseBudgetRagResponse menolak respons tanpa field answer', () => {
  const raw = JSON.stringify({ citedItemIds: ['item-1'] });
  assertThrows(() => parseBudgetRagResponse(raw, ['item-1']));
});

Deno.test('parseBudgetRagResponse menganggap citedItemIds hilang sebagai daftar kosong', () => {
  const raw = JSON.stringify({ answer: 'Tidak ada data yang cocok untuk pertanyaan ini.' });
  const result = parseBudgetRagResponse(raw, ['item-1']);
  assertEquals(result.citedItemIds, []);
});
