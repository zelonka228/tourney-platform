# Тиждень 2 — спільна специфікація (схема БД + API-контракт)

Єдине джерело правди для реалізації бекенду та інтеграції фронтенду. Усі три робочі
напрями (БД, API, фронтенд) мають дотримуватись цих назв полів і форматів.

## Технології
- **БД:** Prisma ORM з провайдером **SQLite** для розробки (файл `backend/prisma/dev.db`,
  нуль налаштувань). Для продакшену `datasource` перемикається на PostgreSQL —
  моделі сумісні.
- **Backend:** Node.js + Express (ESM, `"type": "module"`), CORS увімкнено, порт **4000**.
- **Frontend:** React (Vite), звертається до `http://localhost:4000`.

## Сутності (Prisma-моделі)

- **Team**: `id` (Int, autoincrement), `name` (String), `discipline` (String: "CS2" | "Dota 2" | "Valorant"),
  `logo` (String?, nullable), `winrate` (String?), `streak` (String?), `tournaments` (Int, default 0),
  `best` (String?), `createdAt` (DateTime, default now). Зв'язки: `players Player[]`.
- **Player**: `id`, `teamId` (FK→Team), `nick` (String), `role` (String),
  `rank` (String — зберігаємо як текст: "2510" для CS2/Dota, "Immortal" для Valorant),
  `isSubstitute` (Boolean, default false).
- **Tournament**: `id`, `name` (String), `discipline` (String), `bracketType` (String:
  "single" | "double"), `matchFormat` (Int: 1 | 3 | 5 — best-of), `status` (String, default "draft"),
  `date` (String?), `createdAt`. Зв'язки: `teams TournamentTeam[]`, `matches Match[]`.
- **TournamentTeam** (join турнір↔команда): `id`, `tournamentId` (FK), `teamId` (FK), `seed` (Int).
  Унікальність пари (tournamentId, teamId).
- **Match**: `id`, `tournamentId` (FK), `round` (Int), `position` (Int),
  `teamAId` (Int?), `teamBId` (Int?), `scoreA` (Int?), `scoreB` (Int?),
  `status` (String, default "pending"). 
- **RatingHistory**: `id`, `teamId` (FK), `matchId` (Int?), `ratingBefore` (Int),
  `ratingAfter` (Int), `createdAt`.

## Формати JSON (відповіді API)

Team (масив або один):
```json
{
  "id": 1, "name": "Night Wolves", "discipline": "CS2", "logo": null,
  "winrate": "71%", "streak": "5 W", "tournaments": 12, "best": "1 місце ×4",
  "players": [
    { "id": 1, "nick": "s1mple_ua", "role": "AWPer", "rank": "2510", "isSubstitute": false }
  ]
}
```

Tournament:
```json
{
  "id": 1, "name": "LAN Cup", "discipline": "CS2", "bracketType": "single",
  "matchFormat": 3, "status": "draft", "date": null,
  "teams": [{ "teamId": 1, "seed": 1 }],
  "matches": []
}
```

## REST-ендпоінти

Загальні:
- `GET /api/health` → `{ ok: true }`

Команди:
- `GET /api/teams` → масив Team (з players)
- `GET /api/teams/:id` → один Team (з players) або 404
- `POST /api/teams` → створити. Тіло: `{ name, discipline, logo?, winrate?, streak?, tournaments?, best?, players: [{ nick, role, rank, isSubstitute? }] }` → 201 + створений Team
- `PUT /api/teams/:id` → оновити поля команди та (за наявності `players`) перезаписати склад → 200 + Team
- `DELETE /api/teams/:id` → 204

Турніри:
- `GET /api/tournaments` → масив Tournament (з teams)
- `GET /api/tournaments/:id` → один Tournament (з teams + matches) або 404
- `POST /api/tournaments` → створити. Тіло: `{ name, discipline, bracketType, matchFormat, teamIds?: number[] }`.
  Якщо передано `teamIds` — створити відповідні TournamentTeam із послідовним seed. → 201 + Tournament
- `POST /api/tournaments/:id/register` → зареєструвати команду. Тіло: `{ teamId }` → 201 + оновлений список учасників

Рейтинг (допоміжне):
- `GET /api/teams/:id/rating` → `{ discipline, unit, label, value }` — середній рейтинг по гравцях
  (та сама логіка, що `avgRating` на фронтенді: CS2→FACEIT ELO, Dota 2→MMR, Valorant→звання).

## Поділ файлів (щоб напрями не конфліктували)

- **Напрям БД (Агент A):** `backend/prisma/schema.prisma`, `backend/prisma/seed.js`,
  `backend/src/db.js` (експорт Prisma-клієнта), `backend/package.json` (додати залежності
  `@prisma/client`, `prisma` та скрипти `db:push`, `db:seed`), `backend/.env`, `backend/.gitignore`.
- **Напрям API (Агент B):** `backend/src/index.js`, `backend/src/routes/*.js`,
  `backend/src/rating.js` (уже існує — використати `avgRating`). Імпортує клієнт із `./db.js`.
  НЕ чіпати prisma-схему й залежності.
- **Напрям фронтенд (Агент C):** `frontend/src/lib/api.js` (новий), правки сторінок
  `frontend/src/pages/{Hall,Profile,Team}.jsx`. НЕ чіпати бекенд.

## Дані для сіду
Взяти з `frontend/src/lib/demo.js` (масив `TEAMS` — 8 команд зі складами, ролями, рейтингами,
winrate/streak/tournaments/best). Кожен гравець → Player; поле `rank` зберігати як рядок.

## Правила
- Тільки JavaScript (ESM), без TypeScript.
- Фронтенд `api.js` має **м'який фолбек**: якщо бекенд недоступний (fetch кинув помилку) —
  повертати дані з `demo.js`, щоб застосунок працював автономно.
- Нічого не ламати в наявному застосунку: сторінки мають працювати і без бекенду.
