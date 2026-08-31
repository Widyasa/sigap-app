const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

interface RequestOtpResponse {
  ok: boolean;
  devCode?: string;
  reason?: string;
  retry_after_seconds?: number;
}

export async function requestOtp(email: string): Promise<RequestOtpResponse> {
  const response = await fetch(`${baseUrl}/functions/v1/auth-request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return response.json() as Promise<RequestOtpResponse>;
}

export interface VerifyOtpResponse {
  ok: boolean;
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    email: string;
    profile: {
      fullName: string | null;
      role: string;
      dinasId: string | null;
      kelurahan: string | null;
      kecamatan: string | null;
    };
  };
  reason?: string;
  retry_after_seconds?: number;
}

export interface LoginPasswordResponse {
  ok: boolean;
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    email: string;
    profile: {
      fullName: string | null;
      role: string;
      dinasId: string | null;
      kelurahan: string | null;
      kecamatan: string | null;
    };
  };
  reason?: string;
  retry_after_seconds?: number;
}

export async function verifyOtp(email: string, code: string): Promise<VerifyOtpResponse> {
  const response = await fetch(`${baseUrl}/functions/v1/auth-verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  return response.json() as Promise<VerifyOtpResponse>;
}

export async function loginPassword(
  email: string,
  password: string,
): Promise<LoginPasswordResponse> {
  const response = await fetch(`${baseUrl}/functions/v1/auth-login-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return response.json() as Promise<LoginPasswordResponse>;
}

export interface SetPasswordResponse {
  ok: boolean;
  reason?: string;
}

export async function setPassword(
  email: string,
  password: string,
  accessToken: string,
): Promise<SetPasswordResponse> {
  const response = await fetch(`${baseUrl}/functions/v1/auth-set-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ email, password }),
  });
  return response.json() as Promise<SetPasswordResponse>;
}

export async function signOut(refreshToken: string): Promise<void> {
  await fetch(`${baseUrl}/functions/v1/auth-signout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken, all: false }),
  });
}

export function authReasonToMessage(reason: string | undefined): string {
  switch (reason) {
    case 'invalid_email':
      return 'Alamat email tidak valid.';
    case 'invalid_code':
      return 'Kode OTP salah atau sudah kedaluwarsa.';
    case 'too_many_attempts':
      return 'Terlalu banyak percobaan. Coba lagi nanti.';
    case 'rate_limited':
      return 'Permintaan terlalu sering. Tunggu sebentar.';
    case 'email_failed':
      return 'Gagal mengirim email. Coba lagi nanti.';
    case 'account_disabled':
      return 'Akun dinonaktifkan. Hubungi petugas.';
    case 'session_expired':
      return 'Sesi habis. Masuk kembali.';
    case 'server_misconfigured':
    case 'server_error':
      return 'Terjadi kesalahan server. Coba lagi nanti.';
    case 'invalid_credentials':
      return 'Email atau password salah.';
    case 'unauthorized':
      return 'Sesi habis. Masuk kembali.';
    case 'forbidden':
      return 'Anda tidak memiliki izin.';
    case 'user_not_found':
      return 'Pengguna tidak ditemukan.';
    case 'citizen_password_forbidden':
      return 'Password tidak diizinkan untuk peran warga.';
    default:
      return 'Terjadi kesalahan. Coba lagi.';
  }
}
