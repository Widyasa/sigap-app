import Constants from 'expo-constants';

export const baseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  (Constants.expoConfig?.extra?.supabaseUrl as string | undefined) ??
  '';

interface RequestOtpBody {
  email: string;
}

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
    body: JSON.stringify({ email } satisfies RequestOtpBody),
  });
  return response.json() as Promise<RequestOtpResponse>;
}

interface VerifyOtpBody {
  email: string;
  code: string;
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
      rw: string | null;
    };
  };
  reason?: string;
  retry_after_seconds?: number;
}

export async function verifyOtp(
  email: string,
  code: string,
): Promise<VerifyOtpResponse> {
  const response = await fetch(`${baseUrl}/functions/v1/auth-verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code } satisfies VerifyOtpBody),
  });
  return response.json() as Promise<VerifyOtpResponse>;
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
    default:
      return 'Terjadi kesalahan. Coba lagi.';
  }
}

export interface ClassifyReportResponse {
  ok: boolean;
  classification?: {
    title: string;
    category: string;
    assignedDinas: string;
    urgency: string;
    summary: string;
    confidence: number;
  };
  duplicates?: {
    id: string;
    title: string;
    similarity: number;
    distanceMeters: number;
    upvoteCount: number;
  }[];
  reason?: string;
}

export async function classifyComplaint(
  complaintId: string,
  accessToken: string,
): Promise<ClassifyReportResponse> {
  const response = await fetch(`${baseUrl}/functions/v1/classify-report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ complaintId }),
  });
  return response.json() as Promise<ClassifyReportResponse>;
}
