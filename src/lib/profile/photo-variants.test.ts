import { describe, expect, it } from 'vitest';

import { PHOTO_VARIANTS, checkVariants, imageHeadOf, isPhotoObjectKey, variantKey, variantSize } from './photo-variants';

/** JPEG — SOI · APP0(16) · SOF0 의 높이 · 너비, 나머지는 `pad` 만큼 0 */
function jpeg(width: number, height: number, pad = 0): Uint8Array {
  const head = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...new Array(14).fill(0),
    0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03];
  return Uint8Array.from([...head, ...new Array(pad).fill(0)]);
}

function png(width: number, height: number): Uint8Array {
  const be = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
  return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...be(width), ...be(height), 8, 6, 0, 0, 0]);
}

/** WebP 확장 머리(VP8X) — 너비 · 높이에서 1 을 뺀 24비트 */
function webp(width: number, height: number, pad = 0): Uint8Array {
  const le24 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff];
  const text = (s: string) => [...s].map((c) => c.charCodeAt(0));
  return Uint8Array.from([...text('RIFF'), 0, 0, 0, 0, ...text('WEBP'), ...text('VP8X'), 10, 0, 0, 0, 0, 0, 0, 0,
    ...le24(width - 1), ...le24(height - 1), ...new Array(pad).fill(0)]);
}

describe('imageHeadOf', () => {
  it('JPEG · PNG · WebP 의 머리에서 형식과 크기를 읽는다', () => {
    expect(imageHeadOf(jpeg(1080, 1440))).toEqual({ type: 'image/jpeg', width: 1080, height: 1440 });
    expect(imageHeadOf(png(480, 360))).toEqual({ type: 'image/png', width: 480, height: 360 });
    expect(imageHeadOf(webp(1440, 1080))).toEqual({ type: 'image/webp', width: 1440, height: 1080 });
  });

  it('모르는 형식 · 잘린 머리는 null 이다 — 붙인 이름이 아니라 바이트를 본다', () => {
    expect(imageHeadOf(new TextEncoder().encode('GIF89a......'))).toBeNull();
    expect(imageHeadOf(jpeg(10, 10).subarray(0, 12))).toBeNull();
    expect(imageHeadOf(new Uint8Array())).toBeNull();
  });
});

describe('checkVariants', () => {
  it('작은 벌이 큰 벌을 줄인 크기이고 상한 안이면 받는다', () => {
    const checked = checkVariants(webp(360, 480), webp(1080, 1440));
    expect(checked).toMatchObject({ ok: true, type: 'image/webp' });
  });

  it('작은 사진은 두 벌이 같은 크기여도 받는다 — 키우지 않는다', () => {
    expect(checkVariants(jpeg(300, 200), jpeg(300, 200)).ok).toBe(true);
  });

  it('반올림으로 한 변이 1px 어긋난 것은 같은 그림으로 본다', () => {
    const big = variantSize('large', 4000, 3001);
    const small = variantSize('card', 4000, 3001);
    expect(checkVariants(webp(small.width, small.height + 1), webp(big.width, big.height)).ok).toBe(true);
  });

  it.each([
    ['형식이 다르다', jpeg(360, 480), webp(1080, 1440), 'type-mismatch'],
    ['작은 벌의 변이 상한을 넘는다', webp(481, 300), webp(1440, 900), 'card-edge'],
    ['큰 벌의 변이 상한을 넘는다', webp(360, 480), webp(1500, 2000), 'large-edge'],
    ['작은 벌이 더 크다', webp(480, 360), webp(400, 300), 'card-larger'],
    ['비율이 다르다 — 다른 사진일 수 있다', webp(480, 480), webp(1080, 1440), 'ratio'],
    ['큰 벌의 바이트가 상한을 넘는다', webp(360, 480), webp(1080, 1440, PHOTO_VARIANTS.large.maxBytes), 'large-bytes'],
    ['작은 벌의 바이트가 상한을 넘는다', webp(360, 480, PHOTO_VARIANTS.card.maxBytes), webp(1080, 1440), 'card-bytes'],
  ])('%s 이면 거절한다', (_name, card, large, reason) => {
    expect(checkVariants(card, large)).toMatchObject({ ok: false, reason });
  });

  it('못 읽는 바이트는 형식의 말로 거절한다', () => {
    expect(checkVariants(new Uint8Array(40), webp(10, 10))).toMatchObject({
      ok: false,
      reason: 'unreadable',
      message: 'JPG · PNG · WebP 사진만 올릴 수 있어요. 다른 사진을 골라 주세요.',
    });
  });

  it('두 벌의 상한 합이 서버 액션의 본문 한도(1MB) 안이다 — 여분 64KB', () => {
    expect(PHOTO_VARIANTS.card.maxBytes + PHOTO_VARIANTS.large.maxBytes).toBeLessThanOrEqual(1024 * 1024 - 64 * 1024);
  });
});

describe('열쇠', () => {
  const key = 'photos/0f8b2f6e-1c2d-4e5f-8a9b-0c1d2e3f4a5b/7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918';

  it('한 벌의 객체 키는 열쇠 아래 이름 하나다', () => {
    expect(variantKey(key, 'card')).toBe(`${key}/card`);
    expect(variantKey(key, 'large')).toBe(`${key}/large`);
  });

  it('DB 의 검사식과 같은 모양만 열쇠다', () => {
    expect(isPhotoObjectKey(key)).toBe(true);
    expect(isPhotoObjectKey(`${key}/card`)).toBe(false);
    expect(isPhotoObjectKey('photos/../secret')).toBe(false);
    expect(isPhotoObjectKey(key.toUpperCase())).toBe(false);
  });
});

describe('variantSize', () => {
  it('긴 변을 그 벌의 상한에 맞추고 비율을 지킨다', () => {
    expect(variantSize('large', 3024, 4032)).toEqual({ width: 1080, height: 1440 });
    expect(variantSize('card', 3024, 4032)).toEqual({ width: 360, height: 480 });
  });

  it('작은 사진은 키우지 않는다', () => {
    expect(variantSize('large', 512, 384)).toEqual({ width: 512, height: 384 });
  });
});
