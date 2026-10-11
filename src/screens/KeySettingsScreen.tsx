import { useState } from 'react';
import { AiError, MODELS, checkKey } from '../ai/openrouter';
import { clearApiKey, loadApiKey, saveApiKey } from '../storage/teacher';

interface Props {
  model: string;
  onModel: (model: string) => void;
  onBack: () => void;
}

/**
 * API 키 입력과 모델 선택(기획서 10.4, 11장).
 * 키는 화면에 다시 보여 주지 않는다. 기본은 이번 접속에서만 기억하고, "이 기기에 저장"을 고를 때만 남긴다.
 */
export function KeySettingsScreen({ model, onModel, onBack }: Props) {
  const [stored, setStored] = useState(loadApiKey);
  const [input, setInput] = useState('');
  const [remember, setRemember] = useState(false);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const isCustom = !MODELS.some((m) => m.id === model);
  const [custom, setCustom] = useState(isCustom ? model : '');

  const save = () => {
    const key = input.trim();
    if (!key) return;
    saveApiKey(key, remember);
    setStored(loadApiKey());
    setInput('');
    setStatus({ text: '키를 저장했어요. "연결 확인"을 눌러 확인해 보세요.' });
  };

  const clear = () => {
    clearApiKey();
    setStored(null);
    setStatus({ text: '키를 지웠어요.' });
  };

  const check = async () => {
    if (!stored) return;
    setChecking(true);
    setStatus({ text: '확인하는 중이에요…' });
    try {
      const info = await checkKey(stored.key);
      setStatus({
        text:
          info.limit === null
            ? '연결됐어요. 이 키에는 사용 한도가 없어요. OpenRouter에서 한도를 걸어 두세요.'
            : `연결됐어요. 사용 한도 $${info.limit.toFixed(2)} 가운데 $${(info.remaining ?? 0).toFixed(2)} 남았어요.`,
      });
    } catch (e) {
      setStatus({ text: e instanceof AiError ? e.message : '알 수 없는 오류가 났어요.', error: true });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="list-screen">
      <header className="screen-header">
        <button type="button" className="btn btn-small" onClick={onBack}>
          교사 메뉴로
        </button>
        <h1 className="screen-title">API 키·모델 설정</h1>
        <div className="screen-header-spacer" />
      </header>

      <div className="list-body">
        <section className="note-section" aria-label="API 키">
          <h2 className="note-tag">OpenRouter API 키</h2>
          <p className="rule-card">
            openrouter.ai의 Keys 메뉴에서 이 앱에만 쓸 키를 만들고, 사용 한도(Credit limit)를 꼭 걸어 두세요(예:
            5달러). 키는 OpenRouter로만 보내고, 다른 곳으로 보내지 않아요.
          </p>
          <p className="teacher-message" data-testid="key-state">
            {stored
              ? `저장된 키가 있어요(${stored.remember ? '이 기기에 저장' : '이번 접속에서만 기억'}).`
              : '저장된 키가 없어요.'}
          </p>
          <label className="text-field is-wide">
            <span>{stored ? '새 키' : '키'}</span>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-or-로 시작하는 키를 붙여 넣기"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </label>
          <label className="check-field">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>이 기기에 저장(공용 기기에서는 고르지 마세요. 안 고르면 브라우저를 닫을 때 지워져요)</span>
          </label>
          <div className="teacher-row">
            <button type="button" className="btn btn-primary" disabled={!input.trim()} onClick={save}>
              키 저장
            </button>
            <button type="button" className="btn" disabled={!stored || checking} onClick={() => void check()}>
              연결 확인
            </button>
            <button type="button" className="btn btn-danger" disabled={!stored} onClick={clear}>
              키 지우기
            </button>
          </div>
          {status && (
            <p className={`teacher-message${status.error ? ' is-error' : ''}`} role="status">
              {status.text}
            </p>
          )}
        </section>

        <section className="note-section" aria-label="모델">
          <h2 className="note-tag">모델</h2>
          <div className="teacher-row" role="group" aria-label="모델 고르기">
            {MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`btn${model === m.id ? ' is-selected' : ''}`}
                aria-pressed={model === m.id}
                onClick={() => onModel(m.id)}
              >
                {m.name} ({m.note})
              </button>
            ))}
          </div>
          <div className="teacher-row">
            <label className="text-field is-wide">
              <span>모델 ID 직접 입력</span>
              <input
                type="text"
                spellCheck={false}
                placeholder="예: anthropic/claude-sonnet-5.5"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            </label>
            <button
              type="button"
              className={`btn${isCustom ? ' is-selected' : ''}`}
              disabled={!custom.trim()}
              onClick={() => onModel(custom.trim())}
            >
              이 모델 쓰기
            </button>
          </div>
          <p className="list-guide" data-testid="model-state">
            지금 쓰는 모델: {model}
          </p>
        </section>
      </div>
    </div>
  );
}
