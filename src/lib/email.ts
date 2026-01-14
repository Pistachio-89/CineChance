// Email-сервис для отправки писем через Яндекс SMTP
import { logger } from '@/lib/logger';
import nodemailer from 'nodemailer';

// Инициализация nodemailer для Yandex
const transporter = nodemailer.createTransport({
  host: 'smtp.yandex.ru',
  port: 465,
  secure: true, // true для порта 465
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

// Проверка конфигурации при загрузке модуля
function checkConfiguration() {
  const isConfigured = !!(
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_FROM
  );

  if (isConfigured) {
    logger.info('Email провайдер: Яндекс SMTP', { context: 'Email' });
  } else {
    logger.warn('Yandex SMTP настройки неполные', { context: 'Email' });
    logger.warn('Требуются: SMTP_USER, SMTP_PASS, SMTP_FROM', { context: 'Email' });
  }
  return isConfigured;
}

const isConfigured = checkConfiguration();

interface SendInviteEmailParams {
  to: string;
  inviteLink: string;
  inviterName?: string;
}

export async function sendInviteEmail({
  to,
  inviteLink,
  inviterName = 'Пользователь',
}: SendInviteEmailParams): Promise<boolean> {
  if (!isConfigured) {
    logger.warn('Email сервис не настроен', { context: 'Email' });
    return false;
  }

  const appName = 'CineChance';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const htmlContent = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Приглашение в ${appName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 32px; font-weight: bold;">
          🎬 ${appName}
        </h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">
          Персональные кинопремьеры
        </p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #1f2937; padding: 40px 30px; border-radius: 0 0 16px 16px;">
        <p style="color: #e5e7eb; font-size: 18px; margin: 0 0 20px;">
          Привет! 👋
        </p>
        <p style="color: #9ca3af; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
          <strong style="color: #e5e7eb;">${inviterName}</strong> приглашает вас присоединиться к ${appName} — сервису персональных кинопремьер с умными рекомендациями.
        </p>

        <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 12px; padding: 24px; margin-bottom: 30px;">
          <p style="color: #e5e7eb; font-size: 14px; margin: 0 0 16px; text-align: center;">
            🔑 Ваша персональная ссылка для регистрации:
          </p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="text-align: center;">
                <a href="${inviteLink}"
                   style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                  Зарегистрироваться
                </a>
              </td>
            </tr>
          </table>
          <p style="color: #6b7280; font-size: 12px; margin: 16px 0 0; text-align: center;">
            Ссылка действительна 7 дней
          </p>
        </div>

        <div style="border-top: 1px solid #374151; padding-top: 24px; margin-top: 24px;">
          <p style="color: #6b7280; font-size: 14px; margin: 0 0 16px;">
            📌 Что вас ждёт в ${appName}:
          </p>
          <ul style="color: #9ca3af; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
            <li>Персонализированные рекомендации фильмов и сериалов</li>
            <li>Умные алгоритмы на основе ваших предпочтений</li>
            <li>История просмотров и оценки</li>
            <li>Списки желаемых фильмов с уведомлениями о премьерах</li>
          </ul>
        </div>
      </td>
    </tr>
    <tr>
      <td style="text-align: center; padding: 20px;">
        <p style="color: #6b7280; font-size: 12px; margin: 0;">
          Если кнопка не работает, скопируйте ссылку вручную:<br>
          <span style="color: #9ca3af; word-break: break-all;">${inviteLink}</span>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const textContent = `
Привет!

${inviterName} приглашает вас присоединиться к CineChance — сервису персональных кинопремьер.

Перейдите по ссылке для регистрации:
${inviteLink}

Ссылка действительна 7 дней.

Если ссылка не открывается, скопируйте её и вставьте в адресную строку браузера.

---
CineChance — персональные кинопремьеры
${appUrl}
`;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject: `🎬 Приглашение в ${appName} — регистрация`,
      text: textContent,
      html: htmlContent,
    });

    logger.info('Приглашение отправлено', { to, context: 'Email' });
    return true;
  } catch (error) {
    logger.error('Ошибка отправки приглашения', { error: error instanceof Error ? error.message : error, context: 'Email' });
    return false;
  }
}

// Экспорт функции проверки конфигурации
export function isEmailConfigured(): boolean {
  return isConfigured;
}
