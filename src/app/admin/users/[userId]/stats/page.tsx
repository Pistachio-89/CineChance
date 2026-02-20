import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import AdminSidebar from '../../../AdminSidebar';
import AdminStatsClient from './AdminStatsClient';

const ADMIN_USER_ID = 'cmkbc7sn2000104k3xd3zyf2a';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export default async function AdminUserStatsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await getServerSession(authOptions);
  const { userId } = await params;

  // Auth check
  if (!session || !session.user) {
    redirect("/?auth=required");
  }

  // Admin check
  if (session.user.id !== ADMIN_USER_ID) {
    redirect('/');
  }

  // Fetch user data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!user) {
    redirect('/admin/users');
  }

  return (
    <div className="flex min-h-screen bg-gray-900">
      <AdminSidebar />

      <main className="flex-1 p-8 overflow-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Статистика пользователя
          </h1>
          <p className="text-gray-400">
            Подробная статистика активности пользователя
          </p>
        </div>

        <div className="max-w-4xl">
          <AdminStatsClient
            userId={user.id}
            userName={user.name}
            userEmail={user.email}
          />
        </div>
      </main>
    </div>
  );
}
