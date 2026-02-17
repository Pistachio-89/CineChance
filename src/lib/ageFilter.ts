/**
 * Определяет, нужно ли фильтровать взрослый контент на основе возраста пользователя
 * @param birthDate Дата рождения пользователя (string | null)
 * @param defaultDefaultValue Значение по умолчанию, если дата рождения неизвестна
 * @returns true если нужно фильтровать взрослый контент
 */
export function shouldFilterAdult(birthDate: string | null, defaultDefaultValue: boolean = true): boolean {
  if (!birthDate) {
    return defaultDefaultValue;
  }

  try {
    const birth = new Date(birthDate);
    const now = new Date();
    const age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    
    // Корректировка возраста, если день рождения еще не наступил в этом году
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      return age - 1 >= 18 ? false : true;
    }
    
    return age >= 18 ? false : true;
  } catch {
    // Если не удалось распарсить дату, используем значение по умолчанию
    return defaultDefaultValue;
  }
}
