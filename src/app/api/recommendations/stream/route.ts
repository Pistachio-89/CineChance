import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  // Проверка аутентификации
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const ADMIN_USER_ID = 'cmkbc7sn2000104k3xd3zyf2a';
  const userId = session.user.id as string;

  // Проверка прав администратора
  if (userId !== ADMIN_USER_ID || process.env.NODE_ENV !== 'development') {
    return new Response('Forbidden', { status: 403 });
  }

  // Создаем Server-Sent Events stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Функция для отправки событий
      const sendEvent = (type: string, data: any) => {
        const eventData = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(eventData));
      };

      // Отправляем начальное событие
      sendEvent('connected', { message: 'Debug stream connected', timestamp: Date.now() });

      // Устанавливаем интервал для отправки статуса
      const interval = setInterval(async () => {
        try {
          // Получаем текущую статистику
          const stats = await prisma.watchList.count({
            where: { userId }
          });

          sendEvent('stats', {
            totalMovies: stats,
            timestamp: Date.now(),
            memory: process.memoryUsage(),
          });
        } catch (error) {
          sendEvent('error', { message: 'Failed to fetch stats', error: String(error) });
        }
      }, 2000); // Каждые 2 секунды

      // Очистка при закрытии соединения
      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}
