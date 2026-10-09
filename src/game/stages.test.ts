import { describe, expect, it } from 'vitest';
import { ALL_PROBLEMS } from '../data/problems';
import { TAGS } from '../judge/types';
import { STAGES, isUnlocked, stagePool, stagesOf } from './stages';

describe('스테이지 지도', () => {
  it('3단계: 태그 묶음 3개 + 모두 섞기, 보조 용언을 뺀 9개 태그가 한 번씩', () => {
    const level3 = stagesOf(3);
    expect(level3.map((s) => s.id)).toEqual(['L3-1', 'L3-2', 'L3-3', 'L3-4']);
    const tags = level3.flatMap((s) => s.tags ?? []);
    expect(new Set(tags).size).toBe(9);
    expect(tags).not.toContain('보조 용언');
    for (const tag of tags) expect(TAGS[3]).toContain(tag);
    expect(level3[3].tags).toBeNull();
  });

  it('id가 겹치지 않는다', () => {
    expect(new Set(STAGES.map((s) => s.id)).size).toBe(STAGES.length);
  });

  it('지금 문제로 3단계 스테이지마다 10문제씩 낼 수 있다', () => {
    const reviewed = ALL_PROBLEMS.filter((p) => p.reviewed);
    for (const stage of stagesOf(3)) expect(stagePool(stage, reviewed).length).toBeGreaterThanOrEqual(10);
  });

  it('첫 스테이지는 열려 있고, 앞 스테이지를 끝내야 다음이 열린다', () => {
    const [s1, s2, s3] = stagesOf(3);
    expect(isUnlocked(s1, {})).toBe(true);
    expect(isUnlocked(s2, {})).toBe(false);
    expect(isUnlocked(s2, { 'L3-1': 1 })).toBe(true);
    expect(isUnlocked(s3, { 'L3-1': 3 })).toBe(false);
  });
});
