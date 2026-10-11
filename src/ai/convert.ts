// AI 응답을 문제(기획서 8.1)로 바꾸고 자동 검증한다(기획서 9.2). 형식이 틀린 문제는 이유와 함께 뺀다.
import { normalize } from '../judge/normalize';
import type { Level, Problem, ProblemKind } from '../judge/types';
import { validateProblem } from '../judge/validate';

/** AI가 돌려주는 문제 하나(src/ai/prompt.ts의 RESPONSE_SCHEMA) */
export interface AiProblem {
  kind: ProblemKind;
  noError: boolean;
  wrong: string;
  correct: string;
  wrongText: string | null;
  choices: string[] | null;
  explain: string;
  rule: string;
}

/** 교사가 고칠 수 있는 칸(승인 화면의 수정) */
export type ProblemDraft = Omit<AiProblem, 'kind' | 'noError'>;

export interface Rejected {
  wrong: string;
  reasons: string[];
}

const text = (value: unknown) => (typeof value === 'string' ? normalize(value) : '');

/** 틀린 부분의 위치를 찾는다. 문장 부호는 문장 끝 부호, 맞춤법은 문장 안에 한 번만 나와야 한다 */
function findTarget(kind: ProblemKind, wrong: string, wrongText: string): { start: number } | { error: string } {
  if (!wrongText) return { error: '틀린 부분(wrongText)이 없음' };
  const start = wrong.indexOf(wrongText);
  if (start < 0) return { error: `틀린 부분 "${wrongText}"가 문장에 없음` };
  if (kind === 'punctuation') return { start: wrong.lastIndexOf(wrongText) };
  if (wrong.indexOf(wrongText, start + 1) >= 0) return { error: `틀린 부분 "${wrongText}"가 문장에 두 번 이상 나옴` };
  return { start };
}

/**
 * 문제 하나를 만든다. 성공하면 문제, 실패하면 이유 목록.
 * base: 단계·태그·종류·고칠 곳 없음 여부(AI 응답 값이 아니라 요청이나 원래 문제에서 가져온다)
 */
export function buildProblem(
  base: { id: string; level: Level; tag: string; kind: ProblemKind; noError: boolean; source: Problem['source'] },
  draft: ProblemDraft,
): Problem | string[] {
  const wrong = text(draft.wrong);
  const correct = base.noError ? wrong : text(draft.correct);
  const problem: Problem = {
    id: base.id,
    level: base.level,
    kind: base.kind,
    tag: base.tag,
    rule: text(draft.rule),
    wrong,
    correct,
    acceptedAnswers: [correct],
    explain: text(draft.explain),
    source: base.source,
    reviewed: false,
  };
  if (base.noError) problem.noError = true;
  if (!base.noError && base.kind !== 'spacing') {
    const wrongText = text(draft.wrongText);
    const found = findTarget(base.kind, wrong, wrongText);
    if ('error' in found) return [found.error];
    problem.target = { wrongText, start: found.start };
    problem.choices = (draft.choices ?? []).map(text);
  }
  const errors = validateProblem(problem);
  return errors.length > 0 ? errors : problem;
}

/** AI 응답 전체를 문제 목록으로 바꾼다. id는 앱이 붙인다(prefix-1, prefix-2, ...) */
export function convertAiProblems(
  list: AiProblem[],
  request: { level: Level; tag: string; kind: ProblemKind },
  idPrefix: string,
): { problems: Problem[]; rejected: Rejected[] } {
  const problems: Problem[] = [];
  const rejected: Rejected[] = [];
  const seen = new Set<string>();
  list.forEach((item, index) => {
    const wrong = text(item?.wrong);
    const reasons: string[] = [];
    if (item?.kind !== request.kind) reasons.push(`문제 종류가 요청(${request.kind})과 다름`);
    if (item?.noError && request.level !== 3) reasons.push('"고칠 곳 없음" 문제는 3단계에만 넣음');
    if (seen.has(wrong)) reasons.push('같은 문장이 이미 있음');
    if (reasons.length === 0) {
      const built = buildProblem(
        { id: `${idPrefix}-${index + 1}`, ...request, noError: Boolean(item.noError), source: 'ai' },
        item,
      );
      if (Array.isArray(built)) reasons.push(...built);
      else problems.push(built);
    }
    if (reasons.length > 0) rejected.push({ wrong: wrong || `(${index + 1}번째 문제)`, reasons });
    seen.add(wrong);
  });
  return { problems, rejected };
}
