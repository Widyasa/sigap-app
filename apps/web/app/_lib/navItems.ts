export interface NavItem {
  href: string;
  label: string;
  roles: string[];
}

/** Satu daftar sumber kebenaran untuk sidebar `DashboardShell` — peran per
 * halaman harus selalu cocok dengan role-gate di halaman itu sendiri (lihat
 * masing-masing `canAccess` di app/*\/page.tsx). */
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Ringkasan', roles: ['verifier', 'dinas_staff', 'dinas_head', 'emergency_operator', 'admin'] },
  { href: '/aduan', label: 'Aduan', roles: ['verifier', 'dinas_staff', 'dinas_head', 'admin'] },
  { href: '/aspirasi', label: 'Aspirasi', roles: ['admin', 'dinas_head'] },
  { href: '/layanan', label: 'Layanan', roles: ['verifier', 'dinas_staff', 'dinas_head', 'admin'] },
  { href: '/pengumuman', label: 'Pengumuman', roles: ['admin', 'dinas_head'] },
  { href: '/anggaran', label: 'Anggaran', roles: ['admin'] },
  { href: '/warga', label: 'Warga', roles: ['verifier', 'dinas_head', 'admin'] },
  { href: '/darurat', label: 'Darurat', roles: ['emergency_operator', 'admin'] },
  { href: '/pengguna', label: 'Kelola Pengguna', roles: ['admin'] },
];
