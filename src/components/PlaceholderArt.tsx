// 그림이 준비되기 전까지 쓰는 임시 그림(단색 도형)을 모두 여기에 모은다.
// M5에서 public/assets/ 의 그림으로 바꿀 때 이 파일만 고치면 된다.

export type PlaceholderKind = 'background' | 'monster' | 'castle' | 'defender' | 'graffiti';

const MONSTER_COLORS = ['#8e6bbf', '#6b8ebf', '#bf6b8e', '#6bbf9a', '#bf9a6b', '#7a7fa8'];
// 성벽 낙서 자리(성벽 기준 좌표)와 색
const GRAFFITI_SPOTS = [
  { left: 20, top: 30, rotate: -12 },
  { left: 110, top: 70, rotate: 15 },
  { left: 40, top: 150, rotate: 8 },
  { left: 120, top: 190, rotate: -20 },
  { left: 15, top: 250, rotate: 25 },
  { left: 100, top: 280, rotate: -5 },
  { left: 60, top: 110, rotate: 30 },
  { left: 140, top: 130, rotate: -28 },
  { left: 30, top: 200, rotate: -15 },
  { left: 90, top: 30, rotate: 10 },
];
const GRAFFITI_COLORS = ['#d64545', '#7b3fbf', '#2f8f4f', '#e07b22'];

export function PlaceholderArt({ kind, variant = 0 }: { kind: PlaceholderKind; variant?: number }) {
  switch (kind) {
    case 'background':
      return (
        <div className="ph-background" aria-hidden="true">
          <div className="ph-lane" style={{ top: 190 }} />
          <div className="ph-lane" style={{ top: 370 }} />
          <div className="ph-lane" style={{ top: 550 }} />
        </div>
      );
    case 'monster':
      return (
        <div
          className="ph-monster"
          style={{ background: MONSTER_COLORS[variant % MONSTER_COLORS.length] }}
          aria-hidden="true"
        >
          <span className="ph-eye" />
          <span className="ph-eye" />
        </div>
      );
    case 'castle':
      return (
        <div className="ph-castle" aria-hidden="true">
          <div className="ph-castle-roof" />
          <div className="ph-castle-wall">
            <div className="ph-castle-gate" />
          </div>
        </div>
      );
    case 'graffiti': {
      const spot = GRAFFITI_SPOTS[variant % GRAFFITI_SPOTS.length];
      return (
        <div
          className="ph-graffiti"
          style={{
            left: spot.left,
            top: spot.top,
            transform: `rotate(${spot.rotate}deg)`,
            borderColor: GRAFFITI_COLORS[variant % GRAFFITI_COLORS.length],
          }}
          aria-hidden="true"
        />
      );
    }
    case 'defender':
      return (
        <div className="ph-defender" aria-hidden="true">
          <div className="ph-defender-head" />
          <div className="ph-defender-body" />
        </div>
      );
  }
}
