import { describe, expect, it } from 'vitest';
import { STAGE_HEIGHT, STAGE_WIDTH, fitStage } from './stageFit';

describe('fitStage', () => {
  it('1920×1080에서는 확대·축소 없이 꽉 찬다', () => {
    expect(fitStage(1920, 1080)).toEqual({ scale: 1, left: 0, top: 0 });
  });

  it('1366×768에서는 세로에 맞춰 줄이고 가로 여백을 양쪽에 나눈다', () => {
    const { scale, left, top } = fitStage(1366, 768);
    expect(scale).toBeCloseTo(768 / 1080);
    expect(top).toBe(0);
    expect(left).toBeCloseTo((1366 - STAGE_WIDTH * scale) / 2);
  });

  it('브라우저 주소창 때문에 세로가 짧아지면(1366×650) 세로에 맞춘다', () => {
    const { scale, left, top } = fitStage(1366, 650);
    expect(scale).toBeCloseTo(650 / 1080);
    expect(top).toBe(0);
    expect(left).toBeGreaterThan(0);
  });

  it('세로로 긴 화면에서는 가로에 맞추고 위아래 여백을 나눈다', () => {
    const { scale, left, top } = fitStage(1024, 1366);
    expect(scale).toBeCloseTo(1024 / 1920);
    expect(left).toBe(0);
    expect(top).toBeCloseTo((1366 - STAGE_HEIGHT * scale) / 2);
  });

  it('무대가 화면 밖으로 나가지 않는다', () => {
    for (const [w, h] of [[1920, 1080], [1536, 864], [1366, 768], [1366, 650], [1024, 768]]) {
      const { scale, left, top } = fitStage(w, h);
      expect(left + STAGE_WIDTH * scale).toBeLessThanOrEqual(w + 0.001);
      expect(top + STAGE_HEIGHT * scale).toBeLessThanOrEqual(h + 0.001);
    }
  });
});
