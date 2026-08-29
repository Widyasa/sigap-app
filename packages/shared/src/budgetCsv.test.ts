import { describe, expect, it } from 'vitest';
import { parseBudgetCsv } from './budgetCsv';

const HEADER =
  'fiscal_year,dinas_id,program_name,activity_name,budget_allocated,budget_realized,' +
  'location_address,kelurahan,kecamatan,progress_percent,contractor';

const VALID_ROW = '2026,pupr,Pemeliharaan Jalan,Perbaikan aspal,500000000,0,Jl. Merdeka,Sukamaju,Cibeunying,0,CV Mitra Jaya';

describe('parseBudgetCsv', () => {
  it('mem-parse baris valid', () => {
    const { rows, errors } = parseBudgetCsv(`${HEADER}\n${VALID_ROW}`);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      fiscalYear: 2026,
      dinasId: 'pupr',
      programName: 'Pemeliharaan Jalan',
      budgetAllocated: 500_000_000,
      budgetRealized: 0,
      progressPercent: 0,
      contractor: 'CV Mitra Jaya',
    });
  });

  it('menolak baris dengan budget_allocated kosong alih-alih menyimpannya sebagai 0', () => {
    const row = '2026,pupr,Pemeliharaan Jalan,Perbaikan aspal,,0,Jl. Merdeka,Sukamaju,Cibeunying,0,CV Mitra Jaya';
    const { rows, errors } = parseBudgetCsv(`${HEADER}\n${row}`);
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Baris 2');
  });

  it('menolak baris dengan fiscal_year kosong', () => {
    const row = ',pupr,Pemeliharaan Jalan,Perbaikan aspal,500000000,0,Jl. Merdeka,Sukamaju,Cibeunying,0,CV Mitra Jaya';
    const { rows, errors } = parseBudgetCsv(`${HEADER}\n${row}`);
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });

  it('menolak angka yang bukan angka', () => {
    const row = '2026,pupr,Pemeliharaan Jalan,Perbaikan aspal,limaratusjuta,0,Jl. Merdeka,Sukamaju,Cibeunying,0,CV Mitra Jaya';
    const { rows, errors } = parseBudgetCsv(`${HEADER}\n${row}`);
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });

  it('menolak progress_percent di luar 0..100', () => {
    const row = '2026,pupr,Pemeliharaan Jalan,Perbaikan aspal,500000000,0,Jl. Merdeka,Sukamaju,Cibeunying,150,CV Mitra Jaya';
    const { rows, errors } = parseBudgetCsv(`${HEADER}\n${row}`);
    expect(rows).toHaveLength(0);
    expect(errors[0]).toContain('progress_percent');
  });

  it('menolak nilai anggaran negatif', () => {
    const row = '2026,pupr,Pemeliharaan Jalan,Perbaikan aspal,-1,0,Jl. Merdeka,Sukamaju,Cibeunying,0,CV Mitra Jaya';
    const { rows, errors } = parseBudgetCsv(`${HEADER}\n${row}`);
    expect(rows).toHaveLength(0);
    expect(errors[0]).toContain('negatif');
  });

  it('mengabaikan BOM dan akhiran baris CRLF dari Excel', () => {
    const { rows, errors } = parseBudgetCsv(`﻿${HEADER}\r\n${VALID_ROW}\r\n`);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.fiscalYear).toBe(2026);
  });

  it('mengembalikan galat saat kolom wajib hilang di header', () => {
    const { rows, errors } = parseBudgetCsv('program_name,contractor\nJalan,CV Mitra');
    expect(rows).toHaveLength(0);
    expect(errors[0]).toContain('fiscal_year');
  });

  it('mengimpor baris valid dan melaporkan baris rusak sekaligus', () => {
    const broken = '2026,pupr,,Perbaikan aspal,500000000,0,Jl. Merdeka,Sukamaju,Cibeunying,0,CV Mitra Jaya';
    const { rows, errors } = parseBudgetCsv(`${HEADER}\n${VALID_ROW}\n${broken}`);
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Baris 3');
  });

  it('mengembalikan galat untuk CSV kosong', () => {
    expect(parseBudgetCsv('   ').errors).toEqual(['CSV kosong.']);
  });
});
