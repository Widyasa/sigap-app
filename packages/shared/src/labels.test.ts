import { describe, expect, it } from 'vitest';
import { CATEGORY_LIST, DINAS_LIST } from './constants';
import {
  CATEGORY_LABELS,
  UNLABELLED_CATEGORIES,
  categoryLabel,
  dinasName,
} from './labels';

describe('labels', () => {
  it('setiap kategori di CATEGORY_LIST punya label manusia', () => {
    expect(UNLABELLED_CATEGORIES).toEqual([]);
  });

  it('tidak ada label kategori yatim (label untuk kategori yang tidak ada)', () => {
    const orphans = Object.keys(CATEGORY_LABELS).filter((k) => !CATEGORY_LIST.includes(k));
    expect(orphans).toEqual([]);
  });

  it('categoryLabel jatuh balik ke id mentah, bukan string kosong', () => {
    expect(categoryLabel('jalan_rusak')).toBe('Jalan rusak');
    expect(categoryLabel('kategori_baru_belum_dilabeli')).toBe('kategori_baru_belum_dilabeli');
    expect(categoryLabel(null)).toBe('—');
  });

  it('dinasName memetakan id ke nama lengkap', () => {
    expect(dinasName('pupr')).toBe(DINAS_LIST[0]!.name);
    expect(dinasName(null)).toBe('—');
    expect(dinasName('tidak_ada')).toBe('tidak_ada');
  });
});
