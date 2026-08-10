import { describe, it, expect } from 'vitest';
import { getSlaStatus, formatSlaCountdown } from './sla';

const CREATED = '2026-01-01T00:00:00.000Z';
const DUE = '2026-01-02T00:00:00.000Z'; // 24 jam total

describe('getSlaStatus', () => {
  it('mengembalikan null saat sla_due_at belum ada (belum diklasifikasi)', () => {
    expect(getSlaStatus(CREATED, null)).toBeNull();
  });

  it('tidak kritis saat sisa waktu masih banyak (50%)', () => {
    const now = new Date('2026-01-01T12:00:00.000Z');
    const status = getSlaStatus(CREATED, DUE, now);
    expect(status?.percentRemaining).toBeCloseTo(0.5, 5);
    expect(status?.isOverdue).toBe(false);
    expect(status?.isCritical).toBe(false);
  });

  it('tidak kritis tepat pada ambang 20% (harus di BAWAH, bukan sama dengan)', () => {
    const now = new Date(new Date(DUE).getTime() - 4.8 * 60 * 60 * 1000);
    const status = getSlaStatus(CREATED, DUE, now);
    expect(status?.percentRemaining).toBeCloseTo(0.2, 5);
    expect(status?.isCritical).toBe(false);
  });

  it('kritis sesaat di bawah ambang 20%', () => {
    const now = new Date(new Date(DUE).getTime() - 4.7 * 60 * 60 * 1000); // ~19.6%
    const status = getSlaStatus(CREATED, DUE, now);
    expect(status!.percentRemaining).toBeLessThan(0.2);
    expect(status?.isCritical).toBe(true);
  });

  it('tidak kritis tepat di atas ambang 20%', () => {
    const now = new Date(new Date(DUE).getTime() - 5 * 60 * 60 * 1000); // 20.8%
    const status = getSlaStatus(CREATED, DUE, now);
    expect(status!.percentRemaining).toBeGreaterThan(0.2);
    expect(status?.isCritical).toBe(false);
  });

  it('overdue saat sudah lewat batas', () => {
    const now = new Date('2026-01-03T00:00:00.000Z');
    const status = getSlaStatus(CREATED, DUE, now);
    expect(status?.isOverdue).toBe(true);
    expect(status?.isCritical).toBe(true);
    expect(status?.percentRemaining).toBe(0);
    expect(status?.remainingMs).toBeLessThan(0);
  });
});

describe('formatSlaCountdown', () => {
  it('menampilkan hari dan jam untuk sisa waktu panjang', () => {
    expect(formatSlaCountdown(26 * 60 * 60 * 1000)).toBe('1 hari 2 jam lagi');
  });

  it('menampilkan jam dan menit untuk sisa waktu menengah', () => {
    expect(formatSlaCountdown(90 * 60 * 1000)).toBe('1 jam 30 menit lagi');
  });

  it('menampilkan menit saja untuk sisa waktu pendek', () => {
    expect(formatSlaCountdown(5 * 60 * 1000)).toBe('5 menit lagi');
  });

  it('menampilkan pesan lewat batas untuk waktu negatif atau nol', () => {
    expect(formatSlaCountdown(0)).toBe('Lewat batas SLA');
    expect(formatSlaCountdown(-1000)).toBe('Lewat batas SLA');
  });
});
