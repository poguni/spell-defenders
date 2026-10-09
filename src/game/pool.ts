// 출제할 수 있는 문제 고르기. reviewed: true 문제만 학생에게 낸다(기획서 8.1).
import type { Problem } from '../judge/types';

export interface PlayOptions {
  /** 검수 전 문제(reviewed: false)도 낸다. 개발 확인용 */
  includeUnreviewed: boolean;
  /** 이 id의 문제만 낸다(스테이지 태그 무시). 개발 확인용 */
  problemIds: string[] | null;
}

/**
 * 개발 스위치(기본 꺼짐). npm run dev 로 띄운 화면에서 주소에 ?dev 를 붙였을 때만 켜진다.
 * 켜지면 ?problem=L3-wen-001,L3-uijon-002 처럼 문제를 고를 수 있다.
 * 배포한 사이트(isDevServer = false)에서는 무엇을 붙여도 꺼져 있다.
 */
export function readPlayOptions(search: string, isDevServer: boolean): PlayOptions {
  const params = new URLSearchParams(search);
  if (!isDevServer || !params.has('dev')) return { includeUnreviewed: false, problemIds: null };
  const ids = params.get('problem');
  return { includeUnreviewed: true, problemIds: ids ? ids.split(',') : null };
}

export function availableProblems(problems: readonly Problem[], options: PlayOptions): Problem[] {
  return problems.filter(
    (p) => (p.reviewed || options.includeUnreviewed) && (!options.problemIds || options.problemIds.includes(p.id)),
  );
}
