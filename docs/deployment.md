# Развёртывание

Приложение собирается как статический сайт для GitHub Pages. Workflow запускает проверки при push в `main` или вручную, но публикует только если настроена защита по переменной репозитория `PAGES_REPOSITORY`. Для репозитория `psselectronicstj-byte/calculator` значение переменной должно быть ровно `psselectronicstj-byte/calculator`; без точного совпадения workflow выполнит проверки, но пропустит публикацию.

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

Workflow требует явного opt-in в принадлежащем пользователю репозитории:

1. В **Settings → Pages → Build and deployment** выберите **GitHub Actions**.
2. В **Settings → Secrets and variables → Actions → Variables** добавьте именно repository variable `PAGES_REPOSITORY` со значением точного имени репозитория `owner/repository`. Environment-level variable не подходит: проверка публикации выполняется до запуска deployment environment. Пока repository variable отсутствует или не совпадает с `github.repository`, workflow выполняет проверки, но не загружает артефакт и не публикует сайт.
3. Не добавляйте токены или другие секреты: статическая публикация использует ограниченные `GITHUB_TOKEN` permissions.

Для project Pages базовый путь по умолчанию берётся из имени репозитория (`/repository/`). Для корневого Pages-сайта или нестандартного пути задайте необязательную переменную `PAGES_BASE_PATH`, например `/` либо `/Mathlab-iPhone/`. Локально можно собрать с тем же путём:

```powershell
$env:BASE_PATH = "/Mathlab-iPhone/"
npm run build
```

Перед публикацией проверьте, что страницы, manifest, иконки и `sw.js` обслуживаются по HTTPS и под префиксом репозитория; затем пройдите [чек-лист iPhone Safari](./iphone-acceptance.md).
