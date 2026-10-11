import { describe, expect, it } from 'vitest';
import { TAGS } from '../judge/types';
import { convertAiProblems, type AiProblem } from './convert';
import { TAG_GUIDE } from './prompt';

const spelling = (over: Partial<AiProblem> = {}): AiProblem => ({
  kind: 'spelling',
  noError: false,
  wrong: '왠일로 일찍 왔니?',
  correct: '웬일로 일찍 왔니?',
  wrongText: '왠일로',
  choices: ['웬일로', '왠일로', '웬닐로'],
  explain: "'왠지'가 아니면 '웬'을 써요.",
  rule: '표기',
  ...over,
});
const request = { level: 3 as const, tag: '웬/왠', kind: 'spelling' as const };

describe('convertAiProblems', () => {
  it('맞춤법 문제: 틀린 부분 위치를 앱이 찾고 source ai, reviewed false', () => {
    const { problems, rejected } = convertAiProblems([spelling()], request, 'AI-x');
    expect(rejected).toEqual([]);
    expect(problems[0]).toMatchObject({
      id: 'AI-x-1',
      level: 3,
      tag: '웬/왠',
      target: { wrongText: '왠일로', start: 0 },
      acceptedAnswers: ['웬일로 일찍 왔니?'],
      source: 'ai',
      reviewed: false,
    });
  });

  it('고칠 곳 없음 문제는 target·choices 없이 wrong = correct', () => {
    const item = spelling({
      noError: true,
      wrong: '왠지 기분이 좋다.',
      correct: '왠지 기분이 좋다.',
      wrongText: null,
      choices: null,
    });
    const { problems } = convertAiProblems([item], request, 'AI-x');
    expect(problems[0].noError).toBe(true);
    expect(problems[0].target).toBeUndefined();
    expect(problems[0].choices).toBeUndefined();
  });

  it('띄어쓰기 문제', () => {
    const item: AiProblem = {
      kind: 'spacing',
      noError: false,
      wrong: '나는 할수 있다.',
      correct: '나는 할 수 있다.',
      wrongText: null,
      choices: null,
      explain: "'수'는 앞말과 띄어 써요.",
      rule: '한글 맞춤법 제42항',
    };
    const { problems } = convertAiProblems([item], { level: 3, tag: '의존 명사 띄어쓰기', kind: 'spacing' }, 'AI-x');
    expect(problems).toHaveLength(1);
  });

  it('문장 부호 문제는 문장 끝 부호를 가리킨다', () => {
    const item: AiProblem = {
      kind: 'punctuation',
      noError: false,
      wrong: '아. 배고파.',
      correct: '아. 배고파!',
      wrongText: '.',
      choices: ['!', '.', '?'],
      explain: '느끼는 문장에는 느낌표를 써요.',
      rule: '문장 부호',
    };
    const { problems } = convertAiProblems([item], { level: 1, tag: '문장 부호', kind: 'punctuation' }, 'AI-x');
    expect(problems[0].target).toEqual({ wrongText: '.', start: 6 });
  });

  it('형식이 틀린 문제는 이유와 함께 뺀다', () => {
    const list = [
      spelling({ wrongText: '웬일로' }), // 문장에 없음
      spelling({ wrong: '왠일로 왠일로 왔니?', correct: '웬일로 왠일로 왔니?' }), // 두 번 나옴
      spelling({ choices: ['웬일로', '웬일로', '왠일로'] }), // 보기 중복
      spelling({ kind: 'spacing' }), // 종류가 다름
      spelling({ correct: '웬일로 일찍 왔어?' }), // 틀린 곳 밖에서도 다름
      spelling({ wrong: '왠일로 아주아주아주아주아주아주아주아주아주아주아주아주 일찍 왔니?' }), // 너무 김
    ];
    const { problems, rejected } = convertAiProblems(list, request, 'AI-x');
    expect(problems).toEqual([]);
    expect(rejected).toHaveLength(6);
    expect(rejected[0].reasons[0]).toContain('문장에 없음');
    expect(rejected[1].reasons[0]).toContain('두 번 이상');
    for (const r of rejected) expect(r.reasons.length).toBeGreaterThan(0);
  });

  it('같은 문장은 한 번만, 2단계의 고칠 곳 없음은 뺀다', () => {
    const { problems, rejected } = convertAiProblems([spelling(), spelling()], request, 'AI-x');
    expect(problems).toHaveLength(1);
    expect(rejected[0].reasons).toContain('같은 문장이 이미 있음');
    const two = convertAiProblems([spelling({ noError: true })], { ...request, level: 2 }, 'AI-x');
    expect(two.problems).toEqual([]);
  });

  it('보조 용언(두 가지 모두 허용)을 뺀 모든 태그에 생성 지침이 있다', () => {
    for (const tag of Object.values(TAGS).flat()) {
      if (tag === '보조 용언') expect(TAG_GUIDE[tag]).toBeUndefined();
      else expect(TAG_GUIDE[tag], tag).toBeDefined();
    }
  });
});
