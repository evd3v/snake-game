# Requirements: English Learning App

**Defined:** 2026-03-09
**Core Value:** Пользователь читает реальную книгу в EPUB-читалке, получает AI-разбор каждого предложения, а извлечённые единицы попадают в систему интервального повторения — обучение через чтение в контексте.

## v1.0 Requirements (Validated)

### Sentence Analysis

- [x] **SENT-01**: User can input an English sentence via web UI
- [x] **SENT-02**: User can input an English sentence via Telegram bot
- [x] **SENT-03**: AI analyzes sentence and returns: translation, grammar breakdown, vocabulary, CEFR level
- [x] **SENT-04**: AI extracts collocations and phrasal verbs as separate units
- [x] **SENT-05**: AI identifies grammar patterns with specific notation (e.g. "would have + V3")
- [x] **SENT-06**: AI detects word families and links related forms (reluctance → reluctant, reluctantly)
- [x] **SENT-07**: AI assigns thematic cluster to extracted vocabulary

### Vocabulary

- [x] **VOCAB-01**: Words stored as lemmas with automatic deduplication
- [x] **VOCAB-02**: User selects which words to save after analysis
- [x] **VOCAB-03**: User sets familiarity level on add: "never seen" / "seen but unsure" / "understand in context"
- [x] **VOCAB-04**: Each word linked to original sentence(s) where encountered
- [x] **VOCAB-05**: Collocations and phrasal verbs stored as independent learnable units
- [x] **VOCAB-06**: Word families linked in database (one root → multiple forms)
- [x] **VOCAB-07**: Words auto-grouped into thematic clusters

### Spaced Repetition

- [x] **SRS-01**: FSRS algorithm for scheduling reviews
- [x] **SRS-02**: Flashcard review for vocabulary (show word → recall translation → rate)
- [x] **SRS-03**: Cloze exercises for grammar patterns (AI-generated sentence with gap)
- [x] **SRS-04**: Exercises pre-generated in batches (not at review time)
- [x] **SRS-05**: Original book sentence shown as context during word review
- [x] **SRS-06**: Grammar pattern progression (simple → complex variations)
- [x] **SRS-07**: Quick review session available in Telegram bot

### Dashboard

- [x] **DASH-01**: Overall progress counters (new / learning / known) for words and patterns
- [x] **DASH-02**: Weak spots: grammar patterns and words with low success rate
- [x] **DASH-03**: Activity streak and heatmap (days in a row, daily reviews/additions)
- [x] **DASH-04**: Thematic cluster coverage gaps

### Infrastructure

- [x] **INFRA-01**: PostgreSQL database with Drizzle ORM
- [x] **INFRA-02**: Fastify REST API backend (TypeScript)
- [x] **INFRA-03**: Vue 3 + TypeScript SPA frontend
- [x] **INFRA-04**: Telegram bot via grammY library
- [x] **INFRA-05**: Docker Compose deployment configuration
- [x] **INFRA-06**: Async AI processing (queue-based, non-blocking)

## v1.1 Requirements (Validated)

### Data Model

- [x] **DATA-01**: Слова хранятся с привязкой к POS через таблицу word_senses — одна lemma может иметь несколько значений с разными переводами
- [x] **DATA-02**: SRS-карточки привязаны к word_sense (не к word), каждое значение учится отдельно
- [x] **DATA-03**: Миграция существующих данных — существующие слова получают sense на основе имеющегося POS/translation

### Vocabulary Page

- [x] **VOCPG-01**: Пользователь видит полный список слов с поиском по lemma
- [x] **VOCPG-02**: Пользователь может фильтровать слова по familiarity, SRS state, CEFR уровню и тематическому кластеру
- [x] **VOCPG-03**: Пользователь может сортировать слова по алфавиту, дате добавления, CEFR уровню
- [x] **VOCPG-04**: Пользователь видит collocations связанные с каждым словом
- [x] **VOCPG-05**: Пользователь видит word family (однокоренные слова) для каждого слова
- [x] **VOCPG-06**: Пользователь может группировать слова по тематическим кластерам
- [x] **VOCPG-07**: Пользователь может пометить слово как "знаю" — оно исчезает из очереди повторения
- [x] **VOCPG-08**: Пользователь может сбросить статус слова ("забыл") — оно возвращается в очередь

### Web Review

- [x] **WREV-01**: Пользователь видит и проходит vocab карточки с контекстом предложения
- [x] **WREV-02**: Пользователь видит и проходит grammar cloze упражнения
- [x] **WREV-03**: Пользователь оценивает карточку кнопками Again/Hard/Good/Easy (+ клавиши 1-4)
- [x] **WREV-04**: Пользователь видит прогресс-бар во время сессии
- [x] **WREV-05**: Пользователь видит summary после завершения сессии (сколько Again/Hard/Good/Easy)
- [x] **WREV-06**: Web и Telegram review не конфликтуют (staleness guard)

