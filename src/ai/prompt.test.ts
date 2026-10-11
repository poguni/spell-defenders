import { describe, expect, it } from 'vitest';
import { buildUserPrompt } from './prompt';

describe('buildUserPrompt', () => {
  it('1단계는 보기 2개, 15자 이하, 쉬운 낱말을 요청한다', () => {
    const prompt = buildUserPrompt({ level: 1, tag: '된소리', count: 5, topic: '' });
    expect(prompt).toContain('15자 이하');
    expect(prompt).toContain('맞춤법·문장 부호 문제는 2개');
    expect(prompt).toContain('2학년이 아는 쉬운 낱말');
  });

  it('3단계는 보기 3개를 요청하고 2학년 안내는 넣지 않는다', () => {
    const prompt = buildUserPrompt({ level: 3, tag: '웬/왠', count: 12, topic: '운동회' });
    expect(prompt).toContain('맞춤법·문장 부호 문제는 3개');
    expect(prompt).not.toContain('2학년');
    expect(prompt).toContain('소재: 운동회');
  });
});
