/** NFC 정규화, 앞뒤 공백 제거, 연속 공백(탭·전각 공백 포함)을 띄어쓰기 한 칸으로 */
export function normalize(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim();
}
