import { describe, expect, it } from 'vitest';
import type { Problem } from '../judge/types';
import { emptySave, type SaveData } from '../storage/save';
import {
  MAX_NOTES_IN_STAGE,
  buildStageProblems,
  noteProblems,
  recordReview,
  recordStage,
  type Outcome,
} from './progress';

const problem = (id: string, tag: string) => ({ id, tag, level: 3 }) as Problem;
const A1 = problem('A1', '로서/로써');
const A2 = problem('A2', '로서/로써');
const A3 = problem('A3', '로서/로써');
const A4 = problem('A4', '로서/로써');
const B1 = problem('B1', '웬/왠');

const play = (save: SaveData, ...list: [Problem, Outcome][]) =>
  recordStage(
    save,
    list.map(([p, outcome]) => ({ problem: p, outcome })),
  );

describe('recordStage: 오답 노트', () => {
  it('틀린 문제는 오답 노트에 들어가고 연속 정답이 0이 된다', () => {
    const { save } = play({ ...emptySave(), tagStreaks: { '로서/로써': 2 } }, [A1, 'wrong']);
    expect(save.wrongNotes).toEqual({ A1: '로서/로써' });
    expect(save.tagStreaks['로서/로써']).toBe(0);
  });

  it('놓친 문제(성에 닿음)는 기록하지 않는다', () => {
    const { save } = play(emptySave(), [A1, 'missed']);
    expect(save).toEqual(emptySave());
  });
});

describe('recordStage: 도감', () => {
  it('처음 정화한 태그는 도감에 등록된다', () => {
    const { save, newDex } = play(emptySave(), [A1, 'correct'], [A2, 'correct'], [B1, 'correct']);
    expect(save.dex).toEqual(['로서/로써', '웬/왠']);
    expect(newDex).toEqual(['로서/로써', '웬/왠']);
  });

  it('이미 등록된 태그는 다시 새 등록으로 세지 않는다', () => {
    const { newDex } = play({ ...emptySave(), dex: ['로서/로써'] }, [A1, 'correct']);
    expect(newDex).toEqual([]);
  });
});

describe('recordStage: 익힘(같은 태그 3번 연속 정답)', () => {
  const withNote = play(emptySave(), [A1, 'wrong']).save;

  it('3번 연속 맞히면 그 태그 문제가 오답 노트에서 빠진다', () => {
    const result = play(withNote, [A2, 'correct'], [A3, 'correct'], [A4, 'correct']);
    expect(result.save.wrongNotes).toEqual({});
    expect(result.mastered).toEqual(['로서/로써']);
  });

  it('2번까지는 그대로 남는다', () => {
    const result = play(withNote, [A2, 'correct'], [A3, 'correct']);
    expect(result.save.wrongNotes).toEqual({ A1: '로서/로써' });
    expect(result.save.tagStreaks['로서/로써']).toBe(2);
    expect(result.mastered).toEqual([]);
  });

  it('중간에 틀리면 처음부터 다시 센다', () => {
    const result = play(withNote, [A2, 'correct'], [A3, 'correct'], [A4, 'wrong'], [A2, 'correct']);
    expect(result.save.tagStreaks['로서/로써']).toBe(1);
    expect(Object.keys(result.save.wrongNotes).sort()).toEqual(['A1', 'A4']);
  });

  it('스테이지를 넘어서도 이어서 센다', () => {
    const first = play(withNote, [A2, 'correct'], [A3, 'correct']).save;
    const second = play(first, [A4, 'correct']);
    expect(second.mastered).toEqual(['로서/로써']);
  });

  it('다른 태그 정답은 세지 않는다', () => {
    const result = play(withNote, [A2, 'correct'], [B1, 'correct'], [A3, 'correct']);
    expect(result.save.tagStreaks['로서/로써']).toBe(2);
    expect(result.save.wrongNotes).toEqual({ A1: '로서/로써' });
  });

  it('놓친 문제는 연속 정답을 끊지 않는다', () => {
    const result = play(withNote, [A2, 'correct'], [A3, 'missed'], [A3, 'correct'], [A4, 'correct']);
    expect(result.mastered).toEqual(['로서/로써']);
  });

  it('오답 노트에 없는 태그는 익힘 알림이 없다', () => {
    const result = play(emptySave(), [A1, 'correct'], [A2, 'correct'], [A3, 'correct']);
    expect(result.mastered).toEqual([]);
  });
});

describe('recordReview: 낙서 지우기', () => {
  it('맞혀도 연속 정답에 세지 않는다', () => {
    const save = { ...emptySave(), tagStreaks: { '로서/로써': 1 } };
    expect(recordReview(save, A1, true)).toBe(save);
  });

  it('틀리면 오답 노트에 넣는다', () => {
    const save = recordReview(emptySave(), A1, false);
    expect(save.wrongNotes).toEqual({ A1: '로서/로써' });
  });
});

describe('간격 반복', () => {
  const stagePool = Array.from({ length: 12 }, (_, i) => problem(`S${i}`, '사이시옷'));

  it('오답 노트 문제를 최대 3개 섞고 나머지는 스테이지 문제로 채운다', () => {
    const notes = [A1, A2, A3, A4, B1];
    const result = buildStageProblems(stagePool, notes, 10);
    expect(result).toHaveLength(10);
    expect(result.filter((p) => notes.includes(p))).toHaveLength(MAX_NOTES_IN_STAGE);
  });

  it('오답 노트가 비면 스테이지 문제만', () => {
    const result = buildStageProblems(stagePool, [], 10);
    expect(result).toHaveLength(10);
    expect(result.every((p) => p.id.startsWith('S'))).toBe(true);
  });

  it('같은 문제를 두 번 내지 않는다(오답 노트 문제가 스테이지 문제이기도 할 때)', () => {
    const result = buildStageProblems(stagePool, [stagePool[0], stagePool[1]], 10);
    expect(new Set(result.map((p) => p.id)).size).toBe(result.length);
  });

  it('문제가 모자라면 있는 만큼만', () => {
    expect(buildStageProblems(stagePool.slice(0, 4), [A1], 10)).toHaveLength(5);
  });

  it('noteProblems: 오답 노트에 있는 문제만 고른다', () => {
    const save = { ...emptySave(), wrongNotes: { A2: '로서/로써', 없는문제: '웬/왠' } };
    expect(noteProblems(save, [A1, A2, B1])).toEqual([A2]);
  });
});
