// 문제 자동 검증(기획서 9.1 ③). 내장 문제 스크립트와 앱 안 AI 생성(M7)에서 함께 쓴다.
import { judgeFix, toGaps } from './judge';
import { normalize } from './normalize';
import { MAX_LENGTH, TAGS, type Level, type Problem } from './types';

export interface ValidationIssue {
  /** list 안에서의 위치 */
  index: number;
  id: string;
  message: string;
}

const KINDS = ['spelling', 'spacing', 'punctuation'];
const SOURCES = ['builtin', 'ai', 'teacher'];

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isText);
}

function lettersOnly(text: string): string {
  return toGaps(text).letters.join('');
}

/** 문제 하나를 검사해 문제점 목록을 돌려준다. 빈 목록이면 통과. */
export function validateProblem(data: unknown): string[] {
  if (typeof data !== 'object' || data === null) return ['문제가 객체가 아님'];
  const p = data as Record<string, unknown>;
  const errors: string[] = [];

  // 필수 필드
  if (!isText(p.id)) errors.push('id가 없음');
  if (p.level !== 1 && p.level !== 2 && p.level !== 3) errors.push('level은 1, 2, 3 중 하나여야 함');
  if (!KINDS.includes(p.kind as string)) errors.push('kind는 spelling, spacing, punctuation 중 하나여야 함');
  if (!isText(p.tag)) errors.push('tag가 없음');
  if (!isText(p.rule)) errors.push('rule(근거 조항)이 없음');
  if (!isText(p.wrong)) errors.push('wrong이 없음');
  if (!isText(p.correct)) errors.push('correct가 없음');
  if (!isTextList(p.acceptedAnswers)) errors.push('acceptedAnswers가 비었거나 형식이 틀림');
  if (!isText(p.explain)) errors.push('explain(설명)이 없음');
  if (!SOURCES.includes(p.source as string)) errors.push('source는 builtin, ai, teacher 중 하나여야 함');
  if (typeof p.reviewed !== 'boolean') errors.push('reviewed는 true 또는 false여야 함');
  if (p.noError !== undefined && typeof p.noError !== 'boolean') errors.push('noError는 true 또는 false여야 함');
  if (p.choices !== undefined && !isTextList(p.choices)) errors.push('choices 형식이 틀림');
  if (p.target !== undefined) {
    const t = p.target as { wrongText?: unknown; start?: unknown } | null;
    if (!t || !isText(t.wrongText) || !Number.isInteger(t.start)) errors.push('target(wrongText, start) 형식이 틀림');
  }
  if (errors.length > 0) return errors;

  const problem = data as Problem;
  const level = problem.level as Level;
  if (!TAGS[level].includes(problem.tag)) errors.push(`tag "${problem.tag}"는 ${level}단계 태그 목록에 없음`);

  // 저장된 글자는 정규화된 상태여야 target 위치가 어긋나지 않는다
  const texts = [problem.wrong, problem.correct, ...problem.acceptedAnswers, ...(problem.choices ?? [])];
  if (problem.target) texts.push(problem.target.wrongText);
  for (const text of texts) {
    if (text !== normalize(text)) errors.push(`"${text}"가 정규화되지 않음(NFD, 앞뒤 공백, 연속 공백)`);
  }

  for (const sentence of [problem.wrong, ...problem.acceptedAnswers]) {
    const length = Array.from(sentence).length;
    if (length > MAX_LENGTH[level]) {
      errors.push(`"${sentence}"가 ${length}자로 ${level}단계 상한 ${MAX_LENGTH[level]}자를 넘음`);
    }
  }
  if (!problem.acceptedAnswers.includes(problem.correct)) errors.push('acceptedAnswers에 correct가 없음');

  if (problem.noError) {
    if (level !== 3) errors.push('"고칠 곳 없음" 문제는 3단계에만 넣음');
    if (problem.wrong !== problem.correct) errors.push('"고칠 곳 없음" 문제는 wrong과 correct가 같아야 함');
    if (problem.target || problem.choices) errors.push('"고칠 곳 없음" 문제에는 target·choices를 넣지 않음');
    return errors;
  }

  if (problem.wrong === problem.correct) errors.push('wrong과 correct가 같음');

  if (problem.kind === 'spacing') {
    if (problem.target || problem.choices) errors.push('띄어쓰기 문제에는 target·choices를 넣지 않음');
    for (const sentence of [problem.correct, ...problem.acceptedAnswers]) {
      if (lettersOnly(sentence) !== lettersOnly(problem.wrong)) {
        errors.push(`"${sentence}"는 띄어쓰기 말고 글자가 wrong과 다름`);
      }
    }
    return errors;
  }

  // 맞춤법·문장 부호
  const target = problem.target;
  if (!target) {
    errors.push('target이 없음');
    return errors;
  }
  if (problem.wrong.slice(target.start, target.start + target.wrongText.length) !== target.wrongText) {
    errors.push(`target.start ${target.start} 위치의 글자가 "${target.wrongText}"와 다름`);
    return errors;
  }

  // 차이가 target 한 곳뿐인지: target 앞뒤 글자가 정답 문장과 같아야 한다
  const before = problem.wrong.slice(0, target.start);
  const after = problem.wrong.slice(target.start + target.wrongText.length);
  for (const sentence of problem.acceptedAnswers) {
    const sameOutside =
      sentence.length >= before.length + after.length && sentence.startsWith(before) && sentence.endsWith(after);
    if (!sameOutside) errors.push(`"${sentence}"는 target 밖에서도 wrong과 다름`);
  }

  if (!problem.choices) {
    errors.push('choices가 없음');
  } else {
    if (new Set(problem.choices).size !== problem.choices.length) errors.push('choices에 같은 보기가 두 번 있음');
    const rightChoices = problem.choices.filter((choice) => judgeFix(problem, choice));
    if (rightChoices.length !== 1) errors.push(`choices 중 정답이 ${rightChoices.length}개임(정확히 1개여야 함)`);
  }

  return errors;
}

/** 여러 문제를 검사한다. id 중복도 함께 찾는다. */
export function validateProblems(list: unknown[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  list.forEach((data, index) => {
    const rawId = (data as { id?: unknown } | null)?.id;
    const id = typeof rawId === 'string' && rawId !== '' ? rawId : `(${index + 1}번째 문제)`;
    for (const message of validateProblem(data)) issues.push({ index, id, message });
    if (seen.has(id)) issues.push({ index, id, message: 'id가 중복됨' });
    seen.add(id);
  });
  return issues;
}
