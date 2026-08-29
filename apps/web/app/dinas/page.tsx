'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DinasRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/aduan?tab=dinas');
  }, [router]);
  return null;
}
