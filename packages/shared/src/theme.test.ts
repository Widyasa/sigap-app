import { describe, it, expect } from 'vitest';
import { colors, urgencyColor, statusColor, typography, spacing } from './theme';

describe('theme', () => {
  it('primary di mode gelap lebih terang daripada mode terang', () => {
    expect(colors.light.primary).toBe('#0F4C5C');
    expect(colors.dark.primary).toBe('#2DD4BF');
  });

  it('urgensi P0 memakai merah, bukan warna brand', () => {
    const p0 = urgencyColor('P0', 'light');
    expect(p0.fg).toBe('#DC2626');
    expect(p0.fg).not.toBe(colors.light.primary);
  });

  it('setiap status punya pasangan warna di kedua mode', () => {
    const statuses = ['pending_classification','pending','verified',
                      'in_progress','resolved','rejected'] as const;
    for (const s of statuses) {
      for (const m of ['light','dark'] as const) {
        const c = statusColor(s, m);
        expect(c.fg).toMatch(/^#[0-9A-F]{6}$/i);
        expect(c.bg).toMatch(/^#[0-9A-F]{6}$/i);
      }
    }
  });

  it('body tidak pernah di bawah 16px', () => {
    expect(typography.body.fontSize).toBeGreaterThanOrEqual(16);
  });

  it('spacing memakai kelipatan 4', () => {
    expect(spacing(1)).toBe(4);
    expect(spacing(4)).toBe(16);
  });
});
