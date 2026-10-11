import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  ALL_PROBLEMS,
  answerCorrectly,
  cleanGraffiti,
  fixedText,
  openProblem,
  openWalkingMonster,
} from './helpers';
import type { Problem } from '../src/judge/types';

// 1단계 마을(docs/1단계 마을 개발 계획.md M10)

const SIZES = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1366, height: 768 },
  { width: 1366, height: 650 },
];

const LEVEL1 = ALL_PROBLEMS.filter((p) => p.level === 1);
const longest = (list: Problem[]) =>
  list.reduce((a, b) => (Array.from(b.wrong).length > Array.from(a.wrong).length ? b : a));
const LONG_SPELLING = longest(LEVEL1.filter((p) => p.kind === 'spelling'));
const LONG_SPACING = longest(LEVEL1.filter((p) => p.kind === 'spacing'));
const PUNCTUATION = LEVEL1.find((p) => p.kind === 'punctuation')!;

// 1단계 몬스터 그림 파일(태그 → 파일 이름)
const MONSTER_FILES: Record<string, string> = {
  '소리 나는 대로 쓰기': 'mon-sori',
  받침: 'mon-batchim',
  'ㅐ/ㅔ': 'mon-aee',
  된소리: 'mon-doen',
  '문장 부호': 'mon-punct',
  '띄어쓰기 기초': 'mon-wool',
};

/** 시작하기 → 1단계 고르기 → 스테이지 1 */
async function enterLevel1(page: Page) {
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByRole('button', { name: /1단계 마을/ }).click();
  await page.getByRole('button', { name: '출발!' }).click();
  await page.getByRole('button', { name: /스테이지 1/ }).click();
}

/** 1단계 오답: 보기 중 틀린 것, 띄어쓰기는 고치지 않고 자르기 */
async function answerWrongly(page: Page, problem: Problem) {
  if (problem.kind === 'spacing') {
    await page.getByRole('button', { name: '자르기' }).click();
    return;
  }
  const wrong = problem.choices!.find((c) => c !== fixedText(problem))!;
  await page.locator('.choice-buttons').getByRole('button', { name: wrong, exact: true }).click();
}

async function fontPx(locator: Locator) {
  return locator.first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
}

