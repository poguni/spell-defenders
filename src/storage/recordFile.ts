// 학생 기록 파일 내보내기·불러오기(docs/기록 내보내기·불러오기 개발 계획.md 4장).
// 학생 기록만 담는다. 교사 메뉴 데이터와 불러온 선생님 문제 세트는 담지 않는다.
import { readSaveData, type SaveData } from './save';

export const RECORD_FORMAT = 'spell-defenders-record';
/** 이보다 큰 파일은 읽지 않는다(기록 파일은 보통 수 KB) */
export const RECORD_FILE_MAX = 1_000_000;

export type RecordImport = { ok: true; save: SaveData } | { ok: false; message: string };

export function exportRecord(save: SaveData, now = new Date()): string {
  return JSON.stringify({ format: RECORD_FORMAT, exportedAt: now.toISOString(), save }, null, 2);
}

/** 맞춤법수비대-기록-닉네임-2026-10-12.json (닉네임이 없으면 빼고, 파일 이름에 못 쓰는 글자는 뺀다) */
export function recordFileName(save: SaveData, now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const nickname = (save.nickname ?? '').replace(/[\/:*?"<>|\u0000-\u001f]/g, '').trim().replace(/\s+/g, '_');
  return ['맞춤법수비대-기록', nickname, date].filter(Boolean).join('-') + '.json';
}

const NOT_RECORD = '맞춤법 수비대 기록 파일이 아니에요.';

export function importRecord(text: string): RecordImport {
  if (text.length > RECORD_FILE_MAX) return { ok: false, message: `파일이 너무 커요. ${NOT_RECORD}` };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, message: NOT_RECORD };
  }
  if (typeof data !== 'object' || data === null) return { ok: false, message: NOT_RECORD };
  const { format, save } = data as { format?: unknown; save?: unknown };
  if (format === 'spell-defenders-set') {
    return { ok: false, message: '문제 세트 파일이에요. 처음 화면의 "문제 파일 불러오기"로 불러와 주세요.' };
  }
  if (format !== RECORD_FORMAT) return { ok: false, message: NOT_RECORD };
  const result = readSaveData(save);
  if (result === 'newer') {
    return { ok: false, message: '더 새로운 앱에서 저장한 기록이에요. 화면을 새로 고친 뒤 다시 불러와 주세요.' };
  }
  if (result === 'invalid') return { ok: false, message: '기록 파일이 망가져서 읽을 수 없어요.' };
  return { ok: true, save: result };
}

export interface RecordSummary {
  nickname: string | null;
  /** 모은 별 */
  stars: number;
  /** 별을 받은 스테이지 수 */
  stages: number;
  /** 도감에 등록된 몬스터 수 */
  dex: number;
  /** 오답 노트 문제 수 */
  notes: number;
}

export function summarizeRecord(save: SaveData): RecordSummary {
  const stars = Object.values(save.stars);
  return {
    nickname: save.nickname,
    stars: stars.reduce((sum, n) => sum + n, 0),
    stages: stars.length,
    dex: save.dex.length,
    notes: Object.keys(save.wrongNotes).length,
  };
}
