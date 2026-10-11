import { expect, test, type Page } from '@playwright/test';
import { ALL_PROBLEMS } from './helpers';

// 교사 메뉴(M7): PIN → API 키 → AI 문제 생성(가짜 응답) → 승인·수정·삭제 → 출제
// 실제 OpenRouter에는 요청하지 않는다. 키도 가짜다.

const FAKE_KEY = 'test-key-123';
const API_KEY_KEY = 'spell-defenders-openrouter-key';
const TEACHER_KEY = 'spell-defenders-teacher';

const aiProblem = (wrong: string, correct: string, wrongText: string, choices: string[]) => ({
  kind: 'spelling',
  noError: false,
  wrong,
  correct,
  wrongText,
  choices,
  explain: "'왠지'에만 '왠'을 쓰고 나머지는 '웬'을 써요.",
  rule: '표준국어대사전 \'웬\'',
});

// 통과 4개 + 형식이 틀린 1개(틀린 부분이 문장에 없음)
const AI_PROBLEMS = [
  aiProblem('왠일로 일찍 왔니?', '웬일로 일찍 왔니?', '왠일로', ['웬일로', '왠일로', '웬닐로']),
  aiProblem('왠 우산이 여기 있지?', '웬 우산이 여기 있지?', '왠', ['웬', '왠', '왼']),
  aiProblem('오늘은 웬지 기분이 좋다.', '오늘은 왠지 기분이 좋다.', '웬지', ['왠지', '웬지', '왼지']),
  aiProblem('급식에 왠 떡이 나왔다.', '급식에 웬 떡이 나왔다.', '왠', ['웬', '왠', '왼']),
  aiProblem('왠만하면 같이 가자.', '웬만하면 같이 가자.', '웬일', ['웬만하면', '왠만하면', '왼만하면']),
];

const storage = (page: Page, kind: 'local' | 'session', key: string) =>
  page.evaluate(([k, name]) => (k === 'local' ? localStorage : sessionStorage).getItem(name), [kind, key] as const);

