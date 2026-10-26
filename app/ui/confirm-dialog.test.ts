import { createElement, Fragment } from 'react';
import { describe, expect, it } from 'vitest';

import { autoActions } from './confirm-dialog';

describe('확인 창의 단추 줄 — 나란히가 기본, 글자가 반 칸을 넘으면 위아래', () => {
  it('짧은 두 단추는 나란히 선다 — 차단 · 사진 지우기 · 요청 취소 · 탈퇴 신청', () => {
    expect(autoActions('차단하기', '취소')).toBe('row');
    expect(autoActions('삭제', '취소')).toBe('row');
    expect(autoActions('요청 취소', '닫기')).toBe('row');
    expect(autoActions('탈퇴 신청하기', '취소')).toBe('row');
    expect(autoActions('삭제', '취소')).toBe('row');
  });

  it('여섯 자(띄어쓰기 빼고)를 넘는 단추가 하나라도 있으면 위아래 — 390px 반 칸에 안 든다', () => {
    expect(autoActions('사주풀이 다시 받기', '취소')).toBe('stack');
    expect(autoActions('바꾸고 저장하기', '취소')).toBe('stack');
  });

  it('창 안의 실행 글자를 줄이면 나란히 든다 — 다시 받기 · 출생 정보 바꾸기 창(운영자 2026-10-26)', () => {
    expect(autoActions('다시 받기', '취소')).toBe('row');
    expect(autoActions('바꾸기', '취소')).toBe('row');
    expect(autoActions('사주풀이 받기', '취소')).toBe('row');
  });

  it('그림과 함께 선 글자도 글자만 잰다', () => {
    expect(
      autoActions(createElement(Fragment, null, createElement('svg'), '요청 보내기'), '취소'),
    ).toBe('row');
  });

  it('닫기가 없는 고지(단추 하나)는 나란히 줄에 혼자 꽉 찬다', () => {
    expect(autoActions('풀이권 구매', null)).toBe('row');
  });
});
