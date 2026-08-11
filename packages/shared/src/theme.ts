// Satu-satunya tempat hex literal boleh muncul (lihat CONTEXT-MAP.md dan
// packages/shared/CONTEXT.md). Seluruh aplikasi wajib mengambil warna dari
// token di berkas ini — tidak ada hex hard-coded di tempat lain.

import type { AspirationStatus, ServiceStatus } from './schemas';

export type ThemeMode = 'light' | 'dark';
export type Urgency = 'P0' | 'P1' | 'P2';
export type ComplaintStatus =
  | 'pending_classification' | 'pending' | 'verified'
  | 'in_progress' | 'resolved' | 'rejected';

export interface ColorTokens {
  primary: string; primaryPressed: string; primarySurface: string;
  accent: string; accentSurface: string; civicAmber: string;
  textPrimary: string; textSecondary: string; textMuted: string;
  border: string; surface: string; background: string;
}

export const colors: Record<ThemeMode, ColorTokens> = {
  light: {
    primary: '#0F4C5C', primaryPressed: '#0A3644', primarySurface: '#E6F2F5',
    accent: '#14B8A6', accentSurface: '#CCFBF1', civicAmber: '#F59E0B',
    textPrimary: '#0F172A', textSecondary: '#475569', textMuted: '#94A3B8',
    border: '#E2E8F0', surface: '#FFFFFF', background: '#F8FAFC',
  },
  dark: {
    primary: '#2DD4BF', primaryPressed: '#14B8A6', primarySurface: '#134E4A',
    accent: '#5EEAD4', accentSurface: '#134E4A', civicAmber: '#FBBF24',
    textPrimary: '#F1F5F9', textSecondary: '#94A3B8', textMuted: '#64748B',
    border: '#1E3441', surface: '#142430', background: '#0B1620',
  },
};

interface Pair { fg: string; bg: string }

const URGENCY: Record<Urgency, Record<ThemeMode, Pair>> = {
  P0: { light: { fg: '#DC2626', bg: '#FEF2F2' }, dark: { fg: '#F87171', bg: '#3B1416' } },
  P1: { light: { fg: '#EA580C', bg: '#FFF7ED' }, dark: { fg: '#FB923C', bg: '#3A1E0A' } },
  P2: { light: { fg: '#0284C7', bg: '#EFF6FF' }, dark: { fg: '#60A5FA', bg: '#12253C' } },
};

const STATUS: Record<ComplaintStatus, Record<ThemeMode, Pair>> = {
  pending_classification: { light: { fg: '#64748B', bg: '#F8FAFC' }, dark: { fg: '#94A3B8', bg: '#1B2A36' } },
  pending:                { light: { fg: '#64748B', bg: '#F8FAFC' }, dark: { fg: '#94A3B8', bg: '#1B2A36' } },
  verified:               { light: { fg: '#0284C7', bg: '#EFF6FF' }, dark: { fg: '#60A5FA', bg: '#12253C' } },
  in_progress:            { light: { fg: '#CA8A04', bg: '#FEFCE8' }, dark: { fg: '#FACC15', bg: '#332A08' } },
  resolved:               { light: { fg: '#16A34A', bg: '#F0FDF4' }, dark: { fg: '#4ADE80', bg: '#0C2A16' } },
  rejected:               { light: { fg: '#64748B', bg: '#F8FAFC' }, dark: { fg: '#94A3B8', bg: '#1B2A36' } },
};

const ASPIRATION_STATUS: Record<AspirationStatus, Record<ThemeMode, Pair>> = {
  voting:     { light: { fg: '#0284C7', bg: '#EFF6FF' }, dark: { fg: '#60A5FA', bg: '#12253C' } },
  musrenbang: { light: { fg: '#CA8A04', bg: '#FEFCE8' }, dark: { fg: '#FACC15', bg: '#332A08' } },
  approved:   { light: { fg: '#7C3AED', bg: '#F5F3FF' }, dark: { fg: '#A78BFA', bg: '#241B3D' } },
  budgeted:   { light: { fg: '#0F4C5C', bg: '#E6F2F5' }, dark: { fg: '#2DD4BF', bg: '#134E4A' } },
  realized:   { light: { fg: '#16A34A', bg: '#F0FDF4' }, dark: { fg: '#4ADE80', bg: '#0C2A16' } },
  rejected:   { light: { fg: '#64748B', bg: '#F8FAFC' }, dark: { fg: '#94A3B8', bg: '#1B2A36' } },
};

const SERVICE_STATUS: Record<ServiceStatus, Record<ThemeMode, Pair>> = {
  submitted:  { light: { fg: '#64748B', bg: '#F8FAFC' }, dark: { fg: '#94A3B8', bg: '#1B2A36' } },
  verifying:  { light: { fg: '#0284C7', bg: '#EFF6FF' }, dark: { fg: '#60A5FA', bg: '#12253C' } },
  signing:    { light: { fg: '#CA8A04', bg: '#FEFCE8' }, dark: { fg: '#FACC15', bg: '#332A08' } },
  ready:      { light: { fg: '#16A34A', bg: '#F0FDF4' }, dark: { fg: '#4ADE80', bg: '#0C2A16' } },
  rejected:   { light: { fg: '#DC2626', bg: '#FEF2F2' }, dark: { fg: '#F87171', bg: '#3B1416' } },
  collected:  { light: { fg: '#7C3AED', bg: '#F5F3FF' }, dark: { fg: '#A78BFA', bg: '#241B3D' } },
};

export const urgencyColor = (u: Urgency, m: ThemeMode): Pair => URGENCY[u][m];
export const statusColor  = (s: ComplaintStatus, m: ThemeMode): Pair => STATUS[s][m];
export const aspirationStatusColor = (s: AspirationStatus, m: ThemeMode): Pair => ASPIRATION_STATUS[s][m];
export const serviceStatusColor = (s: ServiceStatus, m: ThemeMode): Pair => SERVICE_STATUS[s][m];

export const typography = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '800' as const },
  h1:      { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  h2:      { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  body:    { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  caption: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  micro:   { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
};

export const spacing = (n: number): number => n * 4;
