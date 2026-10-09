import { useEffect, useState, type ReactNode } from 'react';
import { STAGE_HEIGHT, STAGE_WIDTH, fitStage } from './stageFit';

function readFit() {
  return fitStage(window.innerWidth, window.innerHeight);
}

export function Stage({ children }: { children: ReactNode }) {
  const [fit, setFit] = useState(readFit);

  useEffect(() => {
    const onResize = () => setFit(readFit());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="stage-viewport">
      <div
        className="stage"
        data-scale={fit.scale}
        style={{
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
          transform: `translate(${fit.left}px, ${fit.top}px) scale(${fit.scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
