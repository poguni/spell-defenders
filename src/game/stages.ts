// 단계별 스테이지 지도. 스테이지는 오류 유형(태그) 묶음으로 구성한다(기획서 4.1).
import { TAGS, type Level, type Problem } from '../judge/types';

export interface StageDef {
  id: string;
  level: Level;
  number: number;
  /** 이 스테이지에서 내는 태그. null이면 그 단계 모든 태그(모두 섞기) */
  tags: string[] | null;
}

export const LEVEL_INFO: Record<Level, { place: string; grade: string }> = {
  1: { place: '마을', grade: '초2' },
  2: { place: '숲', grade: '초3~4' },
  3: { place: '성', grade: '초5~6' },
};

const t3 = TAGS[3];

export const STAGES: StageDef[] = [
  // 1·2단계는 문제가 생기면 태그 묶음으로 나눈다
  { id: 'L1-1', level: 1, number: 1, tags: null },
  { id: 'L2-1', level: 2, number: 1, tags: null },
  { id: 'L3-1', level: 3, number: 1, tags: [t3[0], t3[1], t3[2]] },
  { id: 'L3-2', level: 3, number: 2, tags: [t3[3], t3[4], t3[5]] },
  { id: 'L3-3', level: 3, number: 3, tags: [t3[6], t3[7], t3[8]] },
  { id: 'L3-4', level: 3, number: 4, tags: null },
];

export function stagesOf(level: Level): StageDef[] {
  return STAGES.filter((s) => s.level === level);
}

export function findStage(id: string): StageDef | undefined {
  return STAGES.find((s) => s.id === id);
}

export function stagePool(stage: StageDef, problems: readonly Problem[]): Problem[] {
  return problems.filter((p) => p.level === stage.level && (!stage.tags || stage.tags.includes(p.tag)));
}

/** 첫 스테이지는 처음부터 열려 있고, 나머지는 앞 스테이지를 끝내면(별 1개 이상) 열린다 */
export function isUnlocked(stage: StageDef, stars: Record<string, number>): boolean {
  const list = stagesOf(stage.level);
  const index = list.findIndex((s) => s.id === stage.id);
  return index === 0 || (stars[list[index - 1].id] ?? 0) > 0;
}
