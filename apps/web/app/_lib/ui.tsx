'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { colors, spacing, typography } from '@repo/shared';

const THEME = colors.light;

/** Disembunyikan secara visual tapi tetap dibacakan pembaca layar. */
export const visuallyHidden: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

// ---------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------

/**
 * Dialog modal yang benar-benar berperilaku sebagai dialog.
 *
 * Tiga salinan hampir identik dari pola ini pernah tersebar di
 * `ConfirmModal.tsx`, `aduan/_verifikasiTab.tsx`, dan `layanan/page.tsx`,
 * dan tidak satu pun punya `role="dialog"`, jebakan fokus, pengembalian
 * fokus, atau penutupan dengan Escape — sementara satu-satunya cara menutup
 * `ConfirmModal` adalah mengeklik lapisan gelapnya, yang tidak bisa
 * dilakukan pengguna papan ketik sama sekali. Dua di antaranya menjaga aksi
 * yang tidak dapat dibatalkan (menandai SOS sebagai alarm palsu, menghapus
 * pengumuman).
 */
export function Modal({
  title,
  onClose,
  children,
  labelledBy,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Diisi otomatis; hanya untuk kasus judul kustom. */
  labelledBy?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);
  const generatedId = useId();
  const titleId = labelledBy ?? generatedId;

  useEffect(() => {
    openerRef.current = document.activeElement;
    const card = cardRef.current;
    const focusables = () =>
      Array.from(
        card?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea, input, select, a[href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    focusables()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      (openerRef.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={modalCardStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} style={modalTitleStyle}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Empty / error / loading
// ---------------------------------------------------------------------

/**
 * PRD 11.2: "Setiap keadaan kosong wajib memuat tiga hal: ilustrasi atau
 * ikon, penjelasan mengapa kosong, dan satu aksi yang dapat dilakukan.
 * Menulis 'Tidak ada data' adalah pelanggaran terhadap dokumen ini."
 */
export function EmptyState({
  icon = '📭',
  title,
  message,
  action,
}: {
  icon?: string;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div style={emptyStateStyle}>
      <div aria-hidden="true" style={{ fontSize: 32, marginBottom: spacing(2) }}>
        {icon}
      </div>
      <p style={{ margin: 0, fontWeight: 600, color: THEME.textPrimary }}>{title}</p>
      <p style={{ margin: `${spacing(1)}px 0 0`, color: THEME.textSecondary, fontSize: typography.caption.fontSize }}>
        {message}
      </p>
      {action ? <div style={{ marginTop: spacing(3) }}>{action}</div> : null}
    </div>
  );
}

/** Kotak galat dengan tombol coba lagi — diumumkan pembaca layar via role="alert". */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" style={errorStateStyle}>
      <p style={{ margin: 0 }}>{message}</p>
      {onRetry ? (
        <button type="button" style={retryButtonStyle} onClick={onRetry}>
          Coba Lagi
        </button>
      ) : null}
    </div>
  );
}

/** Penanda memuat yang diumumkan pembaca layar (4.1.3 Status Messages). */
export function LoadingState({ message = 'Memuat data…' }: { message?: string }) {
  return (
    <p role="status" aria-live="polite" style={{ color: THEME.textSecondary }}>
      {message}
    </p>
  );
}

/**
 * Merender tepat SATU dari empat keadaan. Sebelumnya sebagian besar halaman
 * menulis `{error && <p/>}{loading ? … : rows.length === 0 ? 'Belum ada …'}`,
 * sehingga saat pengambilan data gagal pengguna melihat pesan galat DAN
 * keadaan kosong yang percaya diri di bawahnya — di halaman antrean darurat
 * itu berbunyi "Tidak ada SOS aktif saat ini."
 */
export function AsyncSection<T>({
  loading,
  error,
  items,
  onRetry,
  empty,
  loadingMessage,
  children,
}: {
  loading: boolean;
  error: string | null;
  items: T[] | null;
  onRetry?: () => void;
  empty: ReactNode;
  loadingMessage?: string;
  children: (items: T[]) => ReactNode;
}) {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (loading || items === null) return <LoadingState message={loadingMessage} />;
  if (items.length === 0) return <>{empty}</>;
  return <>{children(items)}</>;
}

// ---------------------------------------------------------------------
// Toast (konfirmasi keberhasilan)
// ---------------------------------------------------------------------

export interface Flash {
  kind: 'success' | 'error';
  message: string;
}

/**
 * Sebelumnya tidak ada satu pun konfirmasi keberhasilan di dashboard: setiap
 * mutasi hanya diikuti pengambilan ulang senyap, jadi petugas tidak pernah
 * tahu apakah tindakannya tersimpan.
 */
export function useFlash(timeoutMs = 4000) {
  const [flash, setFlash] = useState<Flash | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (kind: Flash['kind'], message: string) => {
      if (timer.current) clearTimeout(timer.current);
      setFlash({ kind, message });
      timer.current = setTimeout(() => setFlash(null), timeoutMs);
    },
    [timeoutMs],
  );

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { flash, showSuccess: (m: string) => show('success', m), showError: (m: string) => show('error', m) };
}

export function FlashMessage({ flash }: { flash: Flash | null }) {
  if (!flash) return null;
  const isError = flash.kind === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      style={{
        ...flashStyle,
        background: isError ? THEME.dangerSurface : '#F0FDF4',
        color: isError ? THEME.danger : '#166534',
        borderColor: isError ? THEME.danger : '#166534',
      }}
    >
      {flash.message}
    </div>
  );
}

// ---------------------------------------------------------------------
// Tabel
// ---------------------------------------------------------------------

/** `<th scope="col">` — tanpa `scope`, hubungan header-sel diserahkan ke tebakan pembaca layar. */
export function Th({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return (
    <th scope="col" style={{ ...thStyle, ...style }}>
      {children}
    </th>
  );
}

export function Td({ children, style, colSpan }: { children?: ReactNode; style?: CSSProperties; colSpan?: number }) {
  return (
    <td colSpan={colSpan} style={{ ...tdStyle, ...style }}>
      {children}
    </td>
  );
}

/**
 * Pembungkus tabel yang bisa digulir mendatar. Tanpa ini, tabel lebar
 * meluber ke `<body>` dan menyeret sidebar serta topbar keluar layar pada
 * lebar di bawah 1280px.
 */
export function TableScroll({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div style={{ overflowX: 'auto', width: '100%' }}>
      <table style={tableStyle}>
        <caption style={visuallyHidden}>{caption}</caption>
        {children}
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------
// Gaya bersama
// ---------------------------------------------------------------------

export const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: typography.caption.fontSize,
};

export const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: `${spacing(2)}px ${spacing(3)}px`,
  color: THEME.textSecondary,
  fontSize: typography.micro.fontSize,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  borderBottom: `1px solid ${THEME.border}`,
  whiteSpace: 'nowrap',
};

export const tdStyle: CSSProperties = {
  padding: `${spacing(2)}px ${spacing(3)}px`,
  borderBottom: `1px solid ${THEME.border}`,
  color: THEME.textPrimary,
  verticalAlign: 'top',
};

export const cardStyle: CSSProperties = {
  border: `1px solid ${THEME.border}`,
  borderRadius: 12,
  background: THEME.surface,
};

export const buttonStyle: CSSProperties = {
  minHeight: 40,
  padding: `0 ${spacing(4)}px`,
  borderRadius: 8,
  border: 'none',
  background: THEME.primary,
  color: THEME.surface,
  fontSize: typography.caption.fontSize,
  fontWeight: 600,
  cursor: 'pointer',
};

export const secondaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: THEME.surface,
  color: THEME.textPrimary,
  border: `1px solid ${THEME.border}`,
};

export const dangerButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: THEME.danger,
};

const modalOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: spacing(4),
};

