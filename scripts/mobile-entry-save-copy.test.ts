import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **앱 입구와 결과 화면 저장의 잠금** — 글자는 웹의 것이고(입구의 줄은 머리글 · 바닥글, 저장은 `app/save-for-reading.tsx`), 앱에 화면이 있는 안내는 웹을 열지 않으며,
 * 풀이권을 팔지 않는 앱은 구매를 권하지 않는다.
 */
const read = (file: string) => readFileSync(join(import.meta.dirname, '..', file), 'utf8');

describe('앱 입구', () => {
  const entry = read('mobile/src/app/index.tsx');

  it('로그인 글자는 웹 머리글의 그것이고 안내 링크는 웹 바닥글과 같은 상수다', () => {
    expect(read('app/site-header.tsx')).toMatch(/^\s*로그인\s*$/m);
    expect(entry).toMatch(/<Text[^>]*>로그인<\/Text>/);
    expect(read('app/site-footer.tsx')).toContain('GUIDE_LINKS');
    expect(entry).toContain("from '@brand/links'");
  });

  it('입력 없이 들어가는 길과 소개로 가는 길이 있다', () => {
    expect(entry).toContain("router.push('/auth'");
    expect(entry).toContain("href: '/landing'");
  });
});

describe('결과 화면의 저장', () => {
  const screen = read('mobile/src/reading/save-self.tsx');
  const web = read('app/save-for-reading.tsx');

  it.each(['이 사주가 내 사주 맞나요?', '첫 화면에 입력한 정보예요.', '내 사주로 저장', '다른 사람의 사주예요', '저장하고 계속하기', '저장한 사람 관리 →'])('%s', (words) => {
    expect(web).toContain(words);
    expect(screen).toContain(words);
  });

  it('내 사주 물음이 저장 카드보다 먼저 갈린다 — 묻지 않고 내 사주로 저장하지 않는다', () => {
    const body = screen.slice(screen.indexOf('export function SavePersonForReading'), screen.indexOf('/** 저장한 사람으로 저장한다'));
    expect(body.indexOf('<SelfConfirm')).toBeGreaterThan(-1);
    expect(body.indexOf('<SelfConfirm')).toBeLessThan(body.indexOf('<SaveCard'));
    expect(screen.slice(screen.indexOf('function SaveCard'), screen.indexOf('function SelfConfirm'))).not.toContain('saveSelfPerson');
  });
});

describe('앱에 있는 화면은 앱에서 연다', () => {
  it.each([
    ['mobile/src/settings/settings-screen.tsx', "router.push('/privacy'"],
    ['mobile/src/credits/credits.tsx', "router.push('/refund?from=credits'"],
  ])('%s', (file, path) => {
    const text = read(file);
    expect(text).toContain(path);
    expect(text).not.toContain('openBrowserAsync');
  });
});

describe('앱은 풀이권을 팔지 않는다', () => {
  it('풀이권 부족 창에 구매 단추가 없고 판매가 닫힌 웹의 글자가 선다', () => {
    const dialogs = read('mobile/src/reading/dialogs.tsx');
    expect(dialogs).not.toContain('BUY_CREDITS_LABEL');
    expect(dialogs).not.toContain('/me/credits');
    expect(dialogs).toContain('SALE_CLOSED_NOTE');
    expect(dialogs).toContain('SALE_CLOSED_OK');
    expect(read('mobile/src/reading/api.ts')).not.toContain('my_reading_sale_is_open');

    const today = read('mobile/src/matching/today.tsx');
    expect(today).not.toContain('BUY_CREDITS_LABEL');
    expect(today).toContain('SALE_CLOSED_NOTE');
    expect(read('mobile/src/matching/doors.ts')).not.toContain('my_reading_sale_is_open');
  });
});

describe('인연 탭', () => {
  it('덱을 읽기 전에 참여를 열고 못 열면 까닭을 낸다', () => {
    const doors = read('mobile/src/matching/doors.ts');
    const deck = doors.slice(doors.indexOf('export function readDeck'));
    expect(deck.indexOf('openParticipation()')).toBeGreaterThan(-1);
    expect(deck.indexOf('openParticipation()')).toBeLessThan(deck.indexOf("rpc('my_discovery_board')"));
    expect(deck).toContain('saveFailureOf(opened)');
  });
});
