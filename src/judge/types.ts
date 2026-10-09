// 문제 형식: 기획서 8.1

export type Level = 1 | 2 | 3;
export type ProblemKind = 'spelling' | 'spacing' | 'punctuation';
export type ProblemSource = 'builtin' | 'ai' | 'teacher';

export interface Problem {
  id: string;
  level: Level;
  kind: ProblemKind;
  tag: string;
  rule: string;
  wrong: string;
  correct: string;
  /** 틀린 부분. start는 wrong에서 0부터 센 글자 위치. 띄어쓰기 문제와 noError 문제에는 없다. */
  target?: { wrongText: string; start: number };
  /** 보기(틀린 부분을 바꿔 넣을 말). 맞춤법·문장 부호 문제에만 있다. */
  choices?: string[];
  acceptedAnswers: string[];
  explain: string;
  /** 3단계 "고칠 곳 없음" 문제. wrong과 correct가 같다(기획서 7.4). */
  noError?: boolean;
  source: ProblemSource;
  reviewed: boolean;
}

// 오류 유형 태그: 기획서 4.2
export const TAGS: Record<Level, string[]> = {
  1: ['소리 나는 대로 쓰기', '받침', 'ㅐ/ㅔ', '된소리', '문장 부호', '띄어쓰기 기초'],
  2: ['되/돼', '안/않', '자주 틀리는 낱말', '뜻이 다른 낱말', '조사 붙여 쓰기', '단위 띄어쓰기'],
  3: [
    '로서/로써',
    '든지/던지',
    '맞히다/맞추다',
    '붙이다/부치다, 반드시/반듯이',
    '웬/왠',
    '어떡해/어떻게',
    '-이/-히',
    '사이시옷',
    '의존 명사 띄어쓰기',
    '보조 용언',
  ],
};

// 단계별 문장 길이 상한(띄어쓰기·문장 부호 포함): 기획서 9.3
export const MAX_LENGTH: Record<Level, number> = { 1: 15, 2: 25, 3: 40 };
