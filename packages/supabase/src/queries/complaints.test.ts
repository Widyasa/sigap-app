import { describe, it, expect } from 'vitest';
import { isValidClassificationTransition } from './complaints';

describe('isValidClassificationTransition', () => {
  it('mengizinkan pending_classification -> pending', () => {
    expect(isValidClassificationTransition('pending_classification', 'pending')).toBe(true);
  });

  it('mengizinkan pending_classification -> rejected', () => {
    expect(isValidClassificationTransition('pending_classification', 'rejected')).toBe(true);
  });

  it('mengizinkan pending -> verified', () => {
    expect(isValidClassificationTransition('pending', 'verified')).toBe(true);
  });

  it('mengizinkan pending -> rejected', () => {
    expect(isValidClassificationTransition('pending', 'rejected')).toBe(true);
  });

  it('mengizinkan pending_classification -> pending_classification (simpan koreksi field tanpa lompat status)', () => {
    expect(isValidClassificationTransition('pending_classification', 'pending_classification')).toBe(true);
  });

  it('mengizinkan pending -> pending (simpan koreksi field tanpa lompat status)', () => {
    expect(isValidClassificationTransition('pending', 'pending')).toBe(true);
  });

  it('menolak pending_classification -> verified (melompati verifikasi manual)', () => {
    expect(isValidClassificationTransition('pending_classification', 'verified')).toBe(false);
  });

  it('menolak verified -> pending (mundur setelah lolos verifikasi)', () => {
    expect(isValidClassificationTransition('verified', 'pending')).toBe(false);
  });

  it('menolak transisi dari status yang tidak diketahui pemetaan', () => {
    expect(isValidClassificationTransition('resolved', 'pending')).toBe(false);
  });
});
