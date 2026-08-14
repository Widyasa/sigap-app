'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './auth';

interface NavItem {
  href: string;
  label: string;
  roles: string[];
}

/** Satu daftar sumber kebenaran untuk kartu dashboard (`/`) dan nav bar —
 * peran per halaman harus selalu cocok dengan role-gate di halaman itu
 * sendiri (lihat masing-masing `canAccess` di app/*\/page.tsx). */
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Ringkasan', roles: ['verifier', 'dinas_staff', 'dinas_head', 'emergency_operator', 'admin'] },
  { href: '/verifikasi', label: 'Aduan Verifikasi', roles: ['verifier', 'admin'] },
  { href: '/dinas', label: 'Aduan Dinas', roles: ['dinas_staff', 'dinas_head', 'admin'] },
  { href: '/aspirasi', label: 'Aspirasi', roles: ['admin', 'dinas_head'] },
  { href: '/layanan', label: 'Layanan', roles: ['verifier', 'dinas_staff', 'dinas_head', 'admin'] },
  { href: '/pengumuman', label: 'Pengumuman', roles: ['admin', 'dinas_head'] },
  { href: '/anggaran', label: 'Anggaran', roles: ['admin'] },
  { href: '/warga', label: 'Warga', roles: ['verifier', 'dinas_head', 'admin'] },
  { href: '/darurat', label: 'Darurat', roles: ['emergency_operator', 'admin'] },
  { href: '/pengguna', label: 'Kelola Pengguna', roles: ['admin'] },
];

/**
 * Nav bar tipis untuk halaman staff — daftar item disaring sesuai peran
 * pengguna yang masuk, supaya petugas dapat berpindah halaman tanpa
 * mengetik URL manual (issue #14 bagian 8, "navigation / shared shell").
 */
export function DashboardNav() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  if (!user) return null;
  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <nav style={navStyle}>
      <Link href="/" style={brandStyle}>
        SIGAP
      </Link>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={pathname === item.href ? { ...linkStyle, ...activeLinkStyle } : linkStyle}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <span style={{ fontSize: 13, color: '#64748B', marginRight: 12 }}>
        {user.fullName ?? user.role}
      </span>
      <button
        style={signOutStyle}
        onClick={async () => {
          await signOut();
          router.replace('/login');
        }}
      >
        Keluar
      </button>
    </nav>
  );
}

const navStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 24px',
  borderBottom: '1px solid #E2E8F0',
  background: '#FFFFFF',
};

const brandStyle: CSSProperties = {
  fontWeight: 700,
  color: '#0F4C5C',
  marginRight: 16,
  textDecoration: 'none',
  fontSize: 15,
};

const linkStyle: CSSProperties = {
  fontSize: 13,
  color: '#334155',
  textDecoration: 'none',
  padding: '6px 10px',
  borderRadius: 6,
};

const activeLinkStyle: CSSProperties = {
  background: '#EFF6FF',
  color: '#0F4C5C',
  fontWeight: 600,
};

const signOutStyle: CSSProperties = {
  fontSize: 13,
  color: '#DC2626',
  background: 'transparent',
  border: '1px solid #FCA5A5',
  borderRadius: 6,
  padding: '6px 10px',
  cursor: 'pointer',
};
