import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL } from '../ai/openrouter';
import type { Problem } from '../judge/types';
import { activeProblems, emptyTeacher, hashPin, parseTeacher, type TeacherData } from './teacher';

const problem = (id: string, reviewed: boolean): Problem => ({
  id,
  level: 3,
  kind: 'spelling',
  tag: '웬/왠',
  rule: '표기',
  wrong: '왠일로 왔니?',
  correct: '웬일로 왔니?',
  target: { wrongText: '왠일로', start: 0 },
  choices: ['웬일로', '왠일로', '웬닐로'],
  acceptedAnswers: ['웬일로 왔니?'],
  explain: "'왠지'가 아니면 '웬'을 써요.",
  source: 'ai',
  reviewed,
});

describe('교사 데이터', () => {
  it('비었거나 깨진 데이터는 빈 데이터', () => {
    expect(parseTeacher(null)).toEqual(emptyTeacher());
    expect(parseTeacher('{깨짐')).toEqual(emptyTeacher());
    expect(parseTeacher('{"version":9}')).toEqual(emptyTeacher());
    expect(emptyTeacher().model).toBe(DEFAULT_MODEL);
  });

  it('형식이 틀린 문제는 버리고 나머지는 살린다', () => {
    const data: TeacherData = {
      ...emptyTeacher(),
      pinHash: 'abc',
      sets: [
        { id: 's1', name: '세트', active: true, problems: [problem('a', true), { ...problem('b', true), wrong: '' }] },
      ],
    };
    const parsed = parseTeacher(JSON.stringify(data));
    expect(parsed.pinHash).toBe('abc');
    expect(parsed.sets[0].problems.map((p) => p.id)).toEqual(['a']);
  });

  it('출제 대상: 켜진 세트의 승인한 문제만', () => {
    const data: TeacherData = {
      ...emptyTeacher(),
      sets: [
        { id: 's1', name: '켜짐', active: true, problems: [problem('a', true), problem('b', false)] },
        { id: 's2', name: '꺼짐', active: false, problems: [problem('c', true)] },
      ],
    };
    expect(activeProblems(data).map((p) => p.id)).toEqual(['a']);
  });

  it('PIN은 해시로만 저장한다', async () => {
    const hash = await hashPin('1234');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashPin('1234')).toBe(hash);
    expect(await hashPin('4321')).not.toBe(hash);
  });
});
