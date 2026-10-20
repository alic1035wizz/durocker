/* Конфиг UI-теста. В CI браузер ставится `npx playwright install --with-deps chromium`;
   локально можно указать свой: CHROMIUM_PATH=/opt/pw-browsers/chromium */
const exe = process.env.CHROMIUM_PATH || undefined;
module.exports = {
  testDir: 'tests',
  testMatch: /(ui|features|company)\.spec\.js$/,
  timeout: 170000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  outputDir: 'test-results',
  use: { launchOptions: exe ? { executablePath: exe, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] } },
};
