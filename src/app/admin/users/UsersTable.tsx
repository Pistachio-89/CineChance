'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Users, Mail, Shield, ArrowUp, ArrowDown, Search, X } from 'lucide-react';
import Link from 'next/link';

interface UserData {
  id: string;
  name: string | null;
  email: string;
  createdAt: Date;
  emailVerified: Date | null;
  _count: {
    watchList: number;
    recommendationLogs: number;
  };
}

interface UsersTableProps {
  users: UserData[];
  totalUsersCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

type SortField = 'name' | 'email' | 'createdAt' | 'watchList' | 'recommendationLogs' | 'status';
type SortDirection = 'asc' | 'desc';

interface Filters {
  name: string;
  email: string;
  status: 'all' | 'verified' | 'unverified';
}

// Sort indicator component - defined outside main component
function SortIndicator({ field, currentField, direction }: { field: SortField; currentField: SortField; direction: SortDirection }) {
  if (currentField !== field) return null;
  return direction === 'asc' ? (
    <ArrowUp className="w-4 h-4 inline ml-1" />
  ) : (
    <ArrowDown className="w-4 h-4 inline ml-1" />
  );
}

export default function UsersTable({
  users,
  totalUsersCount,
  page,
  pageSize,
  totalPages,
  hasNextPage,
  hasPrevPage,
}: UsersTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get current sort/filter from URL
  const sortField = (searchParams.get('sort') as SortField) || 'createdAt';
  const sortDirection = (searchParams.get('order') as SortDirection) || 'desc';
  const filters: Filters = {
    name: searchParams.get('filterName') || '',
    email: searchParams.get('filterEmail') || '',
    status: (searchParams.get('filterStatus') as Filters['status']) || 'all',
  };

  const showFilters = Boolean(filters.name || filters.email || filters.status !== 'all');

  // Format date
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Update URL with new params
  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '' || value === 'all') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    // Reset to page 1 when filtering or sorting
    if (!updates.hasOwnProperty('page')) {
      params.set('page', '1');
    }

