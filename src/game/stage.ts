// 한 스테이지의 게임 상태와 상태 변화(순수 함수). 화면은 이 상태를 그리기만 한다.
import type { Problem } from '../judge/types';
import type { ProblemOutcome } from './progress';

// 게임 수치: 현장 테스트 뒤 조정하기 쉽게 한곳에 모은다
export const STAGE_PROBLEM_COUNT = 10;
export const WAVE_COUNT = 3;
export const LANE_COUNT = 3;
export const FIRST_SPAWN_SECONDS = 1; // 웨이브 시작 뒤 첫 몬스터가 나오기까지
export const SPAWN_GAP_SECONDS = 5; // 같은 웨이브 안 몬스터 사이 간격
export const CROSS_SECONDS = 45; // 첫 웨이브 몬스터가 "보통" 속도로 레인 끝까지 가는 시간
export const WAVE_SPEEDUP = 0.9; // 웨이브마다 CROSS_SECONDS에 곱한다(조금씩 빨라짐)
export const SLOW_FACTOR = 0.5; // "느리게"는 보통의 절반 빠르기
export const MANA_PER_CORRECT = 10;
export const WALL_MAX = 100;
export const WALL_DAMAGE = 10;

export type Speed = 'normal' | 'slow' | 'paused';
/** waiting: 아직 안 나옴, walking: 걷는 중, purified: 정화됨, failed: 틀려서 고칠 수 없이 걷는 중, arrived: 성에 닿음 */
export type MonsterStatus = 'waiting' | 'walking' | 'purified' | 'failed' | 'arrived';

export interface Monster {
  id: number;
  problem: Problem;
  wave: number;
  lane: number;
  /** 웨이브 시작 뒤 나오는 시각(초) */
  spawnAt: number;
  /** 0 = 레인 왼쪽 끝, 1 = 성 */
  progress: number;
  status: MonsterStatus;
  /** 몇 번째로 답했는지. 답하지 않고 성에 닿았으면 null */
  answerOrder: number | null;
}

export interface GameState {
  monsters: Monster[];
  wave: number;
  waveCount: number;
  /** 지금 웨이브가 시작된 뒤 흐른 게임 시간(초) */
  waveTime: number;
  /** 문장 카드를 연 몬스터. 이 몬스터는 멈춘다 */
  selectedId: number | null;
  wall: number;
  mana: number;
  /** 지금까지 답한 수 */
  answers: number;
  finished: boolean;
}

export interface StageSummary {
  stars: number;
  purified: number;
  missed: number;
  wall: number;
}

