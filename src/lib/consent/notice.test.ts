import { describe, expect, it } from 'vitest';

import { DISCOVERY_DISCLOSURE } from '../discovery';
import {
  MATCH_PILLARS_DISCLOSURE,
  NOTICE_VERSION,
  OPTIONAL_CONSENT_NOTE,
  OPTIONAL_CONSENTS,
  noticeFor,
} from './notice';
import { scheduleOf } from './schedule';

/**
 * 일정은 **표에서 온다.** 코드 상수였다가 옮겼다 — 상수는 바꾸려면 배포해야 하고,
 * 그건 「언제든」이 아니다. 날짜 계산(파기 기한)도 함께 DB 로 갔으므로 여기서 재는
 * 것은 **반쪽 줄이 무엇이 되는가**다. 못 읽은 것과 없는 줄은 문이 잰다(`app/beta-schedule.test.ts`).
 */
describe('일정 한 줄을 안내로', () => {
  const full = {
    scheduleId: 7,
    endsOn: '2026-10-31',
    purgeBy: '2026-11-30',
    purgeWithinDays: 30,
    operatorName: '만세력 운영자',
    operatorOfficer: '홍길동',
    operatorContact: 'ops@example.com',
  };

  /** 파기 기한을 **여기서 짓지 않는다** — DB 가 낸 값을 그대로 든다 */
  it('DB 가 낸 값을 그대로 든다', () => {
    expect(scheduleOf(full)).toEqual({
      scheduleId: 7,
      dates: { endsOn: '2026-10-31', purgeBy: '2026-11-30', purgeWithinDays: 30 },
      operator: { name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' },
    });
  });

  /**
   * **반쪽은 안 낸다.** 날짜만 있고 연락처가 없으면 열람·정정·삭제를 어디에 요구하는지
   * 말할 수 없다 — 그런 안내는 지키는 것이 없는 문장만 남는다.
   */
  it('운영자가 비어 있으면 안내가 안 선다', () => {
    expect(scheduleOf({ ...full, operatorContact: null })).toBeNull();
    expect(scheduleOf({ ...full, operatorName: null })).toBeNull();
    expect(scheduleOf({ ...full, operatorOfficer: '  ' })).toBeNull();
    expect(scheduleOf({ ...full, operatorOfficer: undefined })).toBeNull();
  });
});

describe('안내 문구', () => {
  const dates = { endsOn: '2026-11-30', purgeBy: '2026-12-30', purgeWithinDays: 30 };
  const operator = { name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' };
  const text = noticeFor(dates, operator)
    .flatMap((section) => [section.title, ...section.lines])
    .join('\n');

  /** **날짜를 말한다.** 이것을 못 하면 안내를 세울 이유가 없다 */
  it('종료일과 파기 기한을 날짜로 말한다', () => {
    expect(text).toContain('2026년 11월 30일');
    expect(text).toContain('2026년 12월 30일');
  });

  /** 「추후」로 미루는 말이 들어오면 그 문장은 아무것도 약속하지 않는다 */
  it('미루는 말로 기간을 대신하지 않는다', () => {
    for (const vague of ['추후', '별도 공지', '목적 달성 시까지', '미정']) {
      expect(text, vague).not.toContain(vague);
    }
  });

  /**
   * **무엇이 나가고 무엇이 안 나가는지 갈라 말한다.**
   *
   * 「개인정보를 AI 에 보내지 않습니다」는 거짓이고 「AI 가 처리합니다」는 너무 넓다.
   * 코드가 실제로 자르는 것이 무엇인지 그대로 적는다(ADR 0008 · `redacted.ts`).
   */
  it('모델에 무엇이 가고 무엇이 안 가는지 함께 적는다', () => {
    expect(text).toContain('여덟 글자');
    expect(text).toContain('보내지 않습니다');
    expect(text).toContain('OpenAI');
  });

  /** 거부 효과 — 안 주시면 무엇이 안 되는지 */
  it('안 주시면 무엇이 안 되는지 말한다', () => {
    expect(text).toContain('제공하지 못합니다');
  });

  /** 국외 이전 — 맡기는 곳과 범위 */
  it('맡겨서 처리하는 곳을 이름으로 적는다', () => {
    expect(text).toContain('Supabase');
    expect(text).toContain('Vercel');
    expect(text).toContain('국외');
  });
});

/**
 * 처리방침이 갖춰야 하는 것들 — **없으면 지키는 것이 없는 문장만 남는다.**
 *
 * 「무엇을 받는다」만 적고 누구에게 무엇을 요구하는지 안 적으면, 열람·정정·삭제는
 * 적혀만 있는 권리가 된다. 국외로 나가는데 어디로 얼마나 가는지 안 적으면 「보냅니다」가
 * 아무것도 알리지 않는다.
 */
describe('처리방침이 갖춰야 하는 것', () => {
  const operator = { name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' };
  const dates = { endsOn: '2026-10-31', purgeBy: '2026-11-30', purgeWithinDays: 30 };
  const text = noticeFor(dates, operator)
    .flatMap((section) => [section.title, ...section.lines])
    .join('\n');

  it('누구에게 말하면 되는지 적는다', () => {
    expect(text).toContain(operator.name);
    expect(text).toContain(operator.officer);
    expect(text).toContain(operator.contact);
  });

  it('권리와 행사 방법을 적는다', () => {
    for (const right of ['열람', '정정', '삭제', '처리정지']) {
      expect(text, right).toContain(right);
    }
  });

  it('파기 절차와 방법을 적는다', () => {
    expect(text).toContain('파기 절차와 방법');
    expect(text).toContain('복구할 수 없습니다');
  });

  /** 국외 이전은 **항목·국가·시기·목적·기간·거부**가 다 있어야 한다 */
  it('국외로 나가는 곳마다 여섯 가지를 다 적는다', () => {
    for (const where of ['Supabase', 'Vercel', 'OpenAI']) {
      expect(text, where).toContain(where);
    }
    expect(text).toContain('미국');
    expect(text).toContain('이전 항목');
    expect(text).toContain('이전 시기와 방법');
    expect(text).toContain('보유기간');
    /* 거부는 처리마다 갈린다 — 피할 수 있는 이전(OpenAI)과 따로 거부할 수 없는 이전(로그 · 지원 접근) */
    expect(text).toContain('넣지 않으시면 일어나지 않습니다');
    expect(text).toContain('따로 거부할 수 없습니다');
  });

  /**
   * **거부의 효과를 숨기지 않는다.** 「거부할 수 있습니다」만 적고 그러면 무엇이
   * 안 되는지 안 적으면, 고를 수 있는 것처럼 보이는 것을 고르게 된다.
   */
  it('거부하면 무엇이 안 되는지도 적는다', () => {
    expect(text).toContain('받을 수 없고 인연 궁합 요청을 수락할 수 없지만');
    expect(text).toContain('가입하지 않거나 계정 관리에서 탈퇴를 신청하시면 됩니다');
  });

  /**
   * **참여가 기본으로 켜진 뒤로 이 관문이 그 고지를 든다**(PRD §4.1, ADR 0037).
   *
   * 전에는 참여를 켜는 화면이 이 말을 했다. 저장이 곧 참여가 되면서 그 화면을 안 지나는
   * 길이 생겼고, 그러면 **켠 적 없는 참여를 막는 것이 이 문단 하나뿐**이다. 여기서
   * 빠지면 아무도 읽지 않은 채로 남에게 보이게 된다.
   */
  it('자동 참여와 끄는 길을 관문에서 말한다', () => {
    expect(text).toContain('자동으로 참여합니다');
    expect(text).toContain('끄실 수 있습니다');
  });

  /**
   * 무엇이 나가고 무엇이 안 나가는지는 **한 자리에서 온다**(`DISCOVERY_DISCLOSURE`).
   * 여기 손으로 한 벌 더 적으면 참여 화면과 갈리고, 그때 사용자가 읽은 약속이 어느
   * 쪽인지 말할 수 없게 된다.
   */
  it('참여 화면과 같은 열거를 든다', () => {
    for (const line of [...DISCOVERY_DISCLOSURE.shown, ...DISCOVERY_DISCLOSURE.hidden]) {
      expect(text, line).toContain(line);
    }
  });
});

describe('선택 항목', () => {
  /** 둘뿐이고 **거절해도 서비스는 그대로다** */
  it('둘이고 각자 무엇에 쓰는지 적혀 있다', () => {
    expect(OPTIONAL_CONSENTS.map((one) => one.key)).toEqual(['improvement', 'contact']);

    for (const one of OPTIONAL_CONSENTS) {
      expect(one.detail.length, one.key).toBeGreaterThan(20);
    }
  });

  /**
   * **끄면 어떻게 되는지는 항목마다 제 줄로 선다.**
   *
   * 한 문장에 이어 붙여 두었더니 세 화면에서 그 덩어리가 통째로 안 읽혔다. 줄을 가른 뒤로
   * 재는 자리도 갈린다 — `detail` 은 무엇에 쓰는가, `erasure` 는 끄거나 기간이 지난 뒤다.
   */
  it('항목마다 끄면 어떻게 되는지 적혀 있다', () => {
    for (const one of OPTIONAL_CONSENTS) {
      expect(one.erasure.length, one.key).toBeGreaterThan(10);
    }
  });

  /** 철회가 곧 지움이라는 것을 문구가 든다(ADR 0022) */
  it('개선 활용은 철회하면 지운다고 말한다', () => {
    const improvement = OPTIONAL_CONSENTS.find((one) => one.key === 'improvement');

    expect(improvement?.erasure).toContain('삭제합니다');
  });

  /**
   * **「거절해도 좁아지지 않는다」는 공통 한 줄이 든다.**
   *
   * 항목마다 「사주·궁합·풀이는 그대로 이용할 수 있습니다」를 꼬리로 달고 있었다. 같은
   * 약속이 셋이면 고쳐지지 않는 자리가 생긴다 — 한 사실에 한 표기다(ADR 0027).
   */
  it('거절해도 서비스가 그대로라는 말은 한 자리에 있다', () => {
    expect(OPTIONAL_CONSENT_NOTE).toContain('서비스 이용에는 영향이 없습니다');

    for (const one of OPTIONAL_CONSENTS) {
      expect(`${one.detail}${one.erasure}`, one.key).not.toContain('그대로 이용');
    }
  });

  /** 후속 연락은 **광고가 아니다** — 합치면 하나로 받아 둘 다 쓰게 된다 */
  it('후속 연락에 홍보를 섞지 않고 보관 기한을 든다', () => {
    const contact = OPTIONAL_CONSENTS.find((one) => one.key === 'contact');

    expect(contact?.detail).toContain('광고성 메시지는 보내지 않습니다');
    /* 이메일 보관 기한은 이 항목에만 적혀 있다 — 빠지면 안내 전체에서 사라진다 */
    expect(contact?.erasure).toContain('1년');
  });
});

/** 문구가 바뀌면 판본도 바뀐다 — 「보여 준 적 있다」가 아니라 「무엇을 보여 줬나」다 */
it('안내 판본이 값으로 서 있다', () => {
  expect(NOTICE_VERSION).toBe('notice-v8');
});

/**
 * v8 의 내용 개정 — 첫 화면의 짧은 사주 문단(G-66, ADR 0180).
 *
 * 옛 판은 「사주풀이·궁합풀이를 받지 않으면 OpenAI 로 가는 처리는 일어나지 않는다」고 적었다 — 첫 화면의 문단이 그 밖에서 OpenAI 를
 * 불렀다. 받는 때 · 기록의 보존 · 쿠키 · 계정에 이어진 예외 · 거부 방법이 다 서야 그 줄이 사실과 맞는다.
 */
describe('첫 화면의 짧은 사주 문단', () => {
  const sections = noticeFor(
    { endsOn: '2026-11-30', purgeBy: '2026-12-30', purgeWithinDays: 30 },
    { name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' },
  );
  const text = sections.flatMap((section) => section.lines).join(' ');
  const outward = sections.find((section) => section.title === '국외로 나가는 것')?.lines.join(' ') ?? '';

  it('첫 화면의 문단이 OpenAI 로 가는 때와 거부 방법 · 효과를 말한다', () => {
    expect(outward).toContain('로그인하지 않고 첫 화면에서 사주를 보실 때');
    expect(text).toContain('첫 화면에서 사주를 보지 않으시면 이 처리는 일어나지 않습니다');
    expect(text).toContain('넣지 않으셔도 가입과 그 밖의 이용에는 영향이 없습니다');
    expect(text).not.toContain('사주풀이·궁합풀이를 받지 않고 궁합 요청도 수락되지 않으면');
  });

  /**
   * **갈래마다 나가는 것이 다르다.** 사주풀이 · 직접 고른 궁합은 해 · 나이 · 성별을 싣고(`REDACTED_PATHS` 에 없다), 첫 화면 문단은
   * 해 · 나이를 뺀다(`TASTE_DROPPED_PATHS`), 인연 궁합은 고른 칸만 싣는다(`limited-v1` — 성별도 없다).
   */
  it('OpenAI 로 가는 분석 정보와 갈래마다 빠지는 것을 적는다', () => {
    expect(text).toContain('계산된 명식과 태어난 해·나이·성별 등 분석 정보');
    expect(text).toContain('등록하실 때 붙인 이름과 고르신 사이');
    expect(text).toContain('인연 궁합풀이에는 태어난 해·나이·성별을 빼고');
    expect(text).toContain('두 분의 닉네임');
    expect(text).toContain('첫 화면의 짧은 사주 문단에는 태어난 해·나이를 빼고');
    expect(text).not.toContain('여덟 글자와 그 위에서 나온 사실만 보냅니다');
  });

  /**
   * **받는 자의 명칭과 연락처**(제28조의8 ② 3) — 회사의 공식 처리방침에서 찾은 연락처만 싣는다. 못 찾은 곳(OpenAI)은 링크만 선다.
   * 위탁 줄에도 첫 화면 문단이 서고(제30조 ① 4), 거부는 방법까지 말한다(제28조의8 ② 5).
   */
  it('받는 곳의 연락처 · 위탁 · 거부 방법을 적는다', () => {
    expect(outward).toContain('Supabase Pte. Ltd. — 개인정보 문의: privacy@supabase.com');
    expect(outward).toContain('Vercel Inc. — 개인정보 문의: privacy@vercel.com');
    expect(outward).toContain('OpenAI OpCo, LLC — 개인정보 관련 문의처는 이곳에 안내되어 있습니다');
    expect(outward).toContain('가입하지 않거나 계정 관리에서 탈퇴를 신청하시면 됩니다');
    expect(text).toContain('풀이와 첫 화면의 짧은 사주 문단 생성은 OpenAI 에 맡깁니다');
  });

  /**
   * **서울에서 처리하는 것은 위탁 절이, 국외에서 처리 · 접근되는 것만 국외 절이 든다**(운영자 2026-10-15). 「세 곳 모두 국외에 서버를
   * 둡니다」는 서울 리전으로 옮기기 전의 문장이다.
   */
  it('서울 리전과 국외에서 처리되는 것을 갈라 적는다', () => {
    const entrusted = sections.find((section) => section.title === '맡겨서 처리하는 곳')?.lines.join(' ') ?? '';
    expect(entrusted).toContain('Supabase 에 맡기고 서울 리전에서 처리·보관합니다');
    expect(entrusted).toContain('서버 처리(함수 실행)는 서울 리전에서 합니다');
    /* 저장 위치와 전달 경로를 가른다 — 실시간 신호는 저장(3일)만 서울이라고 말한다 */
    expect(entrusted).toContain('실시간으로 갱신하는 신호의 기록도 이 데이터베이스에 3일 남습니다');
    /* 법인 소재지를 처리 국가로 대신하지 않는다 */
    expect(outward).not.toContain('법인 소재지');
    expect(text).not.toContain('세 곳 모두 국외에 서버를 둡니다');
    /* 서울에 있는 저장 자료는 국외 절의 이전 항목이 아니다 */
    expect(outward).not.toContain('구글 계정 이메일');
    /* 「미국 등」은 국가가 아니다 — 확인된 나라만 싣는다(운영자 2026-10-15) */
    expect(outward).not.toContain('미국 등');
    expect(outward).toContain('유럽연합(EU)의 데이터센터');
    /* 국외 이전의 근거(시행령 제31조 ① 2) — 단정할 수 있는 처리에만 */
    expect(outward).toContain('제28조의8 제1항 제3호');
  });

  /**
   * **안전성 확보 조치**(시행령 제31조 ① 3) — 확인되는 조치만. 운영자 2단계 인증은 보류라(G-65) 적지 않고, 저장 암호화는
   * 공식 문서로 확인하지 못해 적지 않는다.
   */
  it('확인되는 안전 조치만 적는다', () => {
    const safety = sections.find((section) => section.title === '개인정보를 지키는 조치')?.lines.join(' ') ?? '';
    expect(safety).toContain('행 단위 접근 정책');
    expect(safety).toContain('누가·언제·무엇을 열람했는지 기록');
    expect(safety).toContain('HTTPS');
    expect(safety).not.toContain('2단계');
    expect(safety).not.toContain('저장할 때 암호화');
  });

  /** 역산 문장은 처리방침에 두지 않는다 — 경계까지 검증하지 않았다(ADR 0180) */
  it('역산을 처리방침에서 말하지 않는다', () => {
    expect(text).not.toContain('60년');
    expect(text).not.toContain('하나로 정해');
  });

  it('임시 기록 24시간 · 쿠키 7일 · 계정에 이어진 예외를 말한다', () => {
    expect(text).toContain('만든 때부터 24시간 뒤 지웁니다');
    expect(text).toContain('쿠키는 7일 뒤 사라지며');
    expect(text).toContain('계정의 풀이 기록으로 남고 탈퇴하실 때 지웁니다');
  });

  /** 새 메시지 알림은 이 판에 없다 — 회사 표가 찬 뒤 알림을 켜기 전에 따로 올린다(ADR 0180) */
  it('웹 푸시의 줄을 싣지 않는다', () => {
    for (const absent of ['구독 주소', '푸시', 'Google LLC', 'Apple Inc.']) {
      expect(text, absent).not.toContain(absent);
    }
  });
});

/** v6 의 내용 개정 넷 — 한 판본에 다 서야 확인자가 한 번만 불려 온다(#165) */
it('안내가 대화 90일 · OpenAI 의 때 셋 · 3일 자동 처분 · 신고 기록 6개월을 말한다', () => {
  const text = noticeFor(
    { endsOn: '2026-11-30', purgeBy: '2026-12-30', purgeWithinDays: 30 },
    { name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' },
  )
    .flatMap((section) => section.lines)
    .join(' ');

  expect(text).toContain('닫힌 날부터 90일');
  expect(text).toContain('궁합풀이가 자동으로 만들어질 때');
  expect(text).toContain('신청 후 3일 이내에 파기합니다');
  expect(text).toContain('탈퇴 처리일부터 6개월');
  expect(text).not.toContain('영업일');
  expect(text).not.toContain('운영자가 확인한 뒤');
});

it('가입 안내도 상세 궁합의 양방향 여덟 글자 공개를 직접 알린다', () => {
  const text = noticeFor(
    { endsOn: '2026-11-30', purgeBy: '2026-12-30', purgeWithinDays: 30 },
    { name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' },
  )
    .flatMap((section) => section.lines)
    .join(' ');

  expect(text).toContain(MATCH_PILLARS_DISCLOSURE);
  expect(text).not.toContain('드러날 수 있습니다');
});
