// 내장 문제 자동 검증: npm run validate
// src/data/problems/ 안의 모든 .json 파일(문제 배열)을 검사하고, 문제가 있으면 실패 코드로 끝낸다.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateProblems } from '../src/judge/validate';

const dir = join(import.meta.dirname, '..', 'src', 'data', 'problems');
const files = readdirSync(dir).filter((name) => name.endsWith('.json'));

const all: unknown[] = [];
const fileOf: string[] = [];
let failed = false;

for (const file of files) {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  } catch (error) {
    console.error(`[${file}] JSON을 읽을 수 없음: ${(error as Error).message}`);
    failed = true;
    continue;
  }
  if (!Array.isArray(data)) {
    console.error(`[${file}] 파일 내용이 문제 배열이 아님`);
    failed = true;
    continue;
  }
  for (const problem of data) {
    all.push(problem);
    fileOf.push(file);
  }
}

// id 중복은 파일을 넘어서도 찾아야 하므로 한꺼번에 검사한다
const issues = validateProblems(all);
for (const { index, id, message } of issues) {
  console.error(`[${fileOf[index]}] ${id}: ${message}`);
}

if (failed || issues.length > 0) {
  console.error(`\n검증 실패: 문제점 ${issues.length}개`);
  process.exit(1);
}
console.log(`검증 통과: 파일 ${files.length}개, 문제 ${all.length}개`);