export function shuffle<T>(list: readonly T[], random: () => number = Math.random): T[] {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 문제 수를 웨이브에 나눈다. 남는 문제는 뒤 웨이브에 붙인다(10 → 3, 3, 4). 빈 웨이브는 뺀다. */
export function splitWaves(count: number): number[] {
  const base = Math.floor(count / WAVE_COUNT);
  const extra = count % WAVE_COUNT;
  return Array.from({ length: WAVE_COUNT }, (_, i) => base + (i >= WAVE_COUNT - extra ? 1 : 0)).filter((n) => n > 0);
}

export function createStage(pool: readonly Problem[], random: () => number = Math.random): GameState {
  const picked = shuffle(pool, random).slice(0, STAGE_PROBLEM_COUNT);
  const sizes = splitWaves(picked.length);
  const monsters: Monster[] = [];
  let next = 0;
  sizes.forEach((size, wave) => {
    const firstLane = Math.floor(random() * LANE_COUNT);
    for (let i = 0; i < size; i++) {
      monsters.push({
        id: next,
        problem: picked[next],
        wave,
        lane: (firstLane + i) % LANE_COUNT,
        spawnAt: FIRST_SPAWN_SECONDS + i * SPAWN_GAP_SECONDS,
        progress: 0,
        status: 'waiting',
        answerOrder: null,
      });
      next++;
    }
  });
  return {
    monsters,
    wave: 0,
    waveCount: sizes.length,
    waveTime: 0,
    selectedId: null,
    wall: WALL_MAX,
    mana: 0,
    answers: 0,
    finished: sizes.length === 0,
  };
}

/** 지금 웨이브의 몬스터가 모두 정화되거나 성에 닿았으면 다음 웨이브로, 마지막이면 끝 */
function advanceWave(state: GameState): GameState {
  const done = state.monsters
    .filter((m) => m.wave === state.wave)
    .every((m) => m.status === 'purified' || m.status === 'arrived');
  if (!done) return state;
  if (state.wave + 1 < state.waveCount) return { ...state, wave: state.wave + 1, waveTime: 0 };
  return { ...state, finished: true };
}

/** 게임 시간 dt초를 흘린다 */
export function tick(state: GameState, dt: number, speed: Speed): GameState {
  if (state.finished || speed === 'paused' || dt <= 0) return state;
  const gameDt = speed === 'slow' ? dt * SLOW_FACTOR : dt;
  const waveTime = state.waveTime + gameDt;
  const step = gameDt / (CROSS_SECONDS * WAVE_SPEEDUP ** state.wave);
  let wall = state.wall;

  const monsters = state.monsters.map((m): Monster => {
    if (m.wave !== state.wave) return m;
    if (m.status === 'waiting') return waveTime >= m.spawnAt ? { ...m, status: 'walking' } : m;
    const moving = (m.status === 'walking' && m.id !== state.selectedId) || m.status === 'failed';
    if (!moving) return m;
    const progress = m.progress + step;
    if (progress < 1) return { ...m, progress };
    wall = Math.max(0, wall - WALL_DAMAGE);
    return { ...m, progress: 1, status: 'arrived' };
  });

  return advanceWave({ ...state, monsters, waveTime, wall });
}

/** 몬스터를 눌러 문장 카드를 연다. 걷는 중인 몬스터만 고를 수 있다 */
export function selectMonster(state: GameState, id: number): GameState {
  const monster = state.monsters.find((m) => m.id === id);
  if (!monster || monster.status !== 'walking' || state.finished) return state;
  return { ...state, selectedId: id };
}

/** 고치기 결과를 반영한다. 정답이면 정화, 오답이면 고칠 수 없는 채로 계속 걷는다 */
export function answer(state: GameState, id: number, correct: boolean): GameState {
  const monster = state.monsters.find((m) => m.id === id);
  if (!monster || monster.status !== 'walking') return state;
  const status: MonsterStatus = correct ? 'purified' : 'failed';
  return advanceWave({
    ...state,
    monsters: state.monsters.map((m) => (m.id === id ? { ...m, status, answerOrder: state.answers } : m)),
    selectedId: null,
    mana: correct ? state.mana + MANA_PER_CORRECT : state.mana,
    answers: state.answers + 1,
  });
}

/** 별: 성벽 상태 기준(기획서 7.1) */
export function starsFor(wall: number): number {
  if (wall >= 80) return 3;
  if (wall >= 50) return 2;
  return 1;
}

export function summarize(state: GameState): StageSummary {
  return {
    stars: starsFor(state.wall),
    purified: state.monsters.filter((m) => m.status === 'purified').length,
    missed: state.monsters.filter((m) => m.status === 'arrived').length,
    wall: state.wall,
  };
}

/** 문제마다 정답·오답·놓침. 답한 차례대로, 놓친 문제는 맨 뒤 */
export function stageOutcomes(state: GameState): ProblemOutcome[] {
  const order = (m: Monster) => m.answerOrder ?? Number.MAX_SAFE_INTEGER;
  return [...state.monsters]
    .sort((a, b) => order(a) - order(b))
    .map((m) => ({
      problem: m.problem,
      outcome: m.status === 'purified' ? 'correct' : m.answerOrder !== null ? 'wrong' : 'missed',
    }));
}
