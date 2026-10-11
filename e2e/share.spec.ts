import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import type { Problem } from '../src/judge/types';
import { exportFile } from '../src/share/shareCode';
import { ALL_PROBLEMS, answerCorrectly } from './helpers';

// 공유 코드(M8): 교사 기기에서 링크를 만들고 다른 브라우저 창(학생 기기)에서 불러와 플레이한다

const PIN_HASH = createHash('sha256').update('spell-defenders:1234').digest('hex');
const level3 = ALL_PROBLEMS.filter((p) => p.level === 3 && p.reviewed);
/** 교사가 AI로 만들어 승인한 문제처럼 */
const asTeacherSet = (list: Problem[]) => list.map((p, i) => ({ ...p, id: `AI-test-${i + 1}`, source: 'ai' as const }));

async function openTeacherMenu(page: Page, problems: Problem[]) {
  const teacher = {
    version: 1,
    pinHash: PIN_HASH,
    model: 'anthropic/claude-sonnet-5.5',
    sets: [{ id: 'set-1', name: '5학년 2반 맞춤법', active: true, problems }],
  };
  await page.addInitScript((data) => {
    if (!localStorage.getItem('spell-defenders-teacher')) localStorage.setItem('spell-defenders-teacher', data);
  }, JSON.stringify(teacher));
  await page.goto('/');
  await page.getByRole('button', { name: '교사 메뉴' }).click();
  await page.getByLabel('PIN', { exact: true }).fill('1234');
  await page.getByRole('button', { name: '들어가기' }).click();
}

test('교사가 공유 링크를 만들고, 다른 창에서 불러와 바로 플레이한다', async ({ page, browser }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const approved = asTeacherSet(level3.slice(0, 4));
  const unapproved = { ...asTeacherSet(level3.slice(4, 5))[0], id: 'AI-test-x', reviewed: false };

  // 교사 기기
  await openTeacherMenu(page, [...approved, unapproved]);
  await page.getByRole('button', { name: '나눠 주기' }).click();
  await expect(page.getByTestId('share-count')).toHaveText('승인한 문제 4개');
  await expect(page.getByRole('img', { name: '문제 세트 QR 코드' })).toBeVisible();
  const link = await page.getByTestId('share-link').inputValue();
  expect(link).toMatch(/#set=[A-Za-z0-9_-]+$/);
  await page.screenshot({ path: 'docs/screenshots/M8/share-1920x1080.png' });

  // 학생 기기(저장소를 함께 쓰지 않는 새 창)
  const student = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const sp = await student.newPage();
  await sp.clock.install();
  await sp.goto(link);
  await expect(sp.getByTestId('import-name')).toHaveText('5학년 2반 맞춤법');
  await expect(sp.getByTestId('import-count')).toHaveText('4개');
  expect(sp.url()).not.toContain('#set='); // 새로 고침해도 다시 묻지 않게 주소에서 지움
  await sp.screenshot({ path: 'docs/screenshots/M8/import-1920x1080.png' });
  await sp.getByRole('button', { name: '불러오고 바로 하기' }).click();

  // 불러온 문제(id가 S…-1, S…-2 …로 바뀜)만 나온다. 순서대로 승인한 문제와 짝을 맞춰 모두 맞힌다
  const dialog = sp.getByRole('dialog');
  const seen = new Set<string>();
  for (let step = 0; step < 300 && !(await sp.locator('.result-screen').count()); step++) {
    const monster = sp.locator('.monster.is-walking').first();
    if (!(await monster.count())) {
      await sp.clock.runFor(500);
      continue;
    }
    await monster.click({ force: true });
    const id = (await sp.locator('.sentence-card').getAttribute('data-problem-id'))!;
    expect(id).toMatch(/^S[0-9a-z]+-[1-4]$/);
    seen.add(id);
    await answerCorrectly(sp, approved[Number(id.split('-')[1]) - 1]);
    await dialog.getByRole('button', { name: '계속하기' }).click();
  }
  expect(seen.size).toBe(4);
  await expect(sp.getByTestId('result-purified')).toHaveText('4');

  // 지도에 "선생님 문제" 스테이지가 생기고 별이 남는다
  await sp.getByRole('button', { name: '지도로' }).click();
  await sp.getByRole('button', { name: /3단계 성/ }).click();
  await sp.getByRole('button', { name: '출발!' }).click();
  const card = sp.getByRole('button', { name: /선생님 문제/ });
  await expect(card).toContainText('5학년 2반 맞춤법');
  await expect(card.getByRole('img', { name: '별 3개' })).toBeVisible();
  const stage = await sp.locator('.stage').boundingBox();
  const box = await card.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(stage!.x + stage!.width);
  await sp.screenshot({ path: 'docs/screenshots/M8/map-teacher-1920x1080.png' });

  // 학생 기기에는 API 키가 없고, 교사 데이터는 빈 기본값뿐이다(PIN·세트 없음)
  const stored = await sp.evaluate(() => ({ ...localStorage }));
  expect(stored['spell-defenders-openrouter-key']).toBeUndefined();
  const teacherData = JSON.parse(stored['spell-defenders-teacher'] ?? '{}');
  expect(teacherData.pinHash ?? null).toBeNull();
  expect(teacherData.sets ?? []).toEqual([]);
  await student.close();
});

test('망가진 링크는 거부한다', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/#set=abcdefg');
  await expect(page.getByRole('alert')).toContainText('공유 코드가 망가졌거나');
  await page.getByRole('button', { name: '처음으로' }).click();
  await expect(page.getByRole('button', { name: '시작하기' })).toBeVisible();
});

test('30문제를 넘는 세트는 파일로: 내보내기 안내와 파일 불러오기', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const big = asTeacherSet(level3.slice(0, 31));
  await openTeacherMenu(page, big);
  await page.getByRole('button', { name: '나눠 주기' }).click();
  await expect(page.getByText('30개를 넘어 링크로 보낼 수 없어요', { exact: false })).toBeVisible();
  await expect(page.getByTestId('share-link')).toHaveCount(0);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '파일로 내보내기' }).click();
  expect((await download).suggestedFilename()).toBe('5학년 2반 맞춤법.json');

  // 학생: 시작 화면에서 파일 불러오기
  await page.getByRole('button', { name: '교사 메뉴로' }).click();
  await page.getByRole('button', { name: '처음으로' }).click();
  await page.locator('.file-button input').setInputFiles({
    name: 'set.json',
    mimeType: 'application/json',
    buffer: Buffer.from(exportFile('큰 세트', big)),
  });
  await expect(page.getByTestId('import-count')).toHaveText('31개');
});
