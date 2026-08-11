import { describe, it, expect } from 'vitest';
import { groupPointLedgerByRef, type PointLedgerEntryLike } from './points';

function entry(overrides: Partial<PointLedgerEntryLike>): PointLedgerEntryLike {
  return {
    id: 1,
    points: 10,
    reason: 'report_created',
    refTable: null,
    refId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('groupPointLedgerByRef', () => {
  it('mengelompokkan report_created dan report_false yang mereferensikan aduan yang sama', () => {
    const created = entry({
      id: 1, points: 10, reason: 'report_created',
      refTable: 'complaints', refId: 'c1', createdAt: '2026-01-01T00:00:00.000Z',
    });
    const reversed = entry({
      id: 2, points: -35, reason: 'report_false',
      refTable: 'complaints', refId: 'c1', createdAt: '2026-01-02T00:00:00.000Z',
    });

    const groups = groupPointLedgerByRef([created, reversed]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.hasReversal).toBe(true);
    expect(groups[0]!.netPoints).toBe(-25);
    // Terbaru dulu di dalam grup.
    expect(groups[0]!.entries.map((e) => e.id)).toEqual([2, 1]);
  });

  it('tidak menggabungkan entri dari aduan yang berbeda meski reason sama', () => {
    const a = entry({ id: 1, refTable: 'complaints', refId: 'c1' });
    const b = entry({ id: 2, refTable: 'complaints', refId: 'c2' });

    const groups = groupPointLedgerByRef([a, b]);

    expect(groups).toHaveLength(2);
    expect(groups.every((g) => !g.hasReversal)).toBe(true);
  });

  it('memberi grup tersendiri per entri tanpa referensi (mis. upvote_given)', () => {
    const u1 = entry({ id: 1, reason: 'upvote_given', points: 2, refTable: null, refId: null });
    const u2 = entry({ id: 2, reason: 'upvote_given', points: 2, refTable: null, refId: null });

    const groups = groupPointLedgerByRef([u1, u2]);

    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.entries.length === 1)).toBe(true);
  });

  it('mengurutkan grup berdasarkan entri terbarunya', () => {
    const older = entry({ id: 1, refTable: 'complaints', refId: 'c1', createdAt: '2026-01-01T00:00:00.000Z' });
    const newer = entry({ id: 2, refTable: 'complaints', refId: 'c2', createdAt: '2026-01-05T00:00:00.000Z' });

    const groups = groupPointLedgerByRef([older, newer]);

    expect(groups.map((g) => g.key)).toEqual(['complaints:c2', 'complaints:c1']);
  });
});
