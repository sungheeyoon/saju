import { PHOTO_MAX_BYTES, PHOTO_MAX_EDGE, PHOTO_TYPES } from '@/src/lib/profile';

/** 줄인 사진 — 보낼 형식과 바이트, 아니면 사용자에게 서는 까닭 한 줄 */
export type Shrunk = { ok: true; contentType: string; base64: string } | { ok: false; message: string };

/** 캔버스를 못 얻었다 — 줄일 수 없는 사진 */
export const SHRINK_FAILED = '사진을 줄이지 못했어요. 다른 사진을 골라 주세요.';

/** 긴 변을 `PHOTO_MAX_EDGE` 에 맞춘 크기 — 비율을 지키고, 작은 사진은 키우지 않는다. 한 변이 0 이 되지 않게 1 이 바닥이다 */
export function shrunkSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** 서버가 받는 형식이면 그대로, 아니면 JPEG 로 적는다 */
export function uploadTypeOf(type: string): string {
  return (PHOTO_TYPES as readonly string[]).includes(type) ? type : 'image/jpeg';
}

/** 상한(`PHOTO_MAX_BYTES`)을 넘으면 그 까닭 한 줄 — 넘지 않으면 `null` */
export function oversizeMessage(size: number): string | null {
  return size > PHOTO_MAX_BYTES ? `사진이 너무 커요. ${Math.round(PHOTO_MAX_BYTES / 1024)}KB 이하 사진을 골라 주세요.` : null;
}

/** 바이트를 base64 로 — 서버 액션은 글자로 받는다 */
export function base64Of(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * 올린 사진을 줄여서 보낸다 — **폰으로 찍은 사진은 그대로 못 올린다.**
 *
 * 요즘 사진 한 장이 3~5MB 다. 상한(512KB)에 걸려 거절하면 사용자가 할 수 있는 일이
 * 없다 — 「작게 만들어 오세요」는 브라우저가 할 수 있는 일을 사람에게 미루는 말이다.
 * 그래서 긴 변을 512px 로 줄이고 WebP 로 다시 굽는다. 카드와 프로필에 서는 크기가
 * 그만하다.
 *
 * **잘라 내지 않는다.** 비율을 지켜 줄이기만 한다 — 얼굴이 잘리는 자리를 우리가 고르면
 * 그것은 사용자가 고른 사진이 아니다. 칸에 담을 때 CSS 가 사람이 고른 자리를 보인다(G-98, `object-position`).
 *
 * 브라우저가 읽지 못한 사진(`createImageBitmap`)이면 던진다 — 부르는 쪽이 제 문장으로 받는다.
 */
export async function shrink(file: File): Promise<Shrunk> {
  const bitmap = await createImageBitmap(file);
  const size = shrunkSize(bitmap.width, bitmap.height);

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext('2d');
  if (context === null) return { ok: false, message: SHRINK_FAILED };
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const baked = (type: string) =>
    new Promise<Blob | null>((done) => canvas.toBlob(done, type, 0.85));

  /*
    **WebP 를 못 구우면 JPEG 로 물러선다**(운영자 2026-09-30). 못 굽는 브라우저의 `toBlob` 은 요청한 형식 대신 PNG 를
    내준다 — 사진을 PNG 로 구우면 512px 한 장이 상한(512KB)을 넘기 쉬워 「사진이 너무 커요」로 떨어졌다. 그래서 받은
    형식이 WebP 가 아니면 같은 캔버스를 JPEG(같은 품질 0.85)로 다시 굽는다. 그것도 안 되면 원본을 그대로 보낸다 —
    상한은 아래에서 다시 본다.
  */
  const webp = await baked('image/webp');
  const blob = webp?.type === 'image/webp' ? webp : await baked('image/jpeg');
  const chosen = blob ?? file;
  const contentType = uploadTypeOf(chosen.type);

  const oversize = oversizeMessage(chosen.size);
  if (oversize !== null) return { ok: false, message: oversize };

  return { ok: true, contentType, base64: base64Of(new Uint8Array(await chosen.arrayBuffer())) };
}
