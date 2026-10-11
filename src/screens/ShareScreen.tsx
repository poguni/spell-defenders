import { useEffect, useState } from 'react';
import { downloadText } from '../share/download';
import { qrImage } from '../share/qr';
import { SHARE_MAX, ShareError, encodeSet, exportFile, shareLink } from '../share/shareCode';
import type { ProblemSet } from '../storage/teacher';

interface Props {
  set: ProblemSet;
  onBack: () => void;
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; link: string | null; qr: string | null };

/** 문제 세트 나눠 주기(기획서 5.3): 링크(30문제까지), 작은 세트는 QR, 30문제를 넘으면 파일 */
export function ShareScreen({ set, onBack }: Props) {
  const approved = set.problems.filter((p) => p.reviewed);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (approved.length === 0) return setState({ status: 'error', message: '승인한 문제가 없어요. 먼저 문제를 승인해 주세요.' });
      if (approved.length > SHARE_MAX) return setState({ status: 'ready', link: null, qr: null });
      try {
        const link = shareLink(window.location.href, await encodeSet(set.name, set.problems));
        const qr = await qrImage(link);
        if (alive) setState({ status: 'ready', link, qr });
      } catch (e) {
        if (alive) setState({ status: 'error', message: e instanceof ShareError ? e.message : '링크를 만들지 못했어요.' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [set]); // 세트가 바뀌면 다시 만든다

  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const download = () => downloadText(`${set.name}.json`, exportFile(set.name, set.problems));

  return (
    <div className="list-screen">
      <header className="screen-header">
        <button type="button" className="btn btn-small" onClick={onBack}>
          교사 메뉴로
        </button>
        <h1 className="screen-title">나눠 주기: {set.name}</h1>
        <div className="screen-header-spacer" />
      </header>

      <div className="share-body">
        {state.status === 'loading' && <p className="list-empty">링크를 만드는 중이에요…</p>}
        {state.status === 'error' && <p className="list-empty">{state.message}</p>}
        {state.status === 'ready' && (
          <>
            {state.qr && <img className="share-qr" src={state.qr} alt="문제 세트 QR 코드" />}
            <div className="share-side">
              <p className="note-tag" data-testid="share-count">
                승인한 문제 {approved.length}개
              </p>
              {state.link ? (
                <>
                  <p className="teacher-message">
                    {state.qr
                      ? '디벗 카메라로 QR을 찍거나, 아래 링크를 학급 게시판·메신저로 보내 주세요.'
                      : '문제가 많아 QR이 너무 촘촘해요. 아래 링크를 학급 게시판·메신저로 보내 주세요.'}
                  </p>
                  <label className="text-field is-wide">
                    <span>링크</span>
                    <input type="text" readOnly value={state.link} data-testid="share-link" onFocus={(e) => e.target.select()} />
                  </label>
                  <div className="teacher-row">
                    <button type="button" className="btn btn-primary btn-large" onClick={() => void copy(state.link!)}>
                      링크 복사
                    </button>
                    {copied && <span className="teacher-message">복사했어요.</span>}
                  </div>
                </>
              ) : (
                <p className="teacher-message">
                  승인한 문제가 {SHARE_MAX}개를 넘어 링크로 보낼 수 없어요. 파일로 내보내 학생 기기에서 "문제 파일
                  불러오기"로 열어 주세요.
                </p>
              )}
              <button type="button" className="btn btn-large" onClick={download}>
                파일로 내보내기
              </button>
              <p className="list-guide">
                학생은 링크를 열고 "불러오기"를 누르면 돼요. 승인한 문제만 보내지고, API 키는 보내지 않아요.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
