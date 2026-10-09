import { useEffect, useState } from 'react';

export function StartScreen({ onStart }: { onStart: () => void }) {
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));

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

  return (
    <div className="start-screen">
      <h1 className="start-title">맞춤법 수비대</h1>
      <p className="start-subtitle">오타 몬스터를 바르게 고쳐 성을 지켜요</p>
      <div className="start-buttons">
        <button type="button" className="btn btn-primary btn-large" onClick={onStart}>
          시작하기
        </button>
        {document.fullscreenEnabled && (
          <button type="button" className="btn btn-large" onClick={toggleFullscreen}>
            {isFullscreen ? '전체 화면 끝내기' : '전체 화면'}
          </button>
        )}
      </div>
    </div>
  );
}
