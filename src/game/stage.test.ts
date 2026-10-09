import { describe, expect, it } from 'vitest';
import type { Problem } from '../judge/types';
import {
  CROSS_SECONDS,
  FIRST_SPAWN_SECONDS,
  MANA_PER_CORRECT,
  SLOW_FACTOR,
  WALL_DAMAGE,
  WALL_MAX,
  answer,
  createStage,
  selectMonster,
  splitWaves,
  stageOutcomes,
  starsFor,
  summarize,
  tick,
  type GameState,
} from './stage';

function makeProblems(count: number): Problem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `T-${i}`,
    level: 3,
    kind: 'spelling',
    tag: '웬/왠',
    rule: '-',
    wrong: '왠일이니?',
    correct: '웬일이니?',
    target: { wrongText: '왠일이니', start: 0 },
    choices: ['웬일이니', '왠일이니'],
    acceptedAnswers: ['웬일이니?'],
    explain: '-',
    source: 'builtin',
    reviewed: true,
  }));
}

// 같은 결과가 나오게 고정한 난수
const fixedRandom = () => 0;

/** 첫 몬스터가 나오도록 시간을 흘린다 */
function spawnFirst(state: GameState): GameState {
  return tick(state, FIRST_SPAWN_SECONDS, 'normal');
}

function walkingIds(state: GameState): number[] {
  return state.monsters.filter((m) => m.status === 'walking').map((m) => m.id);
}

/** 지금 웨이브 몬스터를 모두 나오게 하고 모두 정답 처리 */
function clearWave(state: GameState): GameState {
  // 조금씩 시간을 흘리면서 나온 몬스터는 바로 정답 처리
  let s = state;
  for (let i = 0; i < 100 && !s.finished; i++) {
    const wave = s.wave;
    for (const id of walkingIds(s)) s = answer(s, id, true);
    if (s.wave !== wave || s.finished) break;
    s = tick(s, 1, 'normal');
  }
  return s;
}

describe('splitWaves', () => {
  it('10문제는 3, 3, 4로 나눈다', () => {
    expect(splitWaves(10)).toEqual([3, 3, 4]);
  });

  it('8문제는 2, 3, 3으로 나눈다', () => {
    expect(splitWaves(8)).toEqual([2, 3, 3]);
  });

  it('문제가 3개보다 적으면 빈 웨이브는 뺀다', () => {
    expect(splitWaves(2)).toEqual([1, 1]);
    expect(splitWaves(0)).toEqual([]);
  });
});

describe('createStage', () => {
  it('문제를 10개까지 뽑아 웨이브 3개에 나눈다', () => {
    const state = createStage(makeProblems(30), fixedRandom);
    expect(state.monsters).toHaveLength(10);
    expect(state.waveCount).toBe(3);
    expect(state.monsters.map((m) => m.wave)).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2, 2]);
    expect(new Set(state.monsters.map((m) => m.problem.id)).size).toBe(10);
  });

  it('같은 웨이브 몬스터는 레인 3개에 나눠 차례로 나온다', () => {
    const state = createStage(makeProblems(10), fixedRandom);
    const firstWave = state.monsters.filter((m) => m.wave === 0);
    expect(firstWave.map((m) => m.lane)).toEqual([0, 1, 2]);
    expect(firstWave[1].spawnAt).toBeGreaterThan(firstWave[0].spawnAt);
  });

  it('처음 상태: 성벽 가득, 마나 0, 모두 대기', () => {
    const state = createStage(makeProblems(10));
    expect(state.wall).toBe(WALL_MAX);
    expect(state.mana).toBe(0);
    expect(state.monsters.every((m) => m.status === 'waiting')).toBe(true);
    expect(state.finished).toBe(false);
  });

  it('문제가 없으면 바로 끝난 상태', () => {
    expect(createStage([]).finished).toBe(true);
  });
});

