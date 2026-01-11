'use client';

import { useState, useEffect } from 'react';
import AuthModal from '@/app/components/AuthModal';

interface InviteLandingProps {
  email: string;
  inviteCode: string;
}

export default function InviteLanding({ email, inviteCode }: InviteLandingProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Открываем модальное окно после монтирования на клиенте
    setIsClient(true);
    setIsModalOpen(true);
  }, []);

  const handleClose = () => {
    setIsModalOpen(false);
    // Перенаправляем на главную страницу после закрытия
    setTimeout(() => {
      window.location.href = '/';
    }, 300);
  };

  // Не рендерим ничего до монтирования на клиенте, чтобы избежать hydration mismatch
  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Фоновая анимация или градиент */}
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900/20 via-gray-900 to-blue-900/20 pointer-events-none" />

      {/* Основной контент */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Добро пожаловать в <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">CineChance</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-md mx-auto">
            Вас пригласили зарегистрироваться на платформе для персонализированных кинопремьер.
          </p>
        </div>

        {/* Карточка с информацией */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50 max-w-md w-full mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm text-gray-400">Приглашение отправлено на</p>
              <p className="text-lg font-medium text-white">{email}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-gray-300">
              <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Персонализированные рекомендации</span>
            </div>
            <div className="flex items-center gap-3 text-gray-300">
              <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>История просмотров и оценки</span>
            </div>
            <div className="flex items-center gap-3 text-gray-300">
              <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Списки желаемых фильмов</span>
            </div>
          </div>
        </div>

        {/* Кнопка для ручного открытия модального окна */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:brightness-110 transition shadow-lg shadow-purple-500/25"
        >
          Зарегистрироваться
        </button>

        <p className="text-gray-500 mt-4 text-sm">
          Уже есть аккаунт?{' '}
          <button
            onClick={() => {
              // Перенаправляем на страницу входа
              window.location.href = '/?auth=login';
            }}
            className="text-purple-400 hover:text-purple-300 transition"
          >
            Войти
          </button>
        </p>
      </div>

      {/* Модальное окно регистрации */}
      <AuthModal
        isOpen={isModalOpen}
        onClose={handleClose}
        initialEmail={email}
        inviteCode={inviteCode}
      />
    </div>
  );
}
