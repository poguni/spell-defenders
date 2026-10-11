import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { cleanGraffiti, enterStage, playThrough } from './helpers';

// 기록 내보내기·불러오기(docs/기록 내보내기·불러오기 개발 계획.md M15)

const SIZES = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1366, height: 768 },
  { width: 1366, height: 650 },
];

/** 내 기록 화면에서 "내 기록 저장하기"를 눌러 내려받은 파일 내용과 이름 */
async function saveRecordFile(page: Page, button = '내 기록 저장하기') {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: button, exact: true }).click(),
  ]);
  const path = await download.path();
  return { name: download.suggestedFilename(), text: readFileSync(path, 'utf8') };
}

async function openRecordFile(page: Page, name: string, text: string) {
  await page.locator('.record-screen input[type="file"]').setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  });
}

const summary = (page: Page) => page.locator('.record-body .record-summary');

test('플레이 → 기록 저장 → 지우기 → 파일 불러오기 → 별·오답 노트·도감이 그대로 돌아온다', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.clock.install();
  await page.goto('/');

  // 닉네임을 정하고 한 판(두 문제 틀림) → 낙서 지우기
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByRole('button', { name: /3단계 성/ }).click();
  await page.getByLabel('닉네임 (안 써도 돼요)').fill('민지');
  await page.getByRole('button', { name: '출발!' }).click();
  await page.getByRole('button', { name: /스테이지 1/ }).click();
  await playThrough(page, 2);
  await page.getByRole('button', { name: /낙서 지우기/ }).click();
  await cleanGraffiti(page);
  await page.getByRole('button', { name: '지도로' }).first().click();
  const before = await page.evaluate(() => window.localStorage.getItem('spell-defenders'));

  // 내 기록: 요약 → 저장하기
  await page.getByRole('button', { name: '처음으로' }).click();
  await page.getByRole('button', { name: '내 기록', exact: true }).click();
  await expect(summary(page)).toContainText('민지');
  await expect(summary(page)).not.toContainText('0개');
  const file = await saveRecordFile(page);
  expect(file.name).toMatch(/^맞춤법수비대-기록-민지-\d{4}-\d{2}-\d{2}\.json$/);
  const saved = JSON.parse(file.text);
  expect(saved.format).toBe('spell-defenders-record');
  expect(saved.save).toEqual(JSON.parse(before!));
  await expect(page.getByText("기록 파일을 '다운로드' 폴더에 저장했어요.")).toBeVisible();

  // 지우기 → 빈 기록
  await page.getByRole('button', { name: '내 기록 지우기' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '지우기', exact: true }).click();
  await expect(summary(page)).toContainText('없음');
  await expect(summary(page)).toContainText('0개');

  // 불러오기: 지금 기록과 파일 기록을 나란히 보여 주고, 그만두면 그대로
  await openRecordFile(page, file.name, file.text);
  const dialog = page.getByRole('dialog', { name: '내 기록 불러오기' });
  await expect(dialog.getByRole('heading', { name: '지금 기록' })).toBeVisible();
  await expect(dialog.locator('.record-summary').nth(1)).toContainText('민지');
  await page.screenshot({ path: 'docs/screenshots/M15/import-confirm-1920x1080.png' });
  await dialog.getByRole('button', { name: '그만두기' }).click();
  await expect(summary(page)).toContainText('없음');

  await openRecordFile(page, file.name, file.text);
  await dialog.getByRole('button', { name: '이 기록으로 바꾸기' }).click();
  await expect(page.getByText('기록을 불러왔어요.')).toBeVisible();
  await expect(summary(page)).toContainText('민지');

  // 새로고침해도 불러온 기록이 남고, 저장하기 전과 똑같다
  await page.reload();
  await expect(page.getByText('민지 수비대원, 어서 와요!')).toBeVisible();
  expect(JSON.parse((await page.evaluate(() => window.localStorage.getItem('spell-defenders')))!)).toEqual(
    JSON.parse(before!),
  );
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page.getByRole('heading', { name: '3단계 성' })).toBeVisible();
  await expect(page.getByRole('button', { name: /스테이지 2/ })).toBeEnabled();
});

test('저장하고 지우기: 파일을 내려받은 뒤 기록을 지운다', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await enterStage(page); // 3단계를 골라 기록이 생긴다
  await page.goto('/');
  await page.getByRole('button', { name: '내 기록', exact: true }).click();
  await page.getByRole('button', { name: '내 기록 지우기' }).click();
  const file = await saveRecordFile(page, '저장하고 지우기');
  expect(JSON.parse(file.text).save.level).toBe(3);
  await expect(page.getByText('기록을 파일로 저장한 뒤 지웠어요.')).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem('spell-defenders'))).not.toContain('"level":3');
});

test('잘못된 파일은 지금 기록을 바꾸지 않고 쉬운 말로 거부한다', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await enterStage(page);
  await page.goto('/');
  const before = await page.evaluate(() => window.localStorage.getItem('spell-defenders'));
  await page.getByRole('button', { name: '내 기록', exact: true }).click();

  const cases: [string, string][] = [
    ['아무 글자', '맞춤법 수비대 기록 파일이 아니에요.'],
    ['{"format":"spell-defenders-set","version":1,"problems":[]}', '문제 세트 파일이에요.'],
    ['{"format":"spell-defenders-record","save":{"version":99}}', '더 새로운 앱에서 저장한 기록이에요.'],
    ['{"format":"spell-defenders-record","save":[]}', '기록 파일이 망가져서 읽을 수 없어요.'],
  ];
  for (const [text, message] of cases) {
    await openRecordFile(page, 'bad.json', text);
    await expect(page.locator('.record-message.is-error')).toContainText(message);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await page.screenshot({ path: 'docs/screenshots/M15/import-error-1920x1080.png' });
  expect(await page.evaluate(() => window.localStorage.getItem('spell-defenders'))).toBe(before);

  // 반대로 기록 파일을 "문제 파일 불러오기"에 넣으면 어디서 불러오는지 알려 준다
  await page.getByRole('button', { name: '처음으로' }).click();
  await page.locator('.start-footer input[type="file"]').setInputFiles({
    name: 'record.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"format":"spell-defenders-record","save":{"version":1}}'),
  });
  await expect(page.getByText("내 기록 파일이에요. 처음 화면의 '내 기록'에서 불러와 주세요.")).toBeVisible();
});

for (const size of SIZES) {
  const name = `${size.width}x${size.height}`;

  test(`${name}: 불러오기 확인 창이 화면 안에 들어온다`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole('button', { name: '내 기록', exact: true }).click();
    const save = {
      version: 1,
      nickname: '가나다라마바사아자차',
      level: 3,
      stars: { 'L3-1': 3, 'L3-2': 3, 'L3-3': 3, 'L3-4': 3, 'L1-1': 3, 'L2-1': 3 },
      tagStreaks: {},
      wrongNotes: { 'L3-wen-001': '웬/왠' },
      dex: ['웬/왠'],
      soundOn: true,
    };
    await openRecordFile(page, 'record.json', JSON.stringify({ format: 'spell-defenders-record', save }));
    const dialog = page.getByRole('dialog');
    const stage = (await page.locator('.stage').boundingBox())!;
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(stage.x - 0.5);
    expect(box.y).toBeGreaterThanOrEqual(stage.y - 0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(stage.x + stage.width + 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(stage.y + stage.height + 0.5);
    for (const button of await dialog.locator('.btn').all()) {
      const b = (await button.boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(48);
    }
    await page.screenshot({ path: `docs/screenshots/M15/import-confirm-${name}.png` });
  });
}
