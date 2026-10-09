import { tagInfo } from '../data/tagInfo';
import { MASTERY_STREAK } from '../game/progress';
import { TAGS, type Problem } from '../judge/types';

interface Props {
  /** 오답 노트에 있는 문제 */
  problems: Problem[];
  tagStreaks: Record<string, number>;
  onBack: () => void;
}

/** 오답 노트: 유형 태그별로 틀린 문제와 규칙 설명 카드(기획서 6.1) */
export function NotesScreen({ problems, tagStreaks, onBack }: Props) {
  // 기획서 4.2 태그 순서대로
  const order = (p: Problem) => TAGS[p.level].indexOf(p.tag);
  const tags = [...new Set([...problems].sort((a, b) => order(a) - order(b)).map((p) => p.tag))];

  return (
    <div className="list-screen">
      <header className="screen-header">
        <button type="button" className="btn btn-small" onClick={onBack}>
          지도로
        </button>
        <h1 className="screen-title">오답 노트</h1>
        <span className="screen-header-spacer" />
      </header>

      <div className="list-body">
        {tags.length === 0 ? (
          <p className="list-empty">틀린 문제가 없어요. 잘했어요!</p>
        ) : (
          <>
            <p className="list-guide">같은 유형을 수비전에서 {MASTERY_STREAK}번 연속으로 맞히면 "익힘"이 되어 노트에서 빠져요.</p>
            {tags.map((tag) => (
              <section key={tag} className="note-section" aria-label={tag}>
                <div className="note-head">
                  <h2 className="note-tag">{tag}</h2>
                  <span className="note-streak">
                    연속 정답 {Math.min(tagStreaks[tag] ?? 0, MASTERY_STREAK)} / {MASTERY_STREAK}
                  </span>
                </div>
                <p className="rule-card">{tagInfo(tag).rule}</p>
                <ul className="note-problems">
                  {problems
                    .filter((p) => p.tag === tag)
                    .map((p) => (
                      <li key={p.id}>
                        <span className="note-wrong">{p.wrong}</span>
                        <span className="note-arrow">→</span>
                        <span className="note-correct">{p.noError ? `${p.correct} (고칠 곳 없음)` : p.correct}</span>
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
