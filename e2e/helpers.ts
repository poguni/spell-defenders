import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { toGaps } from '../src/judge/judge';
import type { Problem } from '../src/judge/types';

const PROBLEM_DIR = join(import.meta.dirname, '..', 'src', 'data', 'problems');

/** 앱에 들어 있는 모든 문제 */
export const ALL_PROBLEMS: Problem[] = readdirSync(PROBLEM_DIR)
  .filter((name) => name.endsWith('.json'))
  .flatMap((name) => JSON.parse(readFileSync(join(PROBLEM_DIR, name), 'utf8')) as Problem[]);

/** 문장 카드에 열린 문제 */
export async function openProblem(page: Page): Promise<Problem> {
  const id = await page.locator('.sentence-card').getAttribute('data-problem-id');
  const problem = ALL_PROBLEMS.find((p) => p.id === id);
  if (!problem) throw new Error(`문제를 찾지 못함: ${id}`);
  return problem;
}

/** 걷고 있는 몬스터 하나를 눌러 문장 카드를 연다. 없으면 false */
export async function openWalkingMonster(page: Page): Promise<boolean> {
  const monster = page.locator('.monster.is-walking').first();
  if ((await monster.count()) === 0) return false;
  // 몬스터는 움직이고 있어서 "멈출 때까지 기다리기"를 건너뛴다
  await monster.click({ force: true });
  await page.locator('.sentence-card[data-problem-id]').waitFor();
  return true;
}

export function wordIndexOf(problem: Problem, start: number, end: number): number {
  let wordStart = 0;
  const words = problem.wrong.split(' ');
  for (let i = 0; i < words.length; i++) {
    const wordEnd = wordStart + words[i].length;
    if (wordStart < end && start < wordEnd) return i;
    wordStart = wordEnd + 1;
  }
  throw new Error('낱말을 찾지 못함');
}

/** 고친 말(보기 중 정답) */
export function fixedText(problem: Problem): string {
  const { start, wrongText } = problem.target!;
  const after = problem.wrong.length - start - wrongText.length;
  return problem.correct.slice(start, problem.correct.length - after);
}

/** 틀린 낱말 찾기 단계에서 정답 낱말을 누른다 */
export async function tapTargetWord(page: Page, problem: Problem) {
  const { start, wrongText } = problem.target!;
  await page.locator('.btn-word').nth(wordIndexOf(problem, start, start + wrongText.length)).click();
}

export async function answerCorrectly(page: Page, problem: Problem) {
  if (problem.noError) {
    await page.getByRole('button', { name: '고칠 곳 없음' }).click();
    return;
  }
  if (problem.kind === 'spacing') {
    const want = toGaps(problem.correct).gaps;
    const have = toGaps(problem.wrong).gaps;
    for (let i = 0; i < want.length; i++) {
      if (want[i] !== have[i]) await page.locator(`.gap[aria-label^="${i + 1}번째 글자 뒤"] .gap-hit`).click();
    }
    await page.getByRole('button', { name: '자르기' }).click();
    return;
  }
  if (await page.locator('.btn-word').count()) await tapTargetWord(page, problem);
  await page.locator('.choice-buttons').getByRole('button', { name: fixedText(problem), exact: true }).click();
}

/** 시작하기 → (처음이면 3단계 고르기) → 지도에서 스테이지 열기 */
export async function enterStage(page: Page, stageNumber = 1) {
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.locator('.level-screen, .map-screen').first().waitFor();
  if (await page.locator('.level-screen').count()) {
    await page.getByRole('button', { name: /3단계 성/ }).click();
    await page.getByRole('button', { name: '출발!' }).click();
  }
  await page.getByRole('button', { name: new RegExp(`스테이지 ${stageNumber}`) }).click();
}

/** 일부러 틀린다(문제 종류에 맞게) */
export async function answerWrongly(page: Page, problem: Problem) {
  if (problem.noError) {
    await page.locator('.btn-word').first().click();
    await page.locator('.btn-word').first().click();
  } else if (problem.kind === 'spacing') {
    await page.getByRole('button', { name: '자르기' }).click();
  } else {
    await page.getByRole('button', { name: '고칠 곳 없음' }).click();
  }
}

/** 수비전을 끝까지 한다. 처음 wrongCount문제는 틀리고 나머지는 맞힌다. 가짜 시계(page.clock)가 있어야 한다 */
export async function playThrough(page: Page, wrongCount: number) {
  const dialog = page.getByRole('dialog');
  let answered = 0;
  for (let step = 0; step < 300; step++) {
    if (await page.locator('.result-screen').count()) return;
    if (!(await openWalkingMonster(page))) {
      await page.clock.runFor(500);
      continue;
    }
    const problem = await openProblem(page);
    if (answered < wrongCount) await answerWrongly(page, problem);
    else await answerCorrectly(page, problem);
    answered++;
    await dialog.getByRole('button', { name: '계속하기' }).click();
  }
  throw new Error('스테이지가 끝나지 않음');
}

/** 낙서 지우기에서 모두 맞힌다 */
export async function cleanGraffiti(page: Page) {
  const dialog = page.getByRole('dialog');
  while (!(await page.getByText('성벽이 깨끗해졌어요!').count())) {
    await answerCorrectly(page, await openProblem(page));
    await dialog.getByRole('button', { name: '계속하기' }).click();
  }
}
