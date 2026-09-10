# Дашборд по проектам

Консолидированная отчётность по всем точкам (проектам) в одном месте:
сводка, сравнение проектов, детализация по статьям P&L. База — факт из
xlsx-отчёта ("Конс отчетность.xlsx"). Выручка (статья "Выручка")
подтягивается автоматически из Такском Кассы; рейтинг/отзывы точек —
из Яндекс Карт (информационно, не P&L). 1С, Google Диск — ещё нет
(см. `src/lib/connectors/README.md`).

## Стек

- Next.js 14 (App Router, TypeScript) — фронтенд и API в одном проекте
- Prisma + PostgreSQL (рекомендуется Neon, бесплатный tier)
- NextAuth (логин/пароль, роли `ADMIN` / `VIEWER`)
- Tailwind CSS, Recharts

Всё в одном приложении (монолит) — деплоится целиком на Vercel,
без отдельного бэкенда на Railway. Это самый дешёвый и простой вариант
при текущем объёме данных.

## Как запустить локально

1. Установить зависимости:
   ```
   npm install
   ```
2. Скопировать `.env.example` в `.env` и заполнить `DATABASE_URL` (можно
   взять бесплатную Postgres-базу на [neon.tech](https://neon.tech)) и
   `NEXTAUTH_SECRET` (сгенерировать: `openssl rand -base64 32`).
3. Применить схему БД:
   ```
   npm run db:migrate:dev
   ```
4. Загрузить данные из отчёта и создать первого admin-пользователя:
   ```
   npm run db:seed
   ```
   Пароль admin-а выводится в консоль один раз — сохрани его сразу.
5. Запустить:
   ```
   npm run dev
   ```
   Открыть http://localhost:3000, войти под admin.

## Переменные окружения

Смотри `.env.example` — там расписано, что нужно для базы, авторизации
и (когда будут ключи) для каждого внешнего сервиса.

## Деплой (Vercel + Neon)

1. Запушить этот репозиторий на GitHub.
2. На [neon.tech](https://neon.tech) создать бесплатный проект Postgres,
   скопировать connection string ("Pooled connection").
3. На [vercel.com](https://vercel.com) — "Add New Project", выбрать
   репозиторий.
4. В настройках проекта на Vercel добавить переменные окружения:
   `DATABASE_URL`, `NEXTAUTH_URL` (`https://<домен-на-vercel>/api/v1/auth`
   — важно указать полный путь, не просто домен), `NEXTAUTH_SECRET`,
   и (для автосинка Такскома) `TAXCOM_INTEGRATOR_ID`, `TAXCOM_LOGIN`,
   `TAXCOM_PASSWORD`, `CRON_SECRET` — см. `.env.example`. Для Яндекс
   Карт переменные не нужны — данные публичные (см.
   `src/lib/connectors/README.md`).
5. Deploy. После первого деплоя — один раз локально или через
   `vercel env pull` + `npm run db:migrate:dev && npm run db:seed`,
   применить миграции и засеять базу на проде (либо через `db:migrate`
   в build-хуке, если нужно — скажи, настрою).
6. Ночные синки Такскома и Яндекс Карт (`vercel.json`, `crons`) включаются
   сами после деплоя — Vercel подхватывает конфиг из репозитория.
   Проверить, что сработали: `GET /api/v1/health` не про это — смотреть
   логи функций `/api/v1/sync/taxcom` и `/api/v1/sync/yandex-maps` в
   Vercel Dashboard -> Deployments -> Functions.

## Обновление данных

Сейчас — факт из xlsx, разово. Чтобы обновить вручную:

1. Положить новый xlsx рядом со скриптом (или поменять путь в
   `scripts/extract_xlsx.py`).
2. `python3 scripts/extract_xlsx.py` — пересоберёт `data/raw_extract.json`.
3. `npm run db:seed` — обновит значения в базе (upsert, старые значения
   по тем же проект+статья+месяц перезапишутся).

Такском (статья "Выручка") — уже автоматически: ночью через cron, или
вручную `POST /api/v1/sync/taxcom` (см. ниже, "API"). Бэкфилл за
2025-2026: несколько вызовов подряд, по месяцу за раз, — см.
`src/lib/connectors/README.md`.

Яндекс Карты (рейтинг/отзывы точек) — тоже автоматически: ночью через
cron, или вручную `POST /api/v1/sync/yandex-maps` (см. ниже, "API").
Каждый синк перечитывает весь архив отзывов заново (у Яндекса нет
фильтра по дате) — без чанкинга по датам, в отличие от Такскома.

Когда подключим 1С/Google Диск — так же, автоматически.

## Роли

- **admin** — видит всё, может переименовывать проекты (позже — править
  данные вручную).
- **viewer** — только просмотр.

Пользователей создаёт admin через прямой доступ к базе (`npm run db:seed`
с `SEED_ADMIN_USERNAME`/пароль, либо вручную через Prisma Studio:
`npx prisma studio`). Если нужен экран управления пользователями в UI —
скажи, добавим.

## Команды

```
npm run dev            # локальный запуск
npm run build           # прод-сборка
npm run lint             # ESLint
npm run format           # Prettier (авто-исправление)
npm run format:check     # Prettier (проверка без изменений)
npm test                 # тесты (vitest)
```

## API

Все эндпоинты — под `/api/v1/...`, единый формат ошибки
`{ "error": { "code", "message" } }`, списки — с пагинацией (курсор,
максимум 200 записей за раз).

- `GET /api/v1/health` — проверка живости (и БД).
- `GET /api/v1/projects` — список проектов.
- `GET /api/v1/projects/:code` — один проект.
- `PATCH /api/v1/projects/:code` — переименовать (admin).
- `GET /api/v1/projects/:code/metrics` — статьи проекта по месяцам.
- `POST /api/v1/auth/*` — NextAuth (логин/сессия).
- `POST /api/v1/sync/taxcom` (admin) — ручной/исторический синк Такском
  Кассы, тело `{from, to, projectCodes?}` (ISO-даты), максимум 45 дней
  за один вызов.
- `GET /api/v1/sync/taxcom` — ночной автосинк (см. `vercel.json`),
  вызывается только Vercel Cron (`Authorization: Bearer $CRON_SECRET`).
- `POST /api/v1/sync/yandex-maps` (admin) — ручной синк рейтинга/отзывов
  Яндекс Карт, тело `{projectCodes?: string[]}` — без кодов синкает все
  точки. Данные публичные, ключ/логин не нужны.
- `GET /api/v1/sync/yandex-maps` — ночной автосинк (см. `vercel.json`),
  вызывается только Vercel Cron (`Authorization: Bearer $CRON_SECRET`,
  тот же секрет, что у Такскома).
