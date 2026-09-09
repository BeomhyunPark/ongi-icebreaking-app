import { defineConfig, devices } from '@playwright/test';

// Intentionally fixed loopback endpoints: these tests must never create live rooms.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4176',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      testIgnore: '**/sharing.spec.ts',
      use: { ...devices['Pixel 7'], viewport: { width: 320, height: 740 } },
    },
  ],
  webServer: [
    {
      command:
        'npm run build:e2e && npm run preview -- --host 127.0.0.1 --port 4176 --strictPort --outDir dist-e2e',
      env: { VITE_API_BASE_URL: 'http://127.0.0.1:18080', VITE_KAKAO_JAVASCRIPT_KEY: '' },
      url: 'http://127.0.0.1:4176',
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: './gradlew e2eServer',
      cwd: './backend',
      url: 'http://127.0.0.1:18080/actuator/health/readiness',
      timeout: 180_000,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    },
  ],
});