describe('tick: 시간 흐름', () => {
  it('나올 시각이 되면 몬스터가 걷기 시작한다', () => {
    const state = createStage(makeProblems(10), fixedRandom);
    expect(walkingIds(tick(state, FIRST_SPAWN_SECONDS - 0.1, 'normal'))).toEqual([]);
    expect(walkingIds(spawnFirst(state))).toEqual([0]);
  });

  it('흐른 시간에 비례해 움직인다(기기 속도와 상관없음)', () => {
    const state = spawnFirst(createStage(makeProblems(10), fixedRandom));
    const oneBigStep = tick(state, 0.1, 'normal'); // 프레임이 느린 기기
    let manySmallSteps = state; // 프레임이 빠른 기기
    for (let i = 0; i < 10; i++) manySmallSteps = tick(manySmallSteps, 0.01, 'normal');
    expect(manySmallSteps.monsters[0].progress).toBeCloseTo(oneBigStep.monsters[0].progress);
    expect(oneBigStep.monsters[0].progress).toBeCloseTo(0.1 / CROSS_SECONDS);
  });

  it('느리게는 보통보다 천천히, 일시정지는 멈춤', () => {
    const state = spawnFirst(createStage(makeProblems(10), fixedRandom));
    const normal = tick(state, 1, 'normal').monsters[0].progress;
    const slow = tick(state, 1, 'slow').monsters[0].progress;
    expect(slow).toBeCloseTo(normal * SLOW_FACTOR);
    expect(tick(state, 1, 'paused')).toBe(state);
  });

  it('고른 몬스터는 멈추고 다른 몬스터는 계속 걷는다', () => {
    let state = createStage(makeProblems(10), fixedRandom);
    state = tick(state, 10, 'normal'); // 첫 웨이브 몬스터 둘 이상 나옴
    state = selectMonster(state, 0);
    const before = state.monsters.map((m) => m.progress);
    state = tick(state, 1, 'normal');
    expect(state.monsters[0].progress).toBe(before[0]);
    expect(state.monsters[1].progress).toBeGreaterThan(before[1]);
  });

  it('성에 닿으면 성벽 체력이 줄고 몬스터는 사라진다', () => {
    let state = spawnFirst(createStage(makeProblems(10), fixedRandom));
    state = tick(state, CROSS_SECONDS, 'normal');
    expect(state.monsters[0].status).toBe('arrived');
    expect(state.wall).toBe(WALL_MAX - WALL_DAMAGE);
  });

  it('성벽 체력은 0 아래로 내려가지 않고, 게임 오버 없이 끝까지 진행한다', () => {
    let state = createStage(makeProblems(30), fixedRandom);
    for (let i = 0; i < 1000 && !state.finished; i++) state = tick(state, 1, 'normal');
    expect(state.finished).toBe(true);
    expect(state.wall).toBe(0);
    expect(state.monsters.every((m) => m.status === 'arrived')).toBe(true);
  });
});

describe('selectMonster', () => {
  it('아직 안 나온 몬스터는 고를 수 없다', () => {
    const state = createStage(makeProblems(10), fixedRandom);
    expect(selectMonster(state, 0).selectedId).toBeNull();
  });

  it('다른 몬스터를 누르면 그 몬스터로 바뀐다', () => {
    let state = tick(createStage(makeProblems(10), fixedRandom), 10, 'normal');
    state = selectMonster(state, 0);
    state = selectMonster(state, 1);
    expect(state.selectedId).toBe(1);
  });
});

