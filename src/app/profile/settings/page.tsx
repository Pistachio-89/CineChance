// src/app/profile/settings/page.tsx
'use client';

import { useState } from 'react';
import { Settings, Sliders, Trash2, X, AlertTriangle, Loader2, FileText } from 'lucide-react';
import { deleteAccount } from '@/app/actions/deleteAccount';
import TermsOfServiceModal from '@/app/components/TermsOfServiceModal';

interface RecommendationSettings {
  trackingEnabled: boolean;
  minRating: number;
}

export default function SettingsPage() {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [recSettings, setRecSettings] = useState<RecommendationSettings>({
    trackingEnabled: true,
    minRating: 6,
  });

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'УДАЛИТЬ') {
      setDeleteError('Введите "УДАЛИТЬ" для подтверждения');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    const result = await deleteAccount();

    if (result.success) {
      window.location.href = '/';
    } else {
      setDeleteError(result.error || 'Произошла ошибка');
      setIsDeleting(false);
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
          {/* Основные настройки */}
          <div className="space-y-4">
            <ToggleSetting
              title="Сбор данных"
              description="Разрешить сбор событий взаимодействия"
              checked={recSettings.trackingEnabled}
              onChange={(v) => setRecSettings({ ...recSettings, trackingEnabled: v })}
            />
            
            {/* Пользовательское соглашение */}
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-white font-medium">Пользовательское соглашение</p>
                <p className="text-gray-500 text-sm">Просмотр условий использования сервиса</p>
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

          {/* Ползунок - Минимальный рейтинг */}
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <div className="flex justify-between mb-3">
              <label className="text-white font-medium">Минимальный рейтинг</label>
              <span className="text-blue-400 font-medium">{recSettings.minRating}+</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="0.5"
              value={recSettings.minRating}
              onChange={(e) => setRecSettings({ ...recSettings, minRating: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>1</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>

          {/* Кнопка сохранения */}
          <div className="flex justify-end">
            <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition">
              Сохранить настройки
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
        
        <div className="space-y-4">
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <p className="text-gray-400 text-sm mb-3">История рекомендаций</p>
            <button className="flex items-center gap-2 px-4 py-2 bg-red-900/50 hover:bg-red-900/70 rounded-lg text-red-400 text-sm transition">
              <Trash2 className="w-4 h-4" />
              Очистить историю рекомендаций
            </button>
          </div>
          
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <p className="text-gray-400 text-sm mb-3">История просмотров</p>
            <button className="flex items-center gap-2 px-4 py-2 bg-red-900/50 hover:bg-red-900/70 rounded-lg text-red-400 text-sm transition">
              <Trash2 className="w-4 h-4" />
              Очистить историю просмотров
            </button>
          </div>
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

      {/* Модальное окно пользовательского соглашения */}
      <TermsOfServiceModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} />
    </div>
  );
}

function ToggleSetting({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-white font-medium">{title}</p>
        <p className="text-gray-500 text-sm">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          checked ? 'bg-blue-600' : 'bg-gray-700'
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
            checked ? 'translate-x-7' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
