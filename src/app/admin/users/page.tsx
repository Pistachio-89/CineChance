import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AdminSidebar from "../AdminSidebar";
import UsersTable from "./UsersTable";
import { Users, Calendar, Shield } from 'lucide-react';
import { Prisma } from '@prisma/client';

interface SearchParams {
  page?: string;
  pageSize?: string;
  sort?: string;
  order?: string;
  filterName?: string;
  filterEmail?: string;
  filterStatus?: string;
}

export default async function UsersAdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getServerSession(authOptions);
  const params = await searchParams;

  // Проверка авторизации
  if (!session || !session.user) {
    redirect("/?auth=required");
  }

  // Проверка доступа только для определённого пользователя
  const ADMIN_USER_ID = 'cmkbc7sn2000104k3xd3zyf2a';
  if (session.user.id !== ADMIN_USER_ID) {
    redirect('/');
  }

  // Параметры пагинации
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const pageSize = Math.min(100, Math.max(10, parseInt(params.pageSize || '25', 10)));

  // Параметры сортировки
  const sortField = params.sort || 'createdAt';
  const sortDirection = (params.order === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';

  // Build where clause for filters
  const where: Prisma.UserWhereInput = {};

  if (params.filterName) {
    where.name = { contains: params.filterName, mode: 'insensitive' };
  }

  if (params.filterEmail) {
    where.email = { contains: params.filterEmail, mode: 'insensitive' };
  }

  if (params.filterStatus === 'verified') {
    where.emailVerified = { not: null };
  } else if (params.filterStatus === 'unverified') {
    where.emailVerified = { equals: null };
  }

  // Build orderBy clause (using any for Prisma complex order types)
  let orderBy: Prisma.UserOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'desc' }];

  switch (sortField) {
    case 'name':
      orderBy = [{ name: sortDirection }, { id: 'desc' }];
      break;
    case 'email':
      orderBy = [{ email: sortDirection }, { id: 'desc' }];
      break;
    case 'createdAt':
      orderBy = [{ createdAt: sortDirection }, { id: 'desc' }];
      break;
    case 'watchList':
      orderBy = [{ watchList: { _count: sortDirection } }, { id: 'desc' }];
      break;
    case 'recommendationLogs':
      orderBy = [{ recommendationLogs: { _count: sortDirection } }, { id: 'desc' }];
      break;
    case 'status':
      orderBy = [{ emailVerified: sortDirection === 'asc' ? 'desc' : 'asc' }, { id: 'desc' }];
      break;
  }

  // Загрузка общего количества пользователей (с учётом фильтров)
  const filteredCount = await prisma.user.count({ where });

  // Загрузка пользователей с пагинацией, сортировкой и фильтрацией
  const users = await prisma.user.findMany({
    where,
    orderBy,
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      createdAt: true,
      emailVerified: true,
      _count: {
        select: {
          watchList: true,
          recommendationLogs: true,
        },
      },
    },
  });

  // Общая статистика (по всем пользователям, без фильтров)
  const totalUsersCount = await prisma.user.count();
  const verifiedCount = await prisma.user.count({
    where: { emailVerified: { not: null } },
  });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const newUsers7DaysCount = await prisma.user.count({
    where: { createdAt: { gt: sevenDaysAgo } },
  });

  // Расчёт пагинации
  const totalPages = Math.ceil(filteredCount / pageSize);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  // Сериализация данных для клиента
  const serializedUsers = users.map((user) => ({
    ...user,
    createdAt: user.createdAt,
    emailVerified: user.emailVerified,
  }));

  return (
    <div className="flex min-h-screen bg-gray-900">
      {/* Сайдбар админ-панели */}
      <AdminSidebar />

      {/* Основной контент */}
      <main className="flex-1 p-8 overflow-auto">
        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Пользователи</h1>
          <p className="text-gray-400">
            Управление пользователями платформы
          </p>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-blue-400" />
              <span className="text-gray-400 text-sm">Всего пользователей</span>
            </div>
            <p className="text-3xl font-bold text-white">{totalUsersCount}</p>
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-5 h-5 text-green-400" />
              <span className="text-gray-400 text-sm">Подтверждённых</span>
            </div>
            <p className="text-3xl font-bold text-green-400">{verifiedCount}</p>
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-5 h-5 text-purple-400" />
              <span className="text-gray-400 text-sm">За 7 дней</span>
            </div>
            <p className="text-3xl font-bold text-purple-400">{newUsers7DaysCount}</p>
          </div>
        </div>

        {/* Список пользователей */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Все пользователи</h2>
          <UsersTable
            users={serializedUsers}
            totalUsersCount={filteredCount}
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            hasNextPage={hasNextPage}
            hasPrevPage={hasPrevPage}
          />
        </div>
      </main>
    </div>
  );
}
