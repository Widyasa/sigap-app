// Satu-satunya tempat hex literal boleh muncul (lihat CONTEXT-MAP.md dan
// packages/shared/CONTEXT.md). Seluruh aplikasi wajib mengambil warna dari
// token di berkas ini — tidak ada hex hard-coded di tempat lain.

import type { AspirationStatus, ServiceStatus, EmergencyStatus } from './schemas';
import type { BudgetSectorId } from './constants';

export type ThemeMode = 'light' | 'dark';
export type Urgency = 'P0' | 'P1' | 'P2';
export type ComplaintStatus =
  | 'pending_classification' | 'pending' | 'verified'
  | 'in_progress' | 'resolved' | 'rejected';
export type AnnouncementCategory =
  | 'darurat' | 'infrastruktur' | 'kesehatan' | 'layanan' | 'kegiatan' | 'umum';

export interface ColorTokens {
  primary: string; primaryPressed: string; primarySurface: string;
  accent: string; accentSurface: string;
  /** Varian `accent` yang cukup gelap untuk dipakai sebagai WARNA TEKS di
   *  atas `surface` (accent sendiri hanya 2,49:1 — gagal WCAG AA). */
  accentText: string;
  civicAmber: string;
  danger: string; dangerSurface: string; dangerPressed: string;
  textPrimary: string; textSecondary: string; textMuted: string;
  border: string; surface: string; background: string;
}

export const colors: Record<ThemeMode, ColorTokens> = {
  light: {
    primary: '#0F4C5C', primaryPressed: '#0A3644', primarySurface: '#E6F2F5',
    accent: '#14B8A6', accentSurface: '#CCFBF1', accentText: '#0F766E', civicAmber: '#F59E0B',
    danger: '#DC2626', dangerSurface: '#FEF2F2', dangerPressed: '#B91C1C',
    textPrimary: '#0F172A', textSecondary: '#475569', textMuted: '#64748B',
    border: '#E2E8F0', surface: '#FFFFFF', background: '#F8FAFC',
  },
  dark: {
    primary: '#2DD4BF', primaryPressed: '#14B8A6', primarySurface: '#134E4A',
    accent: '#5EEAD4', accentSurface: '#134E4A', accentText: '#5EEAD4', civicAmber: '#FBBF24',
    danger: '#F87171', dangerSurface: '#450A0A', dangerPressed: '#EF4444',
    textPrimary: '#F1F5F9', textSecondary: '#CBD5E1', textMuted: '#94A3B8',
    border: '#1E3441', surface: '#142430', background: '#0B1620',
  },
};

interface Pair { fg: string; bg: string }

const URGENCY: Record<Urgency, Record<ThemeMode, Pair>> = {
  P0: { light: { fg: '#B91C1C', bg: '#FEF2F2' }, dark: { fg: '#F87171', bg: '#3B1416' } },
  P1: { light: { fg: '#9A3412', bg: '#FFF7ED' }, dark: { fg: '#FB923C', bg: '#3A1E0A' } },
  P2: { light: { fg: '#0369A1', bg: '#EFF6FF' }, dark: { fg: '#60A5FA', bg: '#12253C' } },
};

const STATUS: Record<ComplaintStatus, Record<ThemeMode, Pair>> = {
  pending_classification: { light: { fg: '#64748B', bg: '#F8FAFC' }, dark: { fg: '#94A3B8', bg: '#1B2A36' } },
  pending:                { light: { fg: '#64748B', bg: '#F8FAFC' }, dark: { fg: '#94A3B8', bg: '#1B2A36' } },
  verified:               { light: { fg: '#0369A1', bg: '#EFF6FF' }, dark: { fg: '#60A5FA', bg: '#12253C' } },
  in_progress:            { light: { fg: '#854D0E', bg: '#FEFCE8' }, dark: { fg: '#FACC15', bg: '#332A08' } },
  resolved:               { light: { fg: '#166534', bg: '#F0FDF4' }, dark: { fg: '#4ADE80', bg: '#0C2A16' } },
  rejected:               { light: { fg: '#64748B', bg: '#F8FAFC' }, dark: { fg: '#94A3B8', bg: '#1B2A36' } },
};

const ASPIRATION_STATUS: Record<AspirationStatus, Record<ThemeMode, Pair>> = {
  voting:     { light: { fg: '#0369A1', bg: '#EFF6FF' }, dark: { fg: '#60A5FA', bg: '#12253C' } },
  musrenbang: { light: { fg: '#854D0E', bg: '#FEFCE8' }, dark: { fg: '#FACC15', bg: '#332A08' } },
  approved:   { light: { fg: '#7C3AED', bg: '#F5F3FF' }, dark: { fg: '#A78BFA', bg: '#241B3D' } },
  budgeted:   { light: { fg: '#0F4C5C', bg: '#E6F2F5' }, dark: { fg: '#2DD4BF', bg: '#134E4A' } },
  realized:   { light: { fg: '#166534', bg: '#F0FDF4' }, dark: { fg: '#4ADE80', bg: '#0C2A16' } },
  rejected:   { light: { fg: '#64748B', bg: '#F8FAFC' }, dark: { fg: '#94A3B8', bg: '#1B2A36' } },
};

