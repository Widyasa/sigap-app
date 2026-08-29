import { describe, it, expect } from 'vitest';
import {
  createComplaintSchema,
  aiClassificationSchema,
  emailSchema,
  otpCodeSchema,
  canVoteAspiration,
  type AspirationStatus,
} from './schemas';

describe('createComplaintSchema', () => {
  const valid = {
    description: 'Jalan berlubang besar di depan pasar, sudah dua minggu.',
    locationLat: -6.9,
    locationLng: 107.6,
    locationAddress: 'Jl. Merdeka No. 1',
    imageUrls: ['https://storage.example.id/foto1.jpg'],
  };

  it('menerima aduan valid', () => {
    expect(createComplaintSchema.safeParse(valid).success).toBe(true);
  });

  it('menolak deskripsi kurang dari 20 karakter', () => {
    const result = createComplaintSchema.safeParse({ ...valid, description: 'Terlalu pendek' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Ceritakan lebih detail, minimal 20 karakter');
    }
  });

  it('menolak aduan tanpa foto', () => {
    const result = createComplaintSchema.safeParse({ ...valid, imageUrls: [] });
    expect(result.success).toBe(false);
  });

  it('menolak koordinat di luar wilayah Indonesia', () => {
    const result = createComplaintSchema.safeParse({ ...valid, locationLat: 40, locationLng: -74 });
    expect(result.success).toBe(false);
  });

  it('locationAddress bersifat opsional', () => {
    const { locationAddress, ...rest } = valid;
    expect(createComplaintSchema.safeParse(rest).success).toBe(true);
  });
});

describe('aiClassificationSchema', () => {
  const valid = {
    title: 'Jalan berlubang di Jl. Merdeka',
    category: 'jalan_rusak',
    assignedDinas: 'pupr',
    urgency: 'P1',
    summary: 'Warga melaporkan lubang besar yang membahayakan pengendara motor.',
    confidence: 0.82,
  };

  it('menerima klasifikasi valid', () => {
    expect(aiClassificationSchema.safeParse(valid).success).toBe(true);
  });

  it('menolak kategori yang tidak ada di katalog dinas', () => {
    const result = aiClassificationSchema.safeParse({ ...valid, category: 'kategori_tidak_ada' });
    expect(result.success).toBe(false);
  });

  it('menolak dinas yang tidak ada di katalog', () => {
    const result = aiClassificationSchema.safeParse({ ...valid, assignedDinas: 'dinas_fiktif' });
    expect(result.success).toBe(false);
  });

  it('menolak urgensi di luar P0/P1/P2', () => {
    const result = aiClassificationSchema.safeParse({ ...valid, urgency: 'P3' });
    expect(result.success).toBe(false);
  });

  it('menolak confidence di luar rentang 0..1', () => {
    const result = aiClassificationSchema.safeParse({ ...valid, confidence: 1.5 });
    expect(result.success).toBe(false);
  });
});

describe('emailSchema', () => {
  it('menormalkan huruf besar dan spasi', () => {
    expect(emailSchema.parse('  Budi@Mail.COM ')).toBe('budi@mail.com');
  });

  it('menolak alamat email tidak valid', () => {
    const result = emailSchema.safeParse('bukan-email');
    expect(result.success).toBe(false);
  });
});

describe('otpCodeSchema', () => {
  it('menerima enam digit angka', () => {
    expect(otpCodeSchema.safeParse('123456').success).toBe(true);
  });

  it('menolak kode selain enam digit angka', () => {
    expect(otpCodeSchema.safeParse('12345').success).toBe(false);
    expect(otpCodeSchema.safeParse('abcdef').success).toBe(false);
  });
});

describe('canVoteAspiration', () => {
  const aspiration = { kelurahan: 'Sukamaju', status: 'voting' as AspirationStatus };
  const period = {
    isActive: true,
    startsAt: '2026-08-01T00:00:00.000Z',
    endsAt: '2026-08-31T00:00:00.000Z',
  };
  const now = new Date('2026-08-15T00:00:00.000Z');

  it('mengizinkan warga kelurahan sama saat periode aktif dan status voting', () => {
    expect(canVoteAspiration('Sukamaju', aspiration, period, now)).toBe(true);
  });

  it('menolak warga dari kelurahan berbeda', () => {
    expect(canVoteAspiration('Cihampelas', aspiration, period, now)).toBe(false);
  });

  it('menolak saat periode tidak aktif', () => {
    expect(canVoteAspiration('Sukamaju', aspiration, { ...period, isActive: false }, now)).toBe(false);
  });

  it('menolak saat waktu di luar rentang starts_at..ends_at', () => {
    const outside = new Date('2026-09-15T00:00:00.000Z');
    expect(canVoteAspiration('Sukamaju', aspiration, period, outside)).toBe(false);
  });

  it('menolak saat status aspirasi bukan voting', () => {
    expect(canVoteAspiration('Sukamaju', { ...aspiration, status: 'musrenbang' }, period, now)).toBe(false);
  });

  it('menolak saat voterKelurahan null', () => {
    expect(canVoteAspiration(null, aspiration, period, now)).toBe(false);
  });
});
