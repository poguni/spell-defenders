import { describe, expect, it } from 'vitest';
import type { Problem } from './types';
import { validateProblem, validateProblems } from './validate';

const spelling: Problem = {
  id: 'L3-roseo-001',
  level: 3,
  kind: 'spelling',
  tag: '로서/로써',
  rule: '한글 맞춤법 제57항',
  wrong: '나는 반장으로써 회의를 이끌었다.',
  correct: '나는 반장으로서 회의를 이끌었다.',
  target: { wrongText: '반장으로써', start: 3 },
  choices: ['반장으로서', '반장으로써', '반장으루서'],
  acceptedAnswers: ['나는 반장으로서 회의를 이끌었다.'],
  explain: "자격을 나타낼 때는 '로서'를 써요.",
  source: 'builtin',
  reviewed: false,
};

const spacing: Problem = {
  id: 'L3-uijon-001',
  level: 3,
  kind: 'spacing',
  tag: '의존 명사 띄어쓰기',
  rule: '한글 맞춤법 제42항',
  wrong: '나도 자전거를 탈수 있다.',
  correct: '나도 자전거를 탈 수 있다.',
  acceptedAnswers: ['나도 자전거를 탈 수 있다.'],
  explain: "'수'는 띄어 써요.",
  source: 'builtin',
  reviewed: false,
};

const noError: Problem = {
  id: 'L3-wen-003',
  level: 3,
  kind: 'spelling',
  tag: '웬/왠',
  rule: '표준국어대사전',
  noError: true,
  wrong: '오늘은 왠지 기분이 좋다.',
  correct: '오늘은 왠지 기분이 좋다.',
  acceptedAnswers: ['오늘은 왠지 기분이 좋다.'],
  explain: "'왠지'는 맞게 썼어요.",
  source: 'builtin',
  reviewed: false,
};

describe('validateProblem: 올바른 문제는 통과', () => {
  it.each([
    ['맞춤법', spelling],
    ['띄어쓰기', spacing],
    ['고칠 곳 없음', noError],
  ])('%s', (_, problem) => {
    expect(validateProblem(problem)).toEqual([]);
  });
});

describe('validateProblem: 필수 필드', () => {
  it('객체가 아니면 실패', () => {
    expect(validateProblem(null)).toHaveLength(1);
    expect(validateProblem('문제')).toHaveLength(1);
  });

  it('빠진 필드를 모두 알려 준다', () => {
    const { rule: _rule, explain: _explain, ...rest } = spelling;
    const errors = validateProblem(rest);
    expect(errors).toContain('rule(근거 조항)이 없음');
    expect(errors).toContain('explain(설명)이 없음');
  });

  it('level, kind, source, reviewed 값이 틀리면 실패', () => {
    expect(validateProblem({ ...spelling, level: 4 })).toHaveLength(1);
    expect(validateProblem({ ...spelling, kind: 'grammar' })).toHaveLength(1);
    expect(validateProblem({ ...spelling, source: 'web' })).toHaveLength(1);
    expect(validateProblem({ ...spelling, reviewed: 'yes' })).toHaveLength(1);
  });

  it('target 형식이 틀리면 실패', () => {
    expect(validateProblem({ ...spelling, target: { wrongText: '반장으로써' } })).toEqual([
      'target(wrongText, start) 형식이 틀림',
    ]);
  });

  it('그 단계에 없는 태그면 실패', () => {
    expect(validateProblem({ ...spelling, tag: '되/돼' })[0]).toMatch('3단계 태그 목록에 없음');
  });
});

