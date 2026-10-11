import { useEffect, useState } from 'react';
import { decodeSet, importFile, type ImportResult, type SharedSet } from '../share/shareCode';

/** 받은 것: 링크의 공유 코드나 파일 내용 */
export type ImportSource = { code: string } | { fileText: string };

interface Props {
  source: ImportSource;
  /** 이미 불러온 세트 이름(있으면 바뀐다고 알린다) */
  currentName: string | null;
  onImport: (set: SharedSet) => void;
  onCancel: () => void;
}

/** 학생 쪽 불러오기: 세트 이름과 문제 수를 보여 주고 확인을 받는다 */
export function ImportScreen({ source, currentName, onImport, onCancel }: Props) {
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const r = 'code' in source ? await decodeSet(source.code) : importFile(source.fileText);
      if (alive) setResult(r);
    })();
    return () => {
      alive = false;
    };
  }, [source]);

  return (
    <div className="result-screen import-screen">
      <h1 className="result-title">선생님 문제 불러오기</h1>
      {!result && <p className="list-empty">확인하는 중이에요…</p>}
      {result && !result.ok && (
        <>
          <p className="list-empty" role="alert">
            {result.error}
          </p>
          <button type="button" className="btn btn-large" onClick={onCancel}>
            처음으로
          </button>
        </>
      )}
      {result?.ok && (
        <>
          <dl className="result-numbers">
            <div>
              <dt>세트 이름</dt>
              <dd className="import-name" data-testid="import-name">
                {result.set.name}
              </dd>
            </div>
            <div>
              <dt>문제</dt>
              <dd data-testid="import-count">{result.set.problems.length}개</dd>
            </div>
          </dl>
          {result.dropped > 0 && (
            <p className="list-guide">선생님이 승인하지 않은 문제 {result.dropped}개는 받지 않았어요.</p>
          )}
          {currentName && <p className="list-guide">전에 불러온 '{currentName}' 세트는 이 세트로 바뀌어요.</p>}
          <div className="start-buttons">
            <button type="button" className="btn btn-primary btn-large" onClick={() => onImport(result.set)}>
              불러오고 바로 하기
            </button>
            <button type="button" className="btn btn-large" onClick={onCancel}>
              그만두기
            </button>
          </div>
        </>
      )}
    </div>
  );
}
