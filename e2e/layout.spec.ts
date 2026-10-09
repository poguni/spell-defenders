import { expect, test, type Locator, type Page } from '@playwright/test';
import { ALL_PROBLEMS, answerCorrectly, enterStage, openProblem, openWalkingMonster, tapTargetWord } from './helpers';

// 1366×650은 크롬북 1366×768에서 주소창·탭 때문에 실제로 보이는 크기(기획서 10.3)
const SIZES = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1366, height: 768 },
  { width: 1366, height: 650 },
];

const MIN_TEXT_PX = 24;
const MIN_TOUCH_PX = 48;

// 문장 카드가 가장 커지는 경우: 가장 긴 맞춤법 문장과 가장 긴 띄어쓰기 문장
const longest = (list: typeof ALL_PROBLEMS) =>
  list.reduce((a, b) => (Array.from(b.wrong).length > Array.from(a.wrong).length ? b : a));
const LONG_SPELLING = longest(ALL_PROBLEMS.filter((p) => p.level === 3 && p.kind === 'spelling' && !p.noError));
const LONG_SPACING = longest(ALL_PROBLEMS.filter((p) => p.level === 3 && p.kind === 'spacing'));

async function stageBox(page: Page) {
  const box = await page.locator('.stage').boundingBox();
  if (!box) throw new Error('무대(.stage)를 찾지 못함');
  return box;
}

async function expectInsideStage(page: Page, locator: Locator) {
  const stage = await stageBox(page);
  for (const el of await locator.all()) {
    const box = await el.boundingBox();
    expect(box, '요소가 보여야 함').not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(stage.x - 0.5);
    expect(box!.y).toBeGreaterThanOrEqual(stage.y - 0.5);
    expect(box!.x + box!.width).toBeLessThanOrEqual(stage.x + stage.width + 0.5);
    expect(box!.y + box!.height).toBeLessThanOrEqual(stage.y + stage.height + 0.5);
  }
}

async function expectTouchSize(locator: Locator) {
  for (const el of await locator.all()) {
    const box = await el.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    expect(box!.width).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
  }
}

/** 글자가 실제 화면에서 24px 이상인지 (무대 글자 크기 × 무대 배율) */
async function expectReadable(locator: Locator) {
  const sizes = await locator.evaluateAll((els) => {
    const scale = Number(document.querySelector('.stage')!.getAttribute('data-scale'));
    return els.map((el) => parseFloat(getComputedStyle(el).fontSize) * scale);
  });
  expect(sizes.length).toBeGreaterThan(0);
  for (const size of sizes) expect(size).toBeGreaterThanOrEqual(MIN_TEXT_PX);
}

/** 카드가 위쪽 정보 막대와 겹치지 않고, 글자가 넘치지 않는지 */
async function expectCardFits(page: Page) {
  const card = page.locator('.sentence-card');
  await expectInsideStage(page, card);
  const hud = await page.locator('.hud').boundingBox();
  expect((await card.boundingBox())!.y).toBeGreaterThan(hud!.y + hud!.height);
  const overflows = await page
    .locator('.sentence-card, .sentence-text, .btn')
    .evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).length);
  expect(overflows).toBe(0);
}

for (const size of SIZES) {
  const name = `${size.width}x${size.height}`;

  test(`${name}: 시작 화면과 수비전 화면이 잘리지 않는다`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.clock.install();
    await page.goto(`/?dev&problem=${LONG_SPELLING.id},${LONG_SPACING.id}`);
    await page.evaluate(() => document.fonts.ready);

    const stage = await stageBox(page);
    expect(stage.x + stage.width).toBeLessThanOrEqual(size.width + 0.5);
    expect(stage.y + stage.height).toBeLessThanOrEqual(size.height + 0.5);

    await expectInsideStage(page, page.locator('.start-title'));
    await expectInsideStage(page, page.locator('.start-buttons .btn'));
    await expectTouchSize(page.locator('.start-buttons .btn'));
    await page.screenshot({ path: `docs/screenshots/M3/start-${name}.png` });

    await enterStage(page);
    await expectInsideStage(page, page.locator('.hud'));
    await expectTouchSize(page.locator('.speed-buttons .btn'));
    await expectReadable(page.locator('.card-hint'));

    // 문제 두 개(맞춤법, 띄어쓰기)를 차례로 열어 카드 크기를 확인한다
    for (let opened = 0; opened < 2; ) {
      if (!(await openWalkingMonster(page))) {
        await page.clock.runFor(500);
        continue;
      }
      opened++;
      const problem = await openProblem(page);
      await page.evaluate(() => document.fonts.ready);
      await expectInsideStage(page, page.locator('.monster'));
      await expectReadable(page.locator('.monster-bubble'));

      if (problem.kind === 'spacing') {
        await expectCardFits(page);
        await expectReadable(page.locator('.letter'));
        await expectTouchSize(page.locator('.gap-hit'));
        await expectTouchSize(page.locator('.sentence-card .btn'));
        await page.screenshot({ path: `docs/screenshots/M3/battle-spacing-${name}.png` });
      } else {
        // 틀린 낱말 찾기
        await expectCardFits(page);
        await expectReadable(page.locator('.btn-word'));
        await expectTouchSize(page.locator('.sentence-card .btn'));
        await page.screenshot({ path: `docs/screenshots/M3/battle-find-${name}.png` });
        // 보기 고르기
        await tapTargetWord(page, problem);
        await expectCardFits(page);
        await expectReadable(page.locator('.sentence-text'));
        await expectTouchSize(page.locator('.sentence-card .btn'));
        await page.screenshot({ path: `docs/screenshots/M3/battle-choose-${name}.png` });
      }

      // 설명 창
      await answerCorrectly(page, problem);
      const dialog = page.getByRole('dialog');
      await expectInsideStage(page, dialog);
      await expectReadable(dialog.locator('.feedback-explain'));
      await expectTouchSize(dialog.locator('.btn'));
      if (problem.kind === 'spacing') await page.screenshot({ path: `docs/screenshots/M3/feedback-${name}.png` });
      await dialog.getByRole('button', { name: '계속하기' }).click();
    }
  });
}
