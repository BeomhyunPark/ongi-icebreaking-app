import { test, expect, openActivity } from './fixtures.js';
import { readFileSync } from 'node:fs';

test('built app, release history, and service worker agree on version', async ({ page }) => {
  const { version } = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as { version: string };
  await openActivity(page);
  await page.getByRole('button', { name: `v${version} · 업데이트 내역`, exact: true }).click();
  await expect(page.locator('.release-entry--current .release-entry__version')).toHaveText(
    `v${version}`,
  );
  const worker = await page.request.get('/sw.js');
  expect(worker.ok()).toBe(true);
  expect(await worker.text()).toContain(`ongi-shell-v${version}`);
});

test('home filters and narrow layouts', async ({ page }) => {
  await openActivity(page);
  await page.getByRole('button', { name: '혼자 테스트', exact: true }).click();
  await expect(page.getByRole('button', { name: '마음속 흔적 찾기', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '구르미 Beta 테스트 시작하기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '오늘은 누구?', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '함께 놀기', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '극과 극 밸런스 게임', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '최애 월드컵', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '마음속 흔적 찾기', exact: true })).toHaveCount(0);
  for (const activity of ['', 'group-picker', 'anonymous-sharing', 'gureumi']) {
    await openActivity(page, activity);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
});

test('heart result survives reload', async ({ page }) => {
  await openActivity(page, 'heart-trace');
  await page.getByRole('button', { name: '바로 시작하기', exact: true }).click();
  for (let question = 1; question <= 20; question++) {
    await expect(page.getByText(`Q${question}`, { exact: true })).toBeVisible();
    await page.locator('.answer-option').first().click();
  }
  await expect(page.getByRole('radiogroup', { name: '마지막 문항 선택지' })).toBeVisible();
  await page.locator('.answer-option').first().click();
  await expect(page.getByRole('button', { name: '내 결과 공유', exact: true })).toBeVisible();
  const result = await page.locator('h1').innerText();
  await page.reload();
  await expect(page.locator('h1')).toHaveText(result);
  await expect(page.getByRole('button', { name: '내 결과 공유', exact: true })).toBeVisible();
});

test('balance restores question order and previous answer', async ({ page }) => {
  await openActivity(page, 'balance-game');
  await page.getByRole('button', { name: '랜덤으로 시작', exact: true }).click();
  const first = await page.locator('h1').innerText();
  await page.getByRole('radio').first().click();
  await page.getByRole('button', { name: '다음 질문', exact: true }).click();
  await expect(page.locator('h1')).not.toHaveText(first);
  const second = await page.locator('h1').innerText();
  await page.reload();
  await expect(page.locator('h1')).toHaveText(second);
  await page.getByRole('button', { name: '이전 질문', exact: true }).click();
  await expect(page.locator('h1')).toHaveText(first);
  await expect(page.getByRole('radio').first()).toHaveAttribute('aria-checked', 'true');
});

test('picker preserves duplicate people and exact random result', async ({ page }) => {
  await openActivity(page, 'group-picker');
  await page.locator('input[type=text]').fill('민수,지현,민수');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await expect(page.locator('.group-picker-chips > span')).toHaveCount(3);
  await page.getByRole('button', { name: '기도할 사람 정하기', exact: true }).click();
  const result = page.locator('.group-picker-prayer-result strong');
  await expect(result).toBeVisible();
  const winner = await result.innerText();
  await page.reload();
  await expect(result).toHaveText(winner);
});

test('world cup restores its champion', async ({ page }) => {
  await openActivity(page, 'ideal-world-cup');
  await page.getByRole('button', { name: /^16강,/ }).click();
  await page.getByRole('button', { name: '든든한 한 끼 16강 시작하기', exact: true }).click();
  for (const round of [8, 4, 2, 1]) {
    for (let match = 0; match < round; match++) {
      await page.locator('.world-cup-duel button').first().click();
    }
    if (round > 1) await page.getByRole('button', { name: /계속하기/ }).click();
  }
  await expect(page.locator('.world-cup-duel')).toHaveCount(0);
  const champion = await page.locator('h1').innerText();
  await page.reload();
  await expect(page.locator('h1')).toHaveText(champion);
});
