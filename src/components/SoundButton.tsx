/** 위쪽 막대의 효과음 켜기/끄기 */
export function SoundButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="btn btn-small" aria-pressed={!on} onClick={onToggle}>
      {on ? '소리 끄기' : '소리 켜기'}
    </button>
  );
}
