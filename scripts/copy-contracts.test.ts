/**
 * **글자가 곧 결정인 문장** — 한 글자를 바꾸는 것이 약속을 바꾸는 것이다 (#147).
 *
 * 여기 리터럴은 **제품 코드에서 가져오지 않는다.** 제품과 시험이 같은 상수를 읽으면 둘이 함께 틀려도
 * 초록이다(`chat.spec.ts` 가 `RATE_LIMITED_TEXT` 를 그렇게 쓴다 — 화면에 뜨는지를 재는 데는 그걸로 된다).
 * 이 파일은 글자를, e2e 는 그 글자가 화면에 서는 것을 잰다. 바꿀 일이 생기면 사람이 승인한 새 글자를 여기
 * 먼저 적는다.
 *
 * 뜻만 지키면 되는 문장(버튼 · 상태 안내 · 동의 질문 · 되돌릴 수 없다는 경고)은 여기 없다 — e2e 의 역할 이름과
 * 본문 단언이 든다. **탈퇴 안내**(보존 · 삭제 기간과 처분 결과)는 G-51 이 대화 보존 한 줄을 더하는 날 여기 든다.
 *
 * 화면에만 있는 계약 하나는 e2e 가 리터럴로 든다 — 처리방침의 이름(`notice.spec.ts` 의 heading · link).
 */
import { describe, expect, it } from 'vitest';

import { RATE_LIMITED_TEXT } from '../src/lib/chat';
import { CONSENT_FLOW_STEPS } from '../src/lib/consent';
import { MATCH_PILLARS_DISCLOSURE, NOTICE_ACK_LABEL, OPTIONAL_CONSENTS } from '../src/lib/consent/notice';
import { READING_USES_TICKET_NOTE, REQUEST_RESERVES_NOTE } from '../src/lib/reading';

describe('계약 문구', () => {
  it('가입 안내의 동의 확인문', () => {
    expect(NOTICE_ACK_LABEL).toBe('위 내용을 확인했습니다');
  });

  it('설문 동의를 끄면 무엇이 지워지나', () => {
    expect(OPTIONAL_CONSENTS.find((consent) => consent.key === 'improvement')?.erasure).toBe(
      '동의를 끄면 지금까지 남긴 설문 답변을 삭제합니다.',
    );
  });

  it('수락하면 무엇이 공개되고 무엇은 안 되나', () => {
    expect(MATCH_PILLARS_DISCLOSURE).toBe(
      '수락하면 내 사주팔자 여덟 글자가 상대에게 공개되고, 상대의 사주팔자 여덟 글자도 나에게 공개됩니다. 정확한 생년월일시와 출생지는 공개되지 않습니다.',
    );
  });

  it('요청을 보내는 것만으로는 상대에게 열리는 것이 없다', () => {
    expect(CONSENT_FLOW_STEPS.find((step) => step.title === '요청을 보냅니다')?.body).toBe(
      '인연 목록에서 마음이 가는 사람에게 「상세 궁합을 함께 보자」고 청합니다. 보내는 것만으로 상대에게 열리는 것은 없고, 상대의 소식에 요청이 하나 뜹니다.',
    );
  });

  it('풀이권 — 요청의 임시 차감 · 확정 · 돌아옴', () => {
    expect(REQUEST_RESERVES_NOTE).toBe(
      '요청을 보내면 풀이권 1회가 임시로 차감됩니다. 상대가 수락하면 차감이 확정되고, 두 사람이 함께 볼 궁합풀이가 만들어집니다. 상대가 거절하거나 7일 동안 응답하지 않으면 풀이권이 돌아옵니다.',
    );
  });

  it('풀이권 — 내 풀이의 사용과 실패 시 복구', () => {
    expect(READING_USES_TICKET_NOTE).toBe('계속하면 풀이권 1회가 사용됩니다. 생성에 실패하면 풀이권이 복구됩니다.');
  });

  it('승인된 채팅 한도 거절 문장 (ADR 0091)', () => {
    expect(RATE_LIMITED_TEXT).toBe('메시지를 너무 빠르게 보내고 있습니다. 잠시 뒤에 다시 보내 주세요.');
  });
});
