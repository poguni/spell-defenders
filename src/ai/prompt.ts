// AI 문제 생성 지침(기획서 9.2, 9.3). 태그 설명은 기획서 4.2.
// 이 파일의 문구가 OpenRouter로 보내는 내용 전부다(API 키는 따로 머리글로만 보낸다).
import { MAX_LENGTH, type Level, type ProblemKind } from '../judge/types';

export const MAX_GENERATE_COUNT = 20;

/**
 * 태그마다 문제 종류와 출제 안내(예시: 틀림 → 바름). 여기 있는 태그만 AI로 만들 수 있다.
 * '보조 용언'은 띄어쓰기를 두 가지 모두 허용해서(기획서 4.2, 13장) AI 생성에서 뺀다.
 */
export const TAG_GUIDE: Record<string, { kind: ProblemKind; guide: string }> = {
  // 1단계(초2) 소리와 표기
  '소리 나는 대로 쓰기': { kind: 'spelling', guide: "소리 나는 대로 잘못 쓴 낱말. 예: 가치 놀자 → 같이 놀자, 구지 → 굳이 (한글 맞춤법 제1항, 제6항)" },
  받침: { kind: 'spelling', guide: '받침을 잘못 쓴 낱말. 예: 닥 → 닭, 일따 → 읽다' },
  'ㅐ/ㅔ': { kind: 'spelling', guide: "'ㅐ'와 'ㅔ'를 바꿔 쓴 낱말. 예: 배개 → 베개, 께끗이 → 깨끗이" },
  된소리: { kind: 'spelling', guide: '된소리로 잘못 쓴 어미. 예: 할께 → 할게 (한글 맞춤법 제53항)' },
  '문장 부호': { kind: 'punctuation', guide: '문장 끝 부호(마침표, 물음표, 느낌표)를 잘못 쓴 문장. 예: 밥 먹었니. → 밥 먹었니?' },
  '띄어쓰기 기초': { kind: 'spacing', guide: '낱말을 붙여 쓴 짧은 문장. 예: 나는학교에간다 → 나는 학교에 간다 (한글 맞춤법 제2항)' },
  // 2단계(초3~4) 헷갈리는 낱말
  '되/돼': { kind: 'spelling', guide: "'되'와 '돼'. '되어'로 바꿔 말이 되면 '돼'. 예: 열 살이 되요 → 열 살이 돼요" },
  '안/않': { kind: 'spelling', guide: "'안'과 '않'. '아니'로 바꿀 수 있으면 '안', '아니하'면 '않'. 예: 하지 안았다 → 하지 않았다" },
  '자주 틀리는 낱말': { kind: 'spelling', guide: '자주 틀리는 낱말. 예: 몇일 → 며칠, 금새 → 금세, 설겆이 → 설거지, 역활 → 역할, 일부로 → 일부러' },
  '뜻이 다른 낱말': { kind: 'spelling', guide: '뜻이 다른데 헷갈리는 낱말. 예: 잊어버리다/잃어버리다, 가르치다/가리키다, 낫다/낮다/낳다' },
  '조사 붙여 쓰기': { kind: 'spacing', guide: '조사를 앞말과 띄어 쓴 문장. 예: 친구 와 함께 → 친구와 함께 (한글 맞춤법 제41항)' },
  '단위 띄어쓰기': { kind: 'spacing', guide: '단위를 나타내는 말을 붙여 쓴 문장. 예: 사과한개 → 사과 한 개 (한글 맞춤법 제43항)' },
  // 3단계(초5~6) 구별해 쓰는 말과 띄어쓰기 심화
  '로서/로써': { kind: 'spelling', guide: "자격은 '로서', 방법·도구·재료는 '로써'. 예: 반장으로써 → 반장으로서 (한글 맞춤법 제57항)" },
  '든지/던지': { kind: 'spelling', guide: "고를 때는 '든지', 지난 일을 떠올릴 때는 '던지'. 예: 사과든지 배든지 / 얼마나 춥던지 (한글 맞춤법 제56항)" },
  '맞히다/맞추다': { kind: 'spelling', guide: "답·목표에는 '맞히다', 비교하거나 제자리에 붙일 때는 '맞추다'. 예: 정답을 맞췄다 → 정답을 맞혔다" },
  '붙이다/부치다, 반드시/반듯이': { kind: 'spelling', guide: "딱 대면 '붙이다', 보내거나 부채질하면 '부치다'. '꼭'은 '반드시', 비뚤지 않으면 '반듯이'. 예: 편지를 붙였다 → 편지를 부쳤다 (한글 맞춤법 제57항)" },
  '웬/왠': { kind: 'spelling', guide: "'왠지'에만 '왠', 나머지는 '웬'. 예: 왠일이니 → 웬일이니" },
  '어떡해/어떻게': { kind: 'spelling', guide: "'어떻게 해'의 준말은 '어떡해', 방법·모양은 '어떻게'. 예: 어떻해 → 어떡해" },
  '-이/-히': { kind: 'spelling', guide: "끝소리가 '이'로만 나면 '-이', '히'로도 나면 '-히'. 예: 깨끗히 → 깨끗이 (한글 맞춤법 제51항)" },
  사이시옷: { kind: 'spelling', guide: "사이시옷을 빼거나 잘못 넣은 낱말. 예: 나무잎 → 나뭇잎, 바다가 → 바닷가 (한글 맞춤법 제30항)" },
  '의존 명사 띄어쓰기': { kind: 'spacing', guide: '의존 명사(수, 것, 줄, 적, 데, 만큼 등)를 붙여 쓴 문장. 예: 할수있다 → 할 수 있다 (한글 맞춤법 제42항)' },
};

