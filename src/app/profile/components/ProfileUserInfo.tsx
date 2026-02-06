'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import Link from 'next/link';
import { Settings } from 'lucide-react';
import NicknameEditor from './NicknameEditor';

interface UserData {
  id: string;
  name: string | null;
  email: string | null;
  birthDate: Date | null;
  createdAt: Date;
}

function UserInfoSkeleton() {
  return (
    <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-6 border border-gray-800 animate-pulse">
      <div className="h-5 w-32 bg-gray-700 rounded mb-4"></div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-14 h-14 md:w-16 md:h-16 bg-gray-700 rounded-full flex-shrink-0"></div>
        <div className="flex-1 w-full min-w-0 space-y-2">
          <div className="h-5 w-48 bg-gray-700 rounded"></div>
          <div className="h-4 w-64 bg-gray-800 rounded"></div>
          <div className="h-4 w-32 bg-gray-800 rounded"></div>
        </div>
      </div>
    </div>
  );
}

export default function ProfileUserInfo() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await fetch('/api/user/profile');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUserData({
              id: 'user-id',
              name: data.user.name,
              email: data.user.email,
              birthDate: data.user.birthDate ? new Date(data.user.birthDate) : null,
              createdAt: new Date(data.user.createdAt),
            });
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const userEmail = userData?.email || '';
  const formattedBirthDate = userData?.birthDate 
    ? format(userData.birthDate, isMobile ? 'dd.MM.yyyy' : 'dd MMMM yyyy', { locale: ru })
    : null;

  const handleNicknameChange = (newName: string | null) => {
    setUserData(prev => prev ? { ...prev, name: newName } : null);
  };

  if (isLoading) {
    return <UserInfoSkeleton />;
  }

  return (
    <div className="space-y-4 px-4 sm:px-0">
      {/* Информация о пользователе */}
      {userData ? (
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
      ) : null}

      {/* Настройки параметров аккаунта */}
      <Link 
        href="/profile/settings"
        className="block bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-6 border border-gray-800 hover:border-gray-700 transition"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <Settings className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="text-white font-medium text-sm md:text-base">Настройки параметров аккаунта</p>
            <p className="text-gray-500 text-xs md:text-sm">Управление настройками профиля и рекомендаций</p>
          </div>
          <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Link>
    </div>
  );
}
