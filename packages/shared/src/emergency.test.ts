import { describe, it, expect } from 'vitest';
import { formatTimeSince } from './emergency';

const CREATED = '2026-01-01T00:00:00.000Z';

describe('formatTimeSince', () => {
  it('menampilkan "baru saja" untuk kurang dari satu menit', () => {
    const now = new Date('2026-01-01T00:00:30.000Z');
    expect(formatTimeSince(CREATED, now)).toBe('baru saja');
  });

  it('menampilkan menit saja untuk kurang dari satu jam', () => {
    const now = new Date('2026-01-01T00:05:00.000Z');
    expect(formatTimeSince(CREATED, now)).toBe('5 menit lalu');
  });

  it('menampilkan jam dan menit untuk kurang dari satu hari', () => {
    const now = new Date('2026-01-01T02:30:00.000Z');
    expect(formatTimeSince(CREATED, now)).toBe('2 jam 30 menit lalu');
  });

  it('menampilkan jam genap tanpa menit saat pas', () => {
    const now = new Date('2026-01-01T03:00:00.000Z');
    expect(formatTimeSince(CREATED, now)).toBe('3 jam lalu');
  });

  it('menampilkan hari dan jam untuk lebih dari satu hari', () => {
    const now = new Date('2026-01-02T05:00:00.000Z');
    expect(formatTimeSince(CREATED, now)).toBe('1 hari 5 jam lalu');
  });

  it('menampilkan hari genap tanpa jam saat pas', () => {
    const now = new Date('2026-01-03T00:00:00.000Z');
    expect(formatTimeSince(CREATED, now)).toBe('2 hari lalu');
  });

  it('tidak pernah negatif walau now sebelum created (clock skew)', () => {
    const now = new Date('2025-12-31T23:00:00.000Z');
    expect(formatTimeSince(CREATED, now)).toBe('baru saja');
  });
});
