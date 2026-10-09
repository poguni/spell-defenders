import { expect, test, type Page } from '@playwright/test';
import { TAGS } from '../src/judge/types';
import { ALL_PROBLEMS, cleanGraffiti, enterStage, playThrough } from './helpers';

// M4 확인 기준: 브라우저를 닫았다 열어도 기록 유지
test('플레이 → 새로고침 → 기록 유지 → 내 기록 지우기', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.clock.install();
  await page.goto('/');

  // 처음: 단계 선택과 닉네임
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByRole('button', { name: /3단계 성/ }).click();
  await page.getByLabel('닉네임 (안 써도 돼요)').fill('민지');
  await page.getByRole('button', { name: '출발!' }).click();
  await expect(page.getByRole('heading', { name: '3단계 성' })).toBeVisible();
  await expect(page.getByRole('button', { name: /스테이지 2/ })).toBeDisabled();

  // 스테이지 1: 두 문제 틀리고 나머지 맞힘 → 낙서 지우기
  await page.getByRole('button', { name: /스테이지 1/ }).click();
  await playThrough(page, 2);
  await expect(page.getByText(/도감에 새 몬스터/).first()).toBeVisible();
  await page.getByRole('button', { name: /낙서 지우기/ }).click();
  await cleanGraffiti(page);
  await page.getByRole('button', { name: '지도로' }).first().click();
  // 틀린 두 문제가 오답 노트에 들어간다(같은 태그를 그 뒤 3번 연속 맞혔으면 "익힘"으로 빠질 수 있다)
  const notesButton = page.locator('.map-screen .btn', { hasText: '오답 노트' });
  const notesLabel = (await notesButton.textContent())!;
  const noteCount = Number(notesLabel.match(/\((\d+)\)/)?.[1] ?? 0);
  expect(noteCount).toBeLessThanOrEqual(2);

  // 새로고침해도 기록이 남는다
  await page.reload();
  await expect(page.getByText('민지 수비대원, 어서 와요!')).toBeVisible();
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page.getByRole('heading', { name: '3단계 성' })).toBeVisible(); // 단계를 다시 고르지 않는다
  await expect(page.getByRole('button', { name: /스테이지 2/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /스테이지 1/ }).getByRole('img', { name: /별 [123]개/ })).toBeVisible();

  await expect(notesButton).toHaveText(notesLabel);
  await notesButton.click();
  await expect(page.locator('.note-problems li')).toHaveCount(noteCount);
  if (noteCount > 0) await expect(page.locator('.rule-card').first()).not.toBeEmpty();
  await page.getByRole('button', { name: '지도로' }).click();

  await page.getByRole('button', { name: '몬스터 도감' }).click();
  await expect(page.locator('.dex-card:not(.is-unknown)').first()).toBeVisible();
  await page.getByRole('button', { name: '지도로' }).click();

  // 내 기록 지우기(확인 단계 포함)
  await page.getByRole('button', { name: '처음으로' }).click();
  await page.getByRole('button', { name: '내 기록 지우기' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '그만두기' }).click();
  await expect(page.getByText('민지 수비대원, 어서 와요!')).toBeVisible();
  await page.getByRole('button', { name: '내 기록 지우기' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '지우기' }).click();
  await expect(page.getByText('기록을 모두 지웠어요.')).toBeVisible();

  await page.reload();
  await expect(page.getByText('민지 수비대원')).toHaveCount(0);
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page.getByRole('heading', { name: '단계를 골라요' })).toBeVisible();
});

test('간격 반복: 오답 노트 문제가 다음 스테이지에 섞여 나온다', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.clock.install();
  // 스테이지 3 태그의 문제 하나가 오답 노트에 있는 상태로 시작
  const note = ALL_PROBLEMS.find((p) => p.id === 'L3-wen-001')!;
  await page.addInitScript((save) => window.localStorage.setItem('spell-defenders', save), JSON.stringify({
    version: 1,
    nickname: null,
    level: 3,
    stars: {},
    tagStreaks: {},
    wrongNotes: { [note.id]: note.tag },
    dex: [],
    soundOn: true,
  }));
  await page.goto('/');
  await enterStage(page, 1); // 스테이지 1에는 '웬/왠' 태그가 없다

  const seen = new Set<string>();
  for (let step = 0; step < 200 && seen.size < 10; step++) {
    for (const el of await page.locator('.monster').all()) seen.add((await el.getAttribute('aria-label')) ?? '');
    await page.clock.runFor(1_000);
  }
  expect([...seen].some((label) => label.includes(note.wrong))).toBe(true);
});

