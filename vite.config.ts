import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // 상대 경로: GitHub Pages(poguni.github.io/spell-defenders/)에서도, 다른 주소에서도 그대로 동작
  base: './',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
