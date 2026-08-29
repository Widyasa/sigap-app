import { describe, expect, it } from 'vitest';
import { isValidAspirationTransition, nextAspirationStatuses } from './aspirations';
import { isValidServiceTransition, nextServiceStatuses } from './services';

describe('isValidServiceTransition', () => {
  it('mengikuti alur maju permohonan layanan', () => {
    expect(isValidServiceTransition('submitted', 'verifying')).toBe(true);
    expect(isValidServiceTransition('verifying', 'signing')).toBe(true);
    expect(isValidServiceTransition('signing', 'ready')).toBe(true);
    expect(isValidServiceTransition('ready', 'collected')).toBe(true);
  });

  it('menolak lompatan yang menghasilkan surat tanpa berkas', () => {
    // Inilah bug yang dicegah: `ready` berarti "PDF sudah terbit", padahal
    // output_pdf_url/verification_code baru diisi generate-service-pdf.
    expect(isValidServiceTransition('submitted', 'ready')).toBe(false);
    expect(isValidServiceTransition('verifying', 'ready')).toBe(false);
    expect(isValidServiceTransition('submitted', 'collected')).toBe(false);
  });

  it('menolak mundur dan menolak keluar dari status akhir', () => {
    expect(isValidServiceTransition('signing', 'submitted')).toBe(false);
    expect(isValidServiceTransition('collected', 'ready')).toBe(false);
    expect(isValidServiceTransition('rejected', 'verifying')).toBe(false);
  });

  it('penolakan boleh dari tahap mana pun sebelum surat terbit', () => {
    for (const s of ['submitted', 'verifying', 'signing'] as const) {
      expect(isValidServiceTransition(s, 'rejected')).toBe(true);
    }
    // Setelah surat terbit, penolakan bukan lagi jalur yang sah.
    expect(isValidServiceTransition('ready', 'rejected')).toBe(false);
  });

  it('setiap status boleh tetap di dirinya sendiri', () => {
    for (const s of ['submitted', 'verifying', 'signing', 'ready', 'collected', 'rejected'] as const) {
      expect(isValidServiceTransition(s, s)).toBe(true);
      expect(nextServiceStatuses(s)).toContain(s);
    }
  });
});

describe('isValidAspirationTransition', () => {
  it('mengikuti alur voting -> musrenbang -> approved -> budgeted -> realized', () => {
    expect(isValidAspirationTransition('voting', 'musrenbang')).toBe(true);
    expect(isValidAspirationTransition('musrenbang', 'approved')).toBe(true);
    expect(isValidAspirationTransition('approved', 'budgeted')).toBe(true);
    expect(isValidAspirationTransition('budgeted', 'realized')).toBe(true);
  });

  it('menolak mundur ke voting (memicu ulang trigger poin Musrenbang)', () => {
    expect(isValidAspirationTransition('budgeted', 'voting')).toBe(false);
    expect(isValidAspirationTransition('musrenbang', 'voting')).toBe(false);
    expect(isValidAspirationTransition('realized', 'budgeted')).toBe(false);
  });

  it('menolak lompatan melewati tahap', () => {
    expect(isValidAspirationTransition('voting', 'budgeted')).toBe(false);
    expect(isValidAspirationTransition('voting', 'approved')).toBe(false);
  });

  it('setiap status boleh tetap di dirinya sendiri', () => {
    for (const s of ['voting', 'musrenbang', 'approved', 'budgeted', 'realized', 'rejected'] as const) {
      expect(isValidAspirationTransition(s, s)).toBe(true);
      expect(nextAspirationStatuses(s)).toContain(s);
    }
  });
});
