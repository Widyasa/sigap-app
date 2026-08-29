'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { colors, emailSchema, otpCodeSchema, spacing, typography } from '@repo/shared';
import { useAuth } from '../_lib/auth';

const THEME = colors.light;

/** Sama dengan `RESEND_SECONDS` di apps/native/app/verify.tsx. */
const RESEND_SECONDS = 60;

type Step = 'email' | 'code';

/** Landing pasca-login per peran (issue #14 kriteria role-based views).
 * Operator darurat langsung ke antrean SOS; peran lain ke dashboard `/`
 * yang menyaring kartu navigasi sesuai peran. */
function landingPathForRole(role: string): string {
  return role === 'emergency_operator' ? '/darurat' : '/';
}

export default function LoginPage() {
  const { requestOtp, verifyOtp, isAuthenticated, user } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /**
   * Hitung mundur kirim ulang. Langkah OTP DULU hanya menawarkan
   * "Verifikasi" dan "Ganti Email": kalau surelnya lambat atau masuk folder
   * spam, petugas harus mundur ke langkah pertama dan mengetik ulang
   * alamatnya. Aplikasi warga sudah punya seluruh alur ini
   * (`apps/native/app/verify.tsx`); dashboard-lah yang tertinggal.
   */
  const [resendIn, setResendIn] = useState(0);

  // Redirect pasca-verifikasi: `verifyOtp` hanya mengonfirmasi sukses/gagal,
  // profil (dan perannya) baru tersedia lewat `user` setelah AuthProvider
  // menyetel state-nya, jadi navigasi ditunda ke sini alih-alih di
  // handleVerify agar selalu memakai peran yang sudah termuat.
  useEffect(() => {
    if (isAuthenticated && user) {
      router.replace(landingPathForRole(user.role));
    }
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const handleRequestOtp = async () => {
    if (loading) return;
    setError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Email tidak valid');
      return;
    }
    setLoading(true);
    const result = await requestOtp(parsed.data);
    setLoading(false);
    if (!result.ok) {
      setError(result.message ?? 'Gagal mengirim kode');
      return;
    }
    setEmail(parsed.data);
    // Prefill kode jika backend mengembalikannya (server memutuskan kapan).
    setCode(result.devCode ?? '');
    setStep('code');
    setResendIn(RESEND_SECONDS);
  };

  const handleResend = async () => {
    if (loading || resendIn > 0) return;
    setError(null);
    setLoading(true);
    const result = await requestOtp(email);
    setLoading(false);
    if (!result.ok) {
      setError(result.message ?? 'Gagal mengirim ulang kode');
      return;
    }
    setCode(result.devCode ?? '');
    setResendIn(RESEND_SECONDS);
  };

  const handleVerify = async () => {
    if (loading) return;
    setError(null);
    const parsed = otpCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Kode tidak valid');
      return;
    }
    setLoading(true);
    const result = await verifyOtp(email, parsed.data);
    setLoading(false);
    if (!result.ok) {
      setError(result.message ?? 'Gagal memverifikasi kode');
      return;
    }
    // Navigasi ditangani oleh effect di atas begitu `user` termuat.
  };

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Masuk Petugas SIGAP</h1>
        <p style={{ color: THEME.textSecondary, marginBottom: 24, fontSize: 14 }}>
          Alat internal untuk mengelola periode voting dan tinjauan aspirasi. Bukan untuk warga.
        </p>

        {/* Dibungkus <form> supaya menekan Enter di kolom input mengirim
          formulir — tanpa ini tombol hanya bisa diklik dengan tetikus. */}
        {step === 'email' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRequestOtp();
            }}
          >
            <label htmlFor="login-email" style={labelStyle}>
              Email petugas
            </label>
            <input
              id="login-email"
              name="email"
              style={inputStyle}
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@sigap.test"
              aria-invalid={!!error}
              aria-describedby={error ? 'login-email-error' : undefined}
            />
            {/* `role="alert"` membuat pesan diumumkan begitu muncul: dulu
                galat hanya <p> lepas tanpa kaitan ke kolomnya, jadi pengguna
                pembaca layar tidak mendengar apa pun. */}
            {error ? (
              <p id="login-email-error" role="alert" style={errorStyle}>
                {error}
              </p>
            ) : null}
            <button type="submit" style={buttonStyle} disabled={loading}>
              {loading ? 'Mengirim…' : 'Kirim Kode OTP'}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVerify();
            }}
          >
            <p style={{ fontSize: 14, marginBottom: 12 }}>
              Kode 6 digit telah dikirim ke {email}. Kode berlaku 10 menit.
            </p>
            <label htmlFor="login-otp" style={labelStyle}>
              Kode OTP
            </label>
            <input
              id="login-otp"
              name="one-time-code"
              style={inputStyle}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              aria-invalid={!!error}
              aria-describedby={error ? 'login-otp-error' : undefined}
            />
            {error ? (
              <p id="login-otp-error" role="alert" style={errorStyle}>
                {error}
              </p>
            ) : null}
            <button type="submit" style={buttonStyle} disabled={loading}>
              {loading ? 'Memverifikasi…' : 'Verifikasi'}
            </button>
            <button
              type="button"
              style={{
                ...buttonStyle,
                background: 'transparent',
                color: THEME.primary,
                border: `1px solid ${THEME.primary}`,
              }}
              disabled={loading}
              onClick={() => {
                setStep('email');
                setCode('');
                setError(null);
              }}
            >
              Ganti Email
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  boxSizing: 'border-box',
};

const cardStyle: CSSProperties = {
  width: '100%',
  maxWidth: 380,
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  color: THEME.textSecondary,
  marginBottom: 4,
};

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 44,
  border: `1px solid ${THEME.border}`,
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 16,
  marginBottom: 12,
  boxSizing: 'border-box',
};

const buttonStyle: CSSProperties = {
  width: '100%',
  minHeight: 44,
  borderRadius: 8,
  border: 'none',
  background: THEME.primary,
  color: 'white',
  fontSize: 16,
  fontWeight: 600,
  marginBottom: 12,
  cursor: 'pointer',
};

const errorStyle: CSSProperties = {
  color: THEME.danger,
  fontSize: 13,
  marginBottom: 12,
};
