import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { photoStoreConfigOf, storeErrorClassOf, type StoreEnv } from './store';

const { photoStoreIsOn } = await import('./store-env');

const NONE: StoreEnv = {
  PHOTO_STORE_BUCKET: undefined,
  PHOTO_STORE_REGION: undefined,
  PHOTO_STORE_ROLE_ARN: undefined,
  PHOTO_STORE_ACCESS_KEY_ID: undefined,
  PHOTO_STORE_SECRET_ACCESS_KEY: undefined,
};
const ROLE = 'arn:aws:iam::000000000000:role/saju-photo-store';

describe('사진 저장소의 켜는 값 — 꺼짐 · 켜짐 · 오설정 (G-120)', () => {
  it('다섯이 모두 비면(공백만이어도) 꺼짐이다 — 지금 운영', () => {
    expect(photoStoreConfigOf(NONE)).toEqual({ state: 'off' });
    expect(photoStoreConfigOf({ ...NONE, PHOTO_STORE_BUCKET: '  ' })).toEqual({ state: 'off' });
  });

  it('버킷 · 지역 · 역할이면 켜짐 — 역할이 기본안이다', () => {
    expect(photoStoreConfigOf({ ...NONE, PHOTO_STORE_BUCKET: 'b', PHOTO_STORE_REGION: 'ap-northeast-2', PHOTO_STORE_ROLE_ARN: ROLE })).toEqual({
      state: 'ready',
      config: { bucket: 'b', region: 'ap-northeast-2', credentials: { kind: 'role', roleArn: ROLE } },
    });
  });

  it('역할 대신 접근 키 둘이어도 켜짐이다', () => {
    const state = photoStoreConfigOf({
      ...NONE,
      PHOTO_STORE_BUCKET: 'b',
      PHOTO_STORE_REGION: 'ap-northeast-2',
      PHOTO_STORE_ACCESS_KEY_ID: 'id',
      PHOTO_STORE_SECRET_ACCESS_KEY: 'secret',
    });
    expect(state).toMatchObject({ state: 'ready', config: { credentials: { kind: 'keys' } } });
  });

  it.each([
    ['버킷만', { PHOTO_STORE_BUCKET: 'b' }, 'missing:region.credentials'],
    ['키 하나만', { PHOTO_STORE_BUCKET: 'b', PHOTO_STORE_REGION: 'r', PHOTO_STORE_ACCESS_KEY_ID: 'id' }, 'missing:secret_access_key'],
    ['역할과 키를 함께', { PHOTO_STORE_BUCKET: 'b', PHOTO_STORE_REGION: 'r', PHOTO_STORE_ROLE_ARN: ROLE, PHOTO_STORE_ACCESS_KEY_ID: 'id' }, 'conflict:credentials'],
  ])('%s 이면 오설정이고 빠진 이름만 든다 — 값은 안 든다', (_name, env, problem) => {
    expect(photoStoreConfigOf({ ...NONE, ...env })).toEqual({ state: 'partial', problem });
  });

  it('실패의 분류는 이름만 — DB 검사식 안에 든다', () => {
    expect(storeErrorClassOf('put', Object.assign(new Error('arn:aws:s3:::secret-bucket denied'), { name: 'AccessDenied' }))).toBe('put:accessdenied');
    expect(storeErrorClassOf('delete', new Error('x'))).toBe('delete:unknown');
  });
});

describe('photoStoreIsOn — 이 배포의 값', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('값이 없으면 꺼짐이다 — 프로필 화면이 지금 길(DB)로 보낸다', () => {
    for (const name of Object.keys(NONE)) vi.stubEnv(name, '');
    expect(photoStoreIsOn()).toBe(false);
  });

  it('오설정도 꺼짐처럼 지금 길이다 — 사진이 안 사라진다', () => {
    for (const name of Object.keys(NONE)) vi.stubEnv(name, '');
    vi.stubEnv('PHOTO_STORE_BUCKET', 'b');
    expect(photoStoreIsOn()).toBe(false);
  });

  it('켜는 값이 서면 켜짐이다', () => {
    for (const name of Object.keys(NONE)) vi.stubEnv(name, '');
    vi.stubEnv('PHOTO_STORE_BUCKET', 'b');
    vi.stubEnv('PHOTO_STORE_REGION', 'ap-northeast-2');
    vi.stubEnv('PHOTO_STORE_ROLE_ARN', ROLE);
    expect(photoStoreIsOn()).toBe(true);
  });
});
