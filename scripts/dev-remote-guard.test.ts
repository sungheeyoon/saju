import { describe, expect, it } from 'vitest';

import { remoteDevRefusal } from '../src/lib/local-env';

describe('remoteDevRefusal', () => {
  it('로컬 스택 주소면 개발 서버가 붙는다', () => {
    expect(remoteDevRefusal('http://127.0.0.1:54321', undefined)).toBeNull();
    expect(remoteDevRefusal('http://localhost:54321', undefined)).toBeNull();
  });

  it('운영 주소면 거절하고 로컬로 띄우는 길과 스위치를 말한다', () => {
    const refusal = remoteDevRefusal('https://abc.supabase.co', undefined);
    expect(refusal).toContain('abc.supabase.co');
    expect(refusal).toContain('scripts/ui-dev.mjs');
    expect(refusal).toContain('DEV_ALLOW_REMOTE=1');
  });

  it('스위치를 켜면 운영 주소에도 붙는다', () => {
    expect(remoteDevRefusal('https://abc.supabase.co', '1')).toBeNull();
  });

  it('주소가 비었거나 주소가 아니면 거절하지 않는다 — 붙을 곳이 없다', () => {
    expect(remoteDevRefusal('', undefined)).toBeNull();
    expect(remoteDevRefusal('not a url', undefined)).toBeNull();
  });
});
