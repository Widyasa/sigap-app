import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { AuthProvider } from './_lib/auth';
import '../styles/global.css';

// Dua keluarga font sesuai DESIGN.md ("dual-font strategy"): Plus Jakarta
// Sans untuk judul, Inter untuk teks isi. Dimuat lewat next/font agar
// self-hosted (tanpa permintaan ke Google saat runtime).
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-heading',
});

export const metadata: Metadata = {
  title: 'SIGAP — Dashboard Staf',
  description:
    'Dashboard petugas SIGAP: verifikasi aduan, tindak lanjut dinas, aspirasi, layanan, dan antrean darurat.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${inter.variable} ${plusJakartaSans.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
