import { describe, expect, it } from 'vitest';

import { PHOTO_UPLOAD_MODES, photoUploadModeOf, photoUploadsOnScreen } from './photo-upload-mode';

describe('사진 올리기의 길 — DB 스위치의 값 (G-120, ADR 0203)', () => {
  it.each(PHOTO_UPLOAD_MODES)('%s 는 그대로 읽는다', (mode) => {
    expect(photoUploadModeOf(mode)).toBe(mode);
  });

  it.each([null, undefined, '', 'off', 'S3', 1, []])('모르는 값(%j)은 멈춘 것이다 — 어느 길로 보낼지 모르면 안 보낸다', (value) => {
    expect(photoUploadModeOf(value)).toBe('paused');
  });

  it('화면은 s3 인데 저장소가 꺼진 배포에서만 멈춘 것으로 보인다', () => {
    expect(photoUploadsOnScreen('s3', false)).toBe('paused');
    expect(photoUploadsOnScreen('s3', true)).toBe('s3');
    expect(photoUploadsOnScreen('db', false)).toBe('db');
    expect(photoUploadsOnScreen('db', true)).toBe('db');
    expect(photoUploadsOnScreen('paused', true)).toBe('paused');
  });
});
