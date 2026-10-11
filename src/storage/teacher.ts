// 교사 메뉴 데이터(기획서 5.3, 11장). 학생 기록(save.ts)과 따로 저장한다.
// PIN은 학생이 실수로 들어오는 것을 막는 정도의 장치다(기기 안에 저장되므로 보안 장치가 아님).
import { DEFAULT_MODEL } from '../ai/openrouter';
import type { Problem } from '../judge/types';
import { validateProblem } from '../judge/validate';

export const TEACHER_KEY = 'spell-defenders-teacher';
/** OpenRouter API 키. 기본은 sessionStorage, "이 기기에 저장"을 고르면 localStorage */
export const API_KEY_KEY = 'spell-defenders-openrouter-key';

export interface ProblemSet {
  id: string;
  name: string;
  /** 켜져 있으면 승인한 문제가 이 기기의 스테이지·학급 수비전에 나온다 */
  active: boolean;
  problems: Problem[];
}

export interface TeacherData {
  version: number;
  /** PIN의 SHA-256(16진수). 없으면 아직 정하지 않음 */
  pinHash: string | null;
  model: string;
  sets: ProblemSet[];
}

export function emptyTeacher(): TeacherData {
  return { version: 1, pinHash: null, model: DEFAULT_MODEL, sets: [] };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** 저장된 글자를 읽는다. 깨진 세트·문제는 버린다 */
export function parseTeacher(raw: string | null): TeacherData {
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  if (!isObject(data) || data.version !== 1) return emptyTeacher();
  const sets = Array.isArray(data.sets) ? data.sets : [];
  return {
    version: 1,
    pinHash: typeof data.pinHash === 'string' ? data.pinHash : null,
    model: typeof data.model === 'string' && data.model.trim() ? data.model : DEFAULT_MODEL,
    sets: sets.filter(isObject).map((s) => ({
      id: String(s.id),
      name: String(s.name),
      active: s.active !== false,
      problems: (Array.isArray(s.problems) ? s.problems : []).filter(
        (p): p is Problem => validateProblem(p).length === 0,
      ),
    })),
  };
}

/** 켜진 세트에서 승인한 문제(출제 대상) */
export function activeProblems(teacher: TeacherData): Problem[] {
  return teacher.sets.filter((s) => s.active).flatMap((s) => s.problems.filter((p) => p.reviewed));
}

export async function hashPin(pin: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`spell-defenders:${pin}`));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

// localStorage·sessionStorage는 사생활 보호 모드 등에서 오류를 낼 수 있어 모두 감싼다
function tryStorage<T>(work: () => T, fallback: T): T {
  try {
    return work();
  } catch {
    return fallback;
  }
}

export const loadTeacher = () => parseTeacher(tryStorage(() => localStorage.getItem(TEACHER_KEY), null));
export const writeTeacher = (data: TeacherData) =>
  tryStorage(() => localStorage.setItem(TEACHER_KEY, JSON.stringify(data)), undefined);

export function loadApiKey(): { key: string; remember: boolean } | null {
  const local = tryStorage(() => localStorage.getItem(API_KEY_KEY), null);
  if (local) return { key: local, remember: true };
  const session = tryStorage(() => sessionStorage.getItem(API_KEY_KEY), null);
  return session ? { key: session, remember: false } : null;
}

/** 키를 저장한다. 다른 쪽에 남은 키는 지운다 */
export function saveApiKey(key: string, remember: boolean) {
  clearApiKey();
  tryStorage(() => (remember ? localStorage : sessionStorage).setItem(API_KEY_KEY, key), undefined);
}

export function clearApiKey() {
  tryStorage(() => localStorage.removeItem(API_KEY_KEY), undefined);
  tryStorage(() => sessionStorage.removeItem(API_KEY_KEY), undefined);
}

/** 교사 메뉴 초기화(PIN을 잊었을 때): PIN, 키, 문제 세트를 모두 지운다 */
export function resetTeacher() {
  clearApiKey();
  tryStorage(() => localStorage.removeItem(TEACHER_KEY), undefined);
}
