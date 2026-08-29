import { describe, expect, it } from 'vitest';
import {
  announcementCategoryColor,
  aspirationStatusColor,
  budgetSectorColor,
  colors,
  emergencyStatusColor,
  pointsColor,
  serviceStatusColor,
  statusColor,
  urgencyColor,
  type ThemeMode,
} from './theme';
import {
  ANNOUNCEMENT_CATEGORIES,
  BUDGET_SECTORS,
  COMPLAINT_STATUSES,
  URGENCY_VALUES,
} from './constants';
import { ASPIRATION_STATUSES, EMERGENCY_STATUSES, SERVICE_STATUSES } from './schemas';

/**
 * Rasio kontras WCAG 2.1 (relative luminance). Badge dan label di kedua
 * aplikasi dirender pada ukuran teks normal (12–14px), jadi ambangnya 4.5:1
 * — bukan 3:1 yang hanya berlaku untuk teks besar.
 *
 * Uji ini ada karena enam dari sembilan pasangan status sebelumnya gagal,
 * yang terburuk 2,84:1 pada `in_progress` — status aduan adalah informasi
 * terpenting di setiap baris antrean petugas.
 */
function relativeLuminance(hex: string): number {
  const c = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((v) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4),
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

const AA_NORMAL = 4.5;
const MODES: ThemeMode[] = ['light', 'dark'];

describe('kontras WCAG AA (teks normal, 4.5:1)', () => {
  it('rumus rasio benar untuk kasus yang diketahui', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  for (const mode of MODES) {
    const c = colors[mode];

    it(`[${mode}] warna teks di atas surface dan background`, () => {
      for (const bg of [c.surface, c.background] as const) {
        for (const fg of [c.textPrimary, c.textSecondary, c.textMuted] as const) {
          expect(contrastRatio(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(AA_NORMAL);
        }
      }
    });

    it(`[${mode}] teks di atas permukaan berwarna solid`, () => {
      expect(contrastRatio(c.surface, c.primary), 'surface on primary').toBeGreaterThanOrEqual(AA_NORMAL);
      expect(contrastRatio(c.surface, c.danger), 'surface on danger').toBeGreaterThanOrEqual(AA_NORMAL);
      expect(contrastRatio(c.accentText, c.surface), 'accentText on surface').toBeGreaterThanOrEqual(AA_NORMAL);
      expect(contrastRatio(c.surface, c.textMuted), 'surface on textMuted').toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it(`[${mode}] pasangan badge urgensi`, () => {
      for (const u of URGENCY_VALUES) {
        const p = urgencyColor(u, mode);
        expect(contrastRatio(p.fg, p.bg), `urgency ${u} ${mode}`).toBeGreaterThanOrEqual(AA_NORMAL);
      }
    });

    it(`[${mode}] pasangan badge status aduan`, () => {
      for (const s of COMPLAINT_STATUSES) {
        const p = statusColor(s, mode);
        expect(contrastRatio(p.fg, p.bg), `status ${s} ${mode}`).toBeGreaterThanOrEqual(AA_NORMAL);
      }
    });

    it(`[${mode}] pasangan badge status aspirasi`, () => {
      for (const s of ASPIRATION_STATUSES) {
        const p = aspirationStatusColor(s, mode);
        expect(contrastRatio(p.fg, p.bg), `aspiration ${s} ${mode}`).toBeGreaterThanOrEqual(AA_NORMAL);
      }
    });

    it(`[${mode}] pasangan badge status layanan`, () => {
      for (const s of SERVICE_STATUSES) {
        const p = serviceStatusColor(s, mode);
        expect(contrastRatio(p.fg, p.bg), `service ${s} ${mode}`).toBeGreaterThanOrEqual(AA_NORMAL);
      }
    });

    it(`[${mode}] pasangan badge status darurat`, () => {
      for (const s of EMERGENCY_STATUSES) {
        const p = emergencyStatusColor(s, mode);
        expect(contrastRatio(p.fg, p.bg), `emergency ${s} ${mode}`).toBeGreaterThanOrEqual(AA_NORMAL);
      }
    });

    it(`[${mode}] pasangan warna kategori pengumuman`, () => {
      for (const cat of ANNOUNCEMENT_CATEGORIES) {
        const p = announcementCategoryColor(cat.id, mode);
        expect(contrastRatio(p.fg, p.bg), `announcement ${cat.id} ${mode}`).toBeGreaterThanOrEqual(AA_NORMAL);
      }
    });

    it(`[${mode}] pasangan warna bidang anggaran`, () => {
      for (const sector of BUDGET_SECTORS) {
        const p = budgetSectorColor(sector.id, mode);
        expect(contrastRatio(p.fg, p.bg), `sector ${sector.id} ${mode}`).toBeGreaterThanOrEqual(AA_NORMAL);
      }
    });

    it(`[${mode}] warna mutasi poin`, () => {
      for (const points of [10, -35, 0]) {
        const p = pointsColor(points, mode);
        expect(contrastRatio(p.fg, p.bg), `points ${points} ${mode}`).toBeGreaterThanOrEqual(AA_NORMAL);
      }
    });
  }
});
