import { toGaps } from '../judge/judge';
import type { Problem } from '../judge/types';
import { MANA_PER_CORRECT } from '../game/stage';
import type { AnswerResult } from './SentenceCard';
import { SpacingLetters } from './SpacingLetters';

export interface Feedback extends AnswerResult {
  problem: Problem;
}

/** 정답·오답 설명. 떠 있는 동안 게임 전체가 멈춘다(기획서 7.2) */
export function FeedbackOverlay({ feedback, onClose }: { feedback: Feedback; onClose: () => void }) {
  const { problem, correct, spacing } = feedback;
  const studentAnswer = spacing && !correct ? toGaps(spacing.answer) : null;

  return (
    <div className="feedback-backdrop">
      <section className="feedback-card" role="dialog" aria-label={correct ? '정답' : '오답'}>
        <h2 className={`feedback-title ${correct ? 'is-correct' : 'is-wrong'}`}>
          {correct ? '정화 성공!' : '아쉬워요'}
        </h2>

        {studentAnswer && (
          <div className="feedback-block">
            <p className="feedback-label">내가 자른 문장 (빨간 곳을 고쳐야 해요)</p>
            <SpacingLetters
              letters={studentAnswer.letters}
              gaps={studentAnswer.gaps}
              wrongGaps={[...spacing!.result.needSpace, ...spacing!.result.needJoin]}
            />
          </div>
        )}

        <div className="feedback-block">
          <p className="feedback-label">
            {problem.noError ? '이 문장은 고칠 곳이 없어요' : correct ? '바르게 고친 문장' : '바른 문장'}
          </p>
          <p className="feedback-sentence">{problem.correct}</p>
        </div>

        <p className="feedback-explain">{problem.explain}</p>
        {correct && <p className="feedback-mana">마나 +{MANA_PER_CORRECT}</p>}

        <button type="button" className="btn btn-primary btn-large" onClick={onClose}>
          계속하기
        </button>
      </section>
    </div>
  );
}
