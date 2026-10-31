# Развёртывание

Приложение опубликовано на [GitHub Pages](https://psselectronicstj-byte.github.io/calculator/). Workflow запускает проверки при push в `main` или вручную. Публикация намеренно закреплена за `psselectronicstj-byte/calculator` и веткой `main`; из других репозиториев и веток workflow не публикует сайт. Последняя успешная сборка и публикация: [GitHub Actions run 7](https://github.com/psselectronicstj-byte/calculator/actions/runs/41179908056).

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
2. Pages использует GitHub Actions как источник и HTTPS для сайта.
3. Не добавляйте токены или другие секреты: статическая публикация использует ограниченные `GITHUB_TOKEN` permissions.

Для project Pages базовый путь по умолчанию берётся из имени репозитория (`/repository/`). Для корневого Pages-сайта или нестандартного пути задайте необязательную переменную `PAGES_BASE_PATH`, например `/` либо `/Mathlab-iPhone/`. Локально можно собрать с тем же путём:

```powershell
$env:BASE_PATH = "/Mathlab-iPhone/"
npm run build
```

Проверьте доступность сайта, manifest, иконок и `sw.js` по HTTPS и под префиксом репозитория; затем пройдите [чек-лист iPhone Safari](./iphone-acceptance.md) на реальном устройстве.
