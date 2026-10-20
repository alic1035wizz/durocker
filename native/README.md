# ДурКер — приложение для Android и iOS (Capacitor 6)

Оболочка вокруг сайта: `webDir` = `native/www`, копия сайта, которую делает `scripts/copy-web.js`.
`appId`: `ru.durker.app`, `appName`: «ДурКер». Папки `android/` и `ios/` в репозитории **не созданы** — их генерирует `cap add` на машине с SDK (в облачной песочнице без Android SDK и без доступа к npm-реестру это не сделать).

## Первый запуск (любая ОС, нужен node 20+)

```
cd native
npm install
npm run icons          # resources/icon*.png и splash*.png из assets/ (нужен python3 + Pillow); готовые файлы уже лежат в resources/
npm run copy-web       # сайт → native/www
npx cap add android    # и/или: npx cap add ios  (только на Mac)
npx capacitor-assets generate --assetPath resources   # иконки и сплэш во все размеры
npx cap sync
```

После любой правки сайта: `npm run sync` (= copy-web + cap sync).

## Android (Android Studio)
1. Поставить Android Studio (JDK 17 идёт в комплекте) и через SDK Manager — Android SDK Platform 34.
2. `npm run android` — откроет проект в Android Studio. Дождаться Gradle sync.
3. Отладка: подключить телефон (отладка по USB) или эмулятор → ▶ Run.
4. Релиз: Build → Generate Signed Bundle / APK → Android App Bundle (.aab). Создать keystore **и сохранить его** — потеряете, обновлять приложение в Google Play станет нельзя.
5. Версия: `android/app/build.gradle` → `versionCode` (растёт на 1 каждый релиз) и `versionName`.

## iOS (Xcode, нужен Mac)
1. Xcode 15+, CocoaPods (`sudo gem install cocoapods` или `brew install cocoapods`).
2. `npx cap add ios && npm run ios` — откроет `ios/App/App.xcworkspace`.
3. Target App → Signing & Capabilities: выбрать Team, поставить Bundle Identifier `ru.durker.app`.
4. Запустить на устройстве/симуляторе (▶). Релиз: Product → Archive → Distribute App → App Store Connect.

## Пуш-уведомления (@capacitor/push-notifications)
Плагин уже в `package.json`. После `cap sync` в коде сайта (например, в `js/tg.js`/`js/main.js`) нужно:
```js
const { PushNotifications } = Capacitor.Plugins;
const p = await PushNotifications.requestPermissions();
if (p.receive === 'granted') await PushNotifications.register();
PushNotifications.addListener('registration', t => /* отправить t.value на сервер вместе с id игрока */);
PushNotifications.addListener('pushNotificationActionPerformed', a => /* открыть стол из a.notification.data.code */);
```
**Android (FCM):** создать проект в Firebase Console → добавить Android-приложение `ru.durker.app` → скачать `google-services.json` в `android/app/`. В Gradle-файлах плагин google-services подключает шаблон Capacitor автоматически, если файл найден.
**iOS (APNs):** в Apple Developer создать ключ APNs (.p8) и загрузить его в Firebase (Project settings → Cloud Messaging); в Xcode добавить capabilities **Push Notifications** и **Background Modes → Remote notifications**.
**Сервер:** Cloud Functions/любой бэкенд шлёт через FCM HTTP v1 (`https://fcm.googleapis.com/v1/projects/<id>/messages:send`) по сохранённым токенам.

Тексты уведомлений:
| Событие | Заголовок | Текст |
|---|---|---|
| Друг позвал на матч | ДурКер | **Друг вызвал тебя на матч** (в `data` — код стола) |
| Сменился босс недели | ДурКер | **Босс недели сменился** (понедельник 00:00 по Москве) |

## Что нужно предоставить вам
- Аккаунты: Google Play Console (одноразово 25 $), Apple Developer Program (99 $/год), проект Firebase (бесплатно).
- Android: keystore для подписи и пароли от него; `google-services.json`.
- iOS: Team ID, Bundle ID `ru.durker.app` в Apple Developer, ключ APNs `.p8` (+ Key ID).
- Сервер, который хранит push-токены и отправляет уведомления (в проекте его пока нет — только Apps Script в `apps-script/`).
- Для магазинов: политика конфиденциальности (URL), описание, скриншоты, возрастной рейтинг. В игре есть мат под звёздочками — отметьте это в анкете рейтинга.
- Если нужно другое имя пакета — поменять `appId` в `capacitor.config.json` **до** `cap add`.

## Что внутри
- `capacitor.config.json` — id, имя, цвет, сплэш, пуши.
- `scripts/copy-web.js` — копирует `index.html`, `css`, `js`, `assets`, `sw.js`, `manifest.webmanifest` в `www/`.
- `scripts/make-icons.py` — иконка 1024, adaptive-слои Android, сплэш 2732 из `assets/icon-512.png` и `assets/avatar.png`.
- `resources/` — сгенерированные картинки для `@capacitor/assets`.
