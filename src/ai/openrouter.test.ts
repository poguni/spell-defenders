import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiError, OPENROUTER_API, buildBody, checkKey, generateProblems } from './openrouter';

const GENERATE = { level: 3 as const, tag: '웬/왠', count: 5, topic: '' };

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const content = (text: string) => ({ choices: [{ finish_reason: 'stop', message: { content: text } }] });

afterEach(() => vi.unstubAllGlobals());

describe('OpenRouter 요청', () => {
  it('키는 OpenRouter 주소로만, Authorization 머리글로만 보낸다', async () => {
    const fetchMock = mockFetch(200, content('{"problems":[]}'));
    await generateProblems('test-key', 'model/x', GENERATE);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${OPENROUTER_API}/chat/completions`);
    expect(url.startsWith('https://openrouter.ai/api/v1/')).toBe(true);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    expect(String(init.body)).not.toContain('test-key');
  });

  it('요청 본문: JSON 스키마(strict), 추론 강도 low, 스키마를 지원하는 제공자만', () => {
    const body = buildBody('anthropic/claude-sonnet-5.5', GENERATE);
    expect(body.model).toBe('anthropic/claude-sonnet-5.5');
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.reasoning).toEqual({ effort: 'low', exclude: true });
    expect(body.provider.require_parameters).toBe(true);
    expect(body.messages[1].content).toContain('3단계 "웬/왠" 유형 문제를 5개');
  });

  it('응답의 problems 배열을 돌려준다', async () => {
    mockFetch(200, content('{"problems":[{"wrong":"a"}]}'));
    expect(await generateProblems('k', 'm', GENERATE)).toEqual([{ wrong: 'a' }]);
  });

  it.each([
    [401, '키가 맞지 않아요'],
    [402, '잔액'],
    [404, '모델'],
    [429, '바쁘거나'],
    [503, '바쁘거나'],
  ])('HTTP %i → 쉬운 오류', async (status, text) => {
    mockFetch(status, { error: { code: status, message: 'x' } });
    await expect(generateProblems('k', 'm', GENERATE)).rejects.toThrow(text);
  });

  it('200 안의 오류, 잘린 응답, JSON이 아닌 응답', async () => {
    mockFetch(200, { error: { code: 402, message: 'x' } });
    await expect(generateProblems('k', 'm', GENERATE)).rejects.toThrow('잔액');
    mockFetch(200, { choices: [{ finish_reason: 'length', message: { content: '{"problems":[' } }] });
    await expect(generateProblems('k', 'm', GENERATE)).rejects.toThrow('응답 형식');
    mockFetch(200, content('문제를 만들 수 없어요'));
    await expect(generateProblems('k', 'm', GENERATE)).rejects.toThrow('응답 형식');
  });

  it('네트워크 오류', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    );
    await expect(generateProblems('k', 'm', GENERATE)).rejects.toThrow(AiError);
    await expect(generateProblems('k', 'm', GENERATE)).rejects.toThrow('인터넷');
  });

  it('연결 확인: 키의 사용 한도를 읽는다', async () => {
    const fetchMock = mockFetch(200, { data: { limit: 5, limit_remaining: 4.5, usage: 0.5 } });
    expect(await checkKey('k')).toEqual({ limit: 5, remaining: 4.5 });
    expect((fetchMock.mock.calls[0] as unknown[])[0]).toBe(`${OPENROUTER_API}/key`);
    mockFetch(200, { data: { limit: null, limit_remaining: null } });
    expect(await checkKey('k')).toEqual({ limit: null, remaining: null });
  });
});
