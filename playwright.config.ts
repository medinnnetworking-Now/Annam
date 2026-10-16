import { defineConfig, devices } from '@playwright/test';
import { hashPassword } from './src/lib/auth/password';
import { E2E } from './tests/e2e/env';

// End-to-end tests run the production build with a fresh embedded database and synthetic samples.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /phone\.spec/ },
    { name: 'phone', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }, testMatch: /phone\.spec/ }
  ],
  webServer: {
    command: 'rm -rf .data/e2e && pnpm start -p 3100',
    url: 'http://localhost:3100/login',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ANNAM_PGLITE_DIR: '.data/e2e',
      ANNAM_SEED_SAMPLES: 'true',
      ANNAM_NUTRITIONIST_PASSWORD_HASH: hashPassword(E2E.nutritionist),
      ANNAM_CLINIC_PASSWORD_HASH: hashPassword(E2E.rmclinic),
      ANNAM_ADMIN_PASSWORD_HASH: hashPassword(E2E.admin),
      ANNAM_ADMIN_TOTP_SECRET: E2E.totp
    }
  }
});
