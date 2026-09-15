import { test, expect, openActivity } from './fixtures.js';

test('Gureumi restores answers and result, has no feedback collection, and starts a clean retest', async ({
  page,
}) => {
  const feedbackRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/feedback')) feedbackRequests.push(request.url());
  });
  await openActivity(page, 'gureumi');
  await expect(page.getByRole('heading', { name: '나는 어떤 구르미일까?' })).toBeVisible();
  await page.getByRole('button', { name: '테스트 시작하기', exact: true }).click();
  for (let order = 1; order <= 27; order++) {
    const group = page.getByRole('radiogroup', { name: `${order}번 응답`, exact: true });
    await group.locator('label').first().click();
    await expect(group.getByRole('radio').first()).toBeEnabled();
    if (order === 5) {
      await page.reload();
      await page.getByRole('button', { name: '6번부터 이어하기', exact: true }).click();
      // Resuming uses the first unanswered question's page.
      await expect(page.getByRole('radiogroup', { name: '6번 응답', exact: true })).toBeVisible();
      await page.getByRole('button', { name: '이전', exact: true }).click();
      await expect(
        page.getByRole('radiogroup', { name: '1번 응답', exact: true }).getByRole('radio').first(),
      ).toBeChecked();
    }
    if (order % 5 === 0) await page.getByRole('button', { name: '다음', exact: true }).click();
  }
  await page.getByRole('button', { name: '결과 확인하기', exact: true }).click();
  await expect(page.locator('.gureumi-result h1')).toBeVisible();
  const result = await page.locator('.gureumi-result h1').innerText();
  await page.reload();
  await expect(page.locator('.gureumi-result h1')).toHaveText(result);
  await expect(page.getByRole('button', { name: /피드백|의견|설문/ })).toHaveCount(0);
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '결과 이미지 저장하기' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '카카오톡으로 결과 공유하기' })).toBeEnabled();
  await page.getByRole('button', { name: '8가지 구르미 모두 보기 →' }).click();
  await expect(page.getByRole('heading', { name: '8가지 구르미', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '다시 테스트하기', exact: true }).click();
  const firstGroup = page.getByRole('radiogroup', { name: '1번 응답', exact: true });
  await expect(firstGroup).toBeVisible();
  await expect(firstGroup.getByRole('radio', { checked: true })).toHaveCount(0);
  expect(feedbackRequests).toEqual([]);
});
