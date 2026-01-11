'use client';

import { signIn } from 'next-auth/react';
import { useState, useEffect } from 'react';
import TermsOfServiceModal from './TermsOfServiceModal';

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
  inviteCode?: string;
};

export default function AuthModal({ isOpen, onClose, initialEmail = '', inviteCode = '' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Установка начальных значений при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      if (initialEmail) {
        setEmail(initialEmail);
        // Если есть inviteCode, переключаем в режим регистрации
        if (inviteCode) {
          setMode('register');
        }
      }
      // Сбрасываем ошибку при открытии
      setError('');
    }
  }, [isOpen, initialEmail, inviteCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (mode === 'login') {
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
    } else {
      // Передаем inviteToken если пользователь регистрируется по приглашению
      const signupData = {
        email,
        password,
        name,
        birthDate,
        agreedToTerms,
        ...(inviteCode && { inviteToken: inviteCode }),
      };

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
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <div className="relative w-full max-w-md p-6 bg-gray-900 rounded-xl shadow-2xl border border-gray-800">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h3 className="text-2xl font-bold text-center mb-6">
            {mode === 'login' ? 'Войти' : 'Регистрация'}
          </h3>

          <div className="flex justify-center mb-6 gap-8">
            <button
              onClick={() => setMode('login')}
              className={`pb-2 border-b-2 transition ${mode === 'login' ? 'border-blue-500 text-white' : 'border-transparent text-gray-400'}`}
            >
              Вход
            </button>
            <button
              onClick={() => setMode('register')}
              className={`pb-2 border-b-2 transition ${mode === 'register' ? 'border-purple-500 text-white' : 'border-transparent text-gray-400'}`}
            >
              Регистрация
            </button>
          </div>

          {error && <div className="mb-4 text-red-500 text-center">{error}</div>}

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
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

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 bg-gray-800 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

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

            {mode === 'register' && (
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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:brightness-110 disabled:opacity-70 flex items-center justify-center"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Загрузка...</span>
                </div>
              ) : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
            </button>
          </form>
        </div>
      </div>

      <TermsOfServiceModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
    </>
  );
}
