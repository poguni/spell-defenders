import { useState } from 'react';
import { fromGaps, judgeFix, judgeNoError, judgeSpacing, judgeTap, toGaps, type SpacingResult } from '../judge/judge';
import type { Problem } from '../judge/types';
import { shuffle } from '../game/stage';
import { SpacingLetters } from './SpacingLetters';

export interface AnswerResult {
  correct: boolean;
  /** 띄어쓰기 문제: 학생이 자른 문장과 판정 결과 */
  spacing?: { answer: string; result: SpacingResult };
}

interface CardProps {
  problem: Problem;
  onResult: (result: AnswerResult) => void;
}

/** 아래쪽 문장 카드. 몬스터를 고르기 전에는 안내만 보여 준다 */
export function SentenceCard({ problem, onResult }: { problem: Problem | null; onResult: CardProps['onResult'] }) {
  if (!problem) {
    return (
      <section className="sentence-card" aria-label="문장 카드">
        <p className="card-hint card-hint-idle">다가오는 몬스터를 눌러 문장을 고쳐 주세요.</p>
      </section>
    );
  }
  return problem.kind === 'spacing' ? (
    <SpacingCard key={problem.id} problem={problem} onResult={onResult} />
  ) : (
    <FixCard key={problem.id} problem={problem} onResult={onResult} />
  );
}

function splitWords(sentence: string) {
  const words: { text: string; start: number; end: number }[] = [];
  let start = 0;
  for (const text of sentence.split(' ')) {
    words.push({ text, start, end: start + text.length });
    start += text.length + 1;
  }
  return words;
}

/**
 * 맞춤법·문장 부호(기획서 7.4)
 * - 1단계와 문장 부호: 틀린 곳이 표시된 채로 보기 고르기
 * - 2·3단계: 틀린 낱말을 찾아 누르기 → 보기 고르기. 엉뚱한 곳은 한 번 더 기회
 * - 3단계: "고칠 곳 없음" 버튼
 */
function FixCard({ problem, onResult }: CardProps) {
  const markedFromStart = problem.level === 1 || problem.kind === 'punctuation';
  const [phase, setPhase] = useState<'find' | 'choose'>(markedFromStart ? 'choose' : 'find');
  const [missedTap, setMissedTap] = useState(false);
  const [choices] = useState(() => shuffle(problem.choices ?? []));

  const tapWord = (start: number, end: number) => {
    if (judgeTap(problem, start, end)) setPhase('choose');
    else if (!missedTap) setMissedTap(true);
    else onResult({ correct: false });
  };

  if (phase === 'find') {
    return (
      <section className="sentence-card card-row" aria-label="문장 카드" data-problem-id={problem.id}>
        <div className="card-main">
          <p className={`card-hint${missedTap ? ' is-warning' : ''}`}>
            {missedTap ? '여기는 맞게 썼어요. 다시 찾아보세요.' : '틀린 낱말을 찾아 눌러 주세요.'}
          </p>
          <div className="word-buttons">
            {splitWords(problem.wrong).map((w) => (
              <button key={w.start} type="button" className="btn btn-word" onClick={() => tapWord(w.start, w.end)}>
                {w.text}
              </button>
            ))}
          </div>
        </div>
        {problem.level === 3 && (
          <button
            type="button"
            className="btn btn-choice btn-none"
            onClick={() => onResult({ correct: judgeNoError(problem) })}
          >
            고칠 곳 없음
          </button>
        )}
      </section>
    );
  }

  const target = problem.target!;
  const before = problem.wrong.slice(0, target.start);
  const after = problem.wrong.slice(target.start + target.wrongText.length);
  const isPunctuation = problem.kind === 'punctuation';

  return (
    <section className="sentence-card" aria-label="문장 카드" data-problem-id={problem.id}>
      <p className="card-hint">{isPunctuation ? '빈칸에 알맞은 문장 부호를 골라 주세요.' : '바르게 고친 말을 골라 주세요.'}</p>
      <p className="sentence-text">
        {before}
        <mark className={`sentence-target${isPunctuation ? ' is-blank' : ''}`}>
          {isPunctuation ? '　' : target.wrongText}
        </mark>
        {after}
      </p>
      <div className="choice-buttons">
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            className="btn btn-choice"
            onClick={() => onResult({ correct: judgeFix(problem, choice) })}
          >
            {choice}
          </button>
        ))}
      </div>
    </section>
  );
}

/** 띄어쓰기 칼: 글자 사이를 눌러 띄움/붙임을 바꾸고 "자르기"로 확인(기획서 6.1) */
function SpacingCard({ problem, onResult }: CardProps) {
  const [{ letters, gaps: firstGaps }] = useState(() => toGaps(problem.wrong));
  const [gaps, setGaps] = useState(firstGaps);

  const toggle = (index: number) => setGaps((g) => g.map((spaced, i) => (i === index ? !spaced : spaced)));
  const cut = () => {
    const answer = fromGaps(letters, gaps);
    const result = judgeSpacing(problem, answer);
    onResult({ correct: result.correct, spacing: { answer, result } });
  };

  return (
    <section className="sentence-card card-row" aria-label="문장 카드" data-problem-id={problem.id}>
      <div className="card-main">
        <p className="card-hint">글자 사이를 눌러 띄우거나 붙인 뒤 '자르기'를 눌러 주세요.</p>
        <SpacingLetters letters={letters} gaps={gaps} onToggle={toggle} />
      </div>
      <button type="button" className="btn btn-choice btn-primary" onClick={cut}>
        자르기
      </button>
    </section>
  );
}
