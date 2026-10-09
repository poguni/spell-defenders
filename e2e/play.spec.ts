import { expect, test } from '@playwright/test';
import { answerCorrectly, cleanGraffiti, enterStage, openProblem, openWalkingMonster, wordIndexOf } from './helpers';

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
  await page.screenshot({ path: 'docs/screenshots/M4/result-1920x1080.png' });

  // 낙서 지우기: 틀리거나 놓친 문제를 다시 풀면 낙서가 하나씩 지워진다
  await page.getByRole('button', { name: `낙서 지우기 (${missed})` }).click();
  await expect(page.getByTestId('graffiti')).toHaveAttribute('data-count', String(missed));
  await cleanGraffiti(page);
  await expect(page.getByTestId('graffiti')).toHaveAttribute('data-count', '0');
  await page.screenshot({ path: 'docs/screenshots/M4/review-clean-1920x1080.png' });
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

test('개발 스위치가 꺼져 있으면 검수 전 문제만 있는 단계는 고를 수 없다', async ({ page }) => {
  // 1단계에는 아직 검수 전 임시 문제(문장 부호 2개)만 있다
  await page.goto('/');
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page.getByRole('button', { name: /1단계 마을/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /1단계 마을/ })).toContainText('준비 중');
  await expect(page.getByRole('button', { name: /3단계 성/ })).toBeEnabled();

  await page.goto('/?dev');
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page.getByRole('button', { name: /1단계 마을/ })).toBeEnabled();
});
