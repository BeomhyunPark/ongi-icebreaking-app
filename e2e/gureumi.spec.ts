import { test, expect, openActivity } from './fixtures.js';

test('Gureumi restores answers and result, submits feedback, and starts a clean retest', async ({
  page,
}) => {
  await openActivity(page, 'gureumi');
  await page.getByRole('button', { name: 'Beta 테스트 시작하기', exact: true }).click();
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
  await page.getByRole('button', { name: '피드백 남기기', exact: true }).click();
  await page.getByRole('button', { name: '피드백 보내기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '피드백 고마워요!' })).toBeVisible();
  await page.getByRole('button', { name: '결과로 돌아가기', exact: true }).click();
  await expect(page.locator('.gureumi-result h1')).toHaveText(result);
  await page.getByRole('button', { name: '다시 테스트하기', exact: true }).click();
  const firstGroup = page.getByRole('radiogroup', { name: '1번 응답', exact: true });
  await expect(firstGroup).toBeVisible();
  await expect(firstGroup.getByRole('radio', { checked: true })).toHaveCount(0);
});
