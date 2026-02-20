# Context: Phase 6 - Доработка страницы статистики /profile/stats

## Decisions

- **UI Pattern**: Использовать тот же стиль плашек, что на странице /profile (блок "Статистика" с плашками Просмотренно, Отложенно, Брошено, Скрыто)
- **Content Types**: 4 типа контента - Фильмы, Сериалы, Аниме, Мультфильмы
- **Layout**: Горизонтальные плашки в верхней части страницы /profile/stats
- **Icons**: Использовать те же иконки что на странице /profile (Film, Tv, Monitor)

## Plan 01 (COMPLETED)

В верхней части размещаем 4 плашки с типами контента - Фильмы, Сериалы, Аниме, Мульты, Выводим цифровые значения по данным типам контента

## Plan 02 (NEW - Gap Closure)

### Issues to Fix:
1. **Icon mismatch**: Currently "Мульты" should be "Мультфильмы" to match /profile page
2. **Navigation vs Filter**: Cards currently navigate to /my-movies, should toggle filter on stats page instead
3. **Filter Logic**: Page should filter displayed data when content type is selected
4. **Toggle Behavior**: 
   - Page loads with all 4 types active (show all data)
   - Click on type → disable other 3, show only selected
   - Click on active type → disable all, show all types again

### Technical Implementation:
- Replace Link with button (remove href, add onClick)
- Add state for active content type filter
- Add filter logic to displayed stats (average rating, tags, genres should filter by selected type)
- Add visual indication of active/inactive state (opacity, border color)
