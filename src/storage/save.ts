// 기기에만 저장하는 학습 기록(localStorage). 개인정보는 저장하지 않는다(기획서 11장).
import type { Level } from '../judge/types';

export const STORAGE_KEY = 'spell-defenders';
export const CURRENT_VERSION = 1;
export const NICKNAME_MAX = 10;

export interface SaveData {
  version: number;
  /** 선택. 이 기기에만 저장 */
  nickname: string | null;
  /** 마지막으로 고른 단계 */
  level: Level | null;
  /** 스테이지 id → 최고 별(1~3) */
  stars: Record<string, number>;
  /** 태그 → 수비전에서 연속으로 맞힌 횟수 */
  tagStreaks: Record<string, number>;
  /** 오답 노트: 문제 id → 태그 */
  wrongNotes: Record<string, string>;
  /** 도감에 등록된(정화한 적 있는) 태그 */
  dex: string[];
}

export function emptySave(): SaveData {
  return {
    version: CURRENT_VERSION,
    nickname: null,
    level: null,
    stars: {},
    tagStreaks: {},
    wrongNotes: {},
    dex: [],
  };
}

type RawSave = Record<string, unknown>;

/**
 * 버전 변환: 키는 "이 버전에서 다음 버전으로". 저장 구조를 바꿀 때 여기에 하나씩 더한다.
 * 예) 1: (data) => ({ ...data, version: 2, newField: [] })
 */
export const MIGRATIONS: Record<number, (data: RawSave) => RawSave> = {};

/** 옛 버전 데이터를 지금 버전으로 바꾼다. 바꿀 수 없으면 null */
export function migrate(data: RawSave, migrations = MIGRATIONS): RawSave | null {
  let current = data;
  while (typeof current.version === 'number' && current.version < CURRENT_VERSION) {
    const step = migrations[current.version];
    if (!step) return null;
    current = step(current);
  }
  return current.version === CURRENT_VERSION ? current : null;
}

const isObject = (value: unknown): value is RawSave =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function pickEntries<T>(value: unknown, keep: (v: unknown) => v is T): Record<string, T> {
  if (!isObject(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, T] => keep(entry[1])));
}

const isStar = (v: unknown): v is number => v === 1 || v === 2 || v === 3;
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
const isText = (v: unknown): v is string => typeof v === 'string' && v !== '';

/** 지금 버전 데이터에서 멀쩡한 칸은 살리고 이상한 칸만 기본값으로 */
function sanitize(data: RawSave): SaveData {
  const nickname = typeof data.nickname === 'string' ? cleanNickname(data.nickname) : null;
  const level = data.level === 1 || data.level === 2 || data.level === 3 ? data.level : null;
  return {
    version: CURRENT_VERSION,
    nickname,
    level,
    stars: pickEntries(data.stars, isStar),
    tagStreaks: pickEntries(data.tagStreaks, isCount),
    wrongNotes: pickEntries(data.wrongNotes, isText),
    dex: Array.isArray(data.dex) ? [...new Set(data.dex.filter(isText))] : [],
  };
}

export function cleanNickname(text: string): string | null {
  const trimmed = Array.from(text.normalize('NFC').trim()).slice(0, NICKNAME_MAX).join('');
  return trimmed === '' ? null : trimmed;
}

/** 저장된 글자를 읽는다. 비었거나 깨졌거나 알 수 없는 버전이면 빈 기록 */
export function parseSave(raw: string | null): SaveData {
  if (!raw) return emptySave();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptySave();
  }
  if (!isObject(data)) return emptySave();
  const migrated = migrate(data);
  return migrated ? sanitize(migrated) : emptySave();
}

// localStorage는 사생활 보호 모드 등에서 오류를 낼 수 있어 모두 감싼다
export function loadSave(): SaveData {
  try {
    return parseSave(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return emptySave();
  }
}

export function writeSave(save: SaveData) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // 저장하지 못해도 이번 접속 동안은 계속 플레이할 수 있다
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 지울 수 없으면 무시
  }
}
