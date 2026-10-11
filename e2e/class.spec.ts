import { expect, test, type Locator, type Page } from '@playwright/test';
import { ALL_PROBLEMS, answerCorrectly, answerWrongly, openProblem } from './helpers';

// 학급 수비전(기획서 5.2): 전자칠판 1920×1080 기준

// 개인 모드 글자 크기(무대 좌표). 학급 수비전은 이것의 2배 이상
const PERSONAL_PX: Record<string, number> = {
  '.sentence-text': 52,
  '.btn-word': 48,
  '.btn-choice': 44,
  // 설명 창의 "내가 자른 문장"은 보조 표시라서 문장 카드의 글자만 잰다
  '.sentence-card .letter': 52,
  '.feedback-sentence': 52,
  '.feedback-explain': 40,
};

async function expectDoubleSize(page: Page) {
  for (const [selector, personal] of Object.entries(PERSONAL_PX)) {
    const sizes = await page
      .locator(selector)
      .evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)));
    for (const size of sizes) expect(size, selector).toBeGreaterThanOrEqual(personal * 2);
  }
}

/** 화면(1920×1080) 안에 있고, 안에서 글자가 넘치지 않는지 */
async function expectFits(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(1080.5);
  const overflow = await locator.evaluate((el) => el.scrollHeight - el.clientHeight);
  expect(overflow).toBeLessThanOrEqual(1);
}

const saved = (page: Page) => page.evaluate(() => window.localStorage.getItem('spell-defenders'));

test('학급 수비전 한 판: 한 마리씩 풀고 학급 점수만 보여 주며 기록은 남기지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const before = await saved(page);

  await page.getByRole('button', { name: '학급 수비전' }).click();
  // 처음에는 문제가 있는 유형이 모두 켜져 있다. 하나를 끄고 5마리를 고른다
  const tags = page.getByRole('group', { name: '유형' }).getByRole('button');
  await expect(tags.first()).toHaveAttribute('aria-pressed', 'true');
  await tags.first().click();
  await expect(tags.first()).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '5마리', exact: true }).click();
  await expect(page.getByTestId('class-pool')).toContainText('5마리가 나와요');
  await page.screenshot({ path: 'docs/screenshots/M6/class-setup-1920x1080.png' });
  await page.getByRole('button', { name: '시작!' }).click();

  const dialog = page.getByRole('dialog');
  for (let i = 0; i < 5; i++) {
    await expect(page.getByText(`몬스터 ${i + 1} / 5`)).toBeVisible();
    const problem = await openProblem(page);
    await expect(page.locator('.class-monster-tag')).toHaveText(problem.tag);
    await expectFits(page.locator('.sentence-card'));
    await expectDoubleSize(page);
    if (i === 0) await page.screenshot({ path: 'docs/screenshots/M6/class-battle-1920x1080.png' });

    // 첫 마리는 틀리고 나머지는 맞힌다
    if (i === 0) await answerWrongly(page, problem);
    else await answerCorrectly(page, problem);
    await expect(dialog.getByRole('heading', { name: i === 0 ? '아쉬워요' : '정화 성공!' })).toBeVisible();
    await expect(dialog.getByText(problem.explain)).toBeVisible();
    await expectFits(dialog);
    await expectDoubleSize(page);
    if (i === 1) {
      await expect(dialog.getByText('학급 점수 +1')).toBeVisible();
      await page.screenshot({ path: 'docs/screenshots/M6/class-feedback-1920x1080.png' });
    }
    await expect(page.getByTestId('class-score')).toHaveText(String(i));
    await dialog.getByRole('button', { name: i === 4 ? '결과 보기' : '다음 몬스터' }).click();
  }

  await expect(page.getByTestId('class-result')).toHaveText('4 / 5');
  await page.screenshot({ path: 'docs/screenshots/M6/class-result-1920x1080.png' });
  // 개인 기록(별, 오답 노트, 도감)에 섞이지 않는다
  expect(await saved(page)).toBe(before);

  // 한 판 더: 같은 설정으로 새로 시작
  await page.getByRole('button', { name: '한 판 더' }).click();
  await expect(page.getByText('몬스터 1 / 5')).toBeVisible();
  await expect(page.getByTestId('class-score')).toHaveText('0');
});

// 가장 긴 문장·설명을 틀렸을 때(설명 창이 가장 커질 때)도 화면 안에 들어오는지
const longestBy = (list: typeof ALL_PROBLEMS, size: (p: (typeof ALL_PROBLEMS)[number]) => number) =>
  list.reduce((a, b) => (size(b) > size(a) ? b : a));
const level3 = ALL_PROBLEMS.filter((p) => p.level === 3);
const length = (s: string) => Array.from(s).length;
const LONG = [
  longestBy(level3.filter((p) => p.kind === 'spelling' && !p.noError), (p) => length(p.wrong)),
  longestBy(level3.filter((p) => p.kind === 'spacing'), (p) => length(p.wrong) + length(p.explain)),
  longestBy(level3, (p) => length(p.correct) + length(p.explain)),
];

test('학급 수비전: 가장 긴 문제도 카드와 설명 창이 화면 안에 들어온다', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/?dev&problem=${LONG.map((p) => p.id).join(',')}`);
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: '학급 수비전' }).click();
  await page.getByRole('button', { name: '시작!' }).click();

  const dialog = page.getByRole('dialog');
  const count = new Set(LONG.map((p) => p.id)).size;
  for (let i = 0; i < count; i++) {
    const problem = await openProblem(page);
    await expectFits(page.locator('.sentence-card'));
    if (problem.kind === 'spacing') await page.screenshot({ path: 'docs/screenshots/M6/class-spacing-1920x1080.png' });
    await answerWrongly(page, problem);
    await expectFits(dialog);
    if (problem.kind === 'spacing') {
      await page.screenshot({ path: 'docs/screenshots/M6/class-feedback-spacing-1920x1080.png' });
    }
    await dialog.getByRole('button', { name: /다음 몬스터|결과 보기/ }).click();
  }
  await expect(page.locator('.class-screen.result-screen')).toBeVisible();
});
