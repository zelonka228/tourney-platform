# Турнірна платформа (TourneyForge)

Веб-платформа для організації турнірів та LAN-вечірок з RPG-картками команд.

## Стек

- **Frontend:** React + Vite + React Router (JavaScript)
- **Backend:** Node.js + Express + Socket.io (JavaScript, ESM)
- **БД:** Prisma ORM — SQLite для розробки, PostgreSQL для продакшену (перемикається в `datasource`)
- **Реальний час:** WebSocket (Socket.io)

## Структура

```
frontend/   React-застосунок (усі сторінки UI + шар api.js)
backend/    Express REST API + Prisma (SQLite) + WebSocket
  prisma/   схема БД та сід
docs/       аналітика та специфікації
```

## Запуск

Backend (спочатку налаштувати БД):
```
cd backend
npm install
npm run db:push      # створити dev.db зі схеми
npm run db:seed      # залити 8 демо-команд
npm run start        # http://localhost:4000
```

Smoke-тести backend API (потребують запущеного бекенду):
```
cd backend
npm test
```

Frontend:
```
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Фронтенд працює і без бекенду: якщо API недоступний, `frontend/src/lib/api.js`
автоматично повертає демо-дані з `demo.js`.

URL бекенду задається змінною оточення `VITE_API_URL` (за замовчуванням
`http://localhost:4000`). Скопіюйте `frontend/.env.example` у `frontend/.env`,
щоб вказати інший бекенд.

## Статус за календарним графіком

- **Тиждень 1:** аналіз ринку/аналогів, концепція, проєктування структури сторінок — реалізовано як React-каркас усіх сторінок. Аналіз ринку — у [docs/01-analiz-rynku.md](docs/01-analiz-rynku.md).
- **Тиждень 2:** схема БД (Team, Player, Tournament, Match, Rating) на Prisma; backend REST API (команди, гравці, турніри, реєстрація); інтеграція фронтенду через `api.js` з фолбеком. Специфікація — у [docs/02-week2-spec.md](docs/02-week2-spec.md).
- **Тиждень 3:** генерація сітки (single/double elimination), рейтингова система, live-оновлення (WebSocket).
- **Тиждень 4:** візуалізація сітки, генератор RPG-карток, тестування, звіт.