const modalCardStyle: CSSProperties = {
  background: THEME.surface,
  border: `1px solid ${THEME.border}`,
  borderRadius: 12,
  padding: spacing(5),
  width: '100%',
  maxWidth: 440,
  boxSizing: 'border-box',
};

const modalTitleStyle: CSSProperties = {
  fontSize: typography.h2.fontSize,
  fontWeight: typography.h2.fontWeight,
  margin: `0 0 ${spacing(2)}px`,
  color: THEME.textPrimary,
};

const emptyStateStyle: CSSProperties = {
  textAlign: 'center',
  padding: spacing(8),
  border: `1px dashed ${THEME.border}`,
  borderRadius: 12,
  background: THEME.surface,
};

const errorStateStyle: CSSProperties = {
  background: THEME.dangerSurface,
  border: `1px solid ${THEME.danger}`,
  color: THEME.danger,
  borderRadius: 10,
  padding: spacing(4),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: spacing(3),
  flexWrap: 'wrap',
  fontSize: typography.caption.fontSize,
};

const retryButtonStyle: CSSProperties = {
  minHeight: 36,
  padding: `0 ${spacing(3)}px`,
  borderRadius: 8,
  border: `1px solid ${THEME.danger}`,
  background: 'transparent',
  color: THEME.danger,
  fontSize: typography.caption.fontSize,
  fontWeight: 600,
  cursor: 'pointer',
};

const flashStyle: CSSProperties = {
  border: '1px solid',
  borderRadius: 10,
  padding: `${spacing(3)}px ${spacing(4)}px`,
  marginBottom: spacing(4),
  fontSize: typography.caption.fontSize,
  fontWeight: 600,
};
