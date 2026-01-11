'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import NicknameEditor from './NicknameEditor';
import TermsOfServiceModal from '@/app/components/TermsOfServiceModal';

interface UserData {
  id: string;
  name: string | null;
  email: string | null;
  birthDate: Date | null;
  createdAt: Date;
}

interface ProfileOverviewClientProps {
  initialUserData: UserData;
  watchListCount: number;
  blacklistCount: number;
}

export default function ProfileOverviewClient({ 
  initialUserData, 
  watchListCount, 
  blacklistCount 
}: ProfileOverviewClientProps) {
  const [userData, setUserData] = useState(initialUserData);
  const [isMobile, setIsMobile] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Определяем мобильное устройство
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const userEmail = userData.email || '';

  const formattedBirthDate = userData.birthDate 
    ? format(userData.birthDate, isMobile ? 'dd.MM.yyyy' : 'dd MMMM yyyy', { locale: ru })
    : null;

  const handleNicknameChange = (newName: string | null) => {
    setUserData(prev => ({ ...prev, name: newName }));
  };

  return (
    <div className="space-y-4 md:space-y-6 px-4 sm:px-0">
      {/* Информация о пользователе */}
      <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-6 border border-gray-800">
        <h2 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4">Информация</h2>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xl md:text-2xl font-bold flex-shrink-0">
            {userData.name?.charAt(0) || userData.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 w-full min-w-0 space-y-1">
            <NicknameEditor 
              initialName={userData.name || ''} 
              onNicknameChange={handleNicknameChange}
            />
            <p className="text-gray-400 text-sm md:text-base truncate" title={userEmail}>
              {userEmail}
            </p>
            <p className="text-gray-500 text-xs md:text-sm">
              Дата рождения: <span className="text-gray-300">{formattedBirthDate || '-'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Статистика - ВСЕГДА в одну строку (2 колонки) */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-6 border border-gray-800">
          <p className="text-gray-400 text-xs md:text-sm mb-1">Фильмов в списке</p>
          <p className="text-2xl md:text-3xl font-bold text-white">{watchListCount}</p>
        </div>
        <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-6 border border-gray-800">
          <p className="text-gray-400 text-xs md:text-sm mb-1">Скрыто фильмов</p>
          <p className="text-2xl md:text-3xl font-bold text-white">{blacklistCount}</p>
        </div>
      </div>

      {/* Сбор данных */}
      <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-6 border border-gray-800">
        <p className="text-white font-medium text-sm md:text-base">Сбор данных</p>
        <p className="text-gray-500 text-xs md:text-sm">Разрешён сбор событий взаимодействия</p>
      </div>

      {/* Пользовательское соглашение */}
      <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-6 border border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-medium text-sm md:text-base">Пользовательское соглашение</p>
            <p className="text-gray-500 text-xs md:text-sm">Просмотр условий использования сервиса</p>
          </div>
          <button
            onClick={() => setShowTermsModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition"
          >
            <FileText className="w-4 h-4" />
            Открыть
          </button>
        </div>
      </div>

      {/* Быстрые ссылки */}
      <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-6 border border-gray-800">
        <h2 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4">Быстрый доступ</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <Link 
            href="/my-movies"
            className="p-3 md:p-4 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition text-center block"
          >
            <p className="text-white font-medium text-sm md:text-base">Мои фильмы</p>
            <p className="text-gray-500 text-xs md:text-sm">Управление списком</p>
          </Link>
          <Link 
            href="/profile/settings"
            className="p-3 md:p-4 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition text-center block"
          >
            <p className="text-white font-medium text-sm md:text-base">Настройки</p>
            <p className="text-gray-500 text-xs md:text-sm">Параметры аккаунта</p>
          </Link>
        </div>
      </div>

      {/* Модальное окно пользовательского соглашения */}
      <TermsOfServiceModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} />
    </div>
  );
}