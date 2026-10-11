import { describe, expect, it } from 'vitest';
import { ALL_PROBLEMS } from '../data/problems';
import type { Problem } from '../judge/types';
import { SHARE_MAX, decodeSet, encodeSet, exportFile, importFile, shareLink } from './shareCode';

const REVIEWED = ALL_PROBLEMS.filter((p) => p.reviewed && p.level === 3);
const set = (n: number) => REVIEWED.slice(0, n).map((p) => ({ ...p, source: 'ai' as const }));

/** 테스트용: 아무 JSON이나 공유 코드와 같은 방식으로 압축(조작된 코드 만들기) */
async function rawCode(data: unknown): Promise<string> {
  const stream = new Blob([JSON.stringify(data)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** id만 빼고 비교 */
const withoutId = (list: Problem[]) => list.map(({ id: _id, ...rest }) => rest);

describe('공유 코드', () => {
  it('압축 → 해제 왕복: 문제 내용이 그대로, id는 새로', async () => {
    const original = set(10);
    const result = await decodeSet(await encodeSet('5학년 2반 맞춤법', original));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.set.name).toBe('5학년 2반 맞춤법');
    expect(withoutId(result.set.problems)).toEqual(withoutId(original));
    for (const p of result.set.problems) expect(p.id).toMatch(/^S[0-9a-z]+-\d+$/);
    expect(result.dropped).toBe(0);
  });

  it('여러 정답(acceptedAnswers)과 고칠 곳 없음·띄어쓰기 문제도 그대로', async () => {
    const spacing = REVIEWED.find((p) => p.kind === 'spacing')!;
    // 띄어쓰기를 한 곳 붙인 문장도 정답으로 인정하는 문제(글자는 같아야 검증 통과)
    const alternative = spacing.correct.replace(' ', '');
    const many = { ...spacing, acceptedAnswers: [spacing.correct, alternative] };
    const noError = REVIEWED.find((p) => p.noError)!;
    const list = [many, noError];
    const result = await decodeSet(await encodeSet('세트', list));
    expect(result.ok && withoutId(result.set.problems)).toEqual(withoutId(list));
  });

  it('같은 세트는 다시 받아도 같은 id(별·오답 노트가 이어짐)', async () => {
    const code = await encodeSet('세트', set(3));
    const a = await decodeSet(code);
    const b = await decodeSet(code);
    expect(a.ok && b.ok && a.set.problems.map((p) => p.id)).toEqual(b.ok && b.set.problems.map((p) => p.id));
  });

  it('30문제까지 링크로, 31문제는 파일로 안내', async () => {
    expect(REVIEWED.length).toBeGreaterThan(SHARE_MAX);
    const code = await encodeSet('세트', set(SHARE_MAX));
    expect((await decodeSet(code)).ok).toBe(true);
    await expect(encodeSet('세트', set(SHARE_MAX + 1))).rejects.toThrow('파일로 내보내');
  });

  it('승인 전 문제는 보내지 않는다', async () => {
    const list = set(3);
    list[1] = { ...list[1], reviewed: false };
    const result = await decodeSet(await encodeSet('세트', list));
    expect(result.ok && result.set.problems).toHaveLength(2);
    await expect(encodeSet('세트', [list[1]])).rejects.toThrow('승인한 문제가 없어요');
  });

  it('손상된 코드는 거부', async () => {
    const code = await encodeSet('세트', set(5));
    for (const broken of ['', '!!!', 'abc', code.slice(0, code.length / 2), code.slice(1), code + 'x'.repeat(10), 'A'.repeat(30_000)]) {
      const result = await decodeSet(broken);
      expect(result.ok, broken.slice(0, 20)).toBe(false);
    }
  });

  it('조작된 데이터: 승인 전 문제는 버리고, 모양이 틀린 문제가 있으면 세트 전체를 거부', async () => {
    const good = JSON.parse(JSON.stringify(await decodeSet(await encodeSet('세트', set(2)))));
    expect(good.ok).toBe(true);
    // 공유 코드 안의 배열을 직접 만든다
    const packed = (p: Problem, reviewed: 0 | 1) => [
      p.level, ['spelling', 'spacing', 'punctuation'].indexOf(p.kind), p.tag, p.rule, p.wrong, p.correct,
      p.target ? [p.target.wrongText, p.target.start] : 0, p.choices ?? 0, p.explain, p.source, reviewed, p.noError ? 1 : 0, 0,
    ];
    const [a, b] = set(2);

    const someUnreviewed = await decodeSet(await rawCode({ v: 1, n: '세트', p: [packed(a, 1), packed(b, 0)] }));
    expect(someUnreviewed.ok && someUnreviewed.set.problems.length).toBe(1);
    expect(someUnreviewed.ok && someUnreviewed.dropped).toBe(1);

    const allUnreviewed = await decodeSet(await rawCode({ v: 1, n: '세트', p: [packed(a, 0)] }));
    expect(allUnreviewed).toEqual({ ok: false, error: '받을 수 있는(선생님이 승인한) 문제가 없어요.' });

    const wrongAnswer = packed(a, 1);
    wrongAnswer[5] = '정답을 바꾼 문장.'; // 틀린 곳 밖이 달라짐
    expect((await decodeSet(await rawCode({ v: 1, n: '세트', p: [packed(b, 1), wrongAnswer] }))).ok).toBe(false);

    const badTag = packed(a, 1);
    badTag[2] = '없는 태그';
    expect((await decodeSet(await rawCode({ v: 1, n: '세트', p: [badTag] }))).ok).toBe(false);

    expect((await decodeSet(await rawCode({ v: 2, n: '세트', p: [packed(a, 1)] }))).ok).toBe(false);
    expect((await decodeSet(await rawCode({ v: 1, n: '세트', p: [[1, 2, 3]] }))).ok).toBe(false);
    expect((await decodeSet(await rawCode({ v: 1, n: '세트', p: Array(SHARE_MAX + 1).fill(packed(a, 1)) }))).ok).toBe(false);
    expect((await decodeSet(await rawCode('그냥 글자'))).ok).toBe(false);
  });

  it('너무 크게 풀리는 코드는 거부', async () => {
    const huge = await rawCode({ v: 1, n: 'x'.repeat(1_000_000), p: [] });
    expect(huge.length).toBeLessThan(20_000);
    expect((await decodeSet(huge)).ok).toBe(false);
  });

  it('세트 이름은 30자까지, 비었으면 기본 이름', async () => {
    const long = await decodeSet(await encodeSet('가'.repeat(50), set(1)));
    expect(long.ok && long.set.name).toBe('가'.repeat(30));
    const empty = await decodeSet(await encodeSet('   ', set(1)));
    expect(empty.ok && empty.set.name).toBe('선생님 문제');
  });

  it('공유 링크는 주소의 # 뒤에 코드를 붙인다', () => {
    expect(shareLink('https://poguni.github.io/spell-defenders/#old', 'abc')).toBe(
      'https://poguni.github.io/spell-defenders/#set=abc',
    );
  });
});

describe('파일 내보내기·불러오기', () => {
  it('30문제가 넘어도 파일로는 옮길 수 있고, 승인한 문제만 담는다', () => {
    const list = set(40);
    list[0] = { ...list[0], reviewed: false };
    const result = importFile(exportFile('큰 세트', list));
    expect(result.ok && result.set.problems).toHaveLength(39);
  });

  it('파일 안의 id는 쓰지 않고 새로 붙인다(내장 문제 id와 겹치지 않게)', () => {
    const result = importFile(exportFile('세트', set(2)));
    expect(result.ok && result.set.problems.every((p) => p.id.startsWith('S'))).toBe(true);
  });

  it('이상한 파일은 거부', () => {
    const text = exportFile('세트', set(2));
    expect(importFile('{').ok).toBe(false);
    expect(importFile('{"format":"다른 앱","version":1,"problems":[]}').ok).toBe(false);
    const tampered = JSON.parse(text);
    tampered.problems[0].choices = ['아무거나'];
    expect(importFile(JSON.stringify(tampered)).ok).toBe(false);
  });

  it('내 기록 파일이면 어디서 불러오는지 알려 준다', () => {
    const result = importFile('{"format":"spell-defenders-record","save":{"version":1}}');
    expect(result).toEqual({ ok: false, error: "내 기록 파일이에요. 처음 화면의 '내 기록'에서 불러와 주세요." });
  });
});