async function expectInside(page: Page, locator: Locator) {
  const stage = (await page.locator('.stage').boundingBox())!;
  for (const el of await locator.all()) {
    const box = (await el.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(stage.x - 0.5);
    expect(box.y).toBeGreaterThanOrEqual(stage.y - 0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(stage.x + stage.width + 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(stage.y + stage.height + 0.5);
  }
}

async function expectRealSize(locator: Locator, minTextPx: number, minTouchPx: number | null) {
  const scale = Number(await locator.page().locator('.stage').getAttribute('data-scale'));
  for (const el of await locator.all()) {
    expect(parseFloat(await el.evaluate((e) => getComputedStyle(e).fontSize)) * scale).toBeGreaterThanOrEqual(minTextPx);
    if (minTouchPx === null) continue;
    const box = (await el.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(minTouchPx);
    expect(box.height).toBeGreaterThanOrEqual(minTouchPx);
  }
}

async function expectNoOverflow(page: Page) {
  const overflows = await page
    .locator('.sentence-card, .sentence-text, .btn')
    .evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).length);
  expect(overflows).toBe(0);
}

test('1단계 스테이지 1을 끝까지: 8마리·웨이브 2개, 보기 2개, 1단계 몬스터 그림, 낙서 지우기, 다음 스테이지 열림', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.clock.install();
  await page.goto('/');
  await enterLevel1(page);
  await expect(page.locator('.hud-wave')).toHaveText('웨이브 1 / 2');

  const stageTags = ['소리 나는 대로 쓰기', '받침', '된소리'];
  const dialog = page.getByRole('dialog');
  let answered = 0;
  for (let step = 0; step < 300 && !(await page.locator('.result-screen').count()); step++) {
    if (!(await openWalkingMonster(page))) {
      await page.clock.runFor(500);
      continue;
    }
    const problem = await openProblem(page);
    expect(problem.level).toBe(1);
    expect(stageTags).toContain(problem.tag);

    // 고른 몬스터는 그 태그의 1단계 그림
    const monster = page.locator('.monster.is-selected img.art-monster');
    await expect(monster).toHaveAttribute('src', new RegExp(`${MONSTER_FILES[problem.tag]}-typo\\.webp$`));

    // 1단계는 틀린 곳이 처음부터 표시되고 보기는 2개, 글자는 3단계보다 크다
    await expect(page.locator('.sentence-card')).toHaveClass(/level-1/);
    if (problem.kind !== 'spacing') {
      await expect(page.locator('.btn-word')).toHaveCount(0);
      await expect(page.locator('.choice-buttons .btn')).toHaveCount(2);
      await expect(page.getByText('바른 말을 골라요.')).toBeVisible();
      expect(await fontPx(page.locator('.sentence-text'))).toBeGreaterThan(52);
    }

    if (answered === 0) {
      await answerWrongly(page, problem);
      await expect(dialog.getByRole('heading', { name: '아쉬워요' })).toBeVisible();
    } else {
      await answerCorrectly(page, problem);
      await expect(page.locator('.monster.is-purified img.art-monster').first()).toHaveAttribute(
        'src',
        /-clean\.webp$/,
      );
    }
    answered++;
    await dialog.getByRole('button', { name: '계속하기' }).click();
  }

  await expect(page.locator('.result-screen')).toBeVisible();
  const purified = Number(await page.getByTestId('result-purified').textContent());
  const missed = Number(await page.getByTestId('result-missed').textContent());
  expect(purified + missed).toBe(8);
  expect(missed).toBe(1);
  await page.screenshot({ path: 'docs/screenshots/M10/result-1920x1080.png' });

  await page.getByRole('button', { name: /낙서 지우기/ }).click();
  await cleanGraffiti(page);
  await page.getByRole('button', { name: '지도로' }).first().click();
  await expect(page.getByRole('button', { name: /스테이지 2/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /스테이지 3/ })).toBeDisabled();
  await page.screenshot({ path: 'docs/screenshots/M10/map-1920x1080.png' });

  await page.getByRole('button', { name: '몬스터 도감' }).click();
  await expect(page.locator('img[src*="mon-"]').first()).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/M10/dex-1920x1080.png' });
});

for (const size of SIZES) {
  const name = `${size.width}x${size.height}`;

  test(`${name}: 1단계 문장 카드와 설명 창이 넘치지 않는다`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.clock.install();
    await page.goto(`/?dev&problem=${LONG_SPELLING.id},${LONG_SPACING.id},${PUNCTUATION.id}`);
    await page.evaluate(() => document.fonts.ready);
    await enterLevel1(page);

    for (let opened = 0; opened < 3; ) {
      if (!(await openWalkingMonster(page))) {
        await page.clock.runFor(500);
        continue;
      }
      opened++;
      const problem = await openProblem(page);
      await page.evaluate(() => document.fonts.ready);
      await expectInside(page, page.locator('.sentence-card'));
      await expectNoOverflow(page);
      await expectRealSize(page.locator('.sentence-card .btn'), 24, 48);
      if (problem.kind === 'spacing') {
        await expectRealSize(page.locator('.sentence-card .letter'), 24, null);
        await expectRealSize(page.locator('.gap-hit'), 0, 48);
        // 띄어쓰기 칼 글자는 한 줄에 들어간다
        const tops = await page.locator('.sentence-card .letter').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
        expect(new Set(tops.map(Math.round)).size).toBe(1);
      } else {
        await expectRealSize(page.locator('.sentence-text'), 24, null);
      }
      await page.screenshot({ path: `docs/screenshots/M10/battle-${problem.kind}-${name}.png` });

      await answerCorrectly(page, problem);
      const dialog = page.getByRole('dialog');
      await expectInside(page, dialog);
      await dialog.getByRole('button', { name: '계속하기' }).click();
    }
  });
}

test('학급 수비전에서 1단계를 고를 수 있고, 보기 2개가 크게 나온다', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: '학급 수비전' }).click();
  await page.getByRole('group', { name: '단계' }).getByRole('button', { name: '1단계 마을' }).click();
  await expect(page.getByRole('group', { name: '유형' }).getByRole('button')).toHaveCount(6);
  await page.getByRole('button', { name: '5마리', exact: true }).click();
  await page.getByRole('button', { name: '시작!' }).click();

  const dialog = page.getByRole('dialog');
  for (let i = 0; i < 5; i++) {
    const problem = await openProblem(page);
    expect(problem.level).toBe(1);
    const card = page.locator('.sentence-card');
    const box = (await card.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(1080.5);
    if (problem.kind === 'spacing') {
      expect(await fontPx(page.locator('.sentence-card .letter'))).toBeGreaterThanOrEqual(104);
    } else {
      await expect(page.locator('.choice-buttons .btn')).toHaveCount(2);
      expect(await fontPx(page.locator('.sentence-text'))).toBeGreaterThanOrEqual(104);
      expect(await fontPx(page.locator('.btn-choice'))).toBeGreaterThanOrEqual(88);
      if (i === 0) await page.screenshot({ path: 'docs/screenshots/M10/class-1920x1080.png' });
    }
    await answerCorrectly(page, problem);
    await dialog.getByRole('button', { name: /다음 몬스터|결과 보기/ }).click();
  }
  await expect(page.getByText('5 / 5')).toBeVisible();
});
