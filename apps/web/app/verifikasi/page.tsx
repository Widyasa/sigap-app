'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VerifikasiRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/aduan?tab=verifikasi');
  }, [router]);
  return null;
}
