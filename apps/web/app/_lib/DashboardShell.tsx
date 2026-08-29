'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { colors, spacing, typography } from '@repo/shared';
import { useAuth } from './auth';
import { NAV_ITEMS } from './navItems';
import { visuallyHidden } from './ui';

const THEME = colors.light;

const ROLE_LABELS: Record<string, string> = {
  verifier: 'Verifikator',
  dinas_staff: 'Staf Dinas',
  dinas_head: 'Kepala Dinas',
  emergency_operator: 'Operator Darurat',
  admin: 'Admin',
};

interface DashboardShellProps {
  /** Judul halaman di topbar (mis. "Ringkasan"). */
  title: string;
  /** Subjudul di bawah judul (mis. cakupan kelurahan/tanggal). */
  subtitle?: ReactNode;
  /** Slot aksi khusus halaman di kanan topbar (tombol, dsb). */
  actions?: ReactNode;
  /**
   * Kotak pencarian topbar. Dulu topbar selalu merender `<input disabled>`
   * yang tidak pernah tersambung ke apa pun — kontrol mati yang muncul di
   * kesembilan halaman, dan di /warga duduk tepat di atas kotak pencarian
   * kedua yang benar-benar berfungsi. Sekarang hanya dirender oleh halaman
   * yang memang mengimplementasikan pencarian.
   */
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label: string;
  };
  children: ReactNode;
}

/**
 * Shell dashboard staf: sidebar teal gelap + topbar (PRD 8.3). Seluruh
 * halaman staf memakai shell ini, jadi tidak ada lagi top-nav-bar terpisah
 * di `app/layout.tsx` (dulu `DashboardNav`, yang membuat menu tampil dua
 * kali berdampingan dengan sidebar). `NAV_ITEMS` di `navItems.ts` tetap
 * satu-satunya sumber kebenaran daftar nav.
 */
export function DashboardShell({ title, subtitle, actions, search, children }: DashboardShellProps) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (!user) return null;
  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <div className="sigap-shell" style={shellStyle}>
      <a className="sigap-skip-link" href="#konten-utama">
        Lewati ke konten utama
      </a>

      <div className="sigap-sidebar" style={sidebarStyle}>
        <div style={brandBlockStyle}>
          <div aria-hidden="true" style={brandMarkStyle}>
            S
          </div>
          <div className="sigap-sidebar-label">
            <div style={brandTitleStyle}>SIGAP</div>
            <div style={brandSubtitleStyle}>Dashboard Staf</div>
          </div>
        </div>

        <nav aria-label="Navigasi utama" className="sigap-nav-list" style={navListStyle}>
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className="sigap-nav-link"
                style={isActive ? { ...navLinkStyle, ...navLinkActiveStyle } : navLinkStyle}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sigap-user-block" style={userBlockStyle}>
          <div className="sigap-sidebar-label" style={userNameStyle}>
            {user.fullName ?? user.role}
          </div>
          <div className="sigap-sidebar-label" style={userRoleStyle}>
            {ROLE_LABELS[user.role] ?? user.role}
          </div>
          <button
            type="button"
            style={signOutStyle}
            onClick={async () => {
              await signOut();
              router.replace('/login');
            }}
          >
            Keluar
          </button>
        </div>
      </div>

      <div style={mainColumnStyle}>
        <header className="sigap-topbar" style={topbarStyle}>
          <div style={{ minWidth: 0 }}>
            <h1 style={titleStyle}>{title}</h1>
            {subtitle ? <div style={subtitleStyle}>{subtitle}</div> : null}
          </div>
          <div style={topbarRightStyle}>
            {search ? (
              <>
                <label htmlFor="topbar-search" style={visuallyHidden}>
                  {search.label}
                </label>
                <input
                  id="topbar-search"
                  className="sigap-topbar-search"
                  type="search"
                  value={search.value}
                  placeholder={search.placeholder ?? 'Cari…'}
                  onChange={(e) => search.onChange(e.target.value)}
                  style={searchInputStyle}
                />
              </>
            ) : null}
            {actions}
          </div>
        </header>
        <main id="konten-utama" tabIndex={-1} className="sigap-content" style={contentStyle}>
          {children}
        </main>
      </div>
    </div>
  );
}

