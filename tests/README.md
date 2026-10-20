# Автотесты ДурКера

Запускаются в GitHub Actions (`.github/workflows/test.yml`, node 20) на каждый push и pull request.

| Файл | Что проверяет | Команда |
|---|---|---|
| `tests/sim.js` | 500 партий бот против бота на настоящем движке (`js/rules,engine,bot,meta` в `vm` с заглушками DOM). Падает при любом `REJECT`/`STUCK`, если винрейт Валеры против Студента вне 55–90 %, Шулера против Валеры ниже 55 %, или бот думал дольше 400 мс на 99-м перцентиле (одиночные выбросы терпим до 1500 мс; меряется процессорное время). | `node tests/sim.js` |
| `tests/multi.js` | 100 партий «компании» (3–4 игрока): ни одного отклонённого хода, зависания, потери карты (всегда 54), решения дольше 400 мс. | `node tests/multi.js` |
| `tests/ui.spec.js` | Playwright + chromium: `index.html` с локального сервера на 430×930 и 1280×800, обучение пропущено, одна партия целиком автокликом (⟳ Подбор → основная кнопка), ошибок в консоли нет (сетевые шрифты и mqtt не считаются), скриншоты начала/середины/конца. | `npx playwright test` |

## Запуск

```
npm install                 # ставит @playwright/test
npx playwright install chromium   # один раз (в CI: --with-deps)
npm run test:sim            # sim.js + multi.js
npm run test:ui             # Playwright
```

Быстрая проверка: `SIM_GAMES=50 node tests/sim.js`, `SIM_GAMES=20 node tests/multi.js`.
Если браузер уже стоит в другом месте: `CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test`.
Скриншоты UI-теста лежат в `test-results/` и в CI выгружаются артефактом `ui-screenshots`.

## Шина событий (tests/bus.js, tests/features.spec.js)

`node tests/bus.js` — юнит-тест `js/bus.js` в vm: порядок событий, изоляция ошибок подписчиков, хуки, `menuKey`, `match:over`.
`tests/features.spec.js` (Playwright) — после партии проверяет, что фичи на шине живы: профиль, XP пропуска, портреты и эмоции, пункты меню, окно «Фишки».
Список событий и API — в шапке `js/bus.js`.
