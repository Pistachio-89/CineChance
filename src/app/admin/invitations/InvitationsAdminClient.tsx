'use client';

import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';

interface Invitation {
  id: string;
  email: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  createdBy: {
    name: string | null;
    email: string;
  };
  usedBy: {
    name: string | null;
    email: string;
  } | null;
  isValid: boolean;
}

interface InvitationsAdminClientProps {
  userId: string;
}

export default function InvitationsAdminClient({ userId: _userId }: InvitationsAdminClientProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Загрузка списка приглашений
  const loadInvitations = async () => {
    try {
      const response = await fetch('/api/invitations/admin');
      if (response.ok) {
        const data = await response.json();
        setInvitations(data.invitations);
      }
    } catch (error) {
      logger.error('Error loading invitations', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    loadInvitations();
  }, []);

  // Создание приглашения
  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: `Приглашение для ${email} создано!` });
        setEmail('');
        loadInvitations(); // Обновляем список
      } else {
        setMessage({ type: 'error', text: data.error || 'Ошибка создания приглашения' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Ошибка соединения с сервером' });
    } finally {
      setIsLoading(false);
    }
  };

  // Копирование ссылки
  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  // Удаление приглашения
  const handleDeleteInvite = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить это приглашение?')) return;

    try {
      const response = await fetch(`/api/invitations/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadInvitations();
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Ошибка удаления' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Ошибка соединения с сервером' });
    }
  };

  // Форматирование даты
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Статус приглашения
  const getStatusBadge = (invitation: Invitation) => {
    if (invitation.usedAt) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Использовано
        </span>
      );
    }
    if (!invitation.isValid) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Истёк
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Активно
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Сообщение об ошибке/успехе */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'
        }`}>
          <p className={message.type === 'success' ? 'text-green-400' : 'text-red-400'}>{message.text}</p>
        </div>
      )}

      {/* Форма создания приглашения */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Создать приглашение
        </h2>

        <form onSubmit={handleCreateInvite} className="flex gap-4">
          <div className="flex-1">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:brightness-110 disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Создание...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Создать
              </>
            )}
          </button>
        </form>
        <p className="text-gray-500 text-sm mt-2">
          Приглашение будет действительно в течение 7 дней
        </p>
      </div>

      {/* Список приглашений */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Все приглашения
          </h2>
          <button
            onClick={loadInvitations}
            className="text-gray-400 hover:text-white transition"
            title="Обновить список"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {isLoadingList ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : invitations.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p>Приглашений пока нет</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                  <th className="pb-3 pr-4">Email</th>
                  <th className="pb-3 pr-4">Статус</th>
                  <th className="pb-3 pr-4">Создано</th>
                  <th className="pb-3 pr-4">Действует до</th>
                  <th className="pb-3 pr-4">Создал</th>
                  <th className="pb-3 pr-4">Использовано кем</th>
                  <th className="pb-3">Действия</th>
                </tr>
              </thead>
              <tbody className="text-white">
                {invitations.map((invitation) => (
                  <tr key={invitation.id} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                    <td className="py-4 pr-4">
                      <span className="font-medium">{invitation.email}</span>
                    </td>
                    <td className="py-4 pr-4">
                      {getStatusBadge(invitation)}
                    </td>
                    <td className="py-4 pr-4 text-gray-400">
                      {formatDate(invitation.createdAt)}
                    </td>
                    <td className="py-4 pr-4 text-gray-400">
                      {formatDate(invitation.expiresAt)}
                    </td>
                    <td className="py-4 pr-4 text-gray-400">
                      {invitation.createdBy.name || invitation.createdBy.email}
                    </td>
                    <td className="py-4 pr-4 text-gray-400">
                      {invitation.usedBy ? (
                        <span className="text-gray-300">
                          {invitation.usedBy.name || invitation.usedBy.email}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyInviteLink(invitation.token)}
                          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"
                          title="Копировать ссылку"
                        >
                          {copiedToken === invitation.token ? (
                            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                        {!invitation.usedAt && (
                          <button
                            onClick={() => handleDeleteInvite(invitation.id)}
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition"
                            title="Удалить"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <p className="text-gray-400 text-sm">Всего приглашений</p>
          <p className="text-2xl font-bold text-white">{invitations.length}</p>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <p className="text-gray-400 text-sm">Использовано</p>
          <p className="text-2xl font-bold text-green-400">
            {invitations.filter(i => i.usedAt).length}
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <p className="text-gray-400 text-sm">Активных</p>
          <p className="text-2xl font-bold text-blue-400">
            {invitations.filter(i => !i.usedAt && i.isValid).length}
          </p>
        </div>
      </div>
    </div>
  );
}
