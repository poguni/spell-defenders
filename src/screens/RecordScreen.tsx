import { useState } from 'react';
import { MASTERY_STREAK } from '../game/progress';
import { LEVEL_INFO, type StageDef } from '../game/stages';
import type { Level } from '../judge/types';
import { downloadText } from '../share/download';
import { exportRecord, importRecord, recordFileName, summarizeRecord } from '../storage/recordFile';
import type { SaveData } from '../storage/save';

/** 성적표에 보여 줄 단계와 유형(문제가 있는 것만) */
export interface ReportScope {
  levels: { level: Level; stages: StageDef[] }[];
  /** 문제가 있는 유형 태그(단계 순서). 도감 전체 수와 익힌 유형 순서에 쓴다 */
  tags: string[];
}

interface Props {
  save: SaveData;
  scope: ReportScope;
  /** 불러온 기록으로 지금 기록을 바꾼다 */
  onReplace: (save: SaveData) => void;
  onClear: () => void;
  onHome: () => void;
}

type Dialog = { name: 'import'; save: SaveData } | { name: 'clear' } | null;

/** 기록 요약 한 덩어리(지금 기록, 파일 기록에 함께 쓴다) */
function RecordSummaryList({ save }: { save: SaveData }) {
  const s = summarizeRecord(save);
  return (
    <dl className="record-summary">
      <div>
        <dt>닉네임</dt>
        <dd>{s.nickname ?? '없음'}</dd>
      </div>
      <div>
        <dt>모은 별</dt>
        <dd>
          {s.stars}개 <span className="record-sub">(스테이지 {s.stages}곳)</span>
        </dd>
      </div>
      <div>
        <dt>몬스터 도감</dt>
        <dd>{s.dex}마리</dd>
      </div>
      <div>
        <dt>오답 노트</dt>
        <dd>{s.notes}문제</dd>
      </div>
    </dl>
  );
}

function Stars({ count }: { count: number }) {
  return (
    <span className="map-stars report-stars" role="img" aria-label={`별 ${count}개`}>
      {[1, 2, 3].map((n) => (
        <span key={n} className={`star report-star${n <= count ? ' is-on' : ''}`} />
      ))}
    </span>
  );
}

