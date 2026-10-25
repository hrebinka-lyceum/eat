# Облік шкільного харчування — фронтенд

Внутрішня система однієї школи (5–11 класи). Інтерфейс українською,
часовий пояс Europe/Kyiv. Бекенд — Supabase,
цей репозиторій містить **лише фронтенд**.

## Стек

Vite + React + TypeScript, Tailwind CSS v4 + shadcn/ui,
`@supabase/supabase-js`, `@tanstack/react-query`, `react-router-dom`,
`recharts`, `date-fns` (локаль `uk`).

## Запуск

```bash
npm install
cp .env.example .env   # і вписати справжні значення
npm run dev            # http://localhost:5173/eat/
```

`npm run build` збирає в `dist/` і копіює `index.html` у `404.html` —
без цього прямі посилання на GitHub Pages дають 404.

## Змінні оточення

| Змінна | Де брати |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | там само, **anon / publishable** |

У фронтенді живе виключно anon-ключ. `service_role` сюди не потрапляє
ніколи: доступ до рядків вирішує RLS на сервері.

На GitHub Pages ті самі змінні беруться з секретів репозиторію
(Settings → Secrets and variables → Actions).

## Типи бази

```bash
SUPABASE_ACCESS_TOKEN=... npm run gen:types
```

Поки токена немає, `src/types/database.ts` підтримується вручну й точно
відповідає розгорнутій схемі.

## Тести

```bash
npm test            # Vitest, ~11 с
npm run test:watch
npm run test:coverage
```

`tests/lib` — чиста логіка (формати, дати, CSV, помилки, арифметика звітів),
`tests/api` — доводить, що ціна не потрапляє в запити учня й класного керівника,
`tests/ui` — компонентні тести ключових екранів, зокрема замовлення за клас. Тести проходять у CI перед збіркою.

## Структура

```
src/
  api/         єдиний шар звернень до Supabase, згрупований за сутностями
  auth/        сесія, профіль, охорона маршрутів
  components/  ui/ (shadcn), layout/, common/
  lib/         supabase-клієнт, exportToCsv, формати, людські помилки
  pages/       екрани за ролями
  types/       типи бази
```

Компоненти не викликають `supabase.from(...)` напряму — тільки через `src/api/`.
Це те, на чому потім побудуються звіти.

## Ролі й доступ

| Роль | Домівка | Бачить вартість |
|---|---|---|
| `superadmin` | `/dashboard` | так |
| `admin` | `/dashboard` | так |
| `cafeteria` | `/kitchen` | так |
| `teacher` | `/class` | ні |
| `student` | `/me` | ні |

Приховані пункти меню — це зручність, а не захист: права забезпечує RLS.
Вартість учням і класним керівникам сервер віддає як `null`, тому
показати її неможливо навіть помилково.
