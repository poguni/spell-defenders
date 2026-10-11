import { describe, expect, it } from 'vitest';
import { ALL_PROBLEMS } from '../data/problems';
import { parseSharedSet, sharedStageId } from './sharedSet';

const problems = ALL_PROBLEMS.filter((p) => p.reviewed).slice(0, 3).map((p, i) => ({ ...p, id: `Sabc-${i + 1}` }));

describe('불러온 세트 저장', () => {
  it('저장한 세트를 다시 읽는다', () => {
    const set = { name: '세트', problems };
    expect(parseSharedSet(JSON.stringify(set))).toEqual(set);
    expect(sharedStageId(set)).toBe('T-Sabc');
  });

  it('비었거나 깨졌거나 승인 전·형식 오류 문제가 있으면 없는 것으로', () => {
    expect(parseSharedSet(null)).toBeNull();
    expect(parseSharedSet('{')).toBeNull();
    expect(parseSharedSet(JSON.stringify({ name: '세트', problems: [] }))).toBeNull();
    expect(parseSharedSet(JSON.stringify({ name: '세트', problems: [{ ...problems[0], reviewed: false }] }))).toBeNull();
    expect(parseSharedSet(JSON.stringify({ name: '세트', problems: [{ ...problems[0], wrong: '' }] }))).toBeNull();
  });
});
