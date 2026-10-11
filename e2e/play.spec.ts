import { expect, test } from '@playwright/test';
import {
  ALL_PROBLEMS,
  answerCorrectly,
  answerWrongly,
  cleanGraffiti,
  enterStage,
  openProblem,
  openWalkingMonster,
  wordIndexOf,
} from './helpers';

// 한 스테이지를 처음부터 끝까지 플레이한다(기획서 7.1).
// 시간은 Playwright 가짜 시계로 빨리 돌린다.
test('한 스테이지를 처음부터 끝까지 플레이한다', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.clock.install();
  await page.goto('/');
  await enterStage(page);

  const dialog = page.getByRole('dialog');
  let wrongDone = false;
  let missedTapDone = false;
  let correctCount = 0;

  for (let step = 0; step < 300; step++) {
    if (await page.locator('.result-screen').count()) break;
    if (!(await openWalkingMonster(page))) {
      await page.clock.runFor(500);
      continue;
    }
    const problem = await openProblem(page);

    if (!wrongDone) {
      // 첫 문제는 일부러 틀린다
      if (problem.noError) {
        // 고칠 곳 없는 문장에서 낱말을 누르면: 처음엔 다시 기회, 두 번째는 오답
        await page.locator('.btn-word').first().click();
        await expect(page.getByText('여기는 맞게 썼어요. 다시 찾아보세요.')).toBeVisible();
        await page.locator('.btn-word').first().click();
      } else if (problem.kind === 'spacing') {
        await page.getByRole('button', { name: '자르기' }).click(); // 고치지 않고 자르기
        await expect(dialog.getByText('내가 자른 문장', { exact: false })).toBeVisible();
        await expect(dialog.locator('.gap.is-wrong')).not.toHaveCount(0);
      } else {
        await page.getByRole('button', { name: '고칠 곳 없음' }).click();
      }
      await expect(dialog.getByRole('heading', { name: '아쉬워요' })).toBeVisible();
      await expect(dialog.getByText(problem.correct, { exact: true })).toBeVisible();
      await dialog.getByRole('button', { name: '계속하기' }).click();
      wrongDone = true;

      // 틀린 몬스터는 계속 걸어 성에 닿고, 성벽에 낙서가 생긴다
      await page.clock.runFor(50_000);
      await expect(page.getByTestId('graffiti')).not.toHaveAttribute('data-count', '0');
      await expect(page.getByRole('meter', { name: '성벽 체력' })).not.toHaveAttribute('aria-valuenow', '100');
      continue;
    }

    if (!missedTapDone && problem.kind === 'spelling' && !problem.noError) {
      // 엉뚱한 낱말을 한 번 누르면 다시 찾을 기회를 준다
      const { start, wrongText } = problem.target!;
      const targetIndex = wordIndexOf(problem, start, start + wrongText.length);
      await page.locator('.btn-word').nth(targetIndex === 0 ? 1 : 0).click();
      await expect(page.getByText('여기는 맞게 썼어요. 다시 찾아보세요.')).toBeVisible();
      missedTapDone = true;
    }

    const manaBefore = Number(await page.getByTestId('mana').textContent());
    await answerCorrectly(page, problem);
    await expect(dialog.getByRole('heading', { name: '정화 성공!' })).toBeVisible();
    await expect(dialog.getByText(problem.explain)).toBeVisible();
    await expect(page.getByTestId('mana')).toHaveText(String(manaBefore + 10));
    await dialog.getByRole('button', { name: '계속하기' }).click();
    correctCount++;
  }

  // 결과 화면
  await expect(page.locator('.result-screen')).toBeVisible();
  const purified = Number(await page.getByTestId('result-purified').textContent());
  const missed = Number(await page.getByTestId('result-missed').textContent());
  expect(purified).toBe(correctCount);
  expect(purified + missed).toBe(10);
  expect(missed).toBeGreaterThanOrEqual(1);
  expect(missedTapDone).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/M5/result-1920x1080.png' });

  // 낙서 지우기: 틀리거나 놓친 문제를 다시 풀면 낙서가 하나씩 지워진다
  await page.getByRole('button', { name: `낙서 지우기 (${missed})` }).click();
  await expect(page.getByTestId('graffiti')).toHaveAttribute('data-count', String(missed));
  await cleanGraffiti(page);
  await expect(page.getByTestId('graffiti')).toHaveAttribute('data-count', '0');
  await page.screenshot({ path: 'docs/screenshots/M5/review-clean-1920x1080.png' });
  await page.getByRole('button', { name: '지도로' }).first().click();

  // 지도: 별이 기록되고 다음 스테이지가 열린다
  await expect(page.getByRole('button', { name: /스테이지 1/ }).getByRole('img', { name: /별 [123]개/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /스테이지 2/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /스테이지 3/ })).toBeDisabled();
});

test('속도 버튼: 일시정지하면 몬스터가 멈추고, 몬스터를 누르면 그 몬스터는 멈춘다', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.clock.install();
  await page.goto('/');
  await enterStage(page);
  await page.clock.runFor(7_000); // 몬스터 2마리 나옴

  const left = (i: number) => page.locator('.monster').nth(i).evaluate((el) => (el as HTMLElement).style.left);

  await page.getByRole('button', { name: '일시정지' }).click();
  const paused = await left(0);
  await page.clock.runFor(3_000);
  expect(await left(0)).toBe(paused);

  await page.getByRole('button', { name: '보통' }).click();
  await page.locator('.monster').nth(0).click({ force: true });
  const selected = await left(0);
  const other = await left(1);
  await page.clock.runFor(3_000);
  expect(await left(0)).toBe(selected);
  expect(await left(1)).not.toBe(other);
});

