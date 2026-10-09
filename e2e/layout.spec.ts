import { expect, test, type Locator, type Page } from '@playwright/test';

// 1366×650은 크롬북 1366×768에서 주소창·탭 때문에 실제로 보이는 크기(기획서 10.3)
const SIZES = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1366, height: 768 },
  { width: 1366, height: 650 },
];

const MIN_TEXT_PX = 24;
const MIN_TOUCH_PX = 48;

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

for (const size of SIZES) {
  const name = `${size.width}x${size.height}`;

  test(`${name}: 시작 화면과 수비전 화면이 잘리지 않는다`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);

    const stage = await stageBox(page);
    expect(stage.x + stage.width).toBeLessThanOrEqual(size.width + 0.5);
    expect(stage.y + stage.height).toBeLessThanOrEqual(size.height + 0.5);

    await expectInsideStage(page, page.locator('.start-title'));
    await expectInsideStage(page, page.locator('.start-buttons .btn'));
    await expectTouchSize(page.locator('.start-buttons .btn'));
    await page.screenshot({ path: `docs/screenshots/M1/start-${name}.png` });

    await page.getByRole('button', { name: '시작하기' }).click();
    await page.evaluate(() => document.fonts.ready);

    await expectInsideStage(page, page.locator('.hud'));
    await expectInsideStage(page, page.locator('.speed-buttons .btn'));
    await expectInsideStage(page, page.locator('.monster'));
    await expectInsideStage(page, page.locator('.castle-area'));
    await expectInsideStage(page, page.locator('.sentence-card'));
    await expectInsideStage(page, page.locator('.choice-buttons .btn'));
    await expectTouchSize(page.locator('.speed-buttons .btn'));
    await expectTouchSize(page.locator('.choice-buttons .btn'));

    // 문장 카드 글자가 실제 화면에서 24px 이상인지 (무대 글자 크기 × 무대 배율)
    const actualFontPx = await page.locator('.sentence-text').evaluate((el) => {
      const scale = Number(document.querySelector('.stage')!.getAttribute('data-scale'));
      return parseFloat(getComputedStyle(el).fontSize) * scale;
    });
    expect(actualFontPx).toBeGreaterThanOrEqual(MIN_TEXT_PX);

    // 문장이 카드 밖으로 넘치지 않는지
    const overflows = await page.locator('.sentence-text, .monster-bubble').evaluateAll((els) =>
      els.filter((el) => el.scrollWidth > el.clientWidth + 1).length,
    );
    expect(overflows).toBe(0);

    await page.screenshot({ path: `docs/screenshots/M1/battle-${name}.png` });
  });
}