describe('validateProblem: 맞춤법 문제', () => {
  it('wrong과 correct가 같으면 실패', () => {
    const errors = validateProblem({ ...spelling, correct: spelling.wrong, acceptedAnswers: [spelling.wrong] });
    expect(errors).toContain('wrong과 correct가 같음');
  });

  it('target.start 위치의 글자가 wrongText와 다르면 실패', () => {
    const errors = validateProblem({ ...spelling, target: { wrongText: '반장으로써', start: 4 } });
    expect(errors[0]).toMatch('target.start 4 위치의 글자가');
  });

  it('target 밖에서도 다르면(오류가 두 곳) 실패', () => {
    const errors = validateProblem({
      ...spelling,
      correct: '나는 반장으로서 회의를 이끌었어.',
      acceptedAnswers: ['나는 반장으로서 회의를 이끌었어.'],
    });
    expect(errors.some((e) => e.includes('target 밖에서도'))).toBe(true);
  });

  it('보기에 정답이 없거나 둘 이상이면 실패', () => {
    expect(validateProblem({ ...spelling, choices: ['반장으로써', '반장으루서'] })).toContain(
      'choices 중 정답이 0개임(정확히 1개여야 함)',
    );
    const twoAnswers = {
      ...spelling,
      choices: ['반장으로서', '반장 으로서', '반장으로써'],
      acceptedAnswers: [spelling.correct, '나는 반장 으로서 회의를 이끌었다.'],
    };
    expect(validateProblem(twoAnswers)).toContain('choices 중 정답이 2개임(정확히 1개여야 함)');
  });

  it('같은 보기가 두 번 있으면 실패', () => {
    expect(validateProblem({ ...spelling, choices: ['반장으로서', '반장으로써', '반장으로써'] })).toContain(
      'choices에 같은 보기가 두 번 있음',
    );
  });

  it('target이나 choices가 없으면 실패', () => {
    expect(validateProblem({ ...spelling, target: undefined })).toContain('target이 없음');
    expect(validateProblem({ ...spelling, choices: undefined })).toContain('choices가 없음');
  });

  it('acceptedAnswers에 correct가 없으면 실패', () => {
    expect(validateProblem({ ...spelling, acceptedAnswers: ['나는 반장으로서 회의를 이끌었다!'] })).toContain(
      'acceptedAnswers에 correct가 없음',
    );
  });
});

describe('validateProblem: 띄어쓰기 문제', () => {
  it('공백 말고 글자가 다르면 실패', () => {
    const errors = validateProblem({
      ...spacing,
      correct: '나도 자전거를 탈 수 없다.',
      acceptedAnswers: ['나도 자전거를 탈 수 없다.'],
    });
    expect(errors.some((e) => e.includes('글자가 wrong과 다름'))).toBe(true);
  });

  it('target이나 choices를 넣으면 실패', () => {
    expect(validateProblem({ ...spacing, choices: ['탈 수', '탈수'] })).toContain(
      '띄어쓰기 문제에는 target·choices를 넣지 않음',
    );
  });
});

describe('validateProblem: 고칠 곳 없음 문제', () => {
  it('wrong과 correct가 다르면 실패', () => {
    expect(validateProblem({ ...noError, correct: '오늘은 웬지 기분이 좋다.' })).toContain(
      '"고칠 곳 없음" 문제는 wrong과 correct가 같아야 함',
    );
  });

  it('3단계가 아니면 실패', () => {
    expect(validateProblem({ ...noError, level: 2, tag: '되/돼' })).toContain('"고칠 곳 없음" 문제는 3단계에만 넣음');
  });

  it('target이나 choices를 넣으면 실패', () => {
    expect(validateProblem({ ...noError, choices: ['왠지', '웬지'] })).toContain(
      '"고칠 곳 없음" 문제에는 target·choices를 넣지 않음',
    );
  });
});

describe('validateProblem: 글자 정규화와 길이', () => {
  it('NFD 글자, 문장 끝 공백, 연속 공백이 있으면 실패', () => {
    expect(validateProblem({ ...spacing, wrong: spacing.wrong.normalize('NFD') })[0]).toMatch('정규화되지 않음');
    expect(validateProblem({ ...spacing, wrong: spacing.wrong + ' ' })[0]).toMatch('정규화되지 않음');
    expect(validateProblem({ ...spacing, wrong: '나도  자전거를 탈수 있다.' })[0]).toMatch('정규화되지 않음');
  });

  it('단계별 길이 상한을 넘으면 실패(3단계 40자)', () => {
    const long = '가'.repeat(37) + '할수.'; // 40자
    const ok = { ...spacing, wrong: long, correct: '가'.repeat(37) + '할 수.', acceptedAnswers: ['가'.repeat(37) + '할 수.'] };
    expect(validateProblem(ok).some((e) => e.includes('상한'))).toBe(true); // 바른 문장은 41자
    const short = { ...ok, wrong: '가'.repeat(36) + '할수.', correct: '가'.repeat(36) + '할 수.', acceptedAnswers: ['가'.repeat(36) + '할 수.'] };
    expect(validateProblem(short)).toEqual([]);
  });
});

describe('validateProblems', () => {
  it('id 중복을 찾는다', () => {
    const issues = validateProblems([spelling, spacing, { ...spacing }]);
    expect(issues).toEqual([{ index: 2, id: 'L3-uijon-001', message: 'id가 중복됨' }]);
  });

  it('문제점마다 위치와 id를 붙인다', () => {
    const issues = validateProblems([spelling, { ...spacing, id: '' }]);
    expect(issues).toContainEqual({ index: 1, id: '(2번째 문제)', message: 'id가 없음' });
  });

  it('모두 올바르면 빈 목록', () => {
    expect(validateProblems([spelling, spacing, noError])).toEqual([]);
  });
});
