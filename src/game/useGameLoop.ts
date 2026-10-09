import { useEffect, useRef } from 'react';

// 탭을 오래 비웠다 돌아와도 몬스터가 한꺼번에 뛰어가지 않게, 한 프레임 시간을 이만큼으로 자른다
const MAX_FRAME_SECONDS = 0.1;

/** requestAnimationFrame마다 지난 프레임에서 흐른 시간(초)을 넘겨 onFrame을 부른다 */
export function useGameLoop(onFrame: (dt: number) => void) {
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  useEffect(() => {
    let frame = 0;
    let last: number | null = null;
    const loop = (now: number) => {
      if (last !== null) onFrameRef.current(Math.min((now - last) / 1000, MAX_FRAME_SECONDS));
      last = now;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);
}
