/** 사진 상한 — `profile_photo.bytes` 의 검사식과 같은 수 */
export const PHOTO_MAX_BYTES = 512 * 1024;

/** 올린 사진을 이 변으로 줄여서 보낸다 — 카드와 프로필에 서는 크기 */
export const PHOTO_MAX_EDGE = 512;

/** 긴 변을 `PHOTO_MAX_EDGE` 에 맞춘 크기 — 비율을 지키고, 작은 사진은 키우지 않는다. 한 변이 0 이 되지 않게 1 이 바닥이다 */
export function shrunkSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** 상한(`PHOTO_MAX_BYTES`)을 넘으면 그 까닭 한 줄 — 넘지 않으면 `null` */
export function oversizeMessage(size: number): string | null {
  return size > PHOTO_MAX_BYTES ? `사진이 너무 커요. ${Math.round(PHOTO_MAX_BYTES / 1024)}KB 이하 사진을 골라 주세요.` : null;
}
