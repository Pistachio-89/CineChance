// src/app/actions/deleteAccount.ts
'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/auth';
import { redirect } from 'next/navigation';
import { signOut } from 'next-auth/react';

export async function deleteAccount() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return { success: false, error: 'Не авторизован' };
  }

  const userId = session.user.id;

  try {
    // Сначала проверяем, существует ли пользователь
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { success: false, error: 'Пользователь не найден' };
    }

    // Удаляем все связанные данные пользователя в правильном порядке
    // (из-за foreign key constraints)
    
    // 1. Удаляем записи в watchlist
    await prisma.watchList.deleteMany({
      where: { userId },
    });

    // 2. Удаляем записи в blacklist
    await prisma.blacklist.deleteMany({
      where: { userId },
    });

    // 3. Удаляем сессии пользователя
    await prisma.userSession.deleteMany({
      where: { userId },
    });

    // 4. Удаляем сессии фильтров
    await prisma.filterSession.deleteMany({
      where: { userId },
    });

    // 5. Удаляем события рекомендаций
    await prisma.recommendationEvent.deleteMany({
      where: { userId },
    });

    // 6. Удаляем сигналы намерений
    await prisma.intentSignal.deleteMany({
      where: { userId },
    });

    // 7. Удаляем негативную обратную связь
    await prisma.negativeFeedback.deleteMany({
      where: { userId },
    });

    // 8. Удаляем логи рекомендаций
    await prisma.recommendationLog.deleteMany({
      where: { userId },
    });

    // 9. Удаляем ML предсказания
    await prisma.predictionLog.deleteMany({
      where: { userId },
    });

    // 10. Удаляем эмбединги пользователя
    await prisma.userEmbedding.deleteMany({
      where: { userId },
    });

    // 11. Удаляем теги пользователя
    await prisma.tag.deleteMany({
      where: { userId },
    });

    // 12. Удаляем логи пересмотров
    await prisma.rewatchLog.deleteMany({
      where: { userId },
    });

    // 13. Удаляем историю оценок
    await prisma.ratingHistory.deleteMany({
      where: { userId },
    });

    // 14. Удаляем настройки рекомендаций
    await prisma.recommendationSettings.deleteMany({
      where: { userId },
    });

    // 15. Удаляем приглашения, созданные пользователем
    await prisma.invitation.deleteMany({
      where: { createdById: userId },
    });

    // 16. Удаляем аккаунты (NextAuth)
    await prisma.account.deleteMany({
      where: { userId },
    });

    // 17. Удаляем сессии (NextAuth)
    await prisma.session.deleteMany({
      where: { userId },
    });

    // 18. Удаляем приглашения, использованные пользователем
    await prisma.invitation.updateMany({
      where: { usedById: userId },
      data: { usedById: null },
    });

    // 19. Удаляем самого пользователя
    await prisma.user.delete({
      where: { id: userId },
    });

    // Выходим из системы после удаления
    await signOut({ redirect: false });

    return { success: true };
  } catch (error) {
    console.error('Ошибка удаления аккаунта:', error);
    return { 
      success: false, 
      error: error instanceof Error && error.message.includes('P2025')
        ? 'Аккаунт уже удалён'
        : 'Не удалось удалить аккаунт. Попробуйте позже.' 
    };
  }
}