    router.push(`/admin/users?${params.toString()}`, { scroll: false });
  };

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction
      updateParams({
        sort: field,
        order: sortDirection === 'asc' ? 'desc' : 'asc',
      });
    } else {
      updateParams({
        sort: field,
        order: 'asc',
      });
    }
  };

  // Handle filter change
  const handleFilterChange = (key: keyof Filters, value: string) => {
    const paramMap: Record<string, string> = {
      name: 'filterName',
      email: 'filterEmail',
      status: 'filterStatus',
    };
    updateParams({ [paramMap[key]]: value || null });
  };

  // Clear filters
  const clearFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('filterName');
    params.delete('filterEmail');
    params.delete('filterStatus');
    params.set('page', '1');
    router.push(`/admin/users?${params.toString()}`, { scroll: false });
  };

  const hasActiveFilters = filters.name || filters.email || filters.status !== 'all';

  // Page navigation helpers
  const getPageUrl = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    return `/admin/users?${params.toString()}`;
  };

  // Generate page numbers
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (page > 3) {
        pages.push('...');
      }

      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }

      if (page < totalPages - 2) {
        pages.push('...');
      }

      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  // Th className for sortable columns
  const thClass = (field: SortField) =>
    `pb-3 pr-4 cursor-pointer select-none hover:text-white transition-colors ${
      sortField === field ? 'text-blue-400' : ''
    }`;

  // Get page size URL
  const getPageSizeUrl = (newPageSize: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', '1');
    params.set('pageSize', String(newPageSize));
    return `/admin/users?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      {/* Filter controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            if (hasActiveFilters) {
              clearFilters();
            } else {
              // Toggle show filters - just a visual toggle
            }
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          <Search className="w-4 h-4" />
          Фильтры
          {hasActiveFilters && (
            <span className="w-2 h-2 bg-blue-400 rounded-full" />
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            Сбросить
          </button>
        )}

        <span className="text-gray-400 text-sm">
          Показано: {users.length} из {totalUsersCount}
        </span>
      </div>

      {/* Filter inputs - always visible for simplicity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-700/30 rounded-lg border border-gray-700">
        <div>
          <label className="block text-gray-400 text-sm mb-2">Имя</label>
          <input
            type="text"
            placeholder="Поиск по имени..."
            value={filters.name}
            onChange={(e) => handleFilterChange('name', e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-gray-400 text-sm mb-2">Email</label>
          <input
            type="text"
            placeholder="Поиск по email..."
            value={filters.email}
            onChange={(e) => handleFilterChange('email', e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-gray-400 text-sm mb-2">Статус</label>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">Все</option>
            <option value="verified">Подтверждённые</option>
            <option value="unverified">Неподтверждённые</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
              <th className={thClass('name')} onClick={() => handleSort('name')}>
                Пользователь
                <SortIndicator field="name" currentField={sortField} direction={sortDirection} />
              </th>
              <th className={thClass('email')} onClick={() => handleSort('email')}>
                Email
                <SortIndicator field="email" currentField={sortField} direction={sortDirection} />
              </th>
              <th className={thClass('createdAt')} onClick={() => handleSort('createdAt')}>
                Дата регистрации
                <SortIndicator field="createdAt" currentField={sortField} direction={sortDirection} />
              </th>
              <th className={thClass('watchList')} onClick={() => handleSort('watchList')}>
                Фильмов
                <SortIndicator field="watchList" currentField={sortField} direction={sortDirection} />
              </th>
              <th className={thClass('recommendationLogs')} onClick={() => handleSort('recommendationLogs')}>
                Рекомендаций
                <SortIndicator field="recommendationLogs" currentField={sortField} direction={sortDirection} />
              </th>
              <th className={thClass('status')} onClick={() => handleSort('status')}>
                Статус
                <SortIndicator field="status" currentField={sortField} direction={sortDirection} />
              </th>
            </tr>
          </thead>
          <tbody className="text-white">
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Пользователи не найдены</p>
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr 
                  key={user.id} 
                  className="border-b border-gray-700/50 hover:bg-gray-700/20 cursor-pointer"
                  onClick={() => router.push(`/admin/users/${user.id}/stats`)}
                >
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                        {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">
                        {user.name || 'Без имени'}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-2 text-gray-300">
                      <Mail className="w-4 h-4 text-gray-500" />
                      {user.email}
                    </div>
                  </td>
                  <td className="py-4 pr-4 text-gray-400">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="py-4 pr-4 text-gray-300">
                    {user._count.watchList}
                  </td>
                  <td className="py-4 pr-4 text-gray-300">
                    {user._count.recommendationLogs}
                  </td>
                  <td className="py-4">
                    {user.emailVerified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
                        <Shield className="w-3 h-3" />
                        Подтверждён
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs">
                        Неподтверждён
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <div className="text-gray-400 text-sm">
            Показано {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalUsersCount)} из {totalUsersCount}
          </div>

          <div className="flex items-center gap-1">
            {hasPrevPage ? (
              <Link
                href={getPageUrl(page - 1)}
                className="flex items-center gap-1 px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"
              >
                ← Назад
              </Link>
            ) : (
              <span className="flex items-center gap-1 px-3 py-2 text-gray-600 cursor-not-allowed">
                ← Назад
              </span>
            )}

            <div className="flex items-center gap-1">
              {getPageNumbers().map((pageNum, idx) =>
                pageNum === '...' ? (
                  <span key={`ellipsis-${idx}`} className="px-3 py-2 text-gray-500">
                    ...
                  </span>
                ) : (
                  <Link
                    key={pageNum}
                    href={getPageUrl(pageNum as number)}
                    className={`px-3 py-2 rounded-lg transition ${
                      pageNum === page
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    {pageNum}
                  </Link>
                )
              )}
            </div>

            {hasNextPage ? (
              <Link
                href={getPageUrl(page + 1)}
                className="flex items-center gap-1 px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"
              >
                Вперёд →
              </Link>
            ) : (
              <span className="flex items-center gap-1 px-3 py-2 text-gray-600 cursor-not-allowed">
                Вперёд →
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Показывать:</span>
            <select
              className="bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-600 focus:outline-none focus:border-purple-500"
              value={pageSize}
              onChange={(e) => {
                window.location.href = getPageSizeUrl(parseInt(e.target.value, 10));
              }}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