test('세 단계 모두 고를 수 있고, 문제가 없는 단계는 "준비 중"이다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '시작하기' }).click();
  for (const name of [/1단계 마을/, /2단계 숲/, /3단계 성/]) {
    await expect(page.getByRole('button', { name })).toBeEnabled();
    await expect(page.getByRole('button', { name })).not.toContainText('준비 중');
  }

  // 개발 스위치로 3단계 문제 하나만 남기면 1·2단계는 낼 문제가 없다
  const one = ALL_PROBLEMS.find((p) => p.level === 3 && p.reviewed)!;
  await page.goto(`/?dev&problem=${one.id}`);
  await page.getByRole('button', { name: '시작하기' }).click();
  for (const name of [/1단계 마을/, /2단계 숲/]) {
    await expect(page.getByRole('button', { name })).toBeDisabled();
    await expect(page.getByRole('button', { name })).toContainText('준비 중');
  }
  await expect(page.getByRole('button', { name: /3단계 성/ })).toBeEnabled();
});

test('더 풀 몬스터가 없으면 틀린 몬스터를 기다리지 않고 건너뛴다', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.clock.install();
  // 문제 하나짜리 스테이지(개발 스위치)
  const one = ALL_PROBLEMS.find((p) => p.level === 3 && p.kind === 'spelling' && !p.noError && p.reviewed)!;
  await page.goto(`/?dev&problem=${one.id}`);
  await enterStage(page);
  while (!(await openWalkingMonster(page))) await page.clock.runFor(500);
  await answerWrongly(page, await openProblem(page));
  await page.getByRole('dialog').getByRole('button', { name: '계속하기' }).click();

  // 틀린 몬스터는 아직 길 위에 있고, 건너뛰기를 누르면 바로 성에 닿은 것으로 처리된다
  await expect(page.locator('.monster.is-failed')).toHaveCount(1);
  await expect(page.getByText('더 풀 몬스터가 없어요.', { exact: false })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/M7/skip-1920x1080.png' });
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page.locator('.result-screen')).toBeVisible();
  await expect(page.getByTestId('result-missed')).toHaveText('1');
});

test('단계 선택 화면에서 처음 화면이나 지도로 돌아갈 수 있다', async ({ page }) => {
  await page.goto('/');
  // 처음 들어온 단계 선택: 고른 단계가 없으니 "지도로"는 없다
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page.getByRole('button', { name: '지도로' })).toHaveCount(0);
  await page.getByRole('button', { name: '처음으로' }).click();
  await expect(page.getByRole('button', { name: '시작하기' })).toBeVisible();

  await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByRole('button', { name: /3단계 성/ }).click();
  await page.getByRole('button', { name: '출발!' }).click();
  await expect(page.getByRole('heading', { name: '3단계 성' })).toBeVisible();

  // 지도 → 단계 바꾸기 → 고르지 않고 지도로
  await page.getByRole('button', { name: '단계 바꾸기' }).click();
  await page.getByRole('button', { name: /1단계 마을/ }).click();
  await page.getByRole('button', { name: '지도로' }).click();
  await expect(page.getByRole('heading', { name: '3단계 성' })).toBeVisible();

  // 단계 바꾸기 → 처음으로
  await page.getByRole('button', { name: '단계 바꾸기' }).click();
  await page.getByRole('button', { name: '처음으로' }).click();
  await expect(page.getByRole('button', { name: '시작하기' })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/M14/start-after-back-1920x1080.png' });
});

test('맞히면 수비대원이 정화 마법을 쓰는 모습을 먼저 보여 준 뒤 설명 창이 나온다', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.clock.install();
  const two = ALL_PROBLEMS.filter((p) => p.level === 3 && p.kind === 'spelling' && !p.noError && p.reviewed).slice(0, 2);
  await page.goto(`/?dev&problem=${two.map((p) => p.id).join(',')}`);
  await enterStage(page);

  const dialog = page.getByRole('dialog');
  const backdrop = page.locator('.feedback-backdrop');
  for (let answered = 0; answered < 2; ) {
    if (!(await openWalkingMonster(page))) {
      await page.clock.runFor(500);
      continue;
    }
    const problem = await openProblem(page);
    if (answered === 0) {
      // 맞히면: 수비대원 정화 동작, 몬스터로 뻗는 마법 줄기, 설명 창은 늦게 나타남
      await answerCorrectly(page, problem);
      await expect(page.locator('.art-defender.is-casting')).toBeVisible();
      await expect(page.getByTestId('cast-bolt')).toBeVisible();
      await expect(page.locator('.monster.is-purified')).toHaveCount(1);
      await expect(backdrop).toHaveClass(/is-delayed/);
      await page.screenshot({ path: 'docs/screenshots/M14/cast-1920x1080.png' });
      await dialog.getByRole('button', { name: '계속하기' }).click();
      await expect(page.getByTestId('cast-bolt')).toHaveCount(0);
      await expect(page.locator('.art-defender.is-casting')).toHaveCount(0);
    } else {
      // 틀리면: 정화 연출 없이 설명 창이 바로 나온다
      await page.getByRole('button', { name: '고칠 곳 없음' }).click();
      await expect(dialog.getByRole('heading', { name: '아쉬워요' })).toBeVisible();
      await expect(backdrop).not.toHaveClass(/is-delayed/);
      await expect(page.getByTestId('cast-bolt')).toHaveCount(0);
      await dialog.getByRole('button', { name: '계속하기' }).click();
    }
    answered++;
  }
});
