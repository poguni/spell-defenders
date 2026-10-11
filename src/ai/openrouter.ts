// OpenRouter 요청(기획서 10.4, 11장). API 키는 이 주소로만 보내고, 화면·콘솔·저장소 어디에도 찍지 않는다.
import type { AiProblem } from './convert';
import { RESPONSE_SCHEMA, SYSTEM_PROMPT, buildUserPrompt, type GenerateRequest } from './prompt';

export const OPENROUTER_API = 'https://openrouter.ai/api/v1';

/** 모델 목록(기획서 10.4 순서, 첫째가 기본). 2026-10-11 OpenRouter 모델 목록 API로 확인 */
export const MODELS = [
  { id: 'anthropic/claude-sonnet-5.5', name: 'Claude Sonnet 5.5', note: '품질 우선(기본)' },
  { id: 'google/gemini-3.8-flash', name: 'Gemini 3.8 Flash', note: '품질과 비용의 균형' },
  { id: 'openai/gpt-6-luna', name: 'GPT-6 Luna', note: '비용 최소' },
];
export const DEFAULT_MODEL = MODELS[0].id;

const TIMEOUT_MS = 120_000;
const MAX_TOKENS = 16_000;

/** 화면에 그대로 보여 줄 쉬운 오류 */
export class AiError extends Error {}

const MESSAGES = {
  key: 'API 키가 맞지 않아요. 키를 다시 확인해 주세요.',
  credit: 'OpenRouter 잔액(크레딧)이 부족하거나 키의 사용 한도에 닿았어요. OpenRouter 사이트에서 확인해 주세요.',
  refused: '요청이 거절되었어요. 잠시 뒤 다시 해 보거나 다른 모델을 골라 주세요.',
  busy: '모델이 바쁘거나 응답하지 않아요. 잠시 뒤 다시 해 보세요.',
  model: '모델 ID를 찾을 수 없거나, 이 모델이 필요한 기능(JSON 형식)을 지원하지 않아요. 모델을 다시 골라 주세요.',
  network: '인터넷에 연결할 수 없어요. 와이파이를 확인한 뒤 다시 해 보세요.',
  timeout: '응답이 너무 오래 걸려서 멈췄어요. 개수를 줄이거나 잠시 뒤 다시 해 보세요.',
  format: 'AI 응답 형식이 맞지 않아요. 다시 만들어 보세요.',
  unknown: '알 수 없는 오류가 났어요. 잠시 뒤 다시 해 보세요.',
};

function errorFor(status: number): AiError {
  if (status === 401) return new AiError(MESSAGES.key);
  if (status === 402) return new AiError(MESSAGES.credit);
  if (status === 403) return new AiError(MESSAGES.refused);
  if (status === 400 || status === 404) return new AiError(MESSAGES.model);
  if (status === 408 || status === 429 || status >= 500) return new AiError(MESSAGES.busy);
  return new AiError(MESSAGES.unknown);
}

async function request(key: string, path: string, init: RequestInit = {}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${OPENROUTER_API}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    });
  } catch {
    throw new AiError(controller.signal.aborted ? MESSAGES.timeout : MESSAGES.network);
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw errorFor(response.status);
  try {
    return await response.json();
  } catch {
    throw new AiError(MESSAGES.format);
  }
}

export interface KeyInfo {
  /** 키에 걸어 둔 사용 한도(달러). 없으면 null */
  limit: number | null;
  /** 남은 한도(달러). 한도가 없으면 null */
  remaining: number | null;
}

/** 연결 확인: 키 정보만 묻는다(문제를 만들지 않음) */
export async function checkKey(key: string): Promise<KeyInfo> {
  const body = (await request(key, '/key')) as { data?: { limit?: unknown; limit_remaining?: unknown } };
  const num = (v: unknown) => (typeof v === 'number' ? v : null);
  return { limit: num(body?.data?.limit), remaining: num(body?.data?.limit_remaining) };
}

/** 요청 본문(structured outputs + 추론 강도 low) */
export function buildBody(model: string, generate: GenerateRequest) {
  return {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(generate) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'spelling_problems', strict: true, schema: RESPONSE_SCHEMA },
    },
    reasoning: { effort: 'low', exclude: true },
    max_tokens: MAX_TOKENS,
    // JSON 스키마를 지원하는 제공자에게만 보낸다
    provider: { require_parameters: true },
  };
}

/** 문제 생성. 돌려준 목록은 아직 검증 전(convertAiProblems로 검증) */
export async function generateProblems(key: string, model: string, generate: GenerateRequest): Promise<AiProblem[]> {
  const body = (await request(key, '/chat/completions', {
    method: 'POST',
    body: JSON.stringify(buildBody(model, generate)),
  })) as {
    error?: { code?: number };
    choices?: { finish_reason?: string; message?: { content?: unknown } }[];
  };
  // 생성 중에 난 오류는 200 응답 안에 들어 온다
  if (body?.error) throw errorFor(Number(body.error.code));
  const choice = body?.choices?.[0];
  if (typeof choice?.message?.content !== 'string' || choice.finish_reason === 'length') {
    throw new AiError(MESSAGES.format);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(choice.message.content);
  } catch {
    throw new AiError(MESSAGES.format);
  }
  const problems = (parsed as { problems?: unknown })?.problems;
  if (!Array.isArray(problems)) throw new AiError(MESSAGES.format);
  return problems as AiProblem[];
}
