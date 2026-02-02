/**
 * Константы для ID статусов фильмов
 * Это позволяет избежать запросов к таблице MovieStatus для получения ID по имени
 */

export const MOVIE_STATUS_IDS = {
  WANT_TO_WATCH: 1,      // Хочу посмотреть
  WATCHED: 2,           // Просмотрено  
  REWATCHED: 3,         // Пересмотрено
  DROPPED: 4,           // Брошено
} as const;

export const MOVIE_STATUS_NAMES = {
  [MOVIE_STATUS_IDS.WANT_TO_WATCH]: 'Хочу посмотреть',
  [MOVIE_STATUS_IDS.WATCHED]: 'Просмотрено',
  [MOVIE_STATUS_IDS.REWATCHED]: 'Пересмотрено',
  [MOVIE_STATUS_IDS.DROPPED]: 'Брошено',
} as const;

/**
 * Получает ID статуса по имени
 */
export function getStatusIdByName(statusName: string): number | null {
  const entry = Object.entries(MOVIE_STATUS_NAMES).find(([_, name]) => name === statusName);
  return entry ? parseInt(entry[0]) : null;
}

/**
 * Получает имя статуса по ID
 */
export function getStatusNameById(statusId: number): string | null {
  return MOVIE_STATUS_NAMES[statusId as keyof typeof MOVIE_STATUS_NAMES] || null;
}

/**
 * Получает ID статусов для списков рекомендаций
 */
export function getRecommendationStatusIds(lists: string[]): number[] {
  const statusIds: number[] = [];
  
  if (lists.includes('want')) {
    statusIds.push(MOVIE_STATUS_IDS.WANT_TO_WATCH);
  }
  if (lists.includes('watched')) {
    statusIds.push(MOVIE_STATUS_IDS.WATCHED, MOVIE_STATUS_IDS.REWATCHED);
  }
  if (lists.includes('dropped')) {
    statusIds.push(MOVIE_STATUS_IDS.DROPPED);
  }
  
  return statusIds;
}
