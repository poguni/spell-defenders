import { useState } from 'react';
import { FeedbackOverlay, type Feedback } from '../components/FeedbackOverlay';
import { MonsterArt } from '../components/GameArt';
import { SentenceCard, type AnswerResult } from '../components/SentenceCard';
import { SoundButton } from '../components/SoundButton';
import { tagInfo } from '../data/tagInfo';
import { playSound } from '../game/sound';
import type { Problem } from '../judge/types';

interface Props {
  problems: Problem[];
  soundOn: boolean;
  onToggleSound: () => void;
  onAgain: () => void;
  onSetup: () => void;
  onHome: () => void;
}

/**
 * 학급 수비전(기획서 5.2): 전자칠판에 몬스터가 한 마리씩 크게 나온다.
 * 시간 제한 없이 교사가 학생들이 발표한 답을 골라 진행한다. 기록은 저장하지 않고 학급 점수만 보여 준다.
 */
export function ClassBattleScreen({ problems, soundOn, onToggleSound, onAgain, onSetup, onHome }: Props) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [done, setDone] = useState(false);

  const current = problems[index];
  const isLast = index === problems.length - 1;

  const handleResult = (result: AnswerResult) => {
    if (result.correct) setScore((s) => s + 1);
    setAnswered((n) => n + 1);
    setFeedback({ ...result, problem: current });
    playSound(result.correct ? 'correct' : 'wrong');
  };

  const next = () => {
    setFeedback(null);
    if (isLast) setDone(true);
    else setIndex((i) => i + 1);
  };

  if (done) {
    return (
      <div className="result-screen class-screen">
        <h1 className="result-title">학급 수비 끝!</h1>
        <dl className="result-numbers">
          <div>
            <dt>학급 점수</dt>
            <dd data-testid="class-result">
              {score} / {answered}
            </dd>
          </div>
        </dl>
        <p className="class-result-note">맞힌 몬스터 / 나온 몬스터</p>
        <div className="start-buttons">
          <button type="button" className="btn btn-primary btn-large" onClick={onAgain}>
            한 판 더
          </button>
          <button type="button" className="btn btn-large" onClick={onSetup}>
            유형 다시 고르기
          </button>
          <button type="button" className="btn btn-large" onClick={onHome}>
            처음으로
          </button>
        </div>
      </div>
    );
  }

  const info = tagInfo(current.tag);

  return (
    <div className="class-screen class-battle">
      <header className="hud">
        <div className="hud-item">학급 수비전</div>
        <div className="hud-item hud-wave">
          몬스터 {index + 1} / {problems.length}
        </div>
        <div className="hud-item">
          <span className="hud-label">학급 점수</span>
          <span className="hud-value" data-testid="class-score">
            {score}
          </span>
        </div>
        <div className="speed-buttons">
          <SoundButton on={soundOn} onToggle={onToggleSound} />
          <button type="button" className="btn btn-small" onClick={() => setDone(true)}>
            그만하기
          </button>
        </div>
      </header>

      <div className="class-monster">
        <MonsterArt level={current.level} tag={current.tag} purified={feedback?.correct ?? false} />
        <div>
          <p className="class-monster-name">{info.monster}</p>
          <p className="class-monster-tag">{current.tag}</p>
        </div>
      </div>

      <SentenceCard key={index} problem={current} onResult={handleResult} />

      {feedback && (
        <FeedbackOverlay
          feedback={feedback}
          reward="학급 점수 +1"
          closeLabel={isLast ? '결과 보기' : '다음 몬스터'}
          onClose={next}
        />
      )}
    </div>
  );
}