// 새 화면들이 4가지 크기에서 잘리지 않는지
const SIZES = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1366, height: 768 },
  { width: 1366, height: 650 },
];

async function expectInsideStage(page: Page, selector: string) {
  const stage = (await page.locator('.stage').boundingBox())!;
  for (const el of await page.locator(selector).all()) {
    const box = (await el.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(stage.x - 0.5);
    expect(box.y).toBeGreaterThanOrEqual(stage.y - 0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(stage.x + stage.width + 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(stage.y + stage.height + 0.5);
  }
}

async function expectTouchSize(page: Page, selector: string) {
  for (const el of await page.locator(selector).all()) {
    const box = (await el.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(48);
    expect(box.height).toBeGreaterThanOrEqual(48);
  }
}

for (const size of SIZES) {
  const name = `${size.width}x${size.height}`;
  test(`${name}: 단계 선택·지도·오답 노트·도감이 잘리지 않는다`, async ({ page }) => {
    await page.setViewportSize(size);
    // 9개 태그 모두 오답 노트와 도감에 있는 상태(목록이 가장 길 때)
    const level3 = ALL_PROBLEMS.filter((p) => p.level === 3 && p.reviewed);
    const notes = Object.fromEntries(level3.map((p) => [p.id, p.tag]));
    await page.addInitScript((save) => window.localStorage.setItem('spell-defenders', save), JSON.stringify({
      version: 1,
      nickname: '가나다라마바사아자차',
      level: 3,
      stars: { 'L3-1': 3, 'L3-2': 2, 'L3-3': 1 },
      tagStreaks: {},
      wrongNotes: notes,
      dex: TAGS[3],
      soundOn: true,
    }));
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expectInsideStage(page, '.start-footer .btn');
    await expectTouchSize(page, '.start-footer .btn');

    await page.getByRole('button', { name: '시작하기' }).click();
    await expectInsideStage(page, '.map-stage, .map-screen .btn');
    await expectTouchSize(page, '.map-stage, .map-screen .btn');
    await page.screenshot({ path: `docs/screenshots/M5/map-${name}.png` });

    await page.getByRole('button', { name: '단계 바꾸기' }).click();
    await expectInsideStage(page, '.level-button, .nickname-field, .level-screen .btn-primary');
    await expectTouchSize(page, '.level-button, .nickname-field input');
    await page.screenshot({ path: `docs/screenshots/M5/level-${name}.png` });
    await page.getByRole('button', { name: '출발!' }).click();

    for (const [button, file] of [
      [/오답 노트/, 'notes'],
      ['몬스터 도감', 'dex'],
    ] as const) {
      await page.getByRole('button', { name: button }).click();
      await expectInsideStage(page, '.screen-header .btn, .list-body');
      // 목록은 세로로만 넘기고 가로로 넘치지 않는다
      const overflowX = await page.locator('.list-body').evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflowX).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `docs/screenshots/M5/${file}-${name}.png` });
      await page.getByRole('button', { name: '지도로' }).click();
    }

    await page.getByRole('button', { name: '처음으로' }).click();
    await page.getByRole('button', { name: '내 기록 지우기' }).click();
    await expectInsideStage(page, '[role="dialog"]');
    await page.screenshot({ path: `docs/screenshots/M5/clear-confirm-${name}.png` });
  });
}

test('효과음 끄기는 기기에 저장된다', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await enterStage(page);
  await page.getByRole('button', { name: '소리 끄기' }).click();
  await expect(page.getByRole('button', { name: '소리 켜기' })).toBeVisible();

  await page.reload();
  await enterStage(page);
  await expect(page.getByRole('button', { name: '소리 켜기' })).toBeVisible();
});
