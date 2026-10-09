// 학습 기록 규칙: 오답 노트, 간격 반복, 익힘(기획서 2.3, 6.1). 모두 순수 함수.
import type { Problem } from '../judge/types';
import type { SaveData } from '../storage/save';
import { shuffle } from './stage';

export const MASTERY_STREAK = 3; // 같은 태그를 이만큼 연속으로 맞히면 "익힘"
export const MAX_NOTES_IN_STAGE = 3; // 오답 노트 문제를 다음 스테이지에 섞는 최대 개수

export type Outcome = 'correct' | 'wrong' | 'missed';

export interface ProblemOutcome {
  problem: Problem;
  outcome: Outcome;
}

export interface StageRecord {
  save: SaveData;
  /** 이번에 "익힘"이 되어 오답 노트에서 빠진 태그 */
  mastered: string[];
  /** 이번에 처음 도감에 등록된 태그 */
  newDex: string[];
}

function addWrong(save: SaveData, problem: Problem): SaveData {
  return {
    ...save,
    wrongNotes: { ...save.wrongNotes, [problem.id]: problem.tag },
    tagStreaks: { ...save.tagStreaks, [problem.tag]: 0 },
  };
}

/**
 * 수비전 결과를 기록한다(답한 차례대로 넘겨야 한다).
 * - 정답: 도감 등록, 연속 정답 +1. 연속 3번이 되면 그 태그 문제를 오답 노트에서 뺀다(익힘)
 * - 오답: 오답 노트에 넣고 연속 정답 0
 * - 놓침(성에 닿음): 기록하지 않는다. 낙서 지우기에서 다시 푼다
 */
export function recordStage(start: SaveData, outcomes: ProblemOutcome[]): StageRecord {
  let save = start;
  const mastered: string[] = [];
  const newDex: string[] = [];

  for (const { problem, outcome } of outcomes) {
    const { tag } = problem;
    if (outcome === 'wrong') {
      save = addWrong(save, problem);
      continue;
    }
    if (outcome !== 'correct') continue;

    if (!save.dex.includes(tag)) {
      save = { ...save, dex: [...save.dex, tag] };
      newDex.push(tag);
    }
    const streak = (save.tagStreaks[tag] ?? 0) + 1;
    save = { ...save, tagStreaks: { ...save.tagStreaks, [tag]: streak } };

    const hasNotes = Object.values(save.wrongNotes).includes(tag);
    if (streak >= MASTERY_STREAK && hasNotes) {
      save = {
        ...save,
        wrongNotes: Object.fromEntries(Object.entries(save.wrongNotes).filter(([, t]) => t !== tag)),
      };
      mastered.push(tag);
    }
  }
  return { save, mastered, newDex };
}

/**
 * 낙서 지우기(복습) 결과를 기록한다. 방금 답을 본 문제라 맞혀도 연속 정답에 세지 않고,
 * 틀리면 오답 노트에 넣는다.
 */
export function recordReview(save: SaveData, problem: Problem, correct: boolean): SaveData {
  return correct ? save : addWrong(save, problem);
}

/** 오답 노트에 있는 문제 */
export function noteProblems(save: SaveData, problems: readonly Problem[]): Problem[] {
  return problems.filter((p) => p.id in save.wrongNotes);
}

/**
 * 간격 반복: 스테이지 문제에 오답 노트 문제를 최대 3개 섞는다.
 * 나머지는 스테이지 문제에서 채워 모두 count개 이하.
 */
export function buildStageProblems(
  stagePool: readonly Problem[],
  notePool: readonly Problem[],
  count: number,
  random: () => number = Math.random,
): Problem[] {
  const fromNotes = shuffle(notePool, random).slice(0, Math.min(MAX_NOTES_IN_STAGE, count));
  const chosen = new Set(fromNotes.map((p) => p.id));
  const rest = shuffle(
    stagePool.filter((p) => !chosen.has(p.id)),
    random,
  ).slice(0, count - fromNotes.length);
  return [...fromNotes, ...rest];
}
