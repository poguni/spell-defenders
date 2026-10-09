// 게임 무대는 1920×1080 좌표로 배치하고, 화면에는 비율을 유지한 채 통째로 확대·축소한다.
export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

export interface StageFit {
  scale: number;
  left: number;
  top: number;
}

export function fitStage(viewportWidth: number, viewportHeight: number): StageFit {
  const scale = Math.min(viewportWidth / STAGE_WIDTH, viewportHeight / STAGE_HEIGHT);
  return {
    scale,
    left: (viewportWidth - STAGE_WIDTH * scale) / 2,
    top: (viewportHeight - STAGE_HEIGHT * scale) / 2,
  };
}
