import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  ALL_PROBLEMS,
  answerCorrectly,
  cleanGraffiti,
  openProblem,
  openWalkingMonster,
  tapTargetWord,
  wordIndexOf,
} from './helpers';
import type { Problem } from '../src/judge/types';

// 2단계 숲(docs/2단계 숲 개발 계획.md M13)

const SIZES = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1366, height: 768 },
  { width: 1366, height: 650 },
];

const LEVEL2 = ALL_PROBLEMS.filter((p) => p.level === 2);
const longest = (list: Problem[]) =>
  list.reduce((a, b) => (Array.from(b.wrong).length > Array.from(a.wrong).length ? b : a));
const LONG_SPELLING = longest(LEVEL2.filter((p) => p.kind === 'spelling'));
const LONG_SPACING = longest(LEVEL2.filter((p) => p.kind === 'spacing'));

// 2단계 몬스터 그림 파일(태그 → 파일 이름)
const MONSTER_FILES: Record<string, string> = {
  '되/돼': 'mon-doe',
  '안/않': 'mon-an',
  '자주 틀리는 낱말': 'mon-jaju',
  '뜻이 다른 낱말': 'mon-tteut',
  '조사 붙여 쓰기': 'mon-josa',
  '단위 띄어쓰기': 'mon-danwi',
};

/** 시작하기 → 2단계 고르기 → 스테이지 1 */
async function enterLevel2(page: Page) {
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByRole('button', { name: /2단계 숲/ }).click();
  await page.getByRole('button', { name: '출발!' }).click();
  await page.getByRole('button', { name: /스테이지 1/ }).click();
}

/** 틀린 낱말이 아닌 낱말의 순서 */
function otherWordIndex(problem: Problem) {
  const { start, wrongText } = problem.target!;
  const target = wordIndexOf(problem, start, start + wrongText.length);
  return target === 0 ? 1 : 0;
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

test('2단계 스테이지 1을 끝까지: 10마리·웨이브 3개, 낱말 찾기 → 보기 3개, 2단계 몬스터 그림, 낙서 지우기, 다음 스테이지 열림', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.clock.install();
  await page.goto('/');
  await enterLevel2(page);
  await expect(page.locator('.hud-wave')).toHaveText('웨이브 1 / 3');

  const stageTags = ['되/돼', '안/않', '조사 붙여 쓰기'];
  const dialog = page.getByRole('dialog');
  let wrongDone = false;
  for (let step = 0; step < 400 && !(await page.locator('.result-screen').count()); step++) {
    if (!(await openWalkingMonster(page))) {
      await page.clock.runFor(500);
      continue;
    }
    const problem = await openProblem(page);
    expect(problem.level).toBe(2);
    expect(stageTags).toContain(problem.tag);

    // 고른 몬스터는 그 태그의 2단계 그림
    const monster = page.locator('.monster.is-selected img.art-monster');
    await expect(monster).toHaveAttribute('src', new RegExp(`${MONSTER_FILES[problem.tag]}-typo\\.webp$`));
    // 2단계는 3단계와 같은 글자 크기, "고칠 곳 없음"은 없다
    await expect(page.locator('.sentence-card')).not.toHaveClass(/level-1/);
    await expect(page.getByRole('button', { name: '고칠 곳 없음' })).toHaveCount(0);

    if (problem.kind === 'spacing') {
      await answerCorrectly(page, problem);
    } else {
      // 처음에는 틀린 낱말을 찾아 누른다
      await expect(page.getByText('틀린 낱말을 찾아 눌러 주세요.')).toBeVisible();
      if (!wrongDone) {
        // 엉뚱한 낱말: 처음엔 다시 기회, 두 번째는 오답
        await page.locator('.btn-word').nth(otherWordIndex(problem)).click();
        await expect(page.getByText('여기는 맞게 썼어요. 다시 찾아보세요.')).toBeVisible();
        await page.locator('.btn-word').nth(otherWordIndex(problem)).click();
        await expect(dialog.getByRole('heading', { name: '아쉬워요' })).toBeVisible();
        wrongDone = true;
        await dialog.getByRole('button', { name: '계속하기' }).click();
        continue;
      }
      await tapTargetWord(page, problem);
      await expect(page.locator('.choice-buttons .btn')).toHaveCount(3);
      expect(await fontPx(page.locator('.sentence-text'))).toBe(52);
      await answerCorrectly(page, problem);
      // 웨이브의 마지막 몬스터면 바로 다음 웨이브로 넘어가 정화된 몬스터가 사라진다
      const purifiedArt = page.locator('.monster.is-purified img.art-monster');
      if (await purifiedArt.count()) await expect(purifiedArt.first()).toHaveAttribute('src', /-clean\.webp$/);
    }
    await dialog.getByRole('button', { name: '계속하기' }).click();
  }

  expect(wrongDone).toBe(true);
  await expect(page.locator('.result-screen')).toBeVisible();
  const purified = Number(await page.getByTestId('result-purified').textContent());
  const missed = Number(await page.getByTestId('result-missed').textContent());
  expect(purified + missed).toBe(10);
  expect(missed).toBe(1);
  await page.screenshot({ path: 'docs/screenshots/M13/result-1920x1080.png' });

  await page.getByRole('button', { name: /낙서 지우기/ }).click();
  await cleanGraffiti(page);
  await page.getByRole('button', { name: '지도로' }).first().click();
  await expect(page.getByRole('button', { name: /스테이지 2/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /스테이지 3/ })).toBeDisabled();
  await page.screenshot({ path: 'docs/screenshots/M13/map-1920x1080.png' });

  await page.getByRole('button', { name: '몬스터 도감' }).click();
  await expect(page.locator('img[src*="mon-"]').first()).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/M13/dex-1920x1080.png' });
});

