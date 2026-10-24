import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PHOTO_UPLOADS_PAUSED } from '@/src/lib/account/copy';
import type { PhotoUploadMode } from '@/src/lib/profile';

/**
 * **사진 올리기의 스위치 셋 × 문 · 화면**(G-120, ADR 0203).
 *
 * 거절은 DB 가 한다(`photo_upload_must_be` — `supabase/tests/99_photo_upload_switch.test.sql` 이 잰다). 여기서 재는 것은 앱 쪽이다.
 *
 * 1. 화면이 읽는 길 — 스위치의 값 · 저장소가 꺼진 배포 · 못 읽음
 * 2. 액션은 DB 의 거절 문장을 그대로 세우고, 저장소 길은 표를 못 받으면 저장소에 안 쓴다 — 가짜 DB 가 스위치대로 거절한다
 * 3. 화면의 안내와 DB 의 거절이 같은 글자다
 */

const rpc = vi.fn();
vi.mock('../../auth/server-client', () => ({ supabaseOnServer: async () => ({ rpc }) }));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, refresh: () => undefined }));

let storeReady = true;
vi.mock('../photo/store-env', () => ({ photoStoreIsOn: () => storeReady }));

const { memoryPhotoStore } = await import('../photo/store');
const memory = memoryPhotoStore();
vi.mock('../photo/s3-store', () => ({ photoStoreIfReady: () => memory.store }));

const { photoUploadMode } = await import('./photo-upload-mode');
const { addPhoto, addStoredPhoto, replacePhoto, replaceStoredPhoto } = await import('./actions');

const KEY = 'photos/0f8b2f6e-1c2d-4e5f-8a9b-0c1d2e3f4a5b/7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918';
const WRONG_PATH = '사진을 올리지 못했어요. 다시 시도해 주세요.';

/** WebP 확장 머리(VP8X) — 크기만 든 가짜 그림(`stored-photo.test.ts` 와 같다) */
function webp(width: number, height: number): Blob {
  const le24 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff];
  const text = (s: string) => [...s].map((c) => c.charCodeAt(0));
  return new Blob([Uint8Array.from([...text('RIFF'), 0, 0, 0, 0, ...text('WEBP'), ...text('VP8X'), 10, 0, 0, 0, 0, 0, 0, 0,
    ...le24(width - 1), ...le24(height - 1)])]);
}

function storedForm(replacing = false): FormData {
  const form = new FormData();
  form.set('card', webp(360, 480));
  form.set('large', webp(1080, 1440));
  if (replacing) {
    form.set('position', '1');
    form.set('version', '7');
  }
  return form;
}

const PATH_OF: Record<string, 'db' | 's3' | undefined> = {
  add_my_photo: 'db',
  replace_my_photo: 'db',
  begin_my_photo_upload: 's3',
  add_my_photo_object: 's3',
  replace_my_photo_object: 's3',
};

/** 가짜 DB — 올리는 문은 스위치대로 거절한다(`20261228140000` 의 `photo_upload_must_be` 와 같은 문장) */
function dbWith(mode: PhotoUploadMode) {
  const called: string[] = [];
  rpc.mockImplementation(async (name: string) => {
    called.push(name);
    const path = PATH_OF[name];
    if (path !== undefined && mode === 'paused') return { data: null, error: { code: '55000', message: PHOTO_UPLOADS_PAUSED } };
    if (path !== undefined && mode !== path) return { data: null, error: { code: '55000', message: WRONG_PATH } };
    if (name === 'begin_my_photo_upload') return { data: KEY, error: null };
    if (name === 'add_my_photo' || name === 'add_my_photo_object') return { data: 1, error: null };
    if (name === 'replace_my_photo' || name === 'replace_my_photo_object') return { data: 8, error: null };
    return { data: null, error: null };
  });
  return called;
}

const bytes = { contentType: 'image/png', base64: 'QQ==' };

beforeEach(() => {
  rpc.mockReset();
  memory.objects.clear();
  storeReady = true;
});

