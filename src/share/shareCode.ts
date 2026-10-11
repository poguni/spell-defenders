// 공유 코드(기획서 5.3, 13장): 서버 없이 승인한 문제 세트를 링크나 파일로 학생 기기에 옮긴다.
// 링크: 짧은 배열 형식 JSON → deflate(브라우저 내장 CompressionStream) → base64url → 주소의 # 뒤(서버로 보내지지 않음)
// 받는 쪽은 모양을 하나하나 다시 검사하고(M2 검증 모듈), 승인한(reviewed: true) 문제만 받는다.
import type { Level, Problem, ProblemKind } from '../judge/types';
import { validateProblem } from '../judge/validate';

export const SHARE_MAX = 30; // 링크 한 개에 담는 최대 문제 수(기획서 13장)
export const FILE_MAX = 200; // 파일 한 개에 담는 최대 문제 수
export const SET_NAME_MAX = 30;
export const HASH_PREFIX = '#set=';
const CODE_MAX = 20_000; // 공유 코드 글자 수 상한
const JSON_MAX = 500_000; // 풀었을 때 바이트 상한(아주 작은 코드가 거대하게 풀리는 것 막기)
const FILE_FORMAT = 'spell-defenders-set';

export interface SharedSet {
  name: string;
  problems: Problem[];
}

/** 받기 결과. 버린 문제(승인 전) 수도 알려 준다 */
export type ImportResult = { ok: true; set: SharedSet; dropped: number } | { ok: false; error: string };

export class ShareError extends Error {}

const KINDS: ProblemKind[] = ['spelling', 'spacing', 'punctuation'];
const BROKEN = '공유 코드가 망가졌거나 맞춤법 수비대의 문제 세트가 아니에요.';

// ---------- 링크(공유 코드) ----------

/** 문제 하나 → 짧은 배열. id는 받는 쪽에서 새로 붙인다 */
function pack(p: Problem): unknown[] {
  return [
    p.level,
    KINDS.indexOf(p.kind),
    p.tag,
    p.rule,
    p.wrong,
    p.correct,
    p.target ? [p.target.wrongText, p.target.start] : 0,
    p.choices ?? 0,
    p.explain,
    p.source,
    p.reviewed ? 1 : 0,
    p.noError ? 1 : 0,
    p.acceptedAnswers.length === 1 && p.acceptedAnswers[0] === p.correct ? 0 : p.acceptedAnswers,
  ];
}

function unpack(item: unknown): Record<string, unknown> | null {
  if (!Array.isArray(item) || item.length !== 13) return null;
  const [level, kind, tag, rule, wrong, correct, target, choices, explain, source, reviewed, noError, accepted] = item;
  const problem: Record<string, unknown> = {
    id: 'x',
    level,
    kind: KINDS[kind as number],
    tag,
    rule,
    wrong,
    correct,
    acceptedAnswers: accepted === 0 ? [correct] : accepted,
    explain,
    source,
    reviewed: reviewed === 1,
  };
  if (Array.isArray(target)) problem.target = { wrongText: target[0], start: target[1] };
  if (choices !== 0) problem.choices = choices;
  if (noError === 1) problem.noError = true;
  return problem;
}

async function deflate(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** 풀면서 크기를 센다. 상한을 넘으면 멈춘다 */
async function inflate(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > JSON_MAX) {
      await reader.cancel();
      throw new ShareError(BROKEN);
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(all);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(code)) throw new ShareError(BROKEN);
  const base64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** 승인한 문제만 골라 공유 코드로. 30문제를 넘으면 오류(파일로 보내야 함) */
export async function encodeSet(name: string, problems: Problem[]): Promise<string> {
  const approved = problems.filter((p) => p.reviewed);
  if (approved.length === 0) throw new ShareError('승인한 문제가 없어요.');
  if (approved.length > SHARE_MAX) {
    throw new ShareError(`승인한 문제가 ${SHARE_MAX}개를 넘어 링크로 보낼 수 없어요. 파일로 내보내 주세요.`);
  }
  const json = JSON.stringify({ v: 1, n: cleanName(name), p: approved.map(pack) });
  return toBase64Url(await deflate(json));
}

/** 공유 코드를 풀어 검사한다 */
export async function decodeSet(code: string): Promise<ImportResult> {
  try {
    if (code.length === 0 || code.length > CODE_MAX) return { ok: false, error: BROKEN };
    const data = JSON.parse(await inflate(fromBase64Url(code))) as { v?: unknown; n?: unknown; p?: unknown };
    if (data?.v !== 1 || !Array.isArray(data.p) || data.p.length > SHARE_MAX) return { ok: false, error: BROKEN };
    return checkSet(data.n, data.p.map(unpack));
  } catch {
    return { ok: false, error: BROKEN };
  }
}

export function shareLink(baseUrl: string, code: string): string {
  return `${baseUrl.split('#')[0]}${HASH_PREFIX}${code}`;
}

// ---------- 파일 ----------

/** 파일 내보내기 내용(30문제를 넘는 세트용) */
export function exportFile(name: string, problems: Problem[]): string {
  const approved = problems.filter((p) => p.reviewed);
  return JSON.stringify({ format: FILE_FORMAT, version: 1, name: cleanName(name), problems: approved }, null, 2);
}

export function importFile(text: string): ImportResult {
  try {
    if (text.length > JSON_MAX) return { ok: false, error: BROKEN };
    const data = JSON.parse(text) as { format?: unknown; version?: unknown; name?: unknown; problems?: unknown };
    if (data?.format !== FILE_FORMAT || data.version !== 1 || !Array.isArray(data.problems)) {
      return { ok: false, error: BROKEN };
    }
    if (data.problems.length > FILE_MAX) return { ok: false, error: `문제가 ${FILE_MAX}개를 넘어 불러올 수 없어요.` };
    return checkSet(data.name, data.problems);
  } catch {
    return { ok: false, error: BROKEN };
  }
}

// ---------- 받는 쪽 검사(링크·파일 공통) ----------

function cleanName(name: unknown): string {
  const text = typeof name === 'string' ? name.normalize('NFC').replace(/\s+/g, ' ').trim() : '';
  return Array.from(text).slice(0, SET_NAME_MAX).join('') || '선생님 문제';
}

/** 같은 세트를 다시 받아도 같은 id가 되도록 내용으로 짧은 해시(FNV-1a)를 만든다 */
function contentHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * 문제 하나라도 모양이 틀리면 세트 전체를 거부한다(조작·손상 의심).
 * 승인 전(reviewed: false) 문제는 받지 않고 버린다. id는 새로 붙인다(내장 문제 id와 겹치지 않게).
 */
function checkSet(name: unknown, list: unknown[]): ImportResult {
  const kept: Problem[] = [];
  let dropped = 0;
  for (const item of list) {
    if (!item || typeof item !== 'object') return { ok: false, error: BROKEN };
    const candidate: Record<string, unknown> = { ...(item as Record<string, unknown>), id: 'x' };
    if (validateProblem(candidate).length > 0) return { ok: false, error: BROKEN };
    if (candidate.reviewed === true) kept.push(candidate as unknown as Problem);
    else dropped++;
  }
  if (kept.length === 0) return { ok: false, error: '받을 수 있는(선생님이 승인한) 문제가 없어요.' };
  const prefix = `S${contentHash(JSON.stringify(kept.map(pack)))}`;
  const problems = kept.map((p, i) => ({ ...p, id: `${prefix}-${i + 1}`, level: p.level as Level }));
  return { ok: true, set: { name: cleanName(name), problems }, dropped };
}
