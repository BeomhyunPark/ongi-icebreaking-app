import { test, expect, openActivity, protectContext } from './fixtures.js';
import axe from 'axe-core';

test('마니또 배정·미션·현황판과 홈 이동 후 복원을 별도 브라우저에서 확인한다', async ({ browser, page }, testInfo) => {
  test.setTimeout(120_000);
  const peerContext = await browser.newContext({ viewport: { width: 320, height: 740 } });
  await protectContext(peerContext);
  const peer = await peerContext.newPage();
  const errors: string[] = [];
  peer.on('pageerror', (error) => errors.push(error.message));
  try {
    await openActivity(page, 'manitto');
    await page.getByLabel('모임 이름', { exact: true }).fill('가을 마니또');
    await page.getByLabel('진행자 이름').fill('진행자');
    await page.getByRole('button', { name: '모임 만들기', exact: true }).click();
    await expect(page.getByRole('heading', { name: '가을 마니또' })).toBeVisible();
    const invite = await page.getByLabel('초대 링크', { exact: true }).inputValue();
    await peer.goto(invite);
    await peer.getByLabel('내 이름').fill('참가자');
    await peer.getByRole('button', { name: '참가하기', exact: true }).click();
    await expect(peer.getByRole('heading', { name: '가을 마니또' })).toBeVisible();
    await expect(page.getByRole('button', { name: '마니또 배정하기' })).toBeEnabled();
    await page.getByRole('button', { name: '마니또 배정하기' }).click();
    await page.getByRole('button', { name: '배정 확정' }).click();
    await expect(peer.getByRole('button', { name: '내 상대 확인하기' })).toBeVisible();
    await peer.getByRole('button', { name: '내 상대 확인하기' }).click();
    await expect(peer.locator('.manitto-secret strong')).toHaveText('진행자');
    await expect(peer.getByRole('heading', { name: '미션 현황판' })).toHaveCount(0);
    await page.getByLabel('새 미션').fill('상대에게 반갑게 인사하기');
    await page.getByRole('button', { name: '미션 등록' }).click();
    await expect(peer.getByText('상대에게 반갑게 인사하기')).toBeVisible();
    await peer.getByRole('checkbox', { name: '완료 표시' }).check();
    await expect(page.locator('.manitto-dashboard > li').filter({ hasText: '참가자' })).toContainText('1 / 1 완료');
    await peer.getByRole('button', { name: '← 홈', exact: true }).click();
    await expect(peer.getByRole('button', { name: /진행 중인 마니또/ })).toBeVisible();
    await expect(peer).not.toHaveURL(/manittoRoom/);
    // Exercise a separate activity, then return without losing membership or progress.
    await peer.goto('/?activity=balance-game');
    await expect(peer.locator('.splash-screen')).toHaveCount(0);
    await expect(peer.locator('main')).toBeVisible();
    await peer.goto('/');
    await peer.getByRole('button', { name: /진행 중인 마니또/ }).click();
    await peer.getByRole('button', { name: '가을 마니또 이어가기 →' }).click();
    await expect(peer.getByRole('checkbox', { name: '완료했어요' })).toBeChecked();
    await expect(peer.locator('.manitto-secret strong')).toHaveText('•••');
    await peer.reload();
    await expect(peer.getByRole('checkbox', { name: '완료했어요' })).toBeChecked();
    expect(await peer.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await peer.addScriptTag({ content: axe.source });
    const accessibility = await peer.evaluate(async () => {
      const engine = (window as unknown as { axe: typeof axe }).axe;
      return engine.run(document.querySelector('main')!, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
    });
    expect(accessibility.violations.map(({ id }) => id)).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('manitto-host.png'), fullPage: true });
    await peer.screenshot({ path: testInfo.outputPath('manitto-participant.png'), fullPage: true });
    await peer.getByRole('checkbox', { name: '완료했어요' }).uncheck();
    await expect(page.locator('.manitto-dashboard > li').filter({ hasText: '참가자' })).toContainText('0 / 1 완료');
    await page.getByRole('button', { name: '모임 종료하기' }).click();
    await page.getByRole('button', { name: '종료 확정' }).click();
    await expect(page.getByRole('heading', { name: '새 모임 만들기' })).toBeVisible();
    await expect(peer.getByRole('alert')).toContainText('종료되었거나 만료된 모임');
    expect(errors).toEqual([]);
  } finally { await peerContext.close(); }
});
