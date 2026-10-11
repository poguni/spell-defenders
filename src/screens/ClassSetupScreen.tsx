import { useState } from 'react';
import { LEVEL_INFO } from '../game/stages';
import type { Level } from '../judge/types';

const CLASS_COUNTS = [5, 10, 15] as const;

export interface ClassSettings {
  level: Level;
  tags: string[];
  count: number;
}

interface Props {
  /** 낼 문제가 있는 단계 */
  openLevels: Level[];
  /** 단계마다 문제가 있는 유형 태그 */
  tagsOf: (level: Level) => string[];
  /** 고른 단계·유형의 문제 수 */
  poolSize: (level: Level, tags: string[]) => number;
  /** 지난번에 고른 값 */
  settings: ClassSettings | null;
  onStart: (settings: ClassSettings) => void;
  onBack: () => void;
}

/** 학급 수비전 준비: 단계, 유형(여러 개), 몬스터 수(기획서 5.2) */
export function ClassSetupScreen({ openLevels, tagsOf, poolSize, settings, onStart, onBack }: Props) {
  const [level, setLevel] = useState<Level>(settings?.level ?? openLevels[openLevels.length - 1]);
  const [tags, setTags] = useState(settings?.tags ?? tagsOf(level));
  const [count, setCount] = useState(settings?.count ?? 10);

  const chooseLevel = (n: Level) => {
    setLevel(n);
    setTags(tagsOf(n));
  };
  const toggleTag = (tag: string) =>
    setTags((list) => (list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]));

  const size = poolSize(level, tags);

  return (
    <div className="list-screen class-setup">
      <header className="screen-header">
        <button type="button" className="btn btn-small" onClick={onBack}>
          처음으로
        </button>
        <h1 className="screen-title">학급 수비전 준비</h1>
        <div className="screen-header-spacer" />
      </header>

      <div className="class-setup-body">
        <section className="class-setup-row">
          <h2 className="class-setup-label">단계</h2>
          <div className="class-options" role="group" aria-label="단계">
            {openLevels.map((n) => (
              <button
                key={n}
                type="button"
                className={`btn${level === n ? ' is-selected' : ''}`}
                aria-pressed={level === n}
                onClick={() => chooseLevel(n)}
              >
                {n}단계 {LEVEL_INFO[n].place}
              </button>
            ))}
          </div>
        </section>

        <section className="class-setup-row">
          <h2 className="class-setup-label">유형</h2>
          <div className="class-options" role="group" aria-label="유형">
            {tagsOf(level).map((tag) => (
              <button
                key={tag}
                type="button"
                className={`btn${tags.includes(tag) ? ' is-selected' : ''}`}
                aria-pressed={tags.includes(tag)}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </section>

        <section className="class-setup-row">
          <h2 className="class-setup-label">몬스터</h2>
          <div className="class-options" role="group" aria-label="몬스터 수">
            {CLASS_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                className={`btn${count === n ? ' is-selected' : ''}`}
                aria-pressed={count === n}
                onClick={() => setCount(n)}
              >
                {n}마리
              </button>
            ))}
          </div>
        </section>

        <p className="list-guide" data-testid="class-pool">
          {tags.length === 0
            ? '유형을 하나 이상 골라 주세요.'
            : size < count
              ? `고른 유형의 문제가 ${size}개라서 ${size}마리가 나와요.`
              : `고른 유형의 문제 ${size}개 가운데 ${count}마리가 나와요.`}
        </p>

        <button
          type="button"
          className="btn btn-primary btn-large"
          disabled={size === 0}
          onClick={() => onStart({ level, tags, count })}
        >
          시작!
        </button>
      </div>
    </div>
  );
}
