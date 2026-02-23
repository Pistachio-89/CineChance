# Roadmap: CineChance

**Created:** 2026-02-17
**Mode:** YOLO (Auto-approve)

## Milestones

- ✅ **v1.0 Stabilization** — Phases 1-8 (shipped 2026-02-21)
- 🚀 **v2.0 Recommendations** — Phases 9-15 (in progress)
  - User-to-user recommendations based on Taste Map
  - 8 pattern matching algorithms
  - ML feedback loop

---

## Phase 1: Tests & Logging — SHIPPED

**Status:** ✅ Complete (2026-02-17)

**Plans:** 1 plan
- [x] 01-01-PLAN.md — Add tests and logging infrastructure

---

## Phase 2: Error Handling — SHIPPED

**Status:** ✅ Complete (2026-02-17)

**Plans:** 2 plans
- [x] 02-01-PLAN.md — Add error boundaries
- [x] 02-02-PLAN.md — Add custom error pages

---

## Phase 3: Lint Cleanup — COMPLETED

**Status:** ✅ Complete (2026-02-20)

**Plans:** 5 plans

- [x] 03-01-PLAN.md — Исправить 629 ошибок lint (частично: console.log → logger)
- [x] 03-02-PLAN.md — Gap closure: исправить оставшиеся 439 errors
- [x] 03-03-PLAN.md — Gap closure: исправить оставшиеся 408 errors
- [x] 03-04-PLAN.md — Gap closure: удалить eslint-disable, исправить типы (239→182 errors)
- [x] 03-05-PLAN.md — Gap closure: финальное исправление 182 errors (unused-vars)

---

## Phase 4: Animation Filter — COMPLETED

**Status:** ✅ Complete (2026-02-19)

**Requirements:** [ANIM-01]

**Plans:** 1 plan
- [x] 04-01-PLAN.md — Add "Мульт" filter button to Recommendations page

---

## Phase 5: Recommendation Filters Enhancement — COMPLETED

**Status:** ✅ Complete (2026-02-19)

**Requirements:** [FILTER-01, FILTER-02]

**Plans:** 1 plan
- [x] 05-01-PLAN.md — Rename Мульт→Мульты, add content type filters to Settings

---

## Phase 6: Stats Page Enhancement — COMPLETED

**Status:** ✅ Complete (2026-02-20)

**Requirements:** None

**Plans:** 1 plan
- [x] 06-01-PLAN.md — 4 плашки с типами контента (Фильмы, Сериалы, Аниме, Мульты)

---

## After Stabilization

When all phases are complete and confident — can plan:
- Performance optimization
- New functionality

### Phase 7: Admin user statistics

**Goal:** Admin functionality for user statistics management
**Depends on:** Phase 6
**Plans:** 3 plans

Plans:
- [ ] 07-01-PLAN.md — Пагинация списка пользователей
- [ ] 07-02-PLAN.md — Фильтрация и сортировка по колонкам
- [ ] 07-03-PLAN.md — Страница статистики пользователя (как profile/stats)

### Phase 8: Admin panel UI improvements

**Goal:** Redesign admin panel UI - sidebar, user table, stats
**Depends on:** Phase 7
**Plans:** 1 plan

Plans:
- [ ] 08-01-PLAN.md — UI improvements for admin panel

---

## v2.0: User-to-User Recommendations

**Goal:** Рекомендации фильмов пользователям на основе Карты вкусов (Taste Map)

### Phase 9: ML Database Schema — COMPLETE

**Goal:** Добавить таблицы для ML feedback loop в Prisma schema
**Depends on:** Phase 8
**Status:** ✅ Complete (2026-02-22)
**Plans:** 1 plan

Plans:
- [x] 09-01-PLAN.md — Add ML tables: RecommendationDecision, PredictionOutcome, ModelCorrection, ModelTraining

---

### Phase 10: Taste Map Infrastructure

**Goal:** Создать инфраструктуру для вычисления и хранения Taste Map
**Depends on:** Phase 9
**Plans:** 3/3 plans complete

Plans:
- [x] 10-01-PLAN.md — TasteMap структура данных и Redis хранение
- [x] 10-02-PLAN.md — Similarity calculation (поиск похожих пользователей)

---

### Phase 11: Core Recommendation Patterns

**Goal:** Реализовать базовые паттерны рекомендаций (1-4)
**Depends on:** Phase 10
**Plans:** 2/2 plans complete

Plans:
- [x] 11-01-PLAN.md — Patterns 1-2: Taste Match, Want-to-watch Overlap
- [x] 11-02-PLAN.md — Patterns 3-4: Drop Patterns, Type Twins

---

### Phase 12: Advanced Recommendation Patterns

**Goal:** Реализовать продвинутые паттерны рекомендаций (5-8)
**Depends on:** Phase 11
**Plans:** 2/2 plans created

Plans:
- [ ] 12-01-PLAN.md — Patterns 5-6: Genre Twins, Genre Recommendations
- [ ] 12-02-PLAN.md — Patterns 7-8: Person Twins, Person Recommendations

---

### Phase 13: Recommendation API

**Goal:** Создать API для получения рекомендаций с обработкой Edge Cases
**Depends on:** Phase 12
**Plans:** 2 plans

Plans:
- [ ] 13-01-PLAN.md — Recommendation API endpoint + Cold Start handling
- [ ] 13-02-PLAN.md — Heavy Users handling, Graceful Degradation, Confidence Scoring

---

### Phase 14: UI Integration

**Goal:** Интегрировать рекомендации в UI
**Depends on:** Phase 13
**Plans:** 2 plans

Plans:
- [ ] 14-01-PLAN.md — Main page: Top-12 recommendations horizontal scroll
- [ ] 14-02-PLAN.md — Admin ML Dashboard: discrepancy monitoring, model corrections

---

### Phase 15: ML Feedback Loop

**Goal:** Замкнуть цикл: логирование решений → отслеживание исходов → коррекция модели
**Depends on:** Phase 14
**Plans:** 1 plan

Plans:
- [ ] 15-01-PLAN.md — Decision logging, outcome tracking, auto-corrections

---

_For current project status, see .planning/PROJECT.md_
