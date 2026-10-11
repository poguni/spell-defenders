import { useState } from 'react';
import type { ProblemSet } from '../storage/teacher';

interface Props {
  sets: ProblemSet[];
  onToggleSet: (setId: string) => void;
  onOpenSet: (setId: string) => void;
  onDeleteSet: (setId: string) => void;
  onGenerate: () => void;
  onKeySettings: () => void;
  onBack: () => void;
}

/** 교사 메뉴: 문제 세트 목록과 관리(기획서 5.3) */
export function TeacherMenuScreen({ sets, onToggleSet, onOpenSet, onDeleteSet, onGenerate, onKeySettings, onBack }: Props) {
  const [deleting, setDeleting] = useState<string | null>(null);

  return (
    <div className="list-screen">
      <header className="screen-header">
        <button type="button" className="btn btn-small" onClick={onBack}>
          처음으로
        </button>
        <h1 className="screen-title">교사 메뉴</h1>
        <div className="screen-header-spacer" />
      </header>

      <div className="list-body">
        <div className="teacher-actions">
          <button type="button" className="btn btn-primary btn-large" onClick={onGenerate}>
            AI로 문제 만들기
          </button>
          <button type="button" className="btn btn-large" onClick={onKeySettings}>
            API 키·모델 설정
          </button>
        </div>

        <p className="list-guide">
          승인한 문제만 학생에게 나와요. 출제가 켜진 세트의 승인한 문제는 이 기기의 스테이지와 학급 수비전에 내장
          문제와 섞여 나와요.
        </p>

        {sets.length === 0 && <p className="list-empty">아직 만든 문제 세트가 없어요.</p>}

        {sets.map((set) => {
          const approved = set.problems.filter((p) => p.reviewed).length;
          return (
            <section key={set.id} className="note-section" aria-label={`문제 세트 ${set.name}`}>
              <div className="note-head">
                <h2 className="note-tag">{set.name}</h2>
                <span className="note-streak">
                  문제 {set.problems.length}개 · 승인 {approved}개
                </span>
              </div>
              <div className="teacher-row">
                <button
                  type="button"
                  className={`btn${set.active ? ' is-selected' : ''}`}
                  aria-pressed={set.active}
                  onClick={() => onToggleSet(set.id)}
                >
                  {set.active ? '출제 켜짐' : '출제 꺼짐'}
                </button>
                <button type="button" className="btn" onClick={() => onOpenSet(set.id)}>
                  승인·수정
                </button>
                {deleting === set.id ? (
                  <>
                    <button type="button" className="btn btn-danger" onClick={() => onDeleteSet(set.id)}>
                      정말 삭제
                    </button>
                    <button type="button" className="btn" onClick={() => setDeleting(null)}>
                      그만두기
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn" onClick={() => setDeleting(set.id)}>
                    세트 삭제
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
