// 그림이 준비되기 전까지 쓰는 임시 그림(단색 도형)을 모두 여기에 모은다.
// M5에서 public/assets/ 의 그림으로 바꿀 때 이 파일만 고치면 된다.

export type PlaceholderKind = 'background' | 'monster' | 'castle' | 'defender';

const MONSTER_COLORS = ['#8e6bbf', '#6b8ebf', '#bf6b8e'];

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
    case 'defender':
      return (
        <div className="ph-defender" aria-hidden="true">
          <div className="ph-defender-head" />
          <div className="ph-defender-body" />
        </div>
      );
  }
}
