/**
 * **미리보기 그림 속 이름은 상수와 같다**(G-58 ㉢).
 *
 * 그림 속 글자는 구워 둔 픽셀이라 `SERVICE_NAME` 을 바꿔도 따라오지 않는다 — 이름을 「만세력」에서 「점점」으로(2026-09-24)
 * 바꾼 날 메타데이터는 다 따라왔는데 그림 셋만 옛 이름으로 남았다. 굽는 도구(`brand-share-images.mjs`)가 구운
 * 이름을 옆 JSON 에 적고, 여기서 상수와 견준다. 붉으면 도구를 다시 돌린다.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SERVICE_NAME, SERVICE_TAGLINE } from '@/src/lib/brand';

const root = resolve(__dirname, '..');
const stamp = JSON.parse(readFileSync(join(root, 'scripts/brand-share-images.json'), 'utf8')) as {
  name: string;
  tagline: string;
  images: string[];
};

describe('공유 미리보기 그림', () => {
  it('지금의 서비스 이름과 소개 한 줄로 구워졌다', () => {
    expect(stamp.name).toBe(SERVICE_NAME);
    expect(stamp.tagline).toBe(SERVICE_TAGLINE);
  });

  it('구운 그림이 공개 경로에 있고 메타데이터가 그 그림을 가리킨다', () => {
    const said = read('app/layout.tsx') + read('app/share/preview.ts');
    for (const image of stamp.images) {
      expect(existsSync(join(root, 'public/brand', image))).toBe(true);
      expect(said).toContain(`/brand/${image}`);
    }
    expect(said).not.toMatch(/share-v[123]\.jpg/);
  });
});

/**
 * **탭 그림의 대체판이 있다**(ADR 0149). `/favicon.ico` 가 404 라 탭에 기본 그림이 섰다(2026-10-07) — Safari 는 SVG 를 안 읽는다.
 * 굽는 도구는 `scripts/brand-icons.mjs` 다.
 */
describe('탭 그림', () => {
  it('favicon.ico 가 16 · 32 · 48 세 판을 든다', () => {
    const ico = readFileSync(join(root, 'app/favicon.ico'));
    expect(ico.readUInt16LE(2)).toBe(1);
    const count = ico.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, index) => ico.readUInt8(6 + index * 16));
    expect(sizes).toEqual([16, 32, 48]);
  });

  it('apple-icon.png 가 180 이다', () => {
    const png = readFileSync(join(root, 'app/apple-icon.png'));
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([180, 180]);
  });
});

function read(path: string) {
  return readFileSync(join(root, path), 'utf8');
}