describe('answer', () => {
  it('정답: 정화되고 마나를 얻는다', () => {
    let state = selectMonster(spawnFirst(createStage(makeProblems(10), fixedRandom)), 0);
    state = answer(state, 0, true);
    expect(state.monsters[0].status).toBe('purified');
    expect(state.mana).toBe(MANA_PER_CORRECT);
    expect(state.selectedId).toBeNull();
  });

  it('오답: 마나 없이 계속 걸어서 성에 닿는다', () => {
    let state = selectMonster(spawnFirst(createStage(makeProblems(10), fixedRandom)), 0);
    state = answer(state, 0, false);
    expect(state.monsters[0].status).toBe('failed');
    expect(state.mana).toBe(0);
    // 다시 고를 수도, 다시 답할 수도 없다
    expect(selectMonster(state, 0).selectedId).toBeNull();
    expect(answer(state, 0, true)).toBe(state);
    state = tick(state, CROSS_SECONDS, 'normal');
    expect(state.monsters[0].status).toBe('arrived');
    expect(state.wall).toBe(WALL_MAX - WALL_DAMAGE);
  });
});

describe('웨이브와 스테이지 종료', () => {
  it('웨이브의 몬스터를 모두 처리하면 다음 웨이브, 마지막 웨이브 뒤에는 끝', () => {
    let state = createStage(makeProblems(10), fixedRandom);
    state = clearWave(state);
    expect(state.wave).toBe(1);
    expect(state.waveTime).toBe(0);
    state = clearWave(state);
    expect(state.wave).toBe(2);
    expect(state.finished).toBe(false);
    state = clearWave(state);
    expect(state.finished).toBe(true);
  });

  it('틀린 몬스터가 아직 걷고 있으면 웨이브가 끝나지 않는다', () => {
    let state = createStage(makeProblems(3), fixedRandom); // 웨이브마다 1마리
    state = selectMonster(spawnFirst(state), 0);
    state = answer(state, 0, false);
    expect(state.wave).toBe(0);
    state = tick(state, CROSS_SECONDS, 'normal');
    expect(state.wave).toBe(1);
  });

  it('끝난 뒤에는 시간이 흘러도 바뀌지 않는다', () => {
    let state = createStage(makeProblems(3), fixedRandom);
    for (let i = 0; i < 3; i++) state = clearWave(state);
    expect(state.finished).toBe(true);
    expect(tick(state, 10, 'normal')).toBe(state);
  });
});

describe('별과 결과', () => {
  it('성벽 80 이상 별 3개, 50 이상 2개, 그 아래 1개', () => {
    expect(starsFor(100)).toBe(3);
    expect(starsFor(80)).toBe(3);
    expect(starsFor(70)).toBe(2);
    expect(starsFor(50)).toBe(2);
    expect(starsFor(40)).toBe(1);
    expect(starsFor(0)).toBe(1);
  });

  it('정화 수와 놓친 수를 센다', () => {
    let state = createStage(makeProblems(3), fixedRandom);
    state = clearWave(state); // 1마리 정화
    state = tick(tick(state, FIRST_SPAWN_SECONDS, 'normal'), CROSS_SECONDS, 'normal'); // 1마리 놓침
    state = clearWave(state); // 1마리 정화
    expect(state.finished).toBe(true);
    expect(summarize(state)).toEqual({ stars: 3, purified: 2, missed: 1, wall: WALL_MAX - WALL_DAMAGE });
  });
});

describe('stageOutcomes', () => {
  it('정답·오답·놓침을 답한 차례대로, 놓친 문제는 맨 뒤에 돌려준다', () => {
    let state = createStage(makeProblems(3), fixedRandom); // 웨이브마다 1마리
    state = spawnFirst(state);
    state = answer(state, 0, false); // 0번 오답 → 계속 걷는다
    state = tick(state, CROSS_SECONDS, 'normal'); // 0번 성에 닿음 → 웨이브 2
    state = spawnFirst(state);
    state = tick(state, CROSS_SECONDS, 'normal'); // 1번 놓침 → 웨이브 3
    state = answer(spawnFirst(state), 2, true); // 2번 정답
    expect(state.finished).toBe(true);
    const id = (monster: number) => state.monsters[monster].problem.id;
    expect(stageOutcomes(state).map((o) => [o.problem.id, o.outcome])).toEqual([
      [id(0), 'wrong'],
      [id(2), 'correct'],
      [id(1), 'missed'],
    ]);
  });
});
