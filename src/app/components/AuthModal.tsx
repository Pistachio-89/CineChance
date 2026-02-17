'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import { signIn } from 'next-auth/react';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
const TermsOfServiceModal = dynamic(() => import('./TermsOfServiceModal'), { ssr: false });
import { logger } from '@/lib/logger';

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
  inviteCode?: string;
};

export default function AuthModal({ isOpen, onClose, initialEmail = '', inviteCode = '' }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Режим регистрации только по приглашению
  const isRegisterMode = !!inviteCode;

  // Установка начальных значений при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      logger.info('Auth modal opened', { initialEmail: !!initialEmail, hasInviteCode: !!inviteCode });
      
      if (initialEmail) {
        setEmail(initialEmail);
      }
      
      // Сбрасываем ошибку при открытии
      setError('');
      
      // Сбрасываем форму если открываем без inviteCode
      if (!inviteCode) {
        setPassword('');
        setName('');
        setBirthDate('');
        setAgreedToTerms(false);
      }
    }
  }, [isOpen, initialEmail, inviteCode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await signIn('credentials', {
      redirect: false,
      email,
      password,
    });

    setIsLoading(false);

    if (result?.error) {
      setError('Неверный email или пароль');
    } else {
      onClose();
      window.location.reload();
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Передаем inviteToken если пользователь регистрируется по приглашению
    const signupData = {
      email,
      password,
      name,
      birthDate,
      agreedToTerms,
      ...(inviteCode && { inviteToken: inviteCode }),
    };
    
    logger.info('Submitting signup', { hasInviteToken: !!inviteCode });

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signupData),
    });

    const data = await res.json();
    setIsLoading(false);

    if (data.error) {
      setError(data.error);
    } else {
      const loginResult = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });

      if (loginResult?.error) {
        setError('Регистрация прошла, но вход не удался');
      } else {
        onClose();
        window.location.reload();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <div className="relative w-full max-w-md p-6 bg-gray-900 rounded-xl shadow-2xl border border-gray-800">


          <h3 className="text-2xl font-bold text-center mb-6">
            {isRegisterMode ? 'Регистрация' : 'Войти'}
          </h3>

          {/* Информация о приглашении */}
          {isRegisterMode && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-green-400 text-sm text-center">
                Вы регистрируетесь по приглашению
              </p>
            </div>
          )}

          {error && <div className="mb-4 text-red-500 text-center">{error}</div>}

          <form onSubmit={isRegisterMode ? handleRegister : handleLogin}>
            {/* Поля регистрации */}
            {isRegisterMode && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2 text-purple-400">Никнейм</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-3 bg-gray-800 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                    minLength={2}
                    maxLength={30}
                    placeholder="Ваше имя или никнейм"
                  />
                  <p className="text-gray-500 text-xs mt-1">Опционально. Если не указан, будет использоваться ваш email</p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2 text-purple-400">Дата рождения *</label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full p-3 bg-gray-800 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                  <p className="text-gray-500 text-xs mt-1">Обязательное поле для ограничения контента по возрасту</p>
                </div>
              </>
            )}

            {/* Email */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                {inviteCode ? 'Email (из приглашения)' : 'Email'}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                readOnly={!!inviteCode}
                disabled={!!inviteCode}
                className={`w-full p-3 bg-gray-800 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 ${
                  inviteCode ? 'opacity-60 cursor-not-allowed' : ''
                }`}
                required
              />
              {inviteCode && (
                <p className="text-gray-500 text-xs mt-1">Email закреплён за приглашением и не может быть изменён</p>
              )}
            </div>

            {/* Пароль */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 bg-gray-800 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Согласие с условиями */}
            {isRegisterMode && (
              <div className="mb-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-gray-600 bg-gray-800 text-purple-600 focus:ring-purple-500 focus:ring-offset-gray-900 cursor-pointer flex-shrink-0"
                    required
                  />
                  <span className="text-sm text-gray-400 leading-relaxed">
                    Я даю согласие на обработку моих персональных данных и принимаю{' '}
                    <button
                      type="button"
                      onClick={() => setShowTerms(true)}
                      className="text-purple-400 hover:text-purple-300 underline"
                    >
                      Пользовательское соглашение
                    </button>
                  </span>
                </label>
              </div>
            )}

            {/* Кнопка отправки */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 text-white rounded-lg font-medium hover:brightness-110 disabled:opacity-70 flex items-center justify-center ${
                isRegisterMode 
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600' 
                  : 'bg-gradient-to-r from-blue-600 to-purple-600'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Загрузка...</span>
                </div>
              ) : isRegisterMode ? 'Зарегистрироваться' : 'Войти'}
            </button>
          </form>
        </div>
      </div>

      <TermsOfServiceModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
    </>
  );
}
