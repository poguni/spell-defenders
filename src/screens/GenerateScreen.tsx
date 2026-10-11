import { useState } from 'react';
import { convertAiProblems, type Rejected } from '../ai/convert';
import { AiError, MODELS, generateProblems } from '../ai/openrouter';
import { TAG_GUIDE } from '../ai/prompt';
import { LEVEL_INFO } from '../game/stages';
import { TAGS, type Level, type Problem } from '../judge/types';
import { loadApiKey, type ProblemSet } from '../storage/teacher';

const COUNTS = [5, 10, 15, 20];
const TOPIC_MAX = 30;

interface Props {
  model: string;
  sets: ProblemSet[];
  /** 새 세트(setId null)나 기존 세트에 문제를 더한다. 저장한 세트 id를 돌려준다 */
  onSave: (setId: string | null, name: string, problems: Problem[]) => string;
  onOpenSet: (setId: string) => void;
  onKeySettings: () => void;
  onBack: () => void;
}

type Result = { problems: Problem[]; rejected: Rejected[] };

/** AI로 문제 만들기(기획서 9.2): 단계·유형·개수·(선택) 소재 → 생성 → 자동 검증 → 세트에 저장 */
export function GenerateScreen({ model, sets, onSave, onOpenSet, onKeySettings, onBack }: Props) {
  const [level, setLevel] = useState<Level>(3);
  const levelTags = (n: Level) => TAGS[n].filter((t) => TAG_GUIDE[t]);
  const [tag, setTag] = useState(levelTags(3)[0]);
  const [count, setCount] = useState(10);
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [target, setTarget] = useState<string | null>(null); // null: 새 세트
  const [name, setName] = useState('');
  const apiKey = loadApiKey();
  const modelName = MODELS.find((m) => m.id === model)?.name ?? model;

  const generate = async () => {
    if (!apiKey) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const list = await generateProblems(apiKey.key, model, { level, tag, count, topic });
      setResult(convertAiProblems(list, { level, tag, kind: TAG_GUIDE[tag].kind }, `AI-${Date.now().toString(36)}`));
      setName(`${level}단계 ${tag}`);
    } catch (e) {
      setError(e instanceof AiError ? e.message : '알 수 없는 오류가 났어요. 잠시 뒤 다시 해 보세요.');
    } finally {
      setLoading(false);
    }
  };

  const save = () => {
    if (!result) return;
    onOpenSet(onSave(target, name.trim() || `${level}단계 ${tag}`, result.problems));
  };

  return (
    <div className="list-screen">
      <header className="screen-header">
        <button type="button" className="btn btn-small" onClick={onBack}>
          교사 메뉴로
        </button>
        <h1 className="screen-title">AI로 문제 만들기</h1>
        <div className="screen-header-spacer" />
      </header>

      <div className="list-body">
        {!apiKey ? (
          <section className="note-section">
            <p className="list-empty">먼저 OpenRouter API 키를 넣어 주세요.</p>
            <button type="button" className="btn btn-primary btn-large" onClick={onKeySettings}>
              API 키·모델 설정
            </button>
          </section>
        ) : (
          <section className="note-section" aria-label="만들 문제">
            <div className="class-setup-row">
              <h2 className="class-setup-label">단계</h2>
              <div className="class-options" role="group" aria-label="단계">
                {([1, 2, 3] as Level[]).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`btn${level === n ? ' is-selected' : ''}`}
                    aria-pressed={level === n}
                    onClick={() => {
                      setLevel(n);
                      setTag(levelTags(n)[0]);
                    }}
                  >
                    {n}단계 {LEVEL_INFO[n].place}
                  </button>
                ))}
              </div>
            </div>
            <div className="class-setup-row">
              <h2 className="class-setup-label">유형</h2>
              <div className="class-options" role="group" aria-label="유형">
                {levelTags(level).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`btn${tag === t ? ' is-selected' : ''}`}
                    aria-pressed={tag === t}
                    onClick={() => setTag(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="class-setup-row">
              <h2 className="class-setup-label">개수</h2>
              <div className="class-options" role="group" aria-label="개수">
                {COUNTS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`btn${count === n ? ' is-selected' : ''}`}
                    aria-pressed={count === n}
                    onClick={() => setCount(n)}
                  >
                    {n}개
                  </button>
                ))}
              </div>
            </div>
            <label className="text-field is-wide">
              <span>소재(안 써도 돼요)</span>
              <input
                type="text"
                maxLength={TOPIC_MAX}
                placeholder="예: 운동회, 급식, 현장 체험 학습"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </label>
            <div className="teacher-row">
              <button type="button" className="btn btn-primary btn-large" disabled={loading} onClick={() => void generate()}>
                {loading ? '만드는 중…' : '만들기'}
              </button>
              <span className="teacher-message">모델: {modelName}</span>
            </div>
            {loading && <p className="teacher-message">1분쯤 걸릴 수 있어요. 이 화면에서 기다려 주세요.</p>}
            {error && (
              <p className="teacher-message is-error" role="alert">
                {error}
              </p>
            )}
          </section>
        )}

        {result && (
          <section className="note-section" aria-label="만든 결과">
            <h2 className="note-tag" data-testid="generate-result">
              통과 {result.problems.length}개 · 제외 {result.rejected.length}개
            </h2>
            {result.rejected.length > 0 && (
              <ul className="note-problems teacher-rejected">
                {result.rejected.map((r, i) => (
                  <li key={i}>
                    <span className="note-wrong">{r.wrong}</span>
                    <span className="note-arrow">제외:</span>
                    {r.reasons.join(', ')}
                  </li>
                ))}
              </ul>
            )}
            {result.problems.length > 0 && (
              <>
                <p className="list-guide">통과한 문제도 아직 학생에게 나오지 않아요. 세트에 저장한 뒤 하나씩 승인해 주세요.</p>
                <div className="teacher-row" role="group" aria-label="저장할 세트">
                  <button
                    type="button"
                    className={`btn${target === null ? ' is-selected' : ''}`}
                    aria-pressed={target === null}
                    onClick={() => setTarget(null)}
                  >
                    새 세트
                  </button>
                  {sets.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`btn${target === s.id ? ' is-selected' : ''}`}
                      aria-pressed={target === s.id}
                      onClick={() => setTarget(s.id)}
                    >
                      {s.name}에 더하기
                    </button>
                  ))}
                </div>
                {target === null && (
                  <label className="text-field is-wide">
                    <span>세트 이름</span>
                    <input type="text" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
                  </label>
                )}
                <button type="button" className="btn btn-primary btn-large" onClick={save}>
                  세트에 저장하고 승인하러 가기
                </button>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
