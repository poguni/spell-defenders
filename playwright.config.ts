import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: {
    baseURL: 'http://localhost:5179',
    // 컴퓨터에 설치된 Chrome을 쓴다(별도 브라우저 내려받기 없음).
    channel: 'chrome',
  },
  // 테스트 전용 포트. 직접 띄워 둔 개발 서버(5173)를 재사용하면 바뀐 파일을 못 볼 수 있다
  webServer: {
    command: 'npm run dev -- --port 5179 --strictPort',
    url: 'http://localhost:5179',
    reuseExistingServer: false,
  },
});