### Telegram UX

- [x] **TG-01**: Все новые слова автоматически добавляются с SRS-карточками при анализе предложения
- [x] **TG-02**: Уже известные слова (есть SRS-карточка) не дублируются

### Collocations

- [x] **COLL-01**: Collocations отображаются в веб-UI при анализе предложения
- [x] **COLL-02**: Collocations видны на странице vocabulary для каждого слова

### Collocation SRS & Review Enhancement

- [x] **CSRS-01**: Collocations автоматически получают SRS-карточки при анализе предложения
- [x] **CSRS-02**: Collocation карточки появляются в review: лицо — коллокация + контекстное предложение, оборот — перевод + тип
- [x] **CSRS-03**: При review grammar карточки показывается описание паттерна и оригинальное предложение-пример

### Grammar & Collocations Browse Pages

- [x] **BROWSE-01**: Страница /grammar — список всех grammar patterns с CEFR, описанием, количеством повторений, примерами предложений
- [x] **BROWSE-02**: Страница /collocations — список всех collocations с CEFR, типом, переводом, примерами предложений
- [x] **BROWSE-03**: Фильтрация и поиск на обеих страницах (по CEFR, типу, тексту)

## v2.0 Requirements

Requirements for EPUB Reader & LingQ-style Learning milestone.

### EPUB Management

- [x] **EPUB-01**: Пользователь может загрузить EPUB файл через веб-интерфейс
- [x] **EPUB-02**: Система парсит EPUB на главы, страницы (5-7 предложений) и отдельные предложения, хранит в БД
- [x] **EPUB-03**: Пользователь видит библиотеку загруженных книг и может переключаться между ними
- [x] **EPUB-04**: Пользователь может удалить книгу и все её данные из системы

### Reader UI

- [x] **READ-01**: Пользователь видит страницу из 5-7 предложений с возможностью перелистывания
- [x] **READ-02**: Система запоминает позицию чтения — при повторном открытии продолжает с того же места
- [x] **READ-03**: Пользователь может включить ночную (тёмную) тему
- [x] **READ-04**: Кнопка "далее" неактивна пока не открыл каждое предложение на странице

### Sentence Analysis

- [ ] **ANAL-01**: Клик на предложение открывает модалку с AI-анализом (перевод, слова с POS, грамматика, коллокации)
- [ ] **ANAL-02**: Повторный клик на уже проанализированное предложение подгружает результат из БД без AI-запроса
- [ ] **ANAL-03**: В модалке показаны только НОВЫЕ слова (отсутствующие в словаре или с новым POS) с кнопками "учить"/"знаю"
- [ ] **ANAL-04**: Коллокации и грамматические конструкции также показаны с кнопками "учить"/"знаю"

### Word Highlighting

- [x] **HIGH-01**: Слова в тексте читалки подсвечены по статусу: синее (новое), жёлтое (учу), без цвета (знаю)
- [x] **HIGH-02**: Подсветка обновляется после закрытия модалки анализа (слова меняют статус)

### Page Flow

- [ ] **FLOW-01**: При перелистывании показывается мини-отчёт: сколько новых слов добавлено в "учить", сколько отмечено "знаю", грамматических паттернов
- [ ] **FLOW-02**: Фильтрация A1/A2 убрана — все слова показываются в модалке, пользователь решает сам через "учить"/"знаю"

## Future Requirements

Deferred to future release.

### Advanced Reader

- **ADVRD-01**: Оглавление / навигация по главам
- **ADVRD-02**: Настройка размера и типа шрифта
- **ADVRD-03**: Клавиатурные сочетания для десктопа
- **ADVRD-04**: Подсветка коллокаций в тексте (multi-token spans)

### Advanced Analysis

- **ADV-01**: Reading session tracking (link sentences to specific books)
- **ADV-02**: Automatic CEFR level estimation for user based on known vocabulary
- **ADV-03**: Book difficulty recommendation based on current level

### Advanced Review

- **REV-01**: Multiple exercise types (translation, sentence building, matching)
- **REV-02**: Adaptive difficulty based on user performance trends
- **MSENSE-01**: Одно значение слова может иметь несколько вариантов перевода с контекстом
- **ADVREV-02**: Настраиваемые параметры FSRS через UI

### Per-Book Stats

