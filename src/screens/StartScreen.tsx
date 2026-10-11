import { useEffect, useState } from 'react';

interface Props {
  nickname: string | null;
  onStart: () => void;
  onClassMode: () => void;
  onTeacher: () => void;
  onClearRecords: () => void;
}

export function StartScreen({ nickname, onStart, onClassMode, onTeacher, onClearRecords }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [confirming, setConfirming] = useState(false);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  };

  const clear = () => {
    onClearRecords();
    setConfirming(false);
    setCleared(true);
  };

  return (
    <div className="start-screen">
      <h1 className="start-title">맞춤법 수비대</h1>
      <p className="start-subtitle">
        {nickname ? `${nickname} 수비대원, 어서 와요!` : '오타 몬스터를 바르게 고쳐 성을 지켜요'}
      </p>
      <div className="start-buttons">
        <button type="button" className="btn btn-primary btn-large" onClick={onStart}>
          시작하기
        </button>
        <button type="button" className="btn btn-large" onClick={onClassMode}>
          학급 수비전
        </button>
        {document.fullscreenEnabled && (
          <button type="button" className="btn btn-large" onClick={toggleFullscreen}>
            {isFullscreen ? '전체 화면 끝내기' : '전체 화면'}
          </button>
        )}
      </div>

      <div className="start-footer">
        <button type="button" className="btn btn-small" onClick={onTeacher}>
          교사 메뉴
        </button>
        {cleared ? (
          <p className="start-note">기록을 모두 지웠어요.</p>
        ) : (
          <button type="button" className="btn btn-small" onClick={() => setConfirming(true)}>
            내 기록 지우기
          </button>
        )}
      </div>

      {confirming && (
        <div className="feedback-backdrop">
          <section className="feedback-card" role="dialog" aria-label="내 기록 지우기">
            <h2 className="feedback-title is-wrong">내 기록을 지울까요?</h2>
            <p className="feedback-explain">
              이 기기에 저장된 별, 오답 노트, 몬스터 도감, 닉네임이 모두 지워지고 되돌릴 수 없어요.
            </p>
            <div className="start-buttons">
              <button type="button" className="btn btn-large btn-danger" onClick={clear}>
                지우기
              </button>
              <button type="button" className="btn btn-large" onClick={() => setConfirming(false)}>
                그만두기
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
