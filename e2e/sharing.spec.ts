import type { Page } from '@playwright/test';
import { test, expect, openActivity, protectContext } from './fixtures.js';

const API = 'http://127.0.0.1:18080';

async function writeAnswers(page: Page, answer: string) {
  await page.getByRole('textbox').fill(answer);
  while (await page.getByRole('button', { name: '다음', exact: true }).count()) {
    const progress = await page.locator('.anonymous-sharing-step span').innerText();
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await expect(page.locator('.anonymous-sharing-step span')).not.toHaveText(progress);
  }
  await page.getByRole('button', { name: '작성 완료', exact: true }).click();
  await expect(page.getByRole('textbox')).toHaveCount(0);
}

test('isolated users write concurrently, reconnect, reveal, and advance without skipping rounds', async ({
  browser,
  context,
  page,
}) => {
  test.setTimeout(120_000);
  const peers = await Promise.all([browser.newContext(), browser.newContext()]);
  const peerErrors: string[] = [];
  for (const peer of peers) {
    await protectContext(peer);
    peer.on('page', (p) => p.on('pageerror', (error) => peerErrors.push(error.message)));
  }
  try {
    const pages = [page, ...(await Promise.all(peers.map((peer) => peer.newPage())))];
    const contexts = [context, ...peers];
    await openActivity(page, 'anonymous-sharing');
    await page.getByRole('button', { name: '진행자로 모임 만들기', exact: true }).click();
    await page.getByRole('textbox').fill('브라우저 회귀 테스트');
    const created = page.waitForResponse(
      (response) => response.url() === `${API}/api/rooms` && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: '모임 만들기', exact: true }).click();
    const { roomId, roomCode } = (await (await created).json()) as { roomId: string; roomCode: string };
    const roomUrl = `${API}/api/rooms/${roomId}`;
    await expect(page.getByRole('img', { name: '모임 참여 QR 코드' })).toBeVisible();
    await expect(page.locator('.anonymous-sharing-room-code')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '초대 링크 공유' })).toHaveCount(0);
    const qrSvg = await page.locator('.anonymous-sharing-qr svg').evaluate((svg) => new XMLSerializer().serializeToString(svg));
    const leavingContext = await browser.newContext();
    try {
      await protectContext(leavingContext);
      const leavingPage = await leavingContext.newPage();
      await leavingPage.goto(`/?activity=anonymous-sharing#join=${encodeURIComponent(roomCode)}`);
      await leavingPage.getByLabel('이름', { exact: true }).fill('잠시 참여');
      await leavingPage.getByRole('button', { name: '참여하기', exact: true }).click();
      await leavingPage.getByRole('textbox').fill('나가면 지워질 답변');
      await expect(page.locator('.anonymous-sharing-participants')).toContainText('잠시 참여');
      await leavingPage.getByRole('button', { name: '모임 나가기', exact: true }).click();
      const dialog = leavingPage.getByRole('dialog', { name: '모임에서 나갈까요?' });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: '계속 작성하기' }).click();
      await expect(leavingPage.getByRole('textbox')).toHaveValue('나가면 지워질 답변');
      await leavingPage.getByRole('button', { name: '모임 나가기', exact: true }).click();
      await dialog.getByRole('button', { name: '모임 나가기', exact: true }).click();
      await expect(leavingPage.getByRole('button', { name: '모임 참여하기', exact: true })).toBeVisible();
      await expect(page.locator('.anonymous-sharing-progress-summary strong')).toHaveText('0/0');
      await expect(page.locator('.anonymous-sharing-participants')).not.toContainText('잠시 참여');
      await leavingPage.reload();
      await expect(leavingPage.getByRole('button', { name: '모임 참여하기', exact: true })).toBeVisible();
    } finally {
      await leavingContext.close();
    }
    await page.getByLabel('내 이름', { exact: true }).fill('진행자');
    await page.getByRole('button', { name: '나도 참여하기', exact: true }).click();
    await Promise.all(
      pages.slice(1).map(async (peer, index) => {
        if (index === 0) {
          // Feed the host's actual QR into a camera stream; exercise the real decoder.
          await peer.addInitScript((svg) => {
            Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
              const canvas = document.createElement('canvas');
              canvas.width = canvas.height = 480;
              const image = new Image();
              image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
              await image.decode();
              const context = canvas.getContext('2d')!;
              context.fillStyle = 'white';
              context.fillRect(0, 0, 480, 480);
              context.drawImage(image, 40, 40, 400, 400);
              const stream = canvas.captureStream(5);
              (window as Window & { cameraStream?: MediaStream }).cameraStream = stream;
              return stream;
            } });
          }, qrSvg);
          await openActivity(peer, 'anonymous-sharing');
          await peer.getByRole('button', { name: '모임 참여하기', exact: true }).click();
          await expect(peer.getByLabel('이름', { exact: true })).toBeVisible();
          expect(await peer.evaluate(() =>
            (window as Window & { cameraStream?: MediaStream }).cameraStream?.getTracks().every((track) => track.readyState === 'ended'),
          )).toBe(true);
        } else {
          await peer.goto(`/?activity=anonymous-sharing#join=${encodeURIComponent(roomCode)}`);
        }
        await expect(peer.getByRole('textbox')).toHaveCount(1);
        await peer.getByLabel('이름', { exact: true }).fill(`참여자${index + 1}`);
        await peer.getByRole('button', { name: '참여하기', exact: true }).click();
        await expect(peer.locator('textarea')).toBeVisible();
      }),
    );
    // Joining as a host opens its writing screen as well.
    if (await page.getByRole('button', { name: '내 답변 작성하기', exact: true }).count()) {
      await page.getByRole('button', { name: '내 답변 작성하기', exact: true }).click();
    }
    await Promise.all(pages.map((peer, index) => writeAnswers(peer, `고유 답변 ${index}`)));
    await Promise.all(
      contexts.map(async (client, index) => {
        const response = await client.request.get(`${roomUrl}/responses/me`);
        expect(response.ok()).toBe(true);
        const saved = (await response.json()) as { answers: Array<{ answer: string }> };
        expect(saved.answers.map(({ answer }) => answer).filter((answer) => answer.trim())).toEqual(
          [`고유 답변 ${index}`],
        );
      }),
    );
    await expect(page.locator('.anonymous-sharing-progress-summary strong')).toHaveText('3/3');
    await page.getByRole('button', { name: '참여자 입장 마감', exact: true }).click();
    await page.getByRole('button', { name: '모두 준비됐어요 · 나눔 시작', exact: true }).click();
    const seenNames = new Set<string>();
    for (let round = 0; round < 3; round++) {
      await Promise.all(
        pages.map((peer) =>
          expect(peer.locator('.anonymous-sharing-round')).toHaveText(
            `${round + 1} / 3번째 이야기`,
          ),
        ),
      );
      const snapshots = await Promise.all(
        contexts.map(async (client) => {
          const response = await client.request.get(`${roomUrl}/sharing/current`);
          expect(response.ok()).toBe(true);
          return response.json() as Promise<{
            canReveal: boolean;
            participantName?: string;
            roomVersion: number;
            sequence: number;
          }>;
        }),
      );
      expect(snapshots.filter((snapshot) => snapshot.canReveal)).toHaveLength(1);
      snapshots.forEach((snapshot) => expect(snapshot.participantName).toBeUndefined());
      const author = snapshots.findIndex((snapshot) => snapshot.canReveal);
      await Promise.all(
        pages.map((peer) =>
          expect(peer.locator('.anonymous-sharing-answer-list p')).toHaveText([
            `고유 답변 ${author}`,
          ]),
        ),
      );
      const observer = [1, 2].find((index) => index !== author)!;
      const denied = await contexts[observer].request.post(`${roomUrl}/sharing/reveal`, {
        headers: { 'X-OnGi-Client': 'web' },
      });
      expect(denied.status()).toBe(403);
      if (round === 0) {
        await contexts[observer].setOffline(true);
        await expect(
          pages[observer].getByText('연결을 다시 확인하고 있어요…', { exact: true }),
        ).toBeVisible();
      }
      await pages[author].getByRole('button', { name: '이거 저예요', exact: true }).click();
      await pages[author]
        .getByRole('button', { name: '네, 제 이름을 공개할게요', exact: true })
        .click();
      await expect(page.locator('h1')).toContainText('님의 이야기예요');
      seenNames.add(await page.locator('h1').innerText());
      if (round === 0) {
        // No new event occurs after reconnect: CONNECTED must refresh missed state.
        await contexts[observer].setOffline(false);
        await expect(pages[observer].locator('h1')).toHaveText(
          await page.locator('h1').innerText(),
        );
        await expect(
          pages[observer].getByText('연결을 다시 확인하고 있어요…', { exact: true }),
        ).toHaveCount(0);
        const current = (await (
          await context.request.get(`${roomUrl}/sharing/current`)
        ).json()) as { roomVersion: number; sequence: number };
        const results = await Promise.all(
          [0, 1].map(() =>
            context.request.post(`${roomUrl}/next`, {
              headers: { 'X-OnGi-Client': 'web' },
              data: { expectedVersion: current.roomVersion, expectedRound: current.sequence },
            }),
          ),
        );
        expect(results.map((response) => response.status()).sort()).toEqual([200, 409]);
      } else {
        await page
          .getByRole('button', { name: round === 2 ? '나눔 끝내기' : '다음 이야기', exact: true })
          .click();
      }
    }
    expect(seenNames.size).toBe(3);
    await page.getByRole('button', { name: '모임 종료하기', exact: true }).click();
    await Promise.all(
      pages.map((peer) => expect(peer.locator('.anonymous-sharing-completed')).toBeVisible()),
    );
    expect(peerErrors).toEqual([]);
  } finally {
    await Promise.all(peers.map((peer) => peer.close()));
  }
});


test('방 없애기는 작은 화면에서도 중앙 팝업으로 확인하고 취소 시 버튼으로 돌아온다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await openActivity(page, 'anonymous-sharing');
  await page.getByRole('button', { name: '진행자로 모임 만들기', exact: true }).click();
  await page.getByRole('button', { name: '모임 만들기', exact: true }).click();
  const trigger = page.getByRole('button', { name: '방 없애기', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '정말 이 방을 없앨까요?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: '계속 사용하기' })).toBeFocused();
  expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(true);
  const box = await dialog.boundingBox();
  expect(box!.y).toBeGreaterThan(0);
  expect(box!.y + box!.height).toBeLessThan(740);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole('button', { name: '방 없애기', exact: true }).click();
  await expect(page.getByRole('button', { name: '진행자로 모임 만들기', exact: true })).toBeVisible();
});
