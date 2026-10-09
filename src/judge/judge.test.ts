import { describe, expect, it } from 'vitest';
import { fromGaps, judgeFix, judgeNoError, judgeSpacing, judgeTap, toGaps } from './judge';
import { normalize } from './normalize';
import type { Problem } from './types';

// 기획서 8.1 예시
const spelling: Problem = {
  id: 'L2-doe-001',
  level: 2,
  kind: 'spelling',
  tag: '되/돼',
  rule: '한글 맞춤법 제35항 붙임 2',
  wrong: '내일이면 열 살이 되요.',
  correct: '내일이면 열 살이 돼요.',
  target: { wrongText: '되요', start: 10 },
  choices: ['돼요', '되요', '돼여'],
  acceptedAnswers: ['내일이면 열 살이 돼요.'],
  explain: "'되어요'로 바꿔도 말이 되니까 '돼요'가 맞아요.",
  source: 'builtin',
  reviewed: true,
};

const punctuation: Problem = {
  ...spelling,
  id: 'L1-punct-001',
  level: 1,
  kind: 'punctuation',
  tag: '문장 부호',
  rule: '문장 부호 규정',
  wrong: '밥 먹었니.',
  correct: '밥 먹었니?',
  target: { wrongText: '.', start: 5 },
  choices: ['?', '.', '!'],
  acceptedAnswers: ['밥 먹었니?'],
};

const spacing: Problem = {
  ...spelling,
  id: 'L3-uijon-001',
  level: 3,
  kind: 'spacing',
  tag: '의존 명사 띄어쓰기',
  rule: '한글 맞춤법 제42항',
  wrong: '나도 할수 있다.',
  correct: '나도 할 수 있다.',
  target: undefined,
  choices: undefined,
  acceptedAnswers: ['나도 할 수 있다.'],
};

const noError: Problem = {
  ...spelling,
  id: 'L3-wen-001',
  level: 3,
  tag: '웬/왠',
  wrong: '오늘은 왠지 기분이 좋다.',
  correct: '오늘은 왠지 기분이 좋다.',
  target: undefined,
  choices: undefined,
  acceptedAnswers: ['오늘은 왠지 기분이 좋다.'],
  noError: true,
};

const nfd = (text: string) => text.normalize('NFD');

describe('normalize', () => {
  it('NFD 한글을 NFC로 바꾼다', () => {
    const decomposed = nfd('돼요');
    expect(decomposed).not.toBe('돼요');
    expect(normalize(decomposed)).toBe('돼요');
  });

  it('앞뒤 공백을 없애고 연속 공백·탭·전각 공백을 한 칸으로 줄인다', () => {
    expect(normalize('  나도\t 할　　수  있다.  ')).toBe('나도 할 수 있다.');
  });
});

describe('judgeFix: 맞춤법 고치기', () => {
  it('바른 보기를 고르면 정답', () => {
    expect(judgeFix(spelling, '돼요')).toBe(true);
  });

  it('틀린 보기를 고르면 오답', () => {
    expect(judgeFix(spelling, '되요')).toBe(false);
    expect(judgeFix(spelling, '돼여')).toBe(false);
  });

  it('직접 입력한 글자가 NFD이거나 앞뒤 공백이 있어도 정답', () => {
    expect(judgeFix(spelling, nfd('돼요'))).toBe(true);
    expect(judgeFix(spelling, ' 돼요  ')).toBe(true);
  });

  it('빈 입력은 오답', () => {
    expect(judgeFix(spelling, '')).toBe(false);
    expect(judgeFix(spelling, '   ')).toBe(false);
  });

  it('acceptedAnswers 중 어느 것과 같아도 정답(복수 정답)', () => {
    const twoAnswers: Problem = {
      ...spelling,
      acceptedAnswers: ['내일이면 열 살이 돼요.', '내일이면 열 살이 되어요.'],
    };
    expect(judgeFix(twoAnswers, '돼요')).toBe(true);
    expect(judgeFix(twoAnswers, '되어요')).toBe(true);
    expect(judgeFix(twoAnswers, '되요')).toBe(false);
  });

  it('문제 데이터가 NFD로 들어와도 정답을 알아본다', () => {
    const nfdProblem: Problem = { ...spelling, acceptedAnswers: [nfd('내일이면 열 살이 돼요.')] };
    expect(judgeFix(nfdProblem, '돼요')).toBe(true);
  });

  it('target이 없는 문제(띄어쓰기, 고칠 곳 없음)는 언제나 오답', () => {
    expect(judgeFix(spacing, '할 수')).toBe(false);
    expect(judgeFix(noError, '웬지')).toBe(false);
  });
});

describe('judgeFix: 문장 부호', () => {
  it('바른 부호를 고르면 정답, 다른 부호는 오답', () => {
    expect(judgeFix(punctuation, '?')).toBe(true);
    expect(judgeFix(punctuation, '!')).toBe(false);
    expect(judgeFix(punctuation, '.')).toBe(false);
  });

  it('직접 입력한 부호 앞뒤의 공백은 무시한다', () => {
    expect(judgeFix(punctuation, ' ? ')).toBe(true);
  });

  it('부호를 여러 개 넣으면 오답', () => {
    expect(judgeFix(punctuation, '??')).toBe(false);
  });
});

