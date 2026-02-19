// src/app/profile/settings/SettingsClient.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Sliders, Trash2, X, AlertTriangle, Loader2, CheckCircle, AlertCircle, Save } from 'lucide-react';
import { deleteAccount } from '@/app/actions/deleteAccount';
import { signOut } from 'next-auth/react';
import { logger } from '@/lib/logger';

export default function SettingsClient() {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  
  // Состояния для сброса истории рекомендаций
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Состояния для настроек рекомендаций
  const [minRating, setMinRating] = useState(6.0);
  const [includeWant, setIncludeWant] = useState(true);
  const [includeWatched, setIncludeWatched] = useState(true);
  const [includeDropped, setIncludeDropped] = useState(false);
  const [includeMovie, setIncludeMovie] = useState(true);
  const [includeTv, setIncludeTv] = useState(true);
  const [includeAnime, setIncludeAnime] = useState(true);
  const [includeCartoon, setIncludeCartoon] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Загружаем настройки при монтировании
  useEffect(() => {
    fetchSettings();
  }, []);

  // Получить настройки пользователя
  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/user/settings');
      if (response.ok) {
        const data = await response.json();
        // Обрабатываем как undefined, так и null
        if (data.minRating !== undefined && data.minRating !== null) {
          setMinRating(data.minRating);
        }
        if (data.includeWant !== undefined) {
          setIncludeWant(data.includeWant);
        }
        if (data.includeWatched !== undefined) {
          setIncludeWatched(data.includeWatched);
        }
        if (data.includeDropped !== undefined) {
          setIncludeDropped(data.includeDropped);
        }
        if (data.includeMovie !== undefined) {
          setIncludeMovie(data.includeMovie);
        }
        if (data.includeTv !== undefined) {
          setIncludeTv(data.includeTv);
        }
        if (data.includeAnime !== undefined) {
          setIncludeAnime(data.includeAnime);
        }
        if (data.includeCartoon !== undefined) {
          setIncludeCartoon(data.includeCartoon);
        }
      }
    } catch (error) {
      logger.error('Failed to fetch settings', { error: error instanceof Error ? error.message : String(error) });
    }
  };

  // Подсчёт количества включённых фильтров списков
  const enabledListFiltersCount = [includeWant, includeWatched, includeDropped].filter(Boolean).length;
  
  // Подсчёт количества включённых типов контента
  const enabledTypeFiltersCount = [includeMovie, includeTv, includeAnime, includeCartoon].filter(Boolean).length;

  // Обработчики с защитой от выключения всех фильтров списков
  const handleToggleWant = () => {
    if (!includeWant) {
      // Включаем
      setIncludeWant(true);
    } else if (enabledListFiltersCount > 1) {
      // Выключаем, если есть другие включённые фильтры
      setIncludeWant(false);
    }
    // Если это единственный включённый фильтр - ничего не делаем
  };

  const handleToggleWatched = () => {
    if (!includeWatched) {
      setIncludeWatched(true);
    } else if (enabledListFiltersCount > 1) {
      setIncludeWatched(false);
    }
  };

  const handleToggleDropped = () => {
    if (!includeDropped) {
      setIncludeDropped(true);
    } else if (enabledListFiltersCount > 1) {
      setIncludeDropped(false);
    }
  };
  
  // Обработчики для типов контента
  const handleToggleMovie = () => {
    if (!includeMovie) {
      setIncludeMovie(true);
    } else if (enabledTypeFiltersCount > 1) {
      setIncludeMovie(false);
    }
  };
  
  const handleToggleTv = () => {
    if (!includeTv) {
      setIncludeTv(true);
    } else if (enabledTypeFiltersCount > 1) {
      setIncludeTv(false);
    }
  };
  
  const handleToggleAnime = () => {
    if (!includeAnime) {
      setIncludeAnime(true);
    } else if (enabledTypeFiltersCount > 1) {
      setIncludeAnime(false);
    }
  };
  
  const handleToggleCartoon = () => {
    if (!includeCartoon) {
      setIncludeCartoon(true);
    } else if (enabledTypeFiltersCount > 1) {
      setIncludeCartoon(false);
    }
  };

  // Сохранить настройки
  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          minRating, 
          includeWant, 
          includeWatched, 
          includeDropped,
          includeMovie,
          includeTv,
          includeAnime,
          includeCartoon
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSaveMessage({ type: 'success', text: 'Настройки сохранены' });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage({ type: 'error', text: data.error || 'Ошибка сохранения' });
      }
    } catch (error) {
      logger.error('Failed to save settings', { error: error instanceof Error ? error.message : String(error) });
      setSaveMessage({ type: 'error', text: 'Ошибка соединения' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'УДАЛИТЬ') {
      setDeleteError('Введите "УДАЛИТЬ" для подтверждения');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    const result = await deleteAccount();

    if (result.success) {
      // При успехе закрываем модалку и выходим из системы
      setShowDeleteModal(false);
      await signOut({ redirect: false });
      router.push('/');
    } else {
      setDeleteError(result.error || 'Произошла ошибка');
      setIsDeleting(false);
    }
  };

  // Открыть модальное окно подтверждения сброса
  const handleOpenResetModal = () => {
    setIsResetConfirmOpen(true);
    setResetMessage(null);
  };

  // Подтвердить сброс истории
  const confirmResetLogs = async () => {
    setIsResetConfirmOpen(false);
    setIsResetting(true);
    setResetMessage(null);

    try {
      const response = await fetch('/api/recommendations/reset-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setResetMessage({ type: 'success', text: data.message || 'История рекомендаций очищена' });
      } else {
        setResetMessage({ type: 'error', text: data.error || 'Ошибка при очистке истории' });
      }
    } catch (error) {
      logger.error('Reset history error', { error: error instanceof Error ? error.message : String(error) });
      setResetMessage({ type: 'error', text: 'Ошибка соединения' });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-blue-400" />
          <h2 className="text-xl font-semibold text-white">Настройки</h2>
        </div>
        <p className="text-gray-400 text-sm mt-2">
          Управление параметрами вашего аккаунта
        </p>
      </div>

      {/* Настройки рекомендаций */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex items-center gap-3 mb-6">
          <Sliders className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Настройки рекомендаций</h3>
        </div>

        <div className="space-y-6">
          {/* Ползунок - Минимальный рейтинг */}
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <div className="flex justify-between mb-3">
              <label className="text-white font-medium">Минимальный рейтинг</label>
              <span className="text-blue-400 font-medium">{minRating}+</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="0.5"
              value={minRating}
              onChange={(e) => setMinRating(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>1</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>

          {/* Переключатели списков */}
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <label className="text-white font-medium block mb-4">Включить в рекомендации</label>
            
            {/* Хочу посмотреть */}
            <button
              type="button"
              onClick={handleToggleWant}
              className={`
                w-full px-3 py-3 rounded-lg transition-all duration-200 mb-2 text-left
                ${includeWant
                  ? 'bg-blue-500/20 border border-blue-500/30'
                  : 'bg-gray-800/50 border border-gray-700/50 hover:bg-gray-800'
                }
                ${!includeWant && enabledListFiltersCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              disabled={!includeWant && enabledListFiltersCount === 0}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${includeWant ? 'bg-white' : 'bg-gray-700'}`}>
                    <span className={`font-bold ${includeWant ? 'text-blue-500 text-base' : 'text-gray-400 text-sm'}`}>+</span>
                  </div>
                  <span className={`text-sm font-medium ${includeWant ? 'text-white' : 'text-gray-300'}`}>
                    Хочу посмотреть
                  </span>
                </div>
                <div className={`w-10 h-5 rounded-full transition-colors ${includeWant ? 'bg-blue-500' : 'bg-gray-700'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transform transition-transform mt-0.5 ${includeWant ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </div>
            </button>

            {/* Уже просмотрено */}
            <button
              type="button"
              onClick={handleToggleWatched}
              className={`
                w-full px-3 py-3 rounded-lg transition-all duration-200 mb-2 text-left
                ${includeWatched
                  ? 'bg-green-500/20 border border-green-500/30'
                  : 'bg-gray-800/50 border border-gray-700/50 hover:bg-gray-800'
                }
                ${!includeWatched && enabledListFiltersCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              disabled={!includeWatched && enabledListFiltersCount === 0}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${includeWatched ? 'bg-green-500' : 'bg-gray-700'}`}>
                    <span className="text-xs font-bold text-white">✓</span>
                  </div>
                  <span className={`text-sm font-medium ${includeWatched ? 'text-white' : 'text-gray-300'}`}>
                    Уже просмотрено
                  </span>
                </div>
                <div className={`w-10 h-5 rounded-full transition-colors ${includeWatched ? 'bg-green-500' : 'bg-gray-700'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transform transition-transform mt-0.5 ${includeWatched ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </div>
            </button>

            {/* Брошено */}
            <button
              type="button"
              onClick={handleToggleDropped}
              className={`
                w-full px-3 py-3 rounded-lg transition-all duration-200 text-left
                ${includeDropped
                  ? 'bg-red-500/20 border border-red-500/30'
                  : 'bg-gray-800/50 border border-gray-700/50 hover:bg-gray-800'
                }
                ${!includeDropped && enabledListFiltersCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              disabled={!includeDropped && enabledListFiltersCount === 0}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${includeDropped ? 'bg-red-500' : 'bg-gray-700'}`}>
                    <span className="font-bold text-white text-sm">×</span>
                  </div>
                  <span className={`text-sm font-medium ${includeDropped ? 'text-white' : 'text-gray-300'}`}>
                    Брошено
                  </span>
                </div>
                <div className={`w-10 h-5 rounded-full transition-colors ${includeDropped ? 'bg-red-500' : 'bg-gray-700'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transform transition-transform mt-0.5 ${includeDropped ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </div>
            </button>
          </div>

          {/* Переключатели типов контента */}
          <div className="p-4 bg-gray-800/50 rounded-lg mt-4">
            <label className="text-white font-medium block mb-4">Типы контента</label>
            
            {/* Фильмы */}
            <button
              type="button"
              onClick={handleToggleMovie}
              className={`
                w-full px-3 py-3 rounded-lg transition-all duration-200 mb-2 text-left
                ${includeMovie
                  ? 'bg-green-500/20 border border-green-500/30'
                  : 'bg-gray-800/50 border border-gray-700/50 hover:bg-gray-800'
                }
                ${!includeMovie && enabledTypeFiltersCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              disabled={!includeMovie && enabledTypeFiltersCount === 0}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${includeMovie ? 'bg-green-500' : 'bg-gray-700'}`}>
                    <span className="font-bold text-white text-sm">F</span>
                  </div>
                  <span className={`text-sm font-medium ${includeMovie ? 'text-white' : 'text-gray-300'}`}>
                    Фильмы
                  </span>
                </div>
                <div className={`w-10 h-5 rounded-full transition-colors ${includeMovie ? 'bg-green-500' : 'bg-gray-700'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transform transition-transform mt-0.5 ${includeMovie ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </div>
            </button>

            {/* Сериалы */}
            <button
              type="button"
              onClick={handleToggleTv}
              className={`
                w-full px-3 py-3 rounded-lg transition-all duration-200 mb-2 text-left
                ${includeTv
                  ? 'bg-blue-500/20 border border-blue-500/30'
                  : 'bg-gray-800/50 border border-gray-700/50 hover:bg-gray-800'
                }
                ${!includeTv && enabledTypeFiltersCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              disabled={!includeTv && enabledTypeFiltersCount === 0}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${includeTv ? 'bg-blue-500' : 'bg-gray-700'}`}>
                    <span className="font-bold text-white text-sm">T</span>
                  </div>
                  <span className={`text-sm font-medium ${includeTv ? 'text-white' : 'text-gray-300'}`}>
                    Сериалы
                  </span>
                </div>
                <div className={`w-10 h-5 rounded-full transition-colors ${includeTv ? 'bg-blue-500' : 'bg-gray-700'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transform transition-transform mt-0.5 ${includeTv ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </div>
            </button>

            {/* Аниме */}
            <button
              type="button"
              onClick={handleToggleAnime}
              className={`
                w-full px-3 py-3 rounded-lg transition-all duration-200 mb-2 text-left
                ${includeAnime
                  ? 'bg-purple-500/20 border border-purple-500/30'
                  : 'bg-gray-800/50 border border-gray-700/50 hover:bg-gray-800'
                }
                ${!includeAnime && enabledTypeFiltersCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              disabled={!includeAnime && enabledTypeFiltersCount === 0}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${includeAnime ? 'bg-purple-500' : 'bg-gray-700'}`}>
                    <span className="font-bold text-white text-sm">A</span>
                  </div>
                  <span className={`text-sm font-medium ${includeAnime ? 'text-white' : 'text-gray-300'}`}>
                    Аниме
                  </span>
                </div>
                <div className={`w-10 h-5 rounded-full transition-colors ${includeAnime ? 'bg-purple-500' : 'bg-gray-700'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transform transition-transform mt-0.5 ${includeAnime ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </div>
            </button>

            {/* Мульты */}
            <button
              type="button"
              onClick={handleToggleCartoon}
              className={`
                w-full px-3 py-3 rounded-lg transition-all duration-200 mb-2 text-left
                ${includeCartoon
                  ? 'bg-orange-500/20 border border-orange-500/30'
                  : 'bg-gray-800/50 border border-gray-700/50 hover:bg-gray-800'
                }
                ${!includeCartoon && enabledTypeFiltersCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              disabled={!includeCartoon && enabledTypeFiltersCount === 0}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${includeCartoon ? 'bg-orange-500' : 'bg-gray-700'}`}>
                    <span className="font-bold text-white text-sm">M</span>
                  </div>
                  <span className={`text-sm font-medium ${includeCartoon ? 'text-white' : 'text-gray-300'}`}>
                    Мульты
                  </span>
                </div>
                <div className={`w-10 h-5 rounded-full transition-colors ${includeCartoon ? 'bg-orange-500' : 'bg-gray-700'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transform transition-transform mt-0.5 ${includeCartoon ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </div>
            </button>
          </div>

          {/* Кнопка сохранения и сообщение */}
          <div className="flex justify-end items-center gap-3">
            {saveMessage && (
              <div className={`flex items-center gap-2 text-sm ${
                saveMessage.type === 'success' ? 'text-green-400' : 'text-red-400'
              }`}>
                {saveMessage.type === 'success' ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                <span>{saveMessage.text}</span>
              </div>
            )}
            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg text-white text-sm transition ${
                isSaving
                  ? 'bg-blue-900/50 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Сохранить настройки
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Очистка данных */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex items-center gap-3 mb-6">
          <Trash2 className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Очистка данных</h3>
        </div>

        <div className="p-4 bg-gray-800/50 rounded-lg">
          <p className="text-gray-400 text-sm mb-3">История рекомендаций</p>
          
          <button
            onClick={handleOpenResetModal}
            disabled={isResetting}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition ${
              isResetting
                ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                : 'bg-red-900/50 hover:bg-red-900/70 text-red-400'
            }`}
          >
            {isResetting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Очистка...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Очистить историю рекомендаций
              </>
            )}
          </button>

          {/* Сообщение о результате */}
          {resetMessage && (
            <div className={`mt-3 p-3 rounded-lg flex items-center gap-2 text-sm ${
              resetMessage.type === 'success'
                ? 'bg-green-900/30 text-green-400'
                : 'bg-red-900/30 text-red-400'
            }`}>
              {resetMessage.type === 'success' ? (
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{resetMessage.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* Опасная зона */}
      <div className="bg-gray-900 rounded-xl p-6 border-red-800/30">
        <h3 className="text-lg font-semibold text-red-400 mb-4">Опасная зона</h3>
        <p className="text-gray-400 text-sm mb-4">
          Эти действия нельзя отменить. Будьте внимательны.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="px-4 py-2 bg-red-900/50 hover:bg-red-900/70 rounded-lg text-red-400 text-sm transition"
        >
          Удалить аккаунт
        </button>
      </div>

      {/* Модальное окно подтверждения удаления */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl max-w-md w-full border border-red-800/50">
            {/* Заголовок */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-400" />
                <h3 className="text-xl font-semibold text-white">Удалить аккаунт?</h3>
              </div>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                  setDeleteError(null);
                }}
                className="p-2 hover:bg-gray-800 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Контент */}
            <div className="p-6 space-y-4">
              <div className="p-4 bg-red-900/20 rounded-lg border border-red-800/30">
                <p className="text-red-400 text-sm">
                  <strong>Внимание!</strong> Это действие нельзя отменить.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-gray-400 text-sm">
                  При удалении аккаунта будут безвозвратно удалены:
                </p>
                <ul className="text-gray-500 text-sm space-y-1 list-disc list-inside">
                  <li>Ваш профиль и все данные</li>
                  <li>Список фильмов к просмотру</li>
                  <li>История рекомендаций</li>
                  <li>Статистика и настройки</li>
                </ul>
              </div>

              <div className="space-y-2">
                <label className="text-white font-medium text-sm">
                  Для подтверждения введите <code className="text-red-400">УДАЛИТЬ</code>
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="УДАЛИТЬ"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                />
              </div>

              {deleteError && (
                <p className="text-red-400 text-sm">{deleteError}</p>
              )}
            </div>

            {/* Действия */}
            <div className="flex gap-3 p-6 border-t border-gray-800">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                  setDeleteError(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white text-sm transition"
              >
                Отмена
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmText !== 'УДАЛИТЬ'}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm transition ${
                  isDeleting || deleteConfirmText !== 'УДАЛИТЬ'
                    ? 'bg-red-900/50 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Удаление...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Удалить навсегда
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно подтверждения сброса истории рекомендаций */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl max-w-md w-full border border-yellow-800/50">
            {/* Заголовок */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-yellow-400" />
                <h3 className="text-xl font-semibold text-white">Сбросить историю?</h3>
              </div>
              <button
                onClick={() => setIsResetConfirmOpen(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Контент */}
            <div className="p-6 space-y-4">
              <div className="p-4 bg-yellow-900/20 rounded-lg border border-yellow-800/30">
                <p className="text-yellow-400 text-sm">
                  Это удалит всю историю показов рекомендаций. После этого вы снова сможете получать рекомендации из всех фильмов.
                </p>
              </div>
            </div>

            {/* Действия */}
            <div className="flex gap-3 p-6 border-t border-gray-800">
              <button
                onClick={() => setIsResetConfirmOpen(false)}
                className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white text-sm transition"
              >
                Отмена
              </button>
              <button
                onClick={confirmResetLogs}
                disabled={isResetting}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm transition ${
                  isResetting
                    ? 'bg-yellow-900/50 cursor-not-allowed'
                    : 'bg-yellow-600 hover:bg-yellow-500'
                }`}
              >
                {isResetting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Очистка...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Сбросить
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
