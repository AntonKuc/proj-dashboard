# Дашборд по проектам

Консолидированная отчётность по всем точкам (проектам) в одном месте:
сводка, сравнение проектов, детализация по статьям P&L. Данные сейчас —
факт из xlsx-отчёта ("Конс отчетность.xlsx"), загруженный в базу.
В дальнейшем сюда подключаются Такском Касса, 1С, Google Диск, Яндекс
Карты (см. `src/lib/connectors/README.md`).

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
   — важно указать полный путь, не просто домен), `NEXTAUTH_SECRET`.
5. Deploy. После первого деплоя — один раз локально или через
   `vercel env pull` + `npm run db:migrate:dev && npm run db:seed`,
   применить миграции и засеять базу на проде (либо через `db:migrate`
   в build-хуке, если нужно — скажи, настрою).

## Обновление данных

Сейчас — факт из xlsx, разово. Чтобы обновить вручную:

1. Положить новый xlsx рядом со скриптом (или поменять путь в
   `scripts/extract_xlsx.py`).
2. `python3 scripts/extract_xlsx.py` — пересоберёт `data/raw_extract.json`.
3. `npm run db:seed` — обновит значения в базе (upsert, старые значения
   по тем же проект+статья+месяц перезапишутся).

Когда подключим API-коннекторы (Такском/1С/Google Диск), это будет
происходить автоматически — см. `src/lib/connectors/README.md`.

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
