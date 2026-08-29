import { describe, expect, it } from 'vitest';
import { formatCompactRupiah, formatRupiah } from './money';

describe('formatRupiah', () => {
  it('memakai pemisah ribuan Indonesia', () => {
    expect(formatRupiah(1_500_000_000)).toBe('Rp 1.500.000.000');
    expect(formatRupiah(0)).toBe('Rp 0');
  });

  it('membulatkan pecahan', () => {
    expect(formatRupiah(1_499.6)).toBe('Rp 1.500');
  });

  it('menempatkan tanda minus sebelum angka', () => {
    expect(formatRupiah(-2_000)).toBe('Rp -2.000');
  });
});

describe('formatCompactRupiah', () => {
  it('di bawah satu juta memakai format penuh', () => {
    expect(formatCompactRupiah(999_999)).toBe('Rp 999.999');
    expect(formatCompactRupiah(0)).toBe('Rp 0');
  });

  it('juta', () => {
    expect(formatCompactRupiah(1_000_000)).toBe('Rp 1 jt');
    expect(formatCompactRupiah(320_000_000)).toBe('Rp 320 jt');
  });

  it('milyar', () => {
    expect(formatCompactRupiah(1_000_000_000)).toBe('Rp 1 M');
    expect(formatCompactRupiah(4_820_000_000)).toBe('Rp 4,82 M');
    expect(formatCompactRupiah(1_100_000_000)).toBe('Rp 1,1 M');
  });

  it('naik satuan alih-alih menampilkan "1.000 jt"', () => {
    expect(formatCompactRupiah(999_999_999)).toBe('Rp 1 M');
  });

  it('triliun punya satuannya sendiri', () => {
    expect(formatCompactRupiah(1_000_000_000_000)).toBe('Rp 1 T');
    expect(formatCompactRupiah(2_500_000_000_000)).toBe('Rp 2,5 T');
    expect(formatCompactRupiah(999_999_999_999)).toBe('Rp 1 T');
  });

  it('nilai negatif memakai tanda minus di depan angka, bukan di depan satuan', () => {
    expect(formatCompactRupiah(-1_500_000_000)).toBe('Rp -1,5 M');
    expect(formatCompactRupiah(-320_000_000)).toBe('Rp -320 jt');
  });
});