describe('화면이 읽는 길 — photoUploadMode', () => {
  it.each(['db', 'paused', 's3'] as const)('스위치가 %s 면 그 길이다', async (mode) => {
    rpc.mockResolvedValue({ data: mode, error: null });

    await expect(photoUploadMode()).resolves.toBe(mode);
    expect(rpc).toHaveBeenCalledWith('photo_upload_mode');
  });

  it('스위치가 s3 여도 이 배포의 저장소가 꺼졌으면 멈춘 것으로 보인다', async () => {
    storeReady = false;
    rpc.mockResolvedValue({ data: 's3', error: null });

    await expect(photoUploadMode()).resolves.toBe('paused');
  });

  it('저장소가 꺼져도 db 는 db 다 — 지금 운영 그대로', async () => {
    storeReady = false;
    rpc.mockResolvedValue({ data: 'db', error: null });

    await expect(photoUploadMode()).resolves.toBe('db');
  });

  it('못 읽으면 「올릴 수 있다」로 세우지 않고 던진다 — 화면째 오류 경계', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'fetch failed' } });

    await expect(photoUploadMode()).rejects.toThrow('요청을 처리하지 못했어요');
  });
});

describe('스위치 셋 × 올리는 액션', () => {
  it('db — 바이트 길은 받고, 저장소 길은 「다시 시도」로 거절되고 저장소에 안 쓴다', async () => {
    dbWith('db');

    await expect(addPhoto(bytes)).resolves.toEqual({ ok: true });
    await expect(replacePhoto({ position: 1, version: 7, ...bytes })).resolves.toEqual({ ok: true, version: 8 });
    await expect(addStoredPhoto(storedForm())).resolves.toEqual({ ok: false, message: WRONG_PATH });
    await expect(replaceStoredPhoto(storedForm(true))).resolves.toEqual({ ok: false, message: WRONG_PATH });
    expect(memory.objects.size).toBe(0);
  });

  it('paused — 네 액션 모두 멈춘 까닭을 세우고 저장소에 안 쓴다', async () => {
    dbWith('paused');

    const refused = { ok: false, message: PHOTO_UPLOADS_PAUSED };
    await expect(addPhoto(bytes)).resolves.toEqual(refused);
    await expect(replacePhoto({ position: 1, version: 7, ...bytes })).resolves.toEqual(refused);
    await expect(addStoredPhoto(storedForm())).resolves.toEqual(refused);
    await expect(replaceStoredPhoto(storedForm(true))).resolves.toEqual(refused);
    expect(memory.objects.size).toBe(0);
  });

  it('s3 — 저장소 길은 두 벌을 쓰고 적고, 바이트 길은 「다시 시도」로 거절된다', async () => {
    const called = dbWith('s3');

    await expect(addStoredPhoto(storedForm())).resolves.toEqual({ ok: true });
    expect([...memory.objects.keys()].sort()).toEqual([`${KEY}/card`, `${KEY}/large`]);
    expect(called).toEqual(['begin_my_photo_upload', 'add_my_photo_object']);

    await expect(addPhoto(bytes)).resolves.toEqual({ ok: false, message: WRONG_PATH });
    await expect(replacePhoto({ position: 1, version: 7, ...bytes })).resolves.toEqual({ ok: false, message: WRONG_PATH });
  });
});

describe('화면의 안내와 DB 의 거절이 같은 글자다', () => {
  it.each([
    '20261228140000_photo_uploads_follow_one_switch.sql',
    /* 살아 있는 정의 — 스위치 줄을 for share 로 읽게 다시 세웠다(ADR 0203 덧붙임) */
    '20261229150000_a_switch_change_waits_for_the_uploads_in_flight.sql',
  ])('검사 함수(%s)가 멈춘 동안 내는 문장이 화면의 첫 줄과 같다', (file) => {
    const migration = readFileSync(`supabase/migrations/${file}`, 'utf8');

    expect(migration).toContain(`raise exception '${PHOTO_UPLOADS_PAUSED}' using errcode = '55000'`);
    expect(migration).toContain(`raise exception '${WRONG_PATH}' using errcode = '55000'`);
  });
});