const SIDEBAR_WIDTH = 232;

const shellStyle: CSSProperties = {
  display: 'flex',
  minHeight: '100vh',
  width: '100%',
  background: THEME.background,
};

const sidebarStyle: CSSProperties = {
  width: SIDEBAR_WIDTH,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  background: THEME.primary,
  color: THEME.surface,
  padding: spacing(4),
  boxSizing: 'border-box',
};

const brandBlockStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing(2),
  marginBottom: spacing(6),
};

const brandMarkStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  background: THEME.accent,
  color: THEME.primaryPressed,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: typography.h2.fontWeight,
  fontSize: typography.body.fontSize,
};

const brandTitleStyle: CSSProperties = {
  fontSize: typography.h2.fontSize,
  fontWeight: typography.h2.fontWeight,
  lineHeight: `${typography.h2.lineHeight}px`,
};

const brandSubtitleStyle: CSSProperties = {
  fontSize: typography.micro.fontSize,
  opacity: 0.7,
};

const navListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: spacing(1),
  flex: 1,
  // Tanpa ini, admin dengan 9 item nav mendorong tombol "Keluar" keluar
  // layar pada jendela pendek dan tidak ada cara lain untuk keluar.
  overflowY: 'auto',
  minHeight: 0,
};

const navLinkStyle: CSSProperties = {
  display: 'block',
  padding: `${spacing(2)}px ${spacing(3)}px`,
  borderRadius: 8,
  color: THEME.surface,
  opacity: 0.75,
  textDecoration: 'none',
  fontSize: typography.caption.fontSize,
};

const navLinkActiveStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.14)',
  opacity: 1,
  fontWeight: 600,
};

const userBlockStyle: CSSProperties = {
  borderTop: '1px solid rgba(255,255,255,0.16)',
  paddingTop: spacing(3),
  marginTop: spacing(3),
};

const userNameStyle: CSSProperties = {
  fontSize: typography.caption.fontSize,
  fontWeight: 600,
};

const userRoleStyle: CSSProperties = {
  fontSize: typography.micro.fontSize,
  opacity: 0.7,
  marginBottom: spacing(2),
};

const signOutStyle: CSSProperties = {
  fontSize: typography.micro.fontSize,
  color: THEME.surface,
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.24)',
  borderRadius: 6,
  padding: `${spacing(1)}px ${spacing(2)}px`,
  cursor: 'pointer',
  width: '100%',
};

const mainColumnStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
};

const topbarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${spacing(4)}px ${spacing(6)}px`,
  borderBottom: `1px solid ${THEME.border}`,
  background: THEME.surface,
  gap: spacing(4),
  flexWrap: 'wrap',
};

const titleStyle: CSSProperties = {
  fontSize: typography.h1.fontSize,
  fontWeight: typography.h1.fontWeight,
  color: THEME.textPrimary,
  margin: 0,
};

const subtitleStyle: CSSProperties = {
  fontSize: typography.caption.fontSize,
  color: THEME.textSecondary,
  marginTop: spacing(1),
};

const topbarRightStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing(2),
};

const searchInputStyle: CSSProperties = {
  fontSize: typography.body.fontSize,
  padding: `${spacing(2)}px ${spacing(3)}px`,
  borderRadius: 8,
  border: `1px solid ${THEME.border}`,
  color: THEME.textPrimary,
  background: THEME.background,
  width: 220,
  maxWidth: '100%',
};

const contentStyle: CSSProperties = {
  flex: 1,
  padding: spacing(6),
  boxSizing: 'border-box',
  width: '100%',
};
