import { describe, expect, it } from 'vitest';
import type { Problem } from '../judge/types';
import { availableProblems, readPlayOptions } from './pool';

const problem = (id: string, level: 1 | 2 | 3, reviewed: boolean) => ({ id, level, reviewed }) as Problem;

const PROBLEMS = [
  problem('L3-a', 3, true),
  problem('L3-b', 3, false),
  problem('L1-a', 1, true),
  problem('L1-b', 1, false),
];

describe('readPlayOptions: 개발 스위치', () => {
  it('기본값은 꺼짐', () => {
    expect(readPlayOptions('', true)).toEqual({ includeUnreviewed: false, problemIds: null });
  });

  it('개발 서버에서 ?dev 를 붙이면 켜진다', () => {
    expect(readPlayOptions('?dev', true).includeUnreviewed).toBe(true);
  });

  it('배포한 사이트에서는 ?dev 를 붙여도 꺼져 있다', () => {
    expect(readPlayOptions('?dev&problem=L1-b', false)).toEqual({ includeUnreviewed: false, problemIds: null });
  });

  it('켜졌을 때 문제를 고를 수 있다', () => {
    expect(readPlayOptions('?dev&problem=L3-a,L1-b', true).problemIds).toEqual(['L3-a', 'L1-b']);
  });
});

describe('availableProblems', () => {
  it('기본: reviewed: true 문제만', () => {
    expect(availableProblems(PROBLEMS, readPlayOptions('', true)).map((p) => p.id)).toEqual(['L3-a', 'L1-a']);
  });

  it('개발 스위치를 켜면 검수 전 문제도 낸다', () => {
    expect(availableProblems(PROBLEMS, readPlayOptions('?dev', true))).toHaveLength(4);
  });

  it('문제를 고르면 그 문제만', () => {
    expect(availableProblems(PROBLEMS, readPlayOptions('?dev&problem=L1-b,L3-b', true)).map((p) => p.id)).toEqual([
      'L3-b',
      'L1-b',
    ]);
  });
});
