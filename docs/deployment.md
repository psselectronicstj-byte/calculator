# Развёртывание

Приложение собирается как статический сайт для GitHub Pages. Workflow запускает проверки при push в `main` или вручную. Публикация намеренно закреплена за `psselectronicstj-byte/calculator` и веткой `main`; из других репозиториев и веток workflow не публикует сайт.

## Локальная проверка

Из корня проекта выполните:

```powershell
npm ci
npm run typecheck
npm test -- --run
npm run test:e2e -- --project=chromium
npm run build
```

Сборка включает локальные JS/CSS-чанки, математические библиотеки, графику, иконки и Service Worker. Workbox формирует versioned precache по содержимому файлов; новый Service Worker ожидает явного действия пользователя «Обновить приложение». Сторонние API и удалённые runtime-скрипты не требуются.

## GitHub Pages

Workflow закреплён за единственным разрешённым репозиторием и веткой:

1. Деплой выполняется только из `main` репозитория `psselectronicstj-byte/calculator`; другие репозитории и ветки пропускаются.
2. При первой публикации `actions/configure-pages` включает Pages с источником GitHub Actions.
3. Не добавляйте токены или другие секреты: статическая публикация использует ограниченные `GITHUB_TOKEN` permissions.

Для project Pages базовый путь по умолчанию берётся из имени репозитория (`/repository/`). Для корневого Pages-сайта или нестандартного пути задайте необязательную переменную `PAGES_BASE_PATH`, например `/` либо `/Mathlab-iPhone/`. Локально можно собрать с тем же путём:

```powershell
$env:BASE_PATH = "/Mathlab-iPhone/"
npm run build
```

Перед публикацией проверьте, что страницы, manifest, иконки и `sw.js` обслуживаются по HTTPS и под префиксом репозитория; затем пройдите [чек-лист iPhone Safari](./iphone-acceptance.md).
