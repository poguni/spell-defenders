import { PlaceholderArt } from '../components/PlaceholderArt';

// M1 배치 확인용 임시 데이터. M3에서 문제은행과 게임 루프로 바꾼다.
const LANE_TOPS = [200, 380, 560];
const SAMPLE_MONSTERS = [
  { lane: 0, x: 260, sentence: '반장으로써 책임을 다했다.' },
  { lane: 1, x: 640, sentence: '정답을 맞췄다.' },
  { lane: 2, x: 1020, sentence: '나도 할수있다.' },
];
const SPEEDS = ['보통', '느리게', '일시정지'];

export function BattleScreen() {
  return (
    <div className="battle-screen">
      <PlaceholderArt kind="background" />

      <header className="hud">
        <div className="hud-item">
          <span className="hud-label">성벽</span>
          <div className="hp-bar" role="meter" aria-label="성벽 체력" aria-valuenow={100} aria-valuemin={0} aria-valuemax={100}>
            <div className="hp-fill" style={{ width: '100%' }} />
          </div>
        </div>
        <div className="hud-item hud-wave">웨이브 1 / 3</div>
        <div className="hud-item">
          <span className="hud-label">마나</span>
          <span className="hud-value">0</span>
        </div>
        <div className="speed-buttons" role="group" aria-label="속도">
          {SPEEDS.map((label, i) => (
            <button key={label} type="button" className={`btn btn-small${i === 0 ? ' is-selected' : ''}`}>
              {label}
            </button>
          ))}
        </div>
      </header>

      {SAMPLE_MONSTERS.map((m, i) => (
        <div key={i} className="monster" style={{ left: m.x, top: LANE_TOPS[m.lane] + 105 - 180 }}>
          <div className="monster-bubble">{m.sentence}</div>
          <PlaceholderArt kind="monster" variant={i} />
        </div>
      ))}

      <div className="castle-area">
        <div className="defender-spot">
          <PlaceholderArt kind="defender" />
        </div>
        <PlaceholderArt kind="castle" />
      </div>

      <section className="sentence-card" aria-label="문장 카드">
        <p className="sentence-text">
          반장<mark className="sentence-target">으로써</mark> 책임을 다했다.
        </p>
        <div className="choice-buttons">
          <button type="button" className="btn btn-choice">으로서</button>
          <button type="button" className="btn btn-choice">으로써</button>
          <button type="button" className="btn btn-choice btn-none">고칠 곳 없음</button>
        </div>
      </section>
    </div>
  );
}
