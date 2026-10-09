import { Fragment } from 'react';

interface Props {
  letters: string[];
  /** gaps[i]: i번째 글자와 i+1번째 글자 사이를 띄웠는지 */
  gaps: boolean[];
  /** 있으면 글자 사이를 눌러 띄움/붙임을 바꿀 수 있다(띄어쓰기 칼) */
  onToggle?: (gapIndex: number) => void;
  /** 틀린 글자 사이(빨간색으로 강조) */
  wrongGaps?: number[];
}

/** 띄어쓰기 칼: 글자를 칸에 하나씩 놓고, 글자 사이를 눌러 띄우거나 붙인다 */
export function SpacingLetters({ letters, gaps, onToggle, wrongGaps = [] }: Props) {
  // 띄운 곳을 기준으로 낱말 덩어리로 묶어, 줄이 바뀔 때 낱말 중간에서 끊기지 않게 한다
  const groups: number[][] = [];
  letters.forEach((_, i) => {
    if (i === 0 || gaps[i - 1]) groups.push([]);
    groups[groups.length - 1].push(i);
  });

  const gap = (index: number) => {
    const className = `gap${gaps[index] ? ' is-spaced' : ''}${wrongGaps.includes(index) ? ' is-wrong' : ''}`;
    if (!onToggle) return <span className={className} />;
    return (
      <button
        type="button"
        className={className}
        aria-label={`${index + 1}번째 글자 뒤 ${gaps[index] ? '붙이기' : '띄우기'}`}
        aria-pressed={gaps[index]}
        onClick={() => onToggle(index)}
      >
        <span className="gap-hit" />
      </button>
    );
  };

  return (
    <div className="spacing-letters">
      {groups.map((group) => (
        <Fragment key={group[0]}>
          {group[0] > 0 && gap(group[0] - 1)}
          <span className="letter-group">
            {group.map((i) => (
              <Fragment key={i}>
                {i > group[0] && gap(i - 1)}
                <span className="letter">{letters[i]}</span>
              </Fragment>
            ))}
          </span>
        </Fragment>
      ))}
    </div>
  );
}
