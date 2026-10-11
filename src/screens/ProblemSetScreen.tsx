import { useState, type ChangeEvent } from 'react';
import { buildProblem, type ProblemDraft } from '../ai/convert';
import type { Problem } from '../judge/types';
import type { ProblemSet } from '../storage/teacher';

const KIND_NAMES = { spelling: '맞춤법', spacing: '띄어쓰기', punctuation: '문장 부호' };

interface Props {
  set: ProblemSet;
  onChange: (problems: Problem[]) => void;
  onBack: () => void;
}

/** 승인 화면(기획서 9.2): 문제마다 승인 / 수정 / 삭제. 승인한 문제만 출제 대상 */
export function ProblemSetScreen({ set, onChange, onBack }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const approved = set.problems.filter((p) => p.reviewed).length;

  const replace = (problem: Problem) => onChange(set.problems.map((p) => (p.id === problem.id ? problem : p)));

  return (
    <div className="list-screen">
      <header className="screen-header">
        <button type="button" className="btn btn-small" onClick={onBack}>
          교사 메뉴로
        </button>
        <h1 className="screen-title">{set.name}</h1>
        <div className="screen-header-spacer" />
      </header>

      <div className="list-body">
        <p className="list-guide" data-testid="set-summary">
          문제 {set.problems.length}개 · 승인 {approved}개. 문장, 정답, 설명이 맞는지 하나씩 확인하고 승인해 주세요.
        </p>
        {set.problems.length === 0 && <p className="list-empty">문제가 없어요.</p>}

        {set.problems.map((p) =>
          editing === p.id ? (
            <ProblemEditor
              key={p.id}
              problem={p}
              onSave={(problem) => {
                replace(problem);
                setEditing(null);
              }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <section key={p.id} className="note-section" aria-label={`문제 ${p.wrong}`} data-problem-id={p.id}>
              <div className="note-head">
                <span className="note-streak">
                  {p.tag} · {p.noError ? '고칠 곳 없음' : KIND_NAMES[p.kind]} · {p.source === 'teacher' ? '교사 수정' : 'AI'}
                </span>
                <span className={`teacher-badge${p.reviewed ? ' is-approved' : ''}`}>
                  {p.reviewed ? '승인됨' : '승인 전'}
                </span>
              </div>
              <p className="teacher-sentence">
                {p.noError ? (
                  <span className="note-correct">{p.wrong}</span>
                ) : (
                  <>
                    <span className="note-wrong">{p.wrong}</span>
                    <span className="note-arrow">→</span>
                    <span className="note-correct">{p.correct}</span>
                  </>
                )}
              </p>
              {p.choices && <p className="teacher-message">보기: {p.choices.join(', ')}</p>}
              <p className="rule-card">{p.explain}</p>
              <p className="teacher-message">근거: {p.rule}</p>
              <div className="teacher-row">
                {p.reviewed ? (
                  <button type="button" className="btn" onClick={() => replace({ ...p, reviewed: false })}>
                    승인 취소
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={() => replace({ ...p, reviewed: true })}>
                    승인
                  </button>
                )}
                <button type="button" className="btn" onClick={() => setEditing(p.id)}>
                  수정
                </button>
                {deleting === p.id ? (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => onChange(set.problems.filter((q) => q.id !== p.id))}
                  >
                    정말 삭제
                  </button>
                ) : (
                  <button type="button" className="btn" onClick={() => setDeleting(p.id)}>
                    삭제
                  </button>
                )}
              </div>
            </section>
          ),
        )}
      </div>
    </div>
  );
}

/** 문제 고치기. 고친 문제는 source "teacher"가 되고, 자동 검증을 통과하면 승인된다 */
function ProblemEditor({
  problem,
  onSave,
  onCancel,
}: {
  problem: Problem;
  onSave: (problem: Problem) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ProblemDraft>({
    wrong: problem.wrong,
    correct: problem.correct,
    wrongText: problem.target?.wrongText ?? null,
    choices: problem.choices ?? null,
    explain: problem.explain,
    rule: problem.rule,
  });
  const [errors, setErrors] = useState<string[]>([]);
  const hasTarget = !problem.noError && problem.kind !== 'spacing';
  const set = (field: keyof ProblemDraft) => (e: ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [field]: e.target.value }));

  const save = () => {
    const built = buildProblem({ ...problem, noError: Boolean(problem.noError), source: 'teacher' }, draft);
    if (Array.isArray(built)) setErrors(built);
    else onSave({ ...built, reviewed: true });
  };

  return (
    <section className="note-section teacher-editor" aria-label="문제 고치기">
      <label className="text-field is-wide">
        <span>{problem.noError ? '문장' : '틀린 문장'}</span>
        <input type="text" value={draft.wrong} onChange={set('wrong')} />
      </label>
      {!problem.noError && (
        <label className="text-field is-wide">
          <span>바른 문장</span>
          <input type="text" value={draft.correct} onChange={set('correct')} />
        </label>
      )}
      {hasTarget && (
        <>
          <label className="text-field is-wide">
            <span>틀린 부분</span>
            <input type="text" value={draft.wrongText ?? ''} onChange={set('wrongText')} />
          </label>
          <div className="teacher-row">
            {(draft.choices ?? ['', '', '']).map((choice, i) => (
              <label key={i} className="text-field">
                <span>{i === 0 ? '보기(정답)' : `보기 ${i + 1}`}</span>
                <input
                  type="text"
                  value={choice}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      choices: (d.choices ?? ['', '', '']).map((c, j) => (j === i ? e.target.value : c)),
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </>
      )}
      <label className="text-field is-wide">
        <span>설명</span>
        <input type="text" value={draft.explain} onChange={set('explain')} />
      </label>
      <label className="text-field is-wide">
        <span>근거</span>
        <input type="text" value={draft.rule} onChange={set('rule')} />
      </label>
      {errors.length > 0 && (
        <ul className="teacher-message is-error" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="teacher-row">
        <button type="button" className="btn btn-primary" onClick={save}>
          고쳐서 승인
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          취소
        </button>
      </div>
    </section>
  );
}
