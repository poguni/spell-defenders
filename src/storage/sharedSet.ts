// 학생 기기에 불러온 선생님 문제 세트(한 개만 둔다. 새로 불러오면 바뀜). 학생 기록(save.ts)과 따로 저장한다.
import { validateProblem } from '../judge/validate';
import type { SharedSet } from '../share/shareCode';

export const SHARED_SET_KEY = 'spell-defenders-shared-set';

/** 저장된 세트를 다시 검사한다. 하나라도 이상하면 없는 것으로 */
export function parseSharedSet(raw: string | null): SharedSet | null {
  try {
    const data = raw ? (JSON.parse(raw) as SharedSet) : null;
    if (!data || typeof data.name !== 'string' || !Array.isArray(data.problems) || data.problems.length === 0) return null;
    const valid = data.problems.every((p) => p.reviewed === true && validateProblem(p).length === 0);
    return valid ? { name: data.name, problems: data.problems } : null;
  } catch {
    return null;
  }
}

export function loadSharedSet(): SharedSet | null {
  try {
    return parseSharedSet(localStorage.getItem(SHARED_SET_KEY));
  } catch {
    return null;
  }
}

export function writeSharedSet(set: SharedSet) {
  try {
    localStorage.setItem(SHARED_SET_KEY, JSON.stringify(set));
  } catch {
    // 저장하지 못해도 이번 접속 동안은 플레이할 수 있다
  }
}

/** 지도에 보이는 선생님 문제 스테이지 id. 세트 내용마다 달라서 별 기록이 세트마다 따로 남는다 */
export function sharedStageId(set: SharedSet): string {
  return `T-${set.problems[0].id.split('-')[0]}`;
}