for (const size of SIZES) {
  const name = `${size.width}x${size.height}`;

  test(`${name}: 2단계 가장 긴 문장 카드와 설명 창이 넘치지 않는다`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.clock.install();
    await page.goto(`/?dev&problem=${LONG_SPELLING.id},${LONG_SPACING.id}`);
    await page.evaluate(() => document.fonts.ready);
    await enterLevel2(page);

    for (let opened = 0; opened < 2; ) {
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
        await page.screenshot({ path: `docs/screenshots/M13/battle-spacing-${name}.png` });
      } else {
        await page.screenshot({ path: `docs/screenshots/M13/battle-find-${name}.png` });
        await tapTargetWord(page, problem);
        await expectInside(page, page.locator('.sentence-card'));
        await expectNoOverflow(page);
        await expectRealSize(page.locator('.sentence-text'), 24, null);
        await expectRealSize(page.locator('.sentence-card .btn'), 24, 48);
        await page.screenshot({ path: `docs/screenshots/M13/battle-choose-${name}.png` });
      }

      await answerCorrectly(page, problem);
      const dialog = page.getByRole('dialog');
      await expectInside(page, dialog);
      await dialog.getByRole('button', { name: '계속하기' }).click();
    }
  });
}

test('학급 수비전에서 2단계를 고를 수 있고, 가장 긴 문장도 화면에 들어온다', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: '학급 수비전' }).click();
  await page.getByRole('group', { name: '단계' }).getByRole('button', { name: '2단계 숲' }).click();
  await expect(page.getByRole('group', { name: '유형' }).getByRole('button')).toHaveCount(6);
  await page.getByRole('button', { name: '15마리', exact: true }).click();
  await page.getByRole('button', { name: '시작!' }).click();

  const dialog = page.getByRole('dialog');
  for (let i = 0; i < 15; i++) {
    const problem = await openProblem(page);
    expect(problem.level).toBe(2);
    const fits = async () => {
      const box = (await page.locator('.sentence-card').boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(1080.5);
      await expectNoOverflow(page);
    };
    await fits();
    if (problem.kind === 'spelling') {
      expect(await fontPx(page.locator('.btn-word'))).toBeGreaterThanOrEqual(96);
      await tapTargetWord(page, problem);
      await expect(page.locator('.choice-buttons .btn')).toHaveCount(3);
      await fits();
      if (i < 3) await page.screenshot({ path: 'docs/screenshots/M13/class-1920x1080.png' });
    }
    await answerCorrectly(page, problem);
    await expect(dialog).toBeVisible();
    const box = (await dialog.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(1080.5);
    await dialog.getByRole('button', { name: /다음 몬스터|결과 보기/ }).click();
  }
  await expect(page.getByText('15 / 15')).toBeVisible();
});
