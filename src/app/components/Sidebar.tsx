'use client';

import Link from 'next/link';
import { useSession, signOut } from "next-auth/react";
import { useState } from 'react';
import AuthModal from './AuthModal';

type SidebarProps = {
  isOpen: boolean;
  toggle: () => void;
};

export default function Sidebar({ isOpen, toggle }: SidebarProps) {
  const { data: session, status } = useSession();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const isLoading = status === "loading";

  const handleLogin = () => {
    setShowAuthModal(true);
  };

  const handleLogout = async () => {
    await signOut({
      redirect: true,
      callbackUrl: "/",
    });

    if (window.innerWidth < 1024) toggle();
  };

  // Базовые пункты меню для всех пользователей
  const baseMenuItems = [
    ['/', 'Главная'],
  ];

  // Дополнительные пункты меню только для авторизованных пользователей
  const authMenuItems = [
    ['/my-movies', 'Мои фильмы'],
    ['/recommendations', 'Что посмотреть'],
  ];

  // Объединяем меню в зависимости от статуса авторизации
  const menuItems = session?.user 
    ? [...baseMenuItems, ...authMenuItems]
    : baseMenuItems;

  return (
    <>
      {isOpen && (
        <div
          onClick={toggle}
          className="fixed inset-0 bg-black/70 z-30 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 border-r border-gray-800 flex flex-col transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
      >
        <div className="p-4 border-b border-gray-800 flex justify-end lg:hidden">
          <button
            onClick={toggle}
            className="text-white text-2xl hover:text-purple-500 transition"
          >
            ✕
          </button>
        </div>

        {/* Пользователь */}
        <div className="p-6 border-b border-gray-800">
          {isLoading ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-800 rounded-full animate-pulse mx-auto mb-3" />
              <p className="text-gray-400">Загрузка...</p>
            </div>
          ) : session?.user ? (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-3">
                {session.user.name?.charAt(0) || session.user.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <h3 className="text-white font-medium text-center">
                {session.user.name || session.user.email}
              </h3>
              
            </div>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center text-gray-400 text-2xl mb-3 mx-auto">
                👤
              </div>
              <p className="text-gray-400">Войдите для доступа к профилю</p>
            </div>
          )}
        </div>

        {/* Навигация */}
        <nav className="flex-1 px-6 py-4 overflow-y-auto">
          <ul className="space-y-2">
            {menuItems.map(([href, label]) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => window.innerWidth < 1024 && toggle()}
                  className="block py-3 px-4 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Аутентификация */}
        <div className="p-6 border-t border-gray-800">
          {isLoading ? (
            <div className="h-10 bg-gray-800 rounded-lg animate-pulse" />
          ) : session?.user ? (
            <>
              <button
                onClick={handleLogout}
                className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-lg font-medium hover:brightness-110 transition mb-3"
              >
                Выйти
              </button>

              <Link
                href="/profile"
                onClick={() => window.innerWidth < 1024 && toggle()}
                className="block text-center py-2 text-gray-400 hover:text-white transition text-sm"
              >
                Настройки профиля
              </Link>
            </>
          ) : (
            <>
              <button
                onClick={handleLogin}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:brightness-110 transition"
              >
                Войти
              </button>

            </>
          )}
        </div>
      </aside>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
}