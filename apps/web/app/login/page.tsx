'use client';

import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { emailSchema, otpCodeSchema } from '@repo/shared';
import { useAuth } from '../_lib/auth';

type Step = 'email' | 'code';

export default function LoginPage() {
  const { requestOtp, verifyOtp } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async () => {
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
    // Dev mode: fungsi auth-request-otp mengembalikan devCode di JSON respons
    // sehingga tidak perlu email nyata untuk pengujian lokal (lihat OTP_DEV_MODE).
    setCode(result.devCode ?? '');
    setStep('code');
  };

  const handleVerify = async () => {
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
    router.replace('/aspirasi');
  };

  return (
    <div style={{ width: '100%', maxWidth: 380, padding: 24, fontFamily: 'inherit' }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Masuk Petugas SIGAP</h1>
      <p style={{ color: '#475569', marginBottom: 24, fontSize: 14 }}>
        Alat internal untuk mengelola periode voting dan tinjauan aspirasi. Bukan untuk warga.
      </p>

      {step === 'email' ? (
        <>
          <label style={labelStyle}>Email petugas</label>
          <input
            style={inputStyle}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@sigap.test"
          />
          {error ? <p style={errorStyle}>{error}</p> : null}
          <button style={buttonStyle} disabled={loading} onClick={handleRequestOtp}>
            {loading ? 'Mengirim…' : 'Kirim Kode OTP'}
          </button>
        </>
      ) : (
        <>
          <p style={{ fontSize: 14, marginBottom: 12 }}>
            Kode 6 digit telah dikirim ke {email}. Kode berlaku 10 menit.
          </p>
          <label style={labelStyle}>Kode OTP</label>
          <input
            style={inputStyle}
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="000000"
          />
          {error ? <p style={errorStyle}>{error}</p> : null}
          <button style={buttonStyle} disabled={loading} onClick={handleVerify}>
            {loading ? 'Memverifikasi…' : 'Verifikasi'}
          </button>
          <button
            style={{ ...buttonStyle, background: 'transparent', color: '#0F4C5C', border: '1px solid #0F4C5C' }}
            onClick={() => {
              setStep('email');
              setError(null);
            }}
          >
            Ganti Email
          </button>
        </>
      )}
    </div>
  );
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  color: '#475569',
  marginBottom: 4,
};

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 44,
  border: '1px solid #E2E8F0',
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
  background: '#0F4C5C',
  color: 'white',
  fontSize: 16,
  fontWeight: 600,
  marginBottom: 12,
  cursor: 'pointer',
};

const errorStyle: CSSProperties = {
  color: '#DC2626',
  fontSize: 13,
  marginBottom: 12,
};
