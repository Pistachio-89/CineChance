'use client';

import { useRouter } from 'next/navigation';

interface BackButtonProps {
  className?: string;
}

export default function BackButton({ className = 'text-blue-400 hover:underline mb-6 inline-block' }: BackButtonProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className={className}
      type="button"
    >
      ← На профиль
    </button>
  );
}
