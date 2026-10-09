import { MonsterArt } from '../components/GameArt';
import { tagInfo } from '../data/tagInfo';
import type { Level } from '../judge/types';

interface Props {
  level: Level;
  /** 이 단계에서 문제가 있는 태그 */
  tags: string[];
  dex: string[];
  onBack: () => void;
}

/** 몬스터 도감: 정화한 유형의 몬스터 카드와 규칙 설명(기획서 7.3) */
export function DexScreen({ level, tags, dex, onBack }: Props) {
  const found = tags.filter((t) => dex.includes(t)).length;

  return (
    <div className="list-screen">
      <header className="screen-header">
        <button type="button" className="btn btn-small" onClick={onBack}>
          지도로
        </button>
        <h1 className="screen-title">
          몬스터 도감 {found} / {tags.length}
        </h1>
        <span className="screen-header-spacer" />
      </header>

      <div className="list-body dex-grid">
        {tags.map((tag) => {
          const registered = dex.includes(tag);
          const info = tagInfo(tag);
          return (
            <section key={tag} className={`dex-card${registered ? '' : ' is-unknown'}`} aria-label={tag}>
              <MonsterArt level={level} tag={tag} purified={registered} />
              <h2 className="dex-name">{registered ? info.monster : '???'}</h2>
              <p className="dex-tag">{tag}</p>
              <p className="dex-rule">{registered ? info.rule : '아직 정화하지 못했어요.'}</p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
