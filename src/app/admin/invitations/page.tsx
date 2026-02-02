import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect } from "next/navigation";
import InvitationsAdminClient from "./InvitationsAdminClient";
import AdminSidebar from "../AdminSidebar";

export default async function InvitationsAdminPage() {
  const session = await getServerSession(authOptions);

  // Проверка авторизации
  if (!session || !session.user) {
    redirect("/?auth=required");
  }

  // Проверка доступа только для определённого пользователя
  const ADMIN_USER_ID = 'cmkbc7sn2000104k3xd3zyf2a';
  if (session.user.id !== ADMIN_USER_ID) {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen bg-gray-900">
      {/* Сайдбар админ-панели */}
      <AdminSidebar />

      {/* Основной контент */}
      <main className="flex-1 p-8 overflow-auto">
        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Управление приглашениями</h1>
          <p className="text-gray-400">Создавайте и управляйте приглашениями для регистрации новых пользователей</p>
        </div>

        {/* Клиентский компонент с функционалом */}
        <InvitationsAdminClient userId={session.user.id} />
      </main>
    </div>
  );
}
