// QR 코드(기획서 10.1 qrcode). 너무 촘촘한 QR은 교실에서 찍기 어려워 만들지 않는다.
// 라이브러리는 교사가 나눠 주기 화면을 열 때만 내려받는다(학생 첫 화면을 가볍게).

/** 이보다 큰 QR(버전 20 = 97×97칸, 약 5문제)은 전자칠판에 띄워도 찍기 어렵다 */
export const QR_MAX_VERSION = 20;

/** 링크의 QR 그림(data URL). 너무 촘촘하면 null */
export async function qrImage(url: string): Promise<string | null> {
  const options = { errorCorrectionLevel: 'L' as const, margin: 2 };
  const { default: QRCode } = await import('qrcode');
  try {
    if (QRCode.create(url, options).version > QR_MAX_VERSION) return null;
    return await QRCode.toDataURL(url, { ...options, width: 900 });
  } catch {
    return null; // 너무 길어 QR에 들어가지 않음
  }
}
