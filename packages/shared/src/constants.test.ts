import { describe, it, expect } from 'vitest';
import {
  DINAS_LIST,
  CATEGORY_LIST,
  URGENCY_VALUES,
  COMPLAINT_STATUSES,
  OTP_LENGTH,
  OTP_TTL_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_COOLDOWN_SECONDS,
  POINT_REASONS,
  COMPLAINT_CATEGORY_GROUPS,
  getComplaintCategoryGroup,
} from './constants';

describe('DINAS_LIST', () => {
  it('setiap dinas punya id, nama, dan minimal satu kategori', () => {
    expect(DINAS_LIST.length).toBeGreaterThan(0);
    for (const d of DINAS_LIST) {
      expect(d.id).toBeTruthy();
      expect(d.name).toBeTruthy();
      expect(d.categories.length).toBeGreaterThan(0);
      expect(d.slaHoursP0).toBeGreaterThan(0);
      expect(d.slaHoursP1).toBeGreaterThanOrEqual(d.slaHoursP0);
      expect(d.slaHoursP2).toBeGreaterThanOrEqual(d.slaHoursP1);
    }
  });

  it('id dinas tidak boleh duplikat', () => {
    const ids = DINAS_LIST.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('sesuai seed.sql: pupr menangani jalan_rusak dengan SLA P0 24 jam', () => {
    const pupr = DINAS_LIST.find((d) => d.id === 'pupr');
    expect(pupr?.categories).toContain('jalan_rusak');
    expect(pupr?.slaHoursP0).toBe(24);
    expect(pupr?.slaHoursP1).toBe(72);
    expect(pupr?.slaHoursP2).toBe(168);
  });

  it('dinas lainnya menjadi tempat kategori belum terklasifikasi', () => {
    const lainnya = DINAS_LIST.find((d) => d.id === 'lainnya');
    expect(lainnya?.categories).toEqual(['lainnya']);
  });
});

describe('CATEGORY_LIST', () => {
  it('mencakup seluruh kategori dari setiap dinas tanpa duplikat', () => {
    const fromDinas = DINAS_LIST.flatMap((d) => d.categories);
    expect(new Set(CATEGORY_LIST).size).toBe(CATEGORY_LIST.length);
    expect(new Set(CATEGORY_LIST)).toEqual(new Set(fromDinas));
  });
});

describe('urgensi dan status', () => {
  it('URGENCY_VALUES persis P0, P1, P2', () => {
    expect(URGENCY_VALUES).toEqual(['P0', 'P1', 'P2']);
  });

  it('COMPLAINT_STATUSES mencakup seluruh tahap siklus aduan', () => {
    expect(COMPLAINT_STATUSES).toEqual([
      'pending_classification', 'pending', 'verified',
      'in_progress', 'resolved', 'rejected',
    ]);
  });
});

describe('konstanta OTP (aturan S7/S8)', () => {
  it('enam digit, berlaku 10 menit, maksimal 5 percobaan, jeda 60 detik', () => {
    expect(OTP_LENGTH).toBe(6);
    expect(OTP_TTL_MINUTES).toBe(10);
    expect(OTP_MAX_ATTEMPTS).toBe(5);
    expect(OTP_COOLDOWN_SECONDS).toBe(60);
  });
});

describe('POINT_REASONS', () => {
  it('aduan terbukti palsu membatalkan poin kirim dan verifikasi', () => {
    expect(POINT_REASONS.report_created).toBe(10);
    expect(POINT_REASONS.report_verified).toBe(25);
    expect(POINT_REASONS.report_false).toBe(-35);
    expect(POINT_REASONS.report_created + POINT_REASONS.report_verified + POINT_REASONS.report_false)
      .toBe(0);
  });

  it('upvote memberi poin kecil, musrenbang memberi poin tertinggi', () => {
    expect(POINT_REASONS.upvote_given).toBeLessThan(POINT_REASONS.report_created);
    expect(POINT_REASONS.aspiration_musrenbang).toBe(100);
  });
});

describe('COMPLAINT_CATEGORY_GROUPS', () => {
  it('setiap kategori di CATEGORY_LIST masuk tepat satu grup', () => {
    const fromGroups = COMPLAINT_CATEGORY_GROUPS.flatMap((g) => g.categories);
    expect(new Set(fromGroups).size).toBe(fromGroups.length);
    expect(new Set(fromGroups)).toEqual(new Set(CATEGORY_LIST));
  });

  it('getComplaintCategoryGroup memetakan kategori ke grup yang benar', () => {
    expect(getComplaintCategoryGroup('jalan_rusak')).toBe('jalan');
    expect(getComplaintCategoryGroup('lainnya')).toBe('keamanan');
  });

  it('getComplaintCategoryGroup mengembalikan null untuk kategori tak dikenal', () => {
    expect(getComplaintCategoryGroup('kategori_tidak_ada')).toBeNull();
  });
});
