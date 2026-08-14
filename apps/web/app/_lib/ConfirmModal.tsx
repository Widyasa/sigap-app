'use client';

import type { CSSProperties, ReactNode } from 'react';
import { colors } from '@repo/shared';

const THEME = colors.light;

/**
 * Modal konfirmasi generik — pengganti dialog konfirmasi bawaan browser
 * (tidak bisa distyle, tidak konsisten dengan sisa aplikasi). Sibling dari
 * `RejectReasonModal` (verifikasi/layanan), tapi tanpa textarea: konfirmasi
 * ya/tidak murni, tombol konfirmasi langsung aktif.
 */
export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  danger,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div style={modalOverlayStyle} onClick={onCancel}>
      <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 16, margin: '0 0 8px', color: THEME.textPrimary }}>{title}</h3>
        <p style={{ fontSize: 13, color: THEME.textSecondary, margin: '0 0 12px' }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button style={secondaryButtonStyle} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            style={{ ...buttonStyle, background: danger ? THEME.danger : THEME.primary }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const buttonStyle: CSSProperties = {
  minHeight: 36,
  padding: '0 14px',
  borderRadius: 6,
  border: 'none',
  background: THEME.primary,
  color: THEME.surface,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryButtonStyle: CSSProperties = {
  minHeight: 36,
  padding: '0 14px',
  borderRadius: 6,
  border: `1px solid ${THEME.border}`,
  background: THEME.surface,
  color: THEME.textPrimary,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const modalOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: 16,
};

const modalCardStyle: CSSProperties = {
  background: THEME.surface,
  border: `1px solid ${THEME.border}`,
  borderRadius: 10,
  padding: 20,
  width: '100%',
  maxWidth: 420,
  boxSizing: 'border-box',
};