/** 지침(시스템 메시지) */
export const SYSTEM_PROMPT = `너는 초등학생용 한국어 맞춤법 게임의 문제를 만드는 출제자다.
정답이 틀린 문제는 학생에게 잘못된 맞춤법을 가르치므로, 국립국어원 「한글 맞춤법」과 『표준국어대사전』에 비추어 확실한 문장만 만든다. 조금이라도 애매하면 그 문장은 만들지 않는다.

[공통 원칙]
- 소재는 학생의 일상(학교, 급식, 친구, 가족, 운동회, 놀이, 숙제 등)에서 고른다.
- 실존 인물, 연예인, 브랜드, 회사, 상품 이름은 쓰지 않는다. 무섭거나 폭력적인 내용, 차별하는 표현은 쓰지 않는다.
- 틀린 문장(wrong)에는 그 유형의 오류를 정확히 하나만 넣는다. 나머지 부분은 모두 바르게 쓴다.
- 띄어쓰기를 두 가지 모두 허용하는 곳(보조 용언 "먹어 보다/먹어보다", 전문 용어 등)은 문제에 넣지 않는다.
- 같은 문장이나 거의 같은 문장을 되풀이하지 않는다.
- 문장은 반드시 마침표, 물음표, 느낌표 중 하나로 끝낸다.

[필드 쓰는 법]
- kind: 요청에서 정한 종류를 그대로 쓴다.
- noError: "고칠 곳 없음" 문제면 true, 아니면 false.
- wrong: 학생에게 보여 줄 문장(틀린 곳이 하나 있는 문장).
- correct: wrong을 바르게 고친 문장.
- wrongText: 맞춤법 문제는 wrong에서 틀린 부분(그 어절 전체 또는 틀린 글자가 든 부분). wrong 안에 정확히 한 번만 나와야 한다. 문장 부호 문제는 틀린 부호 한 글자. 띄어쓰기 문제와 "고칠 곳 없음" 문제는 null.
- choices: 맞춤법·문장 부호 문제의 보기 3개. 첫째는 wrongText 자리에 들어갈 바른 말, 둘째는 wrongText 그대로, 셋째는 학생이 헷갈릴 만한 다른 틀린 표기. 띄어쓰기 문제와 "고칠 곳 없음" 문제는 null.
- explain: 초등학생이 읽을 쉬운 해요체 설명 한두 문장, 60자 이내. 왜 그렇게 쓰는지 뜻이나 소리로 설명한다. 어려운 문법 용어는 쓰지 않는다.
- rule: 근거 조항. 예: "한글 맞춤법 제57항", "표준국어대사전 '어떡하다'".

[종류별 규칙]
- 맞춤법(spelling): correct는 wrong에서 wrongText 부분만 바른 말로 바꾼 문장이어야 한다. 다른 글자나 띄어쓰기는 바꾸지 않는다.
- 문장 부호(punctuation): wrong의 맨 끝 부호만 틀리게 쓴다. correct는 그 부호만 바꾼 문장이다.
- 띄어쓰기(spacing): wrong과 correct는 띄어쓰기만 다르고 글자는 똑같다. 틀린 곳은 그 유형에 해당하는 곳 하나(또는 한 덩어리)만 둔다.
- 고칠 곳 없음(noError, 3단계만): 그 유형의 말을 바르게 쓴 문장. wrong과 correct가 똑같다.`;

export interface GenerateRequest {
  level: Level;
  tag: string;
  count: number;
  /** 선택. 소재 */
  topic: string;
}

/** 3단계 맞춤법 유형은 6개 중 1개 정도를 "고칠 곳 없음"으로 */
export function noErrorCount(request: GenerateRequest): number {
  const { kind } = TAG_GUIDE[request.tag];
  return request.level === 3 && kind !== 'spacing' ? Math.floor(request.count / 6) : 0;
}

/** 요청(사용자 메시지) */
export function buildUserPrompt(request: GenerateRequest): string {
  const { kind, guide } = TAG_GUIDE[request.tag];
  const noError = noErrorCount(request);
  const lines = [
    `${request.level}단계 "${request.tag}" 유형 문제를 ${request.count}개 만들어 줘.`,
    `- 유형 설명: ${guide}`,
    `- 종류(kind): ${kind}`,
    `- 문장 길이: 띄어쓰기와 문장 부호를 포함해 ${MAX_LENGTH[request.level]}자 이하`,
    noError > 0
      ? `- ${request.count}개 가운데 ${noError}개는 "고칠 곳 없음" 문제(noError: true), 나머지는 틀린 곳이 하나 있는 문제`
      : '- 모두 틀린 곳이 하나 있는 문제(noError: false)',
  ];
  if (request.topic.trim()) lines.push(`- 소재: ${request.topic.trim()}`);
  return lines.join('\n');
}

/** 응답 형식(OpenRouter structured outputs, JSON 스키마) */
export const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    problems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['spelling', 'spacing', 'punctuation'] },
          noError: { type: 'boolean' },
          wrong: { type: 'string' },
          correct: { type: 'string' },
          wrongText: { type: ['string', 'null'] },
          choices: { type: ['array', 'null'], items: { type: 'string' } },
          explain: { type: 'string' },
          rule: { type: 'string' },
        },
        required: ['kind', 'noError', 'wrong', 'correct', 'wrongText', 'choices', 'explain', 'rule'],
        additionalProperties: false,
      },
    },
  },
  required: ['problems'],
  additionalProperties: false,
} as const;
