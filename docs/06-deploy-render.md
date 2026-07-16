# Деплой на Render.com (безкоштовний план)

Покроково — усе, крім самої реєстрації на Render і кількох кліків у їхньому
дашборді, вже підготовлено (`render.yaml` у корені репо, `backend/prisma/schema.production.prisma`).

## Що розгортається

- **tourneyforge-db** — безкоштовна PostgreSQL.
- **tourneyforge-backend** — Node/Express + Socket.io (Web Service).
- **tourneyforge-frontend** — статична збірка Vite (Static Site), з rewrite-правилом для React Router.

Локальна розробка не зачіпається: `backend/prisma/schema.prisma` (SQLite) лишається як є, продакшн іде через окрему `schema.production.prisma` (PostgreSQL) — детальніше в шапці того файлу.

## Кроки

1. **Зареєструйся на [render.com](https://render.com)** — найпростіше через "Sign up with GitHub" (тоді репо одразу видно, окремого OAuth-кроку не буде).
2. У дашборді: **New → Blueprint**.
3. Вибери репозиторій `tourney-platform` (гілка `master`). Render сам знайде `render.yaml` у корені й запропонує створити всі три ресурси (БД + два сервіси) одним кліком **Apply**.
4. Дочекайся, поки задеплоїться **tourneyforge-backend** (перший деплой — кілька хвилин: install → `prisma generate` → `prisma db push` створює таблиці в щойно створеній Postgres). Скопіюй його URL з дашборду (виду `https://tourneyforge-backend-XXXX.onrender.com`).
5. Відкрий **tourneyforge-frontend → Environment**, встав цей URL у змінну `VITE_API_URL` (без слеша в кінці), збережи.
6. Там же натисни **Manual Deploy → Deploy latest commit** — це обов'язково, бо Vite "запікає" `VITE_API_URL` у збірку саме під час білда, а не читає його в рантаймі.
7. Після завершення — відкрий URL фронтенду з дашборду (`tourneyforge-frontend-XXXX.onrender.com`). Сайт живий.

**Якщо Render під час Apply поскаржиться саме на секцію `routes` у `render.yaml`** (синтаксис rewrite-правил у Blueprint-файлі не задокументовано офіційно на 100%, перевірено через доки лише частково) — не страшно, решта (БД + обидва сервіси) все одно розгорнеться. Просто прибери секцію `routes` з файлу і додай те саме правило вручну: **tourneyforge-frontend → Redirects/Rewrites → Add Rule**: Source `/*`, Destination `/index.html`, Action `Rewrite`. Без цього кроку працюватиме головна сторінка, але прямий перехід за посиланням типу `/tournament/5` (не через клік у застосунку) видаватиме 404.

## Перший вхід і дані

Продакшн-БД порожня (жодних сід-акаунтів). Два варіанти:

- **Зареєструватися звичайним акаунтом** на `/register` — і вручну через Render Shell (Backend service → Shell) підняти собі права: зайти в консоль і виконати
  ```
  node -e "import('@prisma/client').then(({PrismaClient})=>{const p=new PrismaClient();p.user.update({where:{username:'ТВІЙ_ЛОГІН'},data:{role:'admin'}}).then(()=>p.\$disconnect())})"
  ```
- **АБО** один раз прогнати сід-скрипт для демо-даних (Admin/User/Organizer акаунти + 8 демо-команд) через той самий Shell:
  ```
  npm run db:seed
  ```
  Увага: цей скрипт видаляє й перестворює ВСІ команди/турніри/акаунти — запускати тільки на порожній щойно створеній БД, не пізніше, коли там уже є реальні дані.

## Обмеження безкоштовного плану Render

- Backend-сервіс "засинає" після ~15 хв без запитів і прокидається ~30-60 сек на перший запит після сну — це нормально для free-плану, не баг.
- Безкоштовна Postgres на Render видаляється через 90 днів неактивності (Render попереджає на пошту заздалегідь) — для навчального проєкту цього має вистачити з запасом.
- `FACEIT_API_KEY`/`VALORANT_API_KEY` (віджет живої статистики гравця) не задані за замовчуванням — фіча просто віддає чисту 503-помилку, весь інший функціонал не зачіпається. Додати їх можна будь-коли в **tourneyforge-backend → Environment**, значення — ті самі, що в твоєму локальному `backend/.env`.

## Оновлення після наступних змін коду

Render автоматично передеплоює обидва сервіси при кожному `git push` у `master` (auto-deploy увімкнено за замовчуванням для Blueprint-сервісів). Якщо зміниться `schema.prisma` — **не забудь** продублювати зміну в `schema.production.prisma` (див. коментар у шапці файлу), інакше прод-схема розійдеться з дев-схемою.