describe('judgeTap: 틀린 낱말 찾기', () => {
  // '내일이면 열 살이 되요.' 에서 '되요'는 10~11번째 글자
  it('target 안의 글자를 탭하면 정답', () => {
    expect(judgeTap(spelling, 10, 11)).toBe(true);
    expect(judgeTap(spelling, 11, 12)).toBe(true);
  });

  it('target 바로 앞뒤 글자를 탭하면 오답', () => {
    expect(judgeTap(spelling, 9, 10)).toBe(false); // 띄어쓰기
    expect(judgeTap(spelling, 12, 13)).toBe(false); // 마침표
  });

  it('target이 들어 있는 어절(낱말 덩어리) 범위로 탭해도 정답', () => {
    expect(judgeTap(spelling, 10, 13)).toBe(true); // '되요.'
  });

  it('다른 어절을 탭하면 오답', () => {
    expect(judgeTap(spelling, 0, 4)).toBe(false); // '내일이면'
  });

  it('고칠 곳 없음 문제는 어디를 탭해도 오답', () => {
    expect(judgeTap(noError, 4, 6)).toBe(false);
  });
});

describe('judgeNoError: 고칠 곳 없음 버튼', () => {
  it('고칠 곳 없음 문제에서 누르면 정답', () => {
    expect(judgeNoError(noError)).toBe(true);
  });

  it('고칠 곳이 있는 문제에서 누르면 오답', () => {
    expect(judgeNoError(spelling)).toBe(false);
    expect(judgeNoError(spacing)).toBe(false);
  });
});

describe('toGaps', () => {
  it('글자 배열과 글자 사이 띄움/붙임 값을 만든다', () => {
    expect(toGaps('할 수')).toEqual({ letters: ['할', '수'], gaps: [true] });
    expect(toGaps('할수.')).toEqual({ letters: ['할', '수', '.'], gaps: [false, false] });
  });

  it('빈 문자열은 글자도 틈도 없다', () => {
    expect(toGaps('  ')).toEqual({ letters: [], gaps: [] });
  });

  it('fromGaps로 되돌리면 정규화한 문장과 같다', () => {
    const { letters, gaps } = toGaps('  나도  할 수 있다. ');
    expect(fromGaps(letters, gaps)).toBe('나도 할 수 있다.');
    expect(fromGaps([], [])).toBe('');
  });
});

describe('judgeSpacing: 띄어쓰기', () => {
  // 글자: 나 도 할 수 있 다 .  / 틈 번호: 0(나|도) 1(도|할) 2(할|수) 3(수|있) 4(있|다) 5(다|.)
  it('바르게 띄우면 정답', () => {
    expect(judgeSpacing(spacing, '나도 할 수 있다.')).toEqual({ correct: true, needSpace: [], needJoin: [] });
  });

  it('고치지 않고 내면 띄워야 할 곳을 알려 준다', () => {
    expect(judgeSpacing(spacing, '나도 할수 있다.')).toEqual({ correct: false, needSpace: [2], needJoin: [] });
  });

  it('잘못 띄운 곳과 안 띄운 곳을 함께 알려 준다', () => {
    expect(judgeSpacing(spacing, '나 도 할수 있다.')).toEqual({ correct: false, needSpace: [2], needJoin: [0] });
  });

  it('NFD, 문장 끝 공백, 연속 공백이 있어도 정답', () => {
    expect(judgeSpacing(spacing, nfd('나도  할 수   있다.  '))).toMatchObject({ correct: true });
  });

  it('문장 부호 앞을 띄우면 붙여야 할 곳으로 알려 준다', () => {
    expect(judgeSpacing(spacing, '나도 할 수 있다 .')).toEqual({ correct: false, needSpace: [], needJoin: [5] });
  });

  it('acceptedAnswers 중 하나와 같으면 정답, 틀리면 가장 가까운 답 기준으로 알려 준다', () => {
    // 띄어쓰기 허용 규정이 있는 경우(예: 보조 용언)
    const twoAnswers: Problem = {
      ...spacing,
      wrong: '불을꺼 두었다.',
      correct: '불을 꺼 두었다.',
      acceptedAnswers: ['불을 꺼 두었다.', '불을 꺼두었다.'],
    };
    expect(judgeSpacing(twoAnswers, '불을 꺼 두었다.').correct).toBe(true);
    expect(judgeSpacing(twoAnswers, '불을 꺼두었다.').correct).toBe(true);
    // '불을꺼두었다.'는 두 번째 답과 한 곳만 다르다
    expect(judgeSpacing(twoAnswers, '불을꺼두었다.')).toEqual({ correct: false, needSpace: [1], needJoin: [] });
  });

  it('공백 말고 글자가 다르거나 빈 입력이면 오답이고 위치는 비운다', () => {
    expect(judgeSpacing(spacing, '나도 할 수 없다.')).toEqual({ correct: false, needSpace: [], needJoin: [] });
    expect(judgeSpacing(spacing, '')).toEqual({ correct: false, needSpace: [], needJoin: [] });
  });
});
