import { useState } from 'react';
import { hashPin } from '../storage/teacher';

interface Props {
  /** 없으면 PIN을 처음 정한다 */
  pinHash: string | null;
  onSetPin: (pinHash: string) => void;
  onUnlock: () => void;
  /** PIN을 잊었을 때: 교사 메뉴 초기화 */
  onReset: () => void;
  onBack: () => void;
}

const PIN_PATTERN = /^\d{4,8}$/;

/** 교사 메뉴 PIN(기획서 11장). 기기 안에 저장되는 가림 장치일 뿐이라는 것을 안내한다 */
export function TeacherGateScreen({ pinHash, onSetPin, onUnlock, onReset, onBack }: Props) {
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [message, setMessage] = useState('');
  const [confirmingReset, setConfirmingReset] = useState(false);
  const isNew = pinHash === null;

  const submit = async () => {
    if (!PIN_PATTERN.test(pin)) return setMessage('PIN은 숫자 4~8자리로 써 주세요.');
    if (isNew) {
      if (pin !== again) return setMessage('두 번 쓴 PIN이 서로 달라요.');
      onSetPin(await hashPin(pin));
      onUnlock();
    } else if ((await hashPin(pin)) === pinHash) {
      onUnlock();
    } else {
      setPin('');
      setMessage('PIN이 맞지 않아요.');
    }
  };

  return (
    <div className="list-screen">
      <header className="screen-header">
        <button type="button" className="btn btn-small" onClick={onBack}>
          처음으로
        </button>
        <h1 className="screen-title">{isNew ? '교사 메뉴 PIN 정하기' : '교사 메뉴'}</h1>
        <div className="screen-header-spacer" />
      </header>

      <form
        className="teacher-body teacher-gate"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="text-field">
          <span>{isNew ? '새 PIN (숫자 4~8자리)' : 'PIN'}</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
        </label>
        {isNew && (
          <label className="text-field">
            <span>PIN 한 번 더</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={again}
              onChange={(e) => setAgain(e.target.value)}
            />
          </label>
        )}
        {message && <p className="teacher-message is-error">{message}</p>}
        <button type="submit" className="btn btn-primary btn-large">
          {isNew ? 'PIN 정하고 들어가기' : '들어가기'}
        </button>
        <p className="list-guide">
          PIN은 학생이 실수로 교사 메뉴에 들어오는 것을 막는 정도의 장치예요. 이 기기 안에 저장되므로 비밀번호처럼
          안전하지는 않아요.
        </p>
        {!isNew && (
          <button type="button" className="btn btn-small" onClick={() => setConfirmingReset(true)}>
            PIN을 잊었어요
          </button>
        )}
      </form>

      {confirmingReset && (
        <div className="feedback-backdrop">
          <section className="feedback-card" role="dialog" aria-label="교사 메뉴 초기화">
            <h2 className="feedback-title is-wrong">교사 메뉴를 초기화할까요?</h2>
            <p className="feedback-explain">
              PIN, 저장한 API 키, 이 기기의 문제 세트가 모두 지워지고 되돌릴 수 없어요. 학생 기록은 그대로예요.
            </p>
            <div className="start-buttons">
              <button
                type="button"
                className="btn btn-large btn-danger"
                onClick={() => {
                  onReset();
                  setConfirmingReset(false);
                  setPin('');
                  setMessage('');
                }}
              >
                초기화
              </button>
              <button type="button" className="btn btn-large" onClick={() => setConfirmingReset(false)}>
                그만두기
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
