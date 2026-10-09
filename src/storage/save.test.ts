import { afterEach, describe, expect, it } from 'vitest';
import {
  CURRENT_VERSION,
  STORAGE_KEY,
  clearSave,
  cleanNickname,
  emptySave,
  loadSave,
  migrate,
  parseSave,
  writeSave,
  type SaveData,
} from './save';

const FULL: SaveData = {
  version: CURRENT_VERSION,
  nickname: '민지',
  level: 3,
  stars: { 'L3-1': 3, 'L3-2': 1 },
  tagStreaks: { '로서/로써': 2 },
  wrongNotes: { 'L3-roseo-001': '로서/로써' },
  dex: ['로서/로써', '사이시옷'],
  soundOn: false,
};

// Vitest는 브라우저가 아니라서 localStorage를 흉내 낸다
function fakeStorage() {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
  Object.assign(globalThis, { window: { localStorage: storage } });
  return map;
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('저장하고 불러오기', () => {
  it('저장한 것을 그대로 불러온다', () => {
    fakeStorage();
    writeSave(FULL);
    expect(loadSave()).toEqual(FULL);
  });

  it('저장한 적이 없으면 빈 기록', () => {
    fakeStorage();
    expect(loadSave()).toEqual(emptySave());
  });

  it('내 기록 지우기 뒤에는 빈 기록', () => {
    const map = fakeStorage();
    writeSave(FULL);
    clearSave();
    expect(map.has(STORAGE_KEY)).toBe(false);
    expect(loadSave()).toEqual(emptySave());
  });

  it('localStorage를 쓸 수 없어도(사생활 보호 모드 등) 멈추지 않는다', () => {
    const broken = {
      getItem: () => {
        throw new Error('막힘');
      },
      setItem: () => {
        throw new Error('막힘');
      },
      removeItem: () => {
        throw new Error('막힘');
      },
    };
    Object.assign(globalThis, { window: { localStorage: broken } });
    expect(loadSave()).toEqual(emptySave());
    expect(() => writeSave(FULL)).not.toThrow();
    expect(() => clearSave()).not.toThrow();
  });
});

describe('parseSave: 깨진 데이터', () => {
  it.each([
    ['빈 값', null],
    ['JSON이 아님', '{깨진 데이터'],
    ['객체가 아님', '[1,2,3]'],
    ['숫자', '42'],
    ['버전 없음', JSON.stringify({ ...FULL, version: undefined })],
    ['버전이 글자', JSON.stringify({ ...FULL, version: '1' })],
    ['앱보다 새 버전', JSON.stringify({ ...FULL, version: CURRENT_VERSION + 1 })],
  ])('%s → 빈 기록', (_, raw) => {
    expect(parseSave(raw)).toEqual(emptySave());
  });

  it('일부 칸만 이상하면 멀쩡한 칸은 살린다', () => {
    const raw = JSON.stringify({
      ...FULL,
      level: 7,
      stars: { 'L3-1': 3, 'L3-2': 9, 'L3-3': 'three' },
      tagStreaks: { '로서/로써': 2, '웬/왠': -1 },
      dex: ['사이시옷', 5, '사이시옷'],
      wrongNotes: 'oops',
    });
    expect(parseSave(raw)).toEqual({
      ...FULL,
      level: null,
      stars: { 'L3-1': 3 },
      tagStreaks: { '로서/로써': 2 },
      dex: ['사이시옷'],
      wrongNotes: {},
    });
  });

  it('효과음 칸이 없는 옛 저장 데이터는 켜짐으로 채운다', () => {
    const { soundOn: _soundOn, ...withoutSound } = FULL;
    expect(parseSave(JSON.stringify(withoutSound)).soundOn).toBe(true);
  });
});

describe('migrate: 버전 변환', () => {
  it('지금 버전은 그대로', () => {
    expect(migrate({ version: CURRENT_VERSION, nickname: 'a' })).toEqual({ version: CURRENT_VERSION, nickname: 'a' });
  });

  it('옛 버전은 변환 단계를 차례로 거친다', () => {
    const migrations = {
      [CURRENT_VERSION - 2]: (d: Record<string, unknown>) => ({ ...d, version: CURRENT_VERSION - 1, a: 1 }),
      [CURRENT_VERSION - 1]: (d: Record<string, unknown>) => ({ ...d, version: CURRENT_VERSION, b: 2 }),
    };
    expect(migrate({ version: CURRENT_VERSION - 2 }, migrations)).toEqual({ version: CURRENT_VERSION, a: 1, b: 2 });
  });

  it('변환 방법이 없는 옛 버전은 null(빈 기록으로 시작)', () => {
    expect(migrate({ version: CURRENT_VERSION - 1 }, {})).toBeNull();
  });
});

describe('cleanNickname', () => {
  it('앞뒤 공백을 지우고 10글자까지만', () => {
    expect(cleanNickname('  민지  ')).toBe('민지');
    expect(cleanNickname('가나다라마바사아자차카타')).toBe('가나다라마바사아자차');
  });

  it('비어 있으면 null', () => {
    expect(cleanNickname('   ')).toBeNull();
  });
});
