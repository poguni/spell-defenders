// 게임 그림을 모두 여기에 모은다(기획서 16장). 그림 파일이 없는 것은 단색 도형(임시 그림)으로 그린다.
import { TAGS, type Level } from '../judge/types';

const ASSETS = `${import.meta.env.BASE_URL}assets`;

/** 레인(몬스터가 걷는 길) 3줄의 위쪽 좌표(무대 1920×1080 기준) */
export const LANE_TOPS = [210, 390, 570];

const BACKGROUNDS: Record<Level, string> = { 1: 'bg-village', 2: 'bg-forest', 3: 'bg-castle' };

// 태그 → 몬스터 그림 파일 이름(기획서 16.3). 없는 태그는 임시 그림
const MONSTER_FILES: Record<string, string> = {
  '로서/로써': 'mon-roseo',
  '든지/던지': 'mon-deunji',
  '맞히다/맞추다': 'mon-maja',
  '붙이다/부치다, 반드시/반듯이': 'mon-buchi',
  '웬/왠': 'mon-wen',
  '어떡해/어떻게': 'mon-eotteok',
  '-이/-히': 'mon-ihi',
  사이시옷: 'mon-saisiot',
  '의존 명사 띄어쓰기': 'mon-spacing',
};

const MONSTER_COLORS = ['#8e6bbf', '#6b8ebf', '#bf6b8e', '#6bbf9a', '#bf9a6b', '#7a7fa8'];

// 성벽 낙서 자리(성벽 기준 좌표)
const GRAFFITI_SPOTS = [
  { left: 10, top: 20, rotate: -12 },
  { left: 100, top: 60, rotate: 15 },
  { left: 30, top: 140, rotate: 8 },
  { left: 110, top: 180, rotate: -20 },
  { left: 5, top: 240, rotate: 25 },
  { left: 90, top: 270, rotate: -5 },
  { left: 50, top: 100, rotate: 30 },
  { left: 130, top: 120, rotate: -28 },
  { left: 20, top: 190, rotate: -15 },
  { left: 80, top: 10, rotate: 10 },
];

export function monsterImage(tag: string): string | null {
  return MONSTER_FILES[tag] ?? null;
}

export function Background({ level }: { level: Level }) {
  return (
    <div className="art-background" aria-hidden="true">
      <img src={`${ASSETS}/backgrounds/${BACKGROUNDS[level]}.webp`} alt="" />
      {/* 몬스터가 걷는 길 3줄 */}
      {LANE_TOPS.map((top) => (
        <div key={top} className="art-lane" style={{ top }} />
      ))}
    </div>
  );
}

/** 오타 몬스터. purified면 정화 상태 그림 */
export function MonsterArt({ level, tag, purified = false }: { level: Level; tag: string; purified?: boolean }) {
  const file = monsterImage(tag);
  if (file) {
    return (
      <img
        className="art-monster"
        src={`${ASSETS}/monsters/${file}-${purified ? 'clean' : 'typo'}.webp`}
        alt=""
        draggable={false}
      />
    );
  }
  const index = TAGS[level].indexOf(tag);
  return (
    <div
      className={`art-monster ph-monster${purified ? ' is-clean' : ''}`}
      style={{ background: MONSTER_COLORS[Math.max(index, 0) % MONSTER_COLORS.length] }}
      aria-hidden="true"
    >
      <span className="ph-eye" />
      <span className="ph-eye" />
    </div>
  );
}

/** 성 오른쪽 끝: 수비대원과 성문. casting이면 수비대원이 정화 동작 */
export function Castle({ casting = false }: { casting?: boolean }) {
  return (
    <>
      <img
        className={`art-defender${casting ? ' is-casting' : ''}`}
        src={`${ASSETS}/characters/char-defender${casting ? '-cast' : ''}.webp`}
        alt=""
        draggable={false}
      />
      <img className="art-castle" src={`${ASSETS}/characters/castle-gate.webp`} alt="" draggable={false} />
    </>
  );
}

/** 성벽 낙서. 같은 variant는 같은 자리·같은 그림 */
export function Graffiti({ variant }: { variant: number }) {
  const spot = GRAFFITI_SPOTS[variant % GRAFFITI_SPOTS.length];
  // 낙서 그림 3장 중 하나를 자리마다 섞어 고른다
  const file = `graffiti-${((variant * 7) % 3) + 1}`;
  return (
    <img
      className="art-graffiti"
      src={`${ASSETS}/characters/${file}.webp`}
      alt=""
      draggable={false}
      style={{ left: spot.left, top: spot.top, transform: `rotate(${spot.rotate}deg)` }}
    />
  );
}