test('교사 메뉴: PIN, 키 저장 위치, AI 생성·검증, 승인한 문제만 출제', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1920, height: 1080 });

  // 가짜 OpenRouter. 키를 실은 요청이 다른 주소로 가지 않는지도 본다
  const sentTo: string[] = [];
  const bodies: string[] = [];
  page.on('request', (request) => {
    const auth = request.headers().authorization ?? '';
    if (auth.includes(FAKE_KEY) || (request.postData() ?? '').includes(FAKE_KEY)) sentTo.push(request.url());
  });
  await page.route('https://openrouter.ai/api/v1/key', (route) =>
    route.fulfill({ json: { data: { limit: 5, limit_remaining: 4.5, usage: 0.5 } } }),
  );
  await page.route('https://openrouter.ai/api/v1/chat/completions', (route) => {
    bodies.push(route.request().postData() ?? '');
    return route.fulfill({
      json: { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ problems: AI_PROBLEMS }) } }] },
    });
  });

  await page.goto('/');

  // 1. PIN 정하기
  await page.getByRole('button', { name: '교사 메뉴' }).click();
  await page.getByLabel('새 PIN (숫자 4~8자리)').fill('1234');
  await page.getByLabel('PIN 한 번 더').fill('1243');
  await page.getByRole('button', { name: 'PIN 정하고 들어가기' }).click();
  await expect(page.getByText('두 번 쓴 PIN이 서로 달라요.')).toBeVisible();
  await page.getByLabel('PIN 한 번 더').fill('1234');
  await page.getByRole('button', { name: 'PIN 정하고 들어가기' }).click();
  await expect(page.getByRole('heading', { name: '교사 메뉴' })).toBeVisible();
  expect(await storage(page, 'local', TEACHER_KEY)).not.toContain('1234');

  // 2. 키: 기본은 sessionStorage
  await page.getByRole('button', { name: 'API 키·모델 설정' }).click();
  await page.getByPlaceholder('sk-or-로 시작하는 키를 붙여 넣기').fill(FAKE_KEY);
  await page.getByRole('button', { name: '키 저장' }).click();
  await expect(page.getByTestId('key-state')).toContainText('이번 접속에서만 기억');
  expect(await storage(page, 'session', API_KEY_KEY)).toBe(FAKE_KEY);
  expect(await storage(page, 'local', API_KEY_KEY)).toBeNull();
  // 저장한 키는 화면에 다시 보이지 않는다
  await expect(page.getByPlaceholder('sk-or-로 시작하는 키를 붙여 넣기')).toHaveValue('');
  await expect(page.getByText(FAKE_KEY)).toHaveCount(0);

  await page.getByRole('button', { name: '연결 확인' }).click();
  await expect(page.getByRole('status')).toContainText('사용 한도 $5.00 가운데 $4.50 남았어요');

  // 키 지우기
  await page.getByRole('button', { name: '키 지우기' }).click();
  await expect(page.getByTestId('key-state')).toHaveText('저장된 키가 없어요.');
  expect(await storage(page, 'session', API_KEY_KEY)).toBeNull();

  // "이 기기에 저장"을 고르면 localStorage
  await page.getByPlaceholder('sk-or-로 시작하는 키를 붙여 넣기').fill(FAKE_KEY);
  await page.getByLabel(/이 기기에 저장/).check();
  await page.getByRole('button', { name: '키 저장' }).click();
  await expect(page.getByTestId('key-state')).toContainText('이 기기에 저장');
  expect(await storage(page, 'local', API_KEY_KEY)).toBe(FAKE_KEY);
  expect(await storage(page, 'session', API_KEY_KEY)).toBeNull();

  // 모델 고르기
  await expect(page.getByTestId('model-state')).toHaveText('지금 쓰는 모델: anthropic/claude-sonnet-5.5');
  await page.getByRole('button', { name: /Gemini 3.8 Flash/ }).click();
  await expect(page.getByTestId('model-state')).toHaveText('지금 쓰는 모델: google/gemini-3.8-flash');
  await page.screenshot({ path: 'docs/screenshots/M7/key-settings-1920x1080.png' });
  await page.getByRole('button', { name: '교사 메뉴로' }).click();

  // 3. AI로 문제 만들기 → 자동 검증
  await page.getByRole('button', { name: 'AI로 문제 만들기' }).click();
  await page.getByRole('group', { name: '유형' }).getByRole('button', { name: '웬/왠' }).click();
  await page.getByRole('button', { name: '5개', exact: true }).click();
  await page.getByRole('button', { name: '만들기', exact: true }).click();
  await expect(page.getByTestId('generate-result')).toHaveText('통과 4개 · 제외 1개');
  await expect(page.getByText('틀린 부분 "웬일"가 문장에 없음')).toBeVisible();
  const body = JSON.parse(bodies[0]);
  expect(body.model).toBe('google/gemini-3.8-flash');
  expect(body.response_format.json_schema.strict).toBe(true);
  expect(body.reasoning.effort).toBe('low');
  expect(body.messages[1].content).toContain('3단계 "웬/왠" 유형 문제를 5개');
  await page.screenshot({ path: 'docs/screenshots/M7/generate-1920x1080.png' });

  await page.getByLabel('세트 이름').fill('테스트 세트');
  await page.getByRole('button', { name: '세트에 저장하고 승인하러 가기' }).click();
  await expect(page.getByTestId('set-summary')).toContainText('문제 4개 · 승인 0개');

  // 4. 승인 / 수정 / 삭제
  const cards = page.locator('section[data-problem-id]');
  await cards.nth(0).getByRole('button', { name: '승인', exact: true }).click();
  await cards.nth(1).getByRole('button', { name: '승인', exact: true }).click();
  await cards.nth(2).getByRole('button', { name: '수정' }).click();
  const editor = page.getByRole('region', { name: '문제 고치기' });
  await editor.getByLabel('틀린 부분').fill('웬일');
  await editor.getByRole('button', { name: '고쳐서 승인' }).click();
  await expect(editor.getByRole('alert')).toContainText('"웬일"가 문장에 없음');
  await editor.getByLabel('틀린 부분').fill('웬지');
  await editor.getByLabel('설명').fill("'왜인지'를 줄인 '왠지'는 '왠'으로 써요.");
  await editor.getByRole('button', { name: '고쳐서 승인' }).click();
  await expect(cards.nth(2)).toContainText("'왜인지'를 줄인 '왠지'는 '왠'으로 써요.");
  await expect(cards.nth(2)).toContainText('교사 수정');
  await expect(cards.nth(2).locator('.teacher-badge')).toHaveText('승인됨');
  await cards.nth(3).getByRole('button', { name: '삭제' }).click();
  await cards.nth(3).getByRole('button', { name: '정말 삭제' }).click();
  await expect(page.getByTestId('set-summary')).toContainText('문제 3개 · 승인 3개');
  await page.screenshot({ path: 'docs/screenshots/M7/set-1920x1080.png' });

  const saved = JSON.parse((await storage(page, 'local', TEACHER_KEY))!);
  const sources = saved.sets[0].problems.map((p: { source: string; reviewed: boolean }) => `${p.source}:${p.reviewed}`);
  expect(sources).toEqual(['ai:true', 'ai:true', 'teacher:true']);

  // 5. 출제: 켜진 세트의 승인한 문제가 내장 문제와 섞인다
  const builtin = ALL_PROBLEMS.filter((p) => p.level === 3 && p.tag === '웬/왠' && p.reviewed).length;
  /** 시작 화면에서 학급 수비전 준비로 가서 '웬/왠'만 남겼을 때의 문제 수 안내 */
  const poolText = async () => {
    await page.getByRole('button', { name: '학급 수비전' }).click();
    for (const tag of await page.getByRole('group', { name: '유형' }).getByRole('button').all()) {
      if ((await tag.textContent()) !== '웬/왠') await tag.click();
    }
    return page.getByTestId('class-pool').textContent();
  };
  await page.getByRole('button', { name: '교사 메뉴로' }).click();
  await page.getByRole('button', { name: '처음으로' }).click();
  expect(await poolText()).toMatch(new RegExp(`문제가? ${builtin + 3}개`));

  // 출제를 끄면 빠진다(PIN은 페이지를 새로 열 때까지 다시 묻지 않음)
  await page.getByRole('button', { name: '처음으로' }).click();
  await page.getByRole('button', { name: '교사 메뉴' }).click();
  await page.getByRole('button', { name: '출제 켜짐' }).click();
  await expect(page.getByRole('button', { name: '출제 꺼짐' })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/M7/menu-1920x1080.png' });
  await page.getByRole('button', { name: '처음으로' }).click();
  expect(await poolText()).toMatch(new RegExp(`문제가? ${builtin}개`));

  // 6. 새로 열면 PIN을 다시 묻는다. 잊었으면 초기화
  await page.reload();
  await page.getByRole('button', { name: '교사 메뉴' }).click();
  await page.getByLabel('PIN', { exact: true }).fill('0000');
  await page.getByRole('button', { name: '들어가기' }).click();
  await expect(page.getByText('PIN이 맞지 않아요.')).toBeVisible();
  await page.getByRole('button', { name: 'PIN을 잊었어요' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '초기화' }).click();
  await expect(page.getByRole('heading', { name: '교사 메뉴 PIN 정하기' })).toBeVisible();
  expect(await storage(page, 'local', API_KEY_KEY)).toBeNull();
  expect(JSON.parse((await storage(page, 'local', TEACHER_KEY))!).sets).toEqual([]);

  // 키는 OpenRouter로만 갔다
  expect(sentTo.length).toBeGreaterThan(0);
  for (const url of sentTo) expect(url.startsWith('https://openrouter.ai/api/v1/')).toBe(true);
});

test('교사 메뉴: API 오류는 쉬운 말로 보여 준다', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.route('https://openrouter.ai/api/v1/chat/completions', (route) =>
    route.fulfill({ status: 402, json: { error: { code: 402, message: 'Insufficient credits' } } }),
  );
  await page.goto('/');
  await page.evaluate(([k, v]) => sessionStorage.setItem(k, v), [API_KEY_KEY, FAKE_KEY]);
  await page.getByRole('button', { name: '교사 메뉴' }).click();
  await page.getByLabel('새 PIN (숫자 4~8자리)').fill('1234');
  await page.getByLabel('PIN 한 번 더').fill('1234');
  await page.getByRole('button', { name: 'PIN 정하고 들어가기' }).click();
  await page.getByRole('button', { name: 'AI로 문제 만들기' }).click();
  await page.getByRole('button', { name: '만들기', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('잔액(크레딧)이 부족');
});