- **BSTAT-01**: Статистика по книге (% прочитано, слов изучено)
- **BSTAT-02**: Сравнение словарного запаса между книгами

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native mobile app | Web + Telegram bot is sufficient for personal use |
| Audio / pronunciation | Focus is on reading comprehension and grammar |
| Multiple users / auth | Personal tool, single user |
| Real-time chat with AI | Structured analysis is more effective than freeform chat |
| Gamification (badges, XP) | Streak + heatmap is enough motivation for personal use |
| Card template editor | Один пользователь, фиксированные типы карточек |
| Bulk import/export | Данные входят через sentence analysis и EPUB reader |
| Client-side EPUB rendering (epub.js) | Несовместим с per-sentence interaction и per-word highlighting |

## Traceability

### v1.0 (Complete)

| Requirement | Phase | Status |
|-------------|-------|--------|
| SENT-01 | Phase 5 | Complete |
| SENT-02 | Phase 3 | Complete |
| SENT-03 | Phase 2 | Complete |
| SENT-04 | Phase 2 | Complete |
| SENT-05 | Phase 2 | Complete |
| SENT-06 | Phase 2 | Complete |
| SENT-07 | Phase 2 | Complete |
| VOCAB-01 | Phase 2 | Complete |
| VOCAB-02 | Phase 3 | Complete |
| VOCAB-03 | Phase 3 | Complete |
| VOCAB-04 | Phase 2 | Complete |
| VOCAB-05 | Phase 2 | Complete |
| VOCAB-06 | Phase 2 | Complete |
| VOCAB-07 | Phase 2 | Complete |
| SRS-01 | Phase 4 | Complete |
| SRS-02 | Phase 4 | Complete |
| SRS-03 | Phase 4 | Complete |
| SRS-04 | Phase 4 | Complete |
| SRS-05 | Phase 4 | Complete |
| SRS-06 | Phase 4 | Complete |
| SRS-07 | Phase 4 | Complete |
| DASH-01 | Phase 5 | Complete |
| DASH-02 | Phase 5 | Complete |
| DASH-03 | Phase 5 | Complete |
| DASH-04 | Phase 5 | Complete |
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 5 | Complete |
| INFRA-04 | Phase 3 | Complete |
| INFRA-05 | Phase 1 | Complete |
| INFRA-06 | Phase 1 | Complete |

### v1.1 (Complete)

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 6 | Complete |
| DATA-02 | Phase 6 | Complete |
| DATA-03 | Phase 6 | Complete |
| TG-01 | Phase 7 | Complete |
| TG-02 | Phase 7 | Complete |
| VOCPG-01 | Phase 8 | Complete |
| VOCPG-02 | Phase 8 | Complete |
| VOCPG-03 | Phase 8 | Complete |
| VOCPG-04 | Phase 8 | Complete |
| VOCPG-05 | Phase 8 | Complete |
| VOCPG-06 | Phase 8 | Complete |
| VOCPG-07 | Phase 8 | Complete |
| VOCPG-08 | Phase 8 | Complete |
| COLL-01 | Phase 8 | Complete |
| COLL-02 | Phase 8 | Complete |
| WREV-01 | Phase 9 | Complete |
| WREV-02 | Phase 9 | Complete |
| WREV-03 | Phase 9 | Complete |
| WREV-04 | Phase 9 | Complete |
| WREV-05 | Phase 9 | Complete |
| WREV-06 | Phase 9 | Complete |
| CSRS-01 | Phase 10 | Complete |
| CSRS-02 | Phase 10 | Complete |
| CSRS-03 | Phase 10 | Complete |
| BROWSE-01 | Phase 11 | Complete |
| BROWSE-02 | Phase 11 | Complete |
| BROWSE-03 | Phase 11 | Complete |

### v2.0 (Active)

| Requirement | Phase | Status |
|-------------|-------|--------|
| EPUB-01 | Phase 12 | Complete |
| EPUB-02 | Phase 12 | Complete |
| EPUB-03 | Phase 12 | Complete |
| EPUB-04 | Phase 12 | Complete |
| READ-01 | Phase 13 | Complete |
| READ-02 | Phase 13 | Complete |
| READ-03 | Phase 13 | Complete |
| READ-04 | Phase 13 | Complete |
| HIGH-01 | Phase 13 | Complete |
| HIGH-02 | Phase 13 | Complete |
| ANAL-01 | Phase 14 | Pending |
| ANAL-02 | Phase 14 | Pending |
| ANAL-03 | Phase 14 | Pending |
| ANAL-04 | Phase 14 | Pending |
| FLOW-01 | Phase 14 | Pending |
| FLOW-02 | Phase 14 | Pending |

**Coverage:**
- v2.0 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-15 after v2.0 roadmap created*
