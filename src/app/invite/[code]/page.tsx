import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import InviteLanding from "./InviteLanding";

interface InvitePageProps {
  params: Promise<{
    code: string;
  }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { code } = await params;

  if (!code) {
    redirect("/");
  }

  // Проверяем приглашение на сервере
  const invitation = await prisma.invitation.findUnique({
    where: { token: code },
  });

  if (!invitation) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center p-8 bg-gray-800 rounded-xl border border-gray-700">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Приглашение не найдено</h1>
          <p className="text-gray-400 mb-6">Ссылка приглашения недействительна или была удалена.</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:brightness-110 transition"
          >
            Вернуться на главную
          </a>
        </div>
      </div>
    );
  }

  // Проверяем, не истёк ли срок действия
  if (invitation.expiresAt < new Date()) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center p-8 bg-gray-800 rounded-xl border border-gray-700">
          <div className="w-16 h-16 mx-auto mb-4 bg-yellow-500/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Срок действия истёк</h1>
          <p className="text-gray-400 mb-6">Ссылка приглашения больше не действительна. Пожалуйста, запросите новое приглашение.</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:brightness-110 transition"
          >
            Вернуться на главную
          </a>
        </div>
      </div>
    );
  }

  // Проверяем, не было ли уже использовано приглашение
  if (invitation.usedAt) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center p-8 bg-gray-800 rounded-xl border border-gray-700">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-500/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Приглашение уже использовано</h1>
          <p className="text-gray-400 mb-6">Это приглашение уже было использовано для регистрации аккаунта.</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:brightness-110 transition"
          >
            Вернуться на главную
          </a>
        </div>
      </div>
    );
  }

  // Приглашение валидно - показываем страницу с модальным окном регистрации
  return (
    <InviteLanding
      email={invitation.email}
      inviteCode={code}
    />
  );
}
