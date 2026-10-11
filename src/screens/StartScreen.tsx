import { useEffect, useState } from 'react';

interface Props {
  nickname: string | null;
  onStart: () => void;
  onClassMode: () => void;
  onTeacher: () => void;
  /** 선생님이 보낸 문제 파일 */
  onImportFile: (text: string) => void;
  /** 내 기록(저장하기·불러오기·지우기) */
  onRecord: () => void;
}

export function StartScreen({ nickname, onStart, onClassMode, onTeacher, onImportFile, onRecord }: Props) {
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
      {/* 제목은 배경 그림에 들어 있다. 글자 제목은 화면 읽기용으로만 남긴다 */}
      <img className="start-bg" src={`${import.meta.env.BASE_URL}assets/backgrounds/bg-start.webp`} alt="" />
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
        <label className="btn btn-small file-button">
          문제 파일 불러오기
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void file.text().then(onImportFile);
            }}
          />
        </label>
        <button type="button" className="btn btn-small" onClick={onRecord}>
          내 기록
        </button>
      </div>
    </div>
  );
}
