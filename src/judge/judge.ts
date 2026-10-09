import { normalize } from './normalize';
import type { Problem } from './types';

function acceptedAnswers(problem: Problem): string[] {
  return problem.acceptedAnswers.map(normalize);
}

/**
 * 맞춤법·문장 부호 고치기 판정.
 * 틀린 부분(target)을 replacement로 바꾼 문장이 acceptedAnswers 중 하나와 같으면 정답.
 * 보기를 고른 경우(보기 글자)와 직접 입력한 경우(입력한 글자) 모두 이 함수로 판정한다.
 */
export function judgeFix(problem: Problem, replacement: string): boolean {
  if (!problem.target) return false;
  const wrong = normalize(problem.wrong);
  const { start, wrongText } = problem.target;
  const fixed = wrong.slice(0, start) + normalize(replacement) + wrong.slice(start + wrongText.length);
  return acceptedAnswers(problem).includes(normalize(fixed));
}

/**
 * 틀린 낱말 찾기 판정.
 * 학생이 탭한 범위 [tapStart, tapEnd)가 target 범위와 겹치면 정답. 글자 하나를 탭했으면 tapEnd = tapStart + 1.
 */
export function judgeTap(problem: Problem, tapStart: number, tapEnd: number): boolean {
  if (!problem.target) return false;
  const targetStart = problem.target.start;
  const targetEnd = targetStart + problem.target.wrongText.length;
  return tapStart < targetEnd && targetStart < tapEnd;
}

/** "고칠 곳 없음" 버튼 판정 */
export function judgeNoError(problem: Problem): boolean {
  return problem.noError === true;
}

/** 글자(음절) 배열과, 글자 사이마다 띄움(true)/붙임(false) 값 */
export function toGaps(text: string): { letters: string[]; gaps: boolean[] } {
  const letters: string[] = [];
  const gaps: boolean[] = [];
  let space = false;
  for (const ch of normalize(text)) {
    if (ch === ' ') {
      space = true;
      continue;
    }
    if (letters.length > 0) gaps.push(space);
    letters.push(ch);
    space = false;
  }
  return { letters, gaps };
}

/** toGaps의 반대: 글자와 띄움/붙임 값으로 문장을 만든다 */
export function fromGaps(letters: string[], gaps: boolean[]): string {
  return letters.map((ch, i) => (i > 0 && gaps[i - 1] ? ' ' : '') + ch).join('');
}

export interface SpacingResult {
  correct: boolean;
  /** 띄어야 하는데 붙인 곳. 값 i는 i번째 글자와 i+1번째 글자 사이(공백을 뺀 글자 기준) */
  needSpace: number[];
  /** 붙여야 하는데 띄운 곳 */
  needJoin: number[];
}

/**
 * 띄어쓰기 판정(기획서 8.2).
 * 학생 답의 띄움 위치가 acceptedAnswers 중 하나와 같으면 정답.
 * 틀렸으면 가장 가까운 정답과 비교한 틀린 위치를 돌려준다.
 * 공백을 뺀 글자가 문제와 다르면(빈 입력 포함) 오답이고 위치 목록은 비운다.
 */
export function judgeSpacing(problem: Problem, answer: string): SpacingResult {
  const student = toGaps(answer);
  let best: SpacingResult | null = null;

  for (const accepted of acceptedAnswers(problem)) {
    const target = toGaps(accepted);
    if (target.letters.join('') !== student.letters.join('')) continue;

    const needSpace: number[] = [];
    const needJoin: number[] = [];
    target.gaps.forEach((space, i) => {
      if (space && !student.gaps[i]) needSpace.push(i);
      if (!space && student.gaps[i]) needJoin.push(i);
    });
    const result = { correct: needSpace.length + needJoin.length === 0, needSpace, needJoin };
    if (result.correct) return result;
    if (!best || needSpace.length + needJoin.length < best.needSpace.length + best.needJoin.length) {
      best = result;
    }
  }

  return best ?? { correct: false, needSpace: [], needJoin: [] };
}
