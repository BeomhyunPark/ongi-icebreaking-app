import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';

export async function protectContext(context: BrowserContext) {
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['http:', 'https:'].includes(url.protocol)) return route.continue();
    if (!['http://127.0.0.1:4176', 'http://127.0.0.1:18080'].includes(url.origin))
      return route.abort('blockedbyclient');
    return route.continue();
  });
}

export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ context }, use) => {
      const errors: string[] = [];
      context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)));
      await protectContext(context);
      await use(errors);
      expect(errors, 'uncaught browser errors').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export async function openActivity(page: Page, activity = '') {
  await page.goto(activity ? `/?activity=${activity}` : '/');
  await expect(page.locator('.splash-screen')).toHaveCount(0);
  await expect(page.locator('main')).toBeVisible();
}
