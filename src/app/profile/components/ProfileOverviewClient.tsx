'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import Link from 'next/link';
import dynamic from 'next/dynamic';
const TermsOfServiceModal = dynamic(() => import('@/app/components/TermsOfServiceModal'), { ssr: false });
import { Settings, ArrowRight, TrendingUp, Monitor, Tv, Smile, CheckIcon, XIcon, Clock as ClockIcon, EyeOff as EyeOffIcon, PieChart as PieChartIcon, Film, Users, BarChart3, Clapperboard, UserPlus, FileText, Map } from 'lucide-react';
import NicknameEditor from './NicknameEditor';

interface UserStats {
  total: {
    watched: number;
    wantToWatch: number;
    dropped: number;
    hidden: number;
    totalForPercentage: number;
  };
  typeBreakdown: {
    movie: number;
    tv: number;
    cartoon: number;
    anime: number;
  };
}

interface UserStatsData {
  id: string;
  name: string | null;
  email: string | null;
  birthDate: Date | null;
  createdAt: Date;
}

interface ProfileOverviewClientProps {
  userId: string;
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

function StatsCardSkeleton() {
  return (
    <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-4 h-4 bg-gray-700 rounded"></div>
        <div className="h-4 w-24 bg-gray-700 rounded"></div>
      </div>
      <div className="h-8 w-16 bg-gray-700 rounded"></div>
    </div>
  );
}

function TypeBreakdownSkeleton() {
  return (
    <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-4 h-4 bg-gray-700 rounded"></div>
        <div className="h-4 w-24 bg-gray-700 rounded"></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-5 h-5 bg-gray-700 rounded"></div>
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <div className="h-4 w-16 bg-gray-700 rounded"></div>
                <div className="h-4 w-8 bg-gray-700 rounded"></div>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full w-1/2 bg-gray-700 rounded-full"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProfileOverviewClient({ userId }: ProfileOverviewClientProps) {
  const [userData, setUserData] = useState<UserStatsData | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  
  const [userDataLoading, setUserDataLoading] = useState(true);
  const [basicStatsLoading, setBasicStatsLoading] = useState(true);
  const [typeBreakdownLoading, setTypeBreakdownLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await fetch('/api/user/profile');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUserData({
              id: userId,
              name: data.user.name,
              email: data.user.email,
              birthDate: data.user.birthDate ? new Date(data.user.birthDate) : null,
              createdAt: new Date(data.user.createdAt),
            });
          }
        }
      } catch (error) {
      } finally {
        setUserDataLoading(false);
      }
    };
    
    const timer = setTimeout(fetchUserData, 50);
    return () => clearTimeout(timer);
  }, [userId]);

  useEffect(() => {
    const loadDataInParallel = async () => {
      try {
        const statsRes = await fetch('/api/user/stats');

        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats({
            total: {
              watched: data.total?.watched || 0,
              wantToWatch: data.total?.wantToWatch || 0,
              dropped: data.total?.dropped || 0,
              hidden: data.total?.hidden || 0,
              totalForPercentage: data.total?.totalForPercentage || 0,
            },
            typeBreakdown: {
              movie: data.typeBreakdown?.movie || 0,
              tv: data.typeBreakdown?.tv || 0,
              cartoon: data.typeBreakdown?.cartoon || 0,
              anime: data.typeBreakdown?.anime || 0,
            },
          });
        }
        setBasicStatsLoading(false);
        setTypeBreakdownLoading(false);

      } catch (error) {
        setBasicStatsLoading(false);
        setTypeBreakdownLoading(false);
      }
    };

    loadDataInParallel();
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const userEmail = userData?.email || '';
  const formattedBirthDate = userData?.birthDate 
    ? format(userData.birthDate, isMobile ? 'dd.MM.yyyy' : 'dd MMMM yyyy', { locale: ru })
    : null;

  const handleNicknameChange = (newName: string | null) => {
    setUserData(prev => prev ? { ...prev, name: newName } : null);
  };

  return (
    <div className="space-y-4 md:space-y-6 px-4 sm:px-0">
      {userDataLoading ? (
        <UserInfoSkeleton />
      ) : userData ? (
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

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Статистика</h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {basicStatsLoading ? (
            <>
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
            </>
          ) : stats?.total ? (
            <>
              <Link
                href="/my-movies?tab=watched"
                className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 hover:border-green-500/50 hover:bg-gray-800/80 transition cursor-pointer block"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-7 h-7 bg-green-400/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckIcon className="w-4 h-4 text-green-400" />
                  </div>
                  <p className="text-gray-400 text-xs md:text-sm">Просмотрено</p>
                </div>
                <p className="text-2xl md:text-3xl font-bold text-white pl-10">
                  {stats.total.watched}
                </p>
              </Link>

              <Link
                href="/my-movies?tab=want_to_watch"
                className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 hover:border-blue-500/50 hover:bg-gray-800/80 transition cursor-pointer block"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-7 h-7 bg-blue-400/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <ClockIcon className="w-4 h-4 text-blue-400" />
                  </div>
                  <p className="text-gray-400 text-xs md:text-sm">Отложено</p>
                </div>
                <p className="text-2xl md:text-3xl font-bold text-white pl-10">
                  {stats.total.wantToWatch}
                </p>
              </Link>

              <Link
                href="/my-movies?tab=dropped"
                className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 hover:border-red-500/50 hover:bg-gray-800/80 transition cursor-pointer block"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-7 h-7 bg-red-400/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <XIcon className="w-4 h-4 text-red-400" />
                  </div>
                  <p className="text-gray-400 text-xs md:text-sm">Брошено</p>
                </div>
                <p className="text-2xl md:text-3xl font-bold text-white pl-10">
                  {stats.total.dropped}
                </p>
              </Link>

              <Link
                href="/my-movies?tab=hidden"
                className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 hover:border-gray-500/50 hover:bg-gray-800/80 transition cursor-pointer block"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-7 h-7 bg-gray-400/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <EyeOffIcon className="w-4 h-4 text-gray-400" />
                  </div>
                  <p className="text-gray-400 text-xs md:text-sm">Скрыто</p>
                </div>
                <p className="text-2xl md:text-3xl font-bold text-white pl-10">
                  {stats.total.hidden}
                </p>
              </Link>
            </>
          ) : null}
        </div>

        <div className="w-full">
          {typeBreakdownLoading ? (
            <TypeBreakdownSkeleton />
          ) : stats?.typeBreakdown ? (
            <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800">
              <div className="flex items-center gap-2 mb-4">
                <PieChartIcon className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-medium text-white">Типы контента</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <div className="flex items-center gap-3">
                  <Monitor className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-gray-300 text-sm">Фильмы</span>
                      <span className="text-white text-xs">{stats.typeBreakdown.movie}</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${stats.total?.totalForPercentage > 0 
                            ? (stats.typeBreakdown.movie / stats.total.totalForPercentage) * 100 
                            : 0}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Tv className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-gray-300 text-sm">Сериалы</span>
                      <span className="text-white text-xs">{stats.typeBreakdown.tv}</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${stats.total?.totalForPercentage > 0 
                            ? (stats.typeBreakdown.tv / stats.total.totalForPercentage) * 100 
                            : 0}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Smile className="w-5 h-5 text-orange-400 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-gray-300 text-sm">Мультфильмы</span>
                      <span className="text-white text-xs">{stats.typeBreakdown.cartoon}</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-orange-500 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${stats.total?.totalForPercentage > 0 
                            ? (stats.typeBreakdown.cartoon / stats.total.totalForPercentage) * 100 
                            : 0}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 text-purple-400 text-sm font-bold">あ</span>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-gray-300 text-sm">Аниме</span>
                      <span className="text-white text-xs">{stats.typeBreakdown.anime}</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-500 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${stats.total?.totalForPercentage > 0 
                            ? (stats.typeBreakdown.anime / stats.total.totalForPercentage) * 100 
                            : 0}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <Link
          href="/profile/stats"
          className="flex items-center justify-center gap-2 w-full py-3 bg-gray-900 hover:bg-gray-800 rounded-lg border border-gray-800 hover:border-blue-500/50 transition text-gray-400 hover:text-white text-sm"
        >
          <BarChart3 className="w-4 h-4" />
          <span>Показать всю статистику</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        <Link
          href="/profile/collections"
          className="flex items-center gap-3 bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 hover:border-purple-500/50 hover:bg-gray-800/80 transition cursor-pointer"
        >
          <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-400/20 rounded-full flex items-center justify-center flex-shrink-0">
            <Film className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1">
            <p className="text-white font-medium text-sm md:text-base">Кинофраншизы</p>
            <p className="text-gray-500 text-xs md:text-sm">Просмотренные коллекции</p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
        </Link>

        <Link
          href="/profile/actors"
          className="flex items-center gap-3 bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 hover:border-amber-500/50 hover:bg-gray-800/80 transition cursor-pointer"
        >
          <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-400/20 rounded-full flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-white font-medium text-sm md:text-base">Любимые актеры</p>
            <p className="text-gray-500 text-xs md:text-sm">Ваши любимые актеры</p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
        </Link>

        <Link
          href="/profile/creators"
          className="flex items-center gap-3 bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 hover:border-blue-500/50 hover:bg-gray-800/80 transition cursor-pointer"
        >
          <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-400/20 rounded-full flex items-center justify-center flex-shrink-0">
            <Clapperboard className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="text-white font-medium text-sm md:text-base">Любимые режиссеры</p>
            <p className="text-gray-500 text-xs md:text-sm">Ваши любимые режиссеры</p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
        </Link>
      </div>

      <Link
        href="/profile/taste-map"
        className="flex items-center gap-3 bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 hover:border-purple-500/50 hover:bg-gray-800/80 transition cursor-pointer"
      >
        <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
          <Map className="w-5 h-5 text-purple-400" />
        </div>
        <div className="flex-1">
          <p className="text-white font-medium text-sm md:text-base">Карта вкуса</p>
          <p className="text-gray-500 text-xs md:text-sm">Ваши предпочтения в фильмах</p>
        </div>
        <ArrowRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
      </Link>

      <div className="space-y-3">
        <Link
          href="/profile/invite"
          className="flex items-center gap-3 bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 hover:border-green-500/50 hover:bg-gray-800/80 transition cursor-pointer"
        >
          <div className="w-10 h-10 md:w-12 md:h-12 bg-green-400/20 rounded-full flex items-center justify-center flex-shrink-0">
            <UserPlus className="w-5 h-5 text-green-400" />
          </div>
          <div className="flex-1">
            <p className="text-white font-medium text-sm md:text-base">Пригласить друга</p>
            <p className="text-gray-500 text-xs md:text-sm">Пригласите друзей и получите бонусы</p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
        </Link>

        <button
          onClick={() => setShowTermsModal(true)}
          className="flex items-center gap-3 bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 hover:border-gray-500/50 hover:bg-gray-800/80 transition cursor-pointer w-full text-left"
        >
          <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-400/20 rounded-full flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex-1">
            <p className="text-white font-medium text-sm md:text-base">Соглашение</p>
            <p className="text-gray-500 text-xs md:text-sm">Пользовательское соглашение и политика обработки данных</p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
        </button>
      </div>

      {showTermsModal && (
        <TermsOfServiceModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} />
      )}
    </div>
  );
}
