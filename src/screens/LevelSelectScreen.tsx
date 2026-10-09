import { useState } from 'react';
import { LEVEL_INFO } from '../game/stages';
import type { Level } from '../judge/types';
import { NICKNAME_MAX } from '../storage/save';

interface Props {
  level: Level | null;
  nickname: string | null;
  /** 낼 문제가 있는 단계 */
  openLevels: Level[];
  onConfirm: (level: Level, nickname: string) => void;
}

/** 단계 선택과 (선택) 닉네임 입력(기획서 5.1) */
export function LevelSelectScreen({ level, nickname, openLevels, onConfirm }: Props) {
  const [chosen, setChosen] = useState<Level | null>(level && openLevels.includes(level) ? level : null);
  const [name, setName] = useState(nickname ?? '');

  return (
    <div className="result-screen level-screen">
      <h1 className="result-title">단계를 골라요</h1>
      <div className="level-buttons" role="group" aria-label="단계">
        {([1, 2, 3] as Level[]).map((n) => {
          const open = openLevels.includes(n);
          return (
            <button
              key={n}
              type="button"
              className={`btn level-button${chosen === n ? ' is-selected' : ''}`}
              aria-pressed={chosen === n}
              disabled={!open}
              onClick={() => setChosen(n)}
            >
              <span className="level-name">
                {n}단계 {LEVEL_INFO[n].place}
              </span>
              <span className="level-grade">{open ? LEVEL_INFO[n].grade : '준비 중'}</span>
            </button>
          );
        })}
      </div>

      <label className="nickname-field">
        <span>닉네임 (안 써도 돼요)</span>
        <input
          type="text"
          value={name}
          maxLength={NICKNAME_MAX}
          placeholder="이 기기에만 저장돼요"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <button
        type="button"
        className="btn btn-primary btn-large"
        disabled={chosen === null}
        onClick={() => chosen && onConfirm(chosen, name)}
      >
        출발!
      </button>
    </div>
  );
}
