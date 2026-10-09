import { useEffect, useRef, useState } from 'react';
import { FeedbackOverlay, type Feedback } from '../components/FeedbackOverlay';
import { PlaceholderArt } from '../components/PlaceholderArt';
import { SentenceCard, type AnswerResult } from '../components/SentenceCard';
import { TAGS, type Problem } from '../judge/types';
import {
  WALL_MAX,
  answer,
  createStage,
  selectMonster,
  tick,
  type GameState,
  type Monster,
  type Speed,
} from '../game/stage';
import { useGameLoop } from '../game/useGameLoop';

// 무대 좌표(1920×1080) 배치
const LANE_TOPS = [200, 380, 560];
const MONSTER_TOP_OFFSET = 105 - 180;
const MONSTER_START_LEFT = 40; // progress 0: 말풍선까지 화면 안에서 나타난다
const MONSTER_END_LEFT = 1425; // progress 1: 몸이 성벽에 닿는 곳
const BUBBLE_LETTERS = 8;

const SPEEDS: { value: Speed; label: string }[] = [
  { value: 'normal', label: '보통' },
  { value: 'slow', label: '느리게' },
  { value: 'paused', label: '일시정지' },
];

function bubbleText(sentence: string) {
  const letters = Array.from(sentence);
  return letters.length > BUBBLE_LETTERS ? `${letters.slice(0, BUBBLE_LETTERS).join('')}…` : sentence;
}

function monsterClass(monster: Monster, selectedId: number | null) {
  if (monster.status === 'walking') return monster.id === selectedId ? 'is-selected' : 'is-walking';
  return `is-${monster.status}`;
}

interface Props {
  /** 이번 스테이지에 낼 문제 */
  problems: Problem[];
  onFinish: (state: GameState) => void;
}

export function BattleScreen({ problems, onFinish }: Props) {
  const [game, setGame] = useState(() => createStage(problems));
  const [speed, setSpeed] = useState<Speed>('normal');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // 설명이 떠 있는 동안 게임 전체가 멈춘다
  const running: Speed = feedback ? 'paused' : speed;
  useGameLoop((dt) => setGame((g) => tick(g, dt, running)));

  // 마지막 설명 창을 닫으면 한 번만 알린다
  const reported = useRef(false);
  useEffect(() => {
    if (!game.finished || feedback || reported.current) return;
    reported.current = true;
    onFinish(game);
  }, [game, feedback, onFinish]);

  const selected = game.monsters.find((m) => m.id === game.selectedId) ?? null;
  const visible = game.monsters.filter(
    (m) => m.wave === game.wave && m.status !== 'waiting' && m.status !== 'arrived',
  );
  const graffitiCount = game.monsters.filter((m) => m.status === 'arrived').length;

  const handleResult = (result: AnswerResult) => {
    if (!selected) return;
    setGame((g) => answer(g, selected.id, result.correct));
    setFeedback({ ...result, problem: selected.problem });
  };

  return (
    <div className="battle-screen">
      <PlaceholderArt kind="background" />

      <header className="hud">
        <div className="hud-item">
          <span className="hud-label">성벽</span>
          <div
            className="hp-bar"
            role="meter"
            aria-label="성벽 체력"
            aria-valuenow={game.wall}
            aria-valuemin={0}
            aria-valuemax={WALL_MAX}
          >
            <div className="hp-fill" style={{ width: `${(game.wall / WALL_MAX) * 100}%` }} />
          </div>
        </div>
        <div className="hud-item hud-wave">
          웨이브 {game.wave + 1} / {game.waveCount}
        </div>
        <div className="hud-item">
          <span className="hud-label">마나</span>
          <span className="hud-value" data-testid="mana">
            {game.mana}
          </span>
        </div>
        <div className="speed-buttons" role="group" aria-label="속도">
          {SPEEDS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`btn btn-small${speed === value ? ' is-selected' : ''}`}
              aria-pressed={speed === value}
              onClick={() => setSpeed(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {visible.map((m) => (
        <button
          key={m.id}
          type="button"
          className={`monster ${monsterClass(m, game.selectedId)}`}
          style={{
            left: MONSTER_START_LEFT + m.progress * (MONSTER_END_LEFT - MONSTER_START_LEFT),
            top: LANE_TOPS[m.lane] + MONSTER_TOP_OFFSET,
          }}
          disabled={m.status !== 'walking'}
          aria-label={`오타 몬스터: ${m.problem.wrong}`}
          onClick={() => setGame((g) => selectMonster(g, m.id))}
        >
          <span className="monster-bubble">{bubbleText(m.problem.wrong)}</span>
          <PlaceholderArt kind="monster" variant={TAGS[m.problem.level].indexOf(m.problem.tag)} />
        </button>
      ))}

      <div className="castle-area">
        <div className="defender-spot">
          <PlaceholderArt kind="defender" />
        </div>
        <PlaceholderArt kind="castle" />
        <div className="graffiti-layer" data-testid="graffiti" data-count={graffitiCount}>
          {Array.from({ length: graffitiCount }, (_, i) => (
            <PlaceholderArt key={i} kind="graffiti" variant={i} />
          ))}
        </div>
      </div>

      <SentenceCard problem={selected?.problem ?? null} onResult={handleResult} />

      {feedback && <FeedbackOverlay feedback={feedback} onClose={() => setFeedback(null)} />}
    </div>
  );
}