const SERVICE_STATUS: Record<ServiceStatus, Record<ThemeMode, Pair>> = {
  submitted:  { light: { fg: '#64748B', bg: '#F8FAFC' }, dark: { fg: '#94A3B8', bg: '#1B2A36' } },
  verifying:  { light: { fg: '#0369A1', bg: '#EFF6FF' }, dark: { fg: '#60A5FA', bg: '#12253C' } },
  signing:    { light: { fg: '#854D0E', bg: '#FEFCE8' }, dark: { fg: '#FACC15', bg: '#332A08' } },
  ready:      { light: { fg: '#166534', bg: '#F0FDF4' }, dark: { fg: '#4ADE80', bg: '#0C2A16' } },
  rejected:   { light: { fg: '#B91C1C', bg: '#FEF2F2' }, dark: { fg: '#F87171', bg: '#3B1416' } },
  collected:  { light: { fg: '#7C3AED', bg: '#F5F3FF' }, dark: { fg: '#A78BFA', bg: '#241B3D' } },
};

const EMERGENCY_STATUS: Record<EmergencyStatus, Record<ThemeMode, Pair>> = {
  active:      { light: { fg: '#B91C1C', bg: '#FEF2F2' }, dark: { fg: '#F87171', bg: '#3B1416' } },
  responding:  { light: { fg: '#854D0E', bg: '#FEFCE8' }, dark: { fg: '#FACC15', bg: '#332A08' } },
  resolved:    { light: { fg: '#166534', bg: '#F0FDF4' }, dark: { fg: '#4ADE80', bg: '#0C2A16' } },
  false_alarm: { light: { fg: '#64748B', bg: '#F8FAFC' }, dark: { fg: '#94A3B8', bg: '#1B2A36' } },
};

export const urgencyColor = (u: Urgency, m: ThemeMode): Pair => URGENCY[u][m];
export const statusColor  = (s: ComplaintStatus, m: ThemeMode): Pair => STATUS[s][m];
export const aspirationStatusColor = (s: AspirationStatus, m: ThemeMode): Pair => ASPIRATION_STATUS[s][m];
export const serviceStatusColor = (s: ServiceStatus, m: ThemeMode): Pair => SERVICE_STATUS[s][m];
export const emergencyStatusColor = (s: EmergencyStatus, m: ThemeMode): Pair => EMERGENCY_STATUS[s][m];

/**
 * Warna badge kategori pengumuman — dipetakan ke pasangan warna yang sudah
 * ada per kategori (bukan hex baru), sesuai aturan "satu-satunya tempat hex
 * literal" di atas.
 */
export const announcementCategoryColor = (c: AnnouncementCategory, m: ThemeMode): Pair => {
  switch (c) {
    case 'darurat': return URGENCY.P0[m];
    case 'infrastruktur': return STATUS.verified[m];
    case 'kesehatan': return STATUS.resolved[m];
    case 'layanan': return ASPIRATION_STATUS.approved[m];
    case 'kegiatan': return URGENCY.P1[m];
    case 'umum': return STATUS.pending[m];
  }
};

/**
 * Warna kotak bidang anggaran (layar Anggaran) — dipetakan ke pasangan
 * warna yang sudah ada per bidang (bukan hex baru), sesuai aturan
 * "satu-satunya tempat hex literal" di atas. `lingkungan` memakai token
 * `accent`/`accentSurface` (bukan pasangan STATUS) supaya tetap berbeda
 * secara visual dari `kesehatan`, yang memakai hijau `resolved`.
 */
export const budgetSectorColor = (s: BudgetSectorId, m: ThemeMode): Pair => {
  switch (s) {
    case 'infrastruktur': return ASPIRATION_STATUS.budgeted[m];
    case 'kesehatan': return STATUS.resolved[m];
    case 'pendidikan_pemuda': return ASPIRATION_STATUS.approved[m];
    case 'lingkungan': return { fg: colors[m].accentText, bg: colors[m].accentSurface };
    case 'pemerintahan_layanan': return URGENCY.P1[m];
  }
};

/**
 * Warna +/- untuk mutasi poin (issue #13) — dipetakan ke pasangan warna
 * yang sudah ada (hijau `resolved`, merah `P0`) daripada menambah hex
 * literal baru, sesuai aturan "satu-satunya tempat hex literal" di atas.
 */
export const pointsColor = (points: number, m: ThemeMode): Pair =>
  points > 0 ? STATUS.resolved[m] : points < 0 ? URGENCY.P0[m] : STATUS.pending[m];

export const typography = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '800' as const },
  h1:      { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  h2:      { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  body:    { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  caption: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  micro:   { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
};

export const spacing = (n: number): number => n * 4;