/** 성적표: 화면 캡처 한 장으로 선생님께 보여 줄 수 있게 한 화면에 모은다(기획서 6.2) */
function ReportCard({ save, scope }: { save: SaveData; scope: ReportScope }) {
  const s = summarizeRecord(save);
  const mastered = scope.tags.filter((tag) => (save.tagStreaks[tag] ?? 0) >= MASTERY_STREAK);
  const found = scope.tags.filter((tag) => save.dex.includes(tag)).length;
  const today = new Date();
  return (
    <section className="report-card" aria-label="성적표">
      <header className="report-head">
        <h2 className="report-title">{s.nickname ? `${s.nickname} 수비대원 성적표` : '수비대원 성적표'}</h2>
        <p className="report-date">
          {today.getFullYear()}년 {today.getMonth() + 1}월 {today.getDate()}일
        </p>
      </header>

      <table className="report-table">
        <tbody>
          {scope.levels.map(({ level, stages }) => (
            <tr key={level}>
              <th scope="row">
                {level}단계 {LEVEL_INFO[level].place}
              </th>
              {stages.map((stage) => (
                <td key={stage.id} data-stage={stage.id}>
                  <span className="report-stage">{stage.tags ? `스테이지 ${stage.number}` : '모두 섞기'}</span>
                  <Stars count={save.stars[stage.id] ?? 0} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="report-mastered">
        <span className="report-label">익힌 유형 {mastered.length}개</span>
        {mastered.length > 0 ? (
          <ul className="report-tags">
            {mastered.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        ) : (
          <span className="report-empty">같은 유형을 3번 연속 맞히면 여기에 나와요.</span>
        )}
      </div>

      <dl className="report-numbers">
        <div>
          <dt>모은 별</dt>
          <dd>{s.stars}개</dd>
        </div>
        <div>
          <dt>몬스터 도감</dt>
          <dd>
            {found} / {scope.tags.length}
          </dd>
        </div>
        <div>
          <dt>오답 노트</dt>
          <dd>{s.notes}문제</dd>
        </div>
      </dl>
    </section>
  );
}

/**
 * 내 기록: 기록을 파일로 저장하기·불러오기·지우기(docs/기록 내보내기·불러오기 개발 계획.md M15).
 * 기록은 이 기기의 브라우저에만 있으므로, 파일로 저장해 두면 기기가 바뀌거나 기록이 지워져도 되살릴 수 있다.
 */
export function RecordScreen({ save, scope, onReplace, onClear, onHome }: Props) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const saveFile = () => {
    downloadText(recordFileName(save), exportRecord(save));
    setMessage({ text: "기록 파일을 '다운로드' 폴더에 저장했어요." });
  };

  const openFile = (text: string) => {
    const result = importRecord(text);
    if (result.ok) {
      setMessage(null);
      setDialog({ name: 'import', save: result.save });
    } else {
      setMessage({ text: result.message, error: true });
    }
  };

  const clear = (saveFirst: boolean) => {
    if (saveFirst) downloadText(recordFileName(save), exportRecord(save));
    onClear();
    setDialog(null);
    setMessage({ text: saveFirst ? '기록을 파일로 저장한 뒤 지웠어요.' : '기록을 모두 지웠어요.' });
  };

  return (
    <div className="list-screen record-screen">
      <header className="screen-header">
        <button type="button" className="btn btn-small" onClick={onHome}>
          처음으로
        </button>
        <h1 className="screen-title">내 기록</h1>
        <div className="screen-header-spacer" />
      </header>

      <div className="record-body">
        <ReportCard save={save} scope={scope} />
        <p className="list-guide">기록은 이 기기에만 있어요. 파일로 저장해 두면 다른 기기에서도 이어서 할 수 있어요.</p>

        <div className="record-buttons">
          <button type="button" className="btn btn-primary btn-large" onClick={saveFile}>
            내 기록 저장하기
          </button>
          <label className="btn btn-large file-button">
            내 기록 불러오기
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void file.text().then(openFile);
              }}
            />
          </label>
          <button type="button" className="btn btn-large" onClick={() => setDialog({ name: 'clear' })}>
            내 기록 지우기
          </button>
        </div>

        {message && (
          <p className={`record-message${message.error ? ' is-error' : ''}`} role="status">
            {message.text}
          </p>
        )}
      </div>

      {dialog?.name === 'import' && (
        <div className="feedback-backdrop">
          <section className="feedback-card record-dialog" role="dialog" aria-label="내 기록 불러오기">
            <h2 className="feedback-title">이 기록으로 바꿀까요?</h2>
            <div className="record-compare">
              <div>
                <h3 className="record-compare-title">지금 기록</h3>
                <RecordSummaryList save={save} />
              </div>
              <div>
                <h3 className="record-compare-title">파일 기록</h3>
                <RecordSummaryList save={dialog.save} />
              </div>
            </div>
            <p className="feedback-explain">지금 기록은 파일 기록으로 바뀌고, 되돌릴 수 없어요.</p>
            <div className="record-buttons">
              <button
                type="button"
                className="btn btn-primary btn-large"
                onClick={() => {
                  onReplace(dialog.save);
                  setDialog(null);
                  setMessage({ text: '기록을 불러왔어요.' });
                }}
              >
                이 기록으로 바꾸기
              </button>
              <button type="button" className="btn btn-large" onClick={() => setDialog(null)}>
                그만두기
              </button>
            </div>
          </section>
        </div>
      )}

      {dialog?.name === 'clear' && (
        <div className="feedback-backdrop">
          <section className="feedback-card record-dialog" role="dialog" aria-label="내 기록 지우기">
            <h2 className="feedback-title is-wrong">내 기록을 지울까요?</h2>
            <p className="feedback-explain">
              이 기기에 저장된 별, 오답 노트, 몬스터 도감, 닉네임이 모두 지워지고 되돌릴 수 없어요. 먼저 파일로 저장해
              두면 나중에 불러올 수 있어요.
            </p>
            <div className="record-buttons">
              <button type="button" className="btn btn-primary btn-large" onClick={() => clear(true)}>
                저장하고 지우기
              </button>
              <button type="button" className="btn btn-large btn-danger" onClick={() => clear(false)}>
                지우기
              </button>
              <button type="button" className="btn btn-large" onClick={() => setDialog(null)}>
                그만두기
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
