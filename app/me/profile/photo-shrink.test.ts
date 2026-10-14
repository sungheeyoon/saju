import { describe, expect, it } from 'vitest';

import { PHOTO_MAX_BYTES, PHOTO_MAX_EDGE } from '@/src/lib/profile';

import { base64Of, oversizeMessage, shrunkSize, uploadTypeOf } from './photo-shrink';

describe('사진 줄이기 — 브라우저 밖에서 재는 절반', () => {
  it('긴 변을 상한에 맞추고 비율을 지킨다', () => {
    expect(shrunkSize(4032, 3024)).toEqual({ width: PHOTO_MAX_EDGE, height: 384 });
    expect(shrunkSize(3024, 4032)).toEqual({ width: 384, height: PHOTO_MAX_EDGE });
  });

  it('작은 사진은 키우지 않는다', () => {
    expect(shrunkSize(300, 200)).toEqual({ width: 300, height: 200 });
  });

  it('아주 가는 사진도 한 변이 0 이 되지 않는다', () => {
    expect(shrunkSize(10000, 1)).toEqual({ width: PHOTO_MAX_EDGE, height: 1 });
  });

  it('서버가 받는 형식은 그대로, 나머지는 JPEG 로 적는다', () => {
    expect(uploadTypeOf('image/webp')).toBe('image/webp');
    expect(uploadTypeOf('image/png')).toBe('image/png');
    expect(uploadTypeOf('image/heic')).toBe('image/jpeg');
    expect(uploadTypeOf('')).toBe('image/jpeg');
  });

  it('상한까지는 지나가고, 넘으면 KB 로 까닭을 말한다', () => {
    expect(oversizeMessage(PHOTO_MAX_BYTES)).toBeNull();
    expect(oversizeMessage(PHOTO_MAX_BYTES + 1)).toBe('사진이 너무 커요. 512KB 이하 사진을 골라 주세요.');
  });

  it('바이트를 base64 로 옮긴다', () => {
    expect(base64Of(new Uint8Array([]))).toBe('');
    expect(base64Of(new TextEncoder().encode('사주'))).toBe(Buffer.from('사주').toString('base64'));
    expect(base64Of(new Uint8Array([0, 255, 128]))).toBe('AP+A');
  });
});
