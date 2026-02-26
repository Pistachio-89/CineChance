## Обновление логики расчета совпадения жанров на странице сравнения

**Дата:** 25 февраля 2026  
**Файлы изменены:** 
- `src/lib/taste-map/similarity.ts` - новая функция `calculateGenreMatchPercentage`
- `src/app/profile/taste-map/compare/[userId]/page.tsx` - отображение процента

### Что изменилось

**На странице `/profile/taste-map/compare/[id]` в блоке "Жанры - Совпадение предпочитаемых жанров фильмов":**

#### Старая логика (Cosine Similarity)
- Использовался косинусный анализ векторов жанров
- Сравнивались только жанры, присутствующие у обоих пользователей
- Результат зависел от угла между векторами

#### Новая логика
1. **100% базис** = объединение всех жанров из фильмов статуса "Просмотрено/Пересмотрено" у ОБОИХ пользователей
2. **Совпадающие жанры** = жанры, где разница оценок ≤ 0.4 (на шкале 0-1, т.е. 40 пунктов на шкале 0-100)
3. **Результат** = (совпадающие жанры / все жанры) × 100%

### Пример расчета

**Профиль пользователя A:**
- Action: 90 (0.90 на шкале 0-1)
- Sci-Fi: 85 (0.85 на шкале 0-1)
- Comedy: 40 (0.40 на шкале 0-1)

**Профиль пользователя B:**
- Action: 88 (0.88 на шкале 0-1)
- Sci-Fi: 50 (0.50 на шкале 0-1)
- Drama: 75 (0.75 на шкале 0-1)

**Анализ:**
- Union жанров: Action, Sci-Fi, Comedy, Drama (4 жанра)
- Action: |0.90 - 0.88| = 0.02 ≤ 0.4 ✓ совпадает
- Sci-Fi: |0.85 - 0.50| = 0.35 ≤ 0.4 ✓ совпадает
- Comedy: |0.40 - 0.00| = 0.40 ≤ 0.4 ✓ совпадает (граница включена)
- Drama: |0.00 - 0.75| = 0.75 > 0.4 ✗ не совпадает

**Результат:** 3/4 = 75%

### Код изменений

#### Новая функция `calculateGenreMatchPercentage`

```typescript
export function calculateGenreMatchPercentage(
  profileA: GenreProfile,
  profileB: GenreProfile
): number {
  // Get all unique genres from both profiles (union)
  const allGenres = new Set([
    ...Object.keys(profileA),
    ...Object.keys(profileB),
  ]);
  
  if (allGenres.size === 0) {
    return 0;
  }
  
  const MATCH_THRESHOLD = 0.4; // On a 0-1 scale
  let matchingCount = 0;

  for (const genre of allGenres) {
    const ratingA = (profileA[genre] ?? 0) / 100; // Convert 0-100 to 0-1 scale
    const ratingB = (profileB[genre] ?? 0) / 100; // Convert 0-100 to 0-1 scale
    const diff = Math.abs(ratingA - ratingB);
    
    if (diff <= MATCH_THRESHOLD) {
      matchingCount++;
    }
  }
  
  return matchingCount / allGenres.size;
}
```

#### Обновленная функция `computeSimilarity`

Функция теперь использует `calculateGenreMatchPercentage` вместо `cosineSimilarity`:

```typescript
// Compute taste similarity using new genre match percentage logic
const tasteSimilarity = calculateGenreMatchPercentage(
  tasteMapA.genreProfile,
  tasteMapB.genreProfile
);
```

### Влияние на метрики

- **tasteSimilarity** (в блоке "Жанры"): Теперь показывает % жанров с совпадающими предпочтениями
- **overallMatch** (общее совпадение): Пересчитывается с учетом новой tasteSimilarity (вес 50%)
- **genreRatingSimilarity**: Сохранена как отдельная метрика (рейтинговое сходство)

### Тестирование

Функция протестирована на граничных случаях:
- ✓ Пустые профили
- ✓ Идеальное совпадение (diff = 0)
- ✓ Граничное значение (diff = 0.4)
- ✓ Превышение порога (diff > 0.4)
- ✓ Объединение жанров из двух профилей
- ✓ Отсутствующие жанры (трактуются как 0)

### Кэширование

Не требуется инвалидация кэша Redis:
- Taste maps кэшируются на 24 часа
- Similarity вычисляется на лету при каждой загрузке страницы
- Новая логика применяется автоматически при следующем открытии страницы сравнения
