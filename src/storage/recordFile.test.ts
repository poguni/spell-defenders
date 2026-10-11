import { describe, expect, it } from 'vitest';
import { RECORD_FILE_MAX, exportRecord, importRecord, recordFileName, summarizeRecord } from './recordFile';
import { CURRENT_VERSION, emptySave, type SaveData } from './save';

const played: SaveData = {
  ...emptySave(),
  nickname: '민지',
  level: 2,
  stars: { 'L2-1': 3, 'L2-2': 1 },
  tagStreaks: { '되/돼': 2 },
  wrongNotes: { 'L2-an-001': '안/않' },
  dex: ['되/돼', '안/않', '조사 붙여 쓰기'],
  soundOn: false,
};

const NOW = new Date(2026, 9, 12, 9, 30);

describe('기록 파일', () => {
  it('저장한 파일을 불러오면 기록이 그대로 돌아온다', () => {
    const result = importRecord(exportRecord(played, NOW));
    expect(result).toEqual({ ok: true, save: played });
  });

  it('파일에는 형식 이름, 저장한 때, 학생 기록만 담긴다', () => {
    const data = JSON.parse(exportRecord(played, NOW));
    expect(Object.keys(data).sort()).toEqual(['exportedAt', 'format', 'save']);
    expect(data.format).toBe('spell-defenders-record');
    expect(data.exportedAt).toBe(NOW.toISOString());
    expect(data.save.version).toBe(CURRENT_VERSION);
  });

  it('파일 이름: 닉네임과 날짜, 파일 이름에 못 쓰는 글자는 뺀다', () => {
    expect(recordFileName(played, NOW)).toBe('맞춤법수비대-기록-민지-2026-10-12.json');
    expect(recordFileName({ ...played, nickname: null }, NOW)).toBe('맞춤법수비대-기록-2026-10-12.json');
    expect(recordFileName({ ...played, nickname: '하늘/별:*1 반' }, NOW)).toBe('맞춤법수비대-기록-하늘별1_반-2026-10-12.json');
    expect(recordFileName({ ...played, nickname: '???' }, NOW)).toBe('맞춤법수비대-기록-2026-10-12.json');
  });

  it('JSON이 아니거나 다른 파일이면 거부한다', () => {
    for (const text of ['', '안녕', '[]', 'null', '{"format":"other","save":{}}', JSON.stringify({ save: played })]) {
      expect(importRecord(text)).toEqual({ ok: false, message: '맞춤법 수비대 기록 파일이 아니에요.' });
    }
  });

  it('문제 세트 파일이면 어디서 불러오는지 알려 준다', () => {
    const result = importRecord(JSON.stringify({ format: 'spell-defenders-set', version: 1, problems: [] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('문제 파일 불러오기');
  });

  it('앱보다 새 버전에서 저장한 기록은 거부한다', () => {
    const text = JSON.stringify({ format: 'spell-defenders-record', save: { ...played, version: CURRENT_VERSION + 1 } });
    const result = importRecord(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('더 새로운 앱');
  });

  it('기록 칸이 없거나 망가졌으면 거부한다', () => {
    for (const save of [undefined, null, [], {}, { version: 'one' }, { version: 0 }]) {
      const result = importRecord(JSON.stringify({ format: 'spell-defenders-record', save }));
      expect(result).toEqual({ ok: false, message: '기록 파일이 망가져서 읽을 수 없어요.' });
    }
  });

  it('일부 칸만 이상하면 그 칸만 기본값으로 채운다', () => {
    const save = { ...played, stars: { 'L2-1': 3, 'L2-2': -1, 'L2-3': 9 }, dex: ['되/돼', 7], nickname: 42 };
    const result = importRecord(JSON.stringify({ format: 'spell-defenders-record', save }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.save.stars).toEqual({ 'L2-1': 3 });
      expect(result.save.dex).toEqual(['되/돼']);
      expect(result.save.nickname).toBeNull();
      expect(result.save.wrongNotes).toEqual(played.wrongNotes);
    }
  });

  it('너무 큰 파일은 읽지 않는다', () => {
    const result = importRecord(' '.repeat(RECORD_FILE_MAX + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('너무 커요');
  });

  it('요약: 별 합계, 별을 받은 스테이지, 도감, 오답 노트', () => {
    expect(summarizeRecord(played)).toEqual({ nickname: '민지', stars: 4, stages: 2, dex: 3, notes: 1 });
    expect(summarizeRecord(emptySave())).toEqual({ nickname: null, stars: 0, stages: 0, dex: 0, notes: 0 });
  });
});
