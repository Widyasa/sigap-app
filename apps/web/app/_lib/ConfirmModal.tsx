'use client';

import type { ReactNode } from 'react';
import { colors, typography } from '@repo/shared';
import { Modal, buttonStyle, dangerButtonStyle, secondaryButtonStyle } from './ui';

const THEME = colors.light;

/**
 * Modal konfirmasi ya/tidak, dibangun di atas primitif `Modal` bersama.
 *
 * Versi sebelumnya adalah salinan ketiga dari kerangka modal yang sama dan
 * TIDAK punya `role="dialog"`, nama aksesibel, jebakan fokus, pengembalian
 * fokus, maupun penutupan dengan Escape. Satu-satunya cara membatalkannya
 * adalah mengeklik lapisan gelap — yang tidak bisa dilakukan pengguna papan
 * ketik sama sekali. Padahal justru modal INILAH yang menjaga dua aksi yang
 * tidak dapat dibatalkan: menandai SOS yang sedang berjalan sebagai alarm
 * palsu, dan menghapus pengumuman.
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
    <Modal title={title} onClose={onCancel}>
      <p style={{ fontSize: typography.caption.fontSize, color: THEME.textSecondary, margin: '0 0 12px' }}>
        {message}
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
        <button type="button" style={secondaryButtonStyle} onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" style={danger ? dangerButtonStyle : buttonStyle} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
