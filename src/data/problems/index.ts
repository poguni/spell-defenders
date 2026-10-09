import type { Problem } from '../../judge/types';

// 이 폴더의 모든 .json 문제 파일. 형식 검사는 npm run validate 가 맡는다.
const files = import.meta.glob<Problem[]>('./*.json', { eager: true, import: 'default' });

export const ALL_PROBLEMS: Problem[] = Object.values(files).flat();
