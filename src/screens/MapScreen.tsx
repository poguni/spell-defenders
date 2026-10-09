import { LEVEL_INFO, type StageDef } from '../game/stages';
import type { Level } from '../judge/types';

export interface MapStage {
  stage: StageDef;
  stars: number;
  unlocked: boolean;
  /** 낼 문제가 있는지 */
  ready: boolean;
}

interface Props {
  level: Level;
  stages: MapStage[];
  noteCount: number;
  onPlay: (stageId: string) => void;
  onNotes: () => void;
  onDex: () => void;
  onChangeLevel: () => void;
  onHome: () => void;
}

/** 단계별 스테이지 지도(기획서 7.3): 별 기록, 앞 스테이지를 끝내면 다음이 열린다 */
export function MapScreen({ level, stages, noteCount, onPlay, onNotes, onDex, onChangeLevel, onHome }: Props) {
  return (
    <div className={`map-screen map-level-${level}`}>
      <header className="screen-header">
        <button type="button" className="btn btn-small" onClick={onHome}>
          처음으로
        </button>
        <h1 className="screen-title">
          {level}단계 {LEVEL_INFO[level].place}
        </h1>
        <button type="button" className="btn btn-small" onClick={onChangeLevel}>
          단계 바꾸기
        </button>
      </header>

      <ol className="map-stages">
        {stages.map(({ stage, stars, unlocked, ready }) => {
          const playable = unlocked && ready;
          return (
            <li key={stage.id}>
              <button
                type="button"
                className={`map-stage${playable ? '' : ' is-locked'}`}
                disabled={!playable}
                onClick={() => onPlay(stage.id)}
              >
                <span className="map-stage-number">스테이지 {stage.number}</span>
                <span className="map-stars" role="img" aria-label={`별 ${stars}개`}>
                  {[1, 2, 3].map((n) => (
                    <span key={n} className={`star star-small${n <= stars ? ' is-on' : ''}`} />
                  ))}
                </span>
                <span className="map-stage-tags">
                  {!ready ? '준비 중' : !unlocked ? '앞 스테이지를 끝내면 열려요' : (stage.tags?.join('\n') ?? '모두 섞기')}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="start-buttons">
        <button type="button" className="btn btn-large" onClick={onNotes}>
          오답 노트 {noteCount > 0 ? `(${noteCount})` : ''}
        </button>
        <button type="button" className="btn btn-large" onClick={onDex}>
          몬스터 도감
        </button>
      </div>
    </div>
  );
}
