import { tagInfo } from '../data/tagInfo';
import type { StageSummary } from '../game/stage';

interface Props {
  summary: StageSummary;
  /** 낙서 지우기로 다시 풀 문제 수(틀리거나 놓친 문제) */
  reviewCount: number;
  /** 이번에 익힌 태그 */
  mastered: string[];
  /** 이번에 도감에 새로 등록된 태그 */
  newDex: string[];
  onReview: () => void;
  onRetry: () => void;
  onMap: () => void;
}

export function ResultScreen({ summary, reviewCount, mastered, newDex, onReview, onRetry, onMap }: Props) {
  return (
    <div className="result-screen">
      <h1 className="result-title">스테이지 끝!</h1>
      <div className="result-stars" role="img" aria-label={`별 ${summary.stars}개`}>
        {[1, 2, 3].map((n) => (
          <span key={n} className={`star${n <= summary.stars ? ' is-on' : ''}`} />
        ))}
      </div>
      <dl className="result-numbers">
        <div>
          <dt>정화한 몬스터</dt>
          <dd data-testid="result-purified">{summary.purified}</dd>
        </div>
        <div>
          <dt>놓친 몬스터</dt>
          <dd data-testid="result-missed">{summary.missed}</dd>
        </div>
        <div>
          <dt>성벽</dt>
          <dd>{summary.wall}</dd>
        </div>
      </dl>

      {(mastered.length > 0 || newDex.length > 0) && (
        <ul className="result-news">
          {mastered.map((tag) => (
            <li key={`m-${tag}`}>'{tag}' 유형을 익혔어요! 오답 노트에서 뺐어요.</li>
          ))}
          {newDex.map((tag) => (
            <li key={`d-${tag}`}>도감에 새 몬스터: {tagInfo(tag).monster}</li>
          ))}
        </ul>
      )}

      <div className="start-buttons">
        {reviewCount > 0 ? (
          <button type="button" className="btn btn-primary btn-large" onClick={onReview}>
            낙서 지우기 ({reviewCount})
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-large" onClick={onRetry}>
            다시 하기
          </button>
        )}
        <button type="button" className="btn btn-large" onClick={onMap}>
          지도로
        </button>
      </div>
    </div>
  );
}
