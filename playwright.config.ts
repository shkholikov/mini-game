import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  // WebGL in headless Chromium is software-rendered; one browser at a time keeps timings stable.
  workers: 1,
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'tablet', use: { ...devices['Galaxy Tab S9 landscape'], browserName: 'chromium' } },
    {
      name: '4x3',
      use: { browserName: 'chromium', viewport: { width: 1024, height: 768 }, hasTouch: true },
    },
  ],
});
