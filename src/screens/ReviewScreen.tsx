import { useState } from 'react';
import { FeedbackOverlay, type Feedback } from '../components/FeedbackOverlay';
import { PlaceholderArt } from '../components/PlaceholderArt';
import { SentenceCard, type AnswerResult } from '../components/SentenceCard';
import type { Problem } from '../judge/types';

interface Props {
  /** 스테이지에서 틀리거나 놓친 문제 */
  problems: Problem[];
  onAnswer: (problem: Problem, correct: boolean) => void;
  onDone: () => void;
}

/**
 * 낙서 지우기(복습): 시간 제한 없이 다시 풀기(기획서 6.1).
 * 맞히면 낙서가 하나 지워지고, 틀리면 설명을 본 뒤 맨 뒤로 보내 다시 푼다.
 */
export function ReviewScreen({ problems, onAnswer, onDone }: Props) {
  const [queue, setQueue] = useState(problems);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [attempt, setAttempt] = useState(0); // 같은 문제를 다시 풀 때도 카드를 새로 만든다
  const current = queue[0] ?? null;
  const clean = queue.length === 0 && !feedback;

  const handleResult = (result: AnswerResult) => {
    if (!current) return;
    onAnswer(current, result.correct);
    setFeedback({ ...result, problem: current });
    setQueue((q) => (result.correct ? q.slice(1) : [...q.slice(1), q[0]]));
    setAttempt((n) => n + 1);
  };

  return (
    <div className="review-screen">
      <PlaceholderArt kind="background" />

      <header className="hud">
        <div className="hud-item">낙서 지우기</div>
        <div className="hud-item hud-wave" data-testid="review-left">
          남은 낙서 {queue.length}
        </div>
        <button type="button" className="btn btn-small" onClick={onDone}>
          {clean ? '지도로' : '그만하기'}
        </button>
      </header>

      <div className={`castle-area${clean ? ' is-clean' : ''}`}>
        <div className="defender-spot">
          <PlaceholderArt kind="defender" />
        </div>
        <PlaceholderArt kind="castle" />
        <div className="graffiti-layer" data-testid="graffiti" data-count={queue.length}>
          {queue.map((p) => (
            <PlaceholderArt key={p.id} kind="graffiti" variant={problems.indexOf(p)} />
          ))}
        </div>
      </div>

      {clean ? (
        <section className="sentence-card review-done" aria-label="문장 카드">
          <p className="card-hint card-hint-idle">성벽이 깨끗해졌어요!</p>
          <button type="button" className="btn btn-primary btn-large" onClick={onDone}>
            지도로
          </button>
        </section>
      ) : (
        <SentenceCard key={attempt} problem={current} onResult={handleResult} />
      )}

      {feedback && <FeedbackOverlay feedback={feedback} onClose={() => setFeedback(null)} />}
    </div>
  );
}
