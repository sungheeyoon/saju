import { calledName, withNicknames } from './display';

/**
 * **받은 공유본의 판정과 글자** — 웹(`app/share/`)과 앱(`mobile/src/share/`)이 함께 쓴다. 읽는 문(`shared_reading`)과 그리는 일은
 * 각자 한다. 두 벌이면 앱에서만 갈래가 다른 토큰이 열리거나 궁합 글의 호칭이 그대로 선다.
 */
export type ShareKind = 'self' | 'person' | 'private';

export type SharedReading = {
  readonly metaphor: string | null;
  readonly score: number | null;
  readonly body: string;
  readonly nameA: string | null;
  readonly nameB: string | null;
};

/** 문 `shared_reading` 이 내는 칸 가운데 여기서 읽는 것 */
type SharedRow = {
  readonly kind: string;
  readonly name_a?: string | null;
  readonly name_b?: string | null;
  readonly metaphor?: string | null;
  readonly score?: number | null;
  readonly body: string;
};

/**
 * 문의 답 한 행을 화면이 읽을 꼴로 — **행이 없거나 주소가 맡은 갈래와 다르면 안 연다**(`null`).
 * 미리보기가 거짓말을 하는 자리라 화면이 아니라 여기서 막는다. 없는 링크와 못 여는 링크는 안 가른다.
 */
export function sharedReadingOfRow(row: SharedRow | undefined, expect: ShareKind): SharedReading | null {
  if (row === undefined || row.kind !== expect) return null;

  /* 생성 타입은 **반환의 `null` 허용을 안 적는다** — 한 사람 글에는 `name_b` 가 없다 */
  const nameA = row.name_a ?? null;
  const nameB = row.name_b ?? null;

  /*
    **궁합 글은 자리 호칭으로 온다**(운영자 2026-10-15) — 공유본에 얼린 두 이름표로 바꿔 세운다. 두 칸은 `charts.a` ·
    `charts.b` 차례로 얼었다(`share_my_reading` 이 `reading_scope` 의 차례를 따른다). 하나라도 없으면 호칭 그대로 둔다 —
    제목(`sharedTitle`)도 그때 이름 없이 선다. 저장된 공유본은 원문 그대로라 이름표를 나중에 고쳐도 받은 링크는 그대로다.
  */
  const named = (text: string): string =>
    row.kind === 'private' && nameA !== null && nameB !== null
      ? withNicknames(text, { first: nameA, second: nameB })
      : text;

  return {
    metaphor: row.metaphor === null || row.metaphor === undefined ? null : named(row.metaphor),
    score: row.score ?? null,
    body: named(row.body),
    nameA,
    nameB,
  };
}

/**
 * 공유본의 제목 — **누구의 무엇인가.**
 *
 * 부르는 말은 `calledName` 이 정한다. 본문이 쓰는 규칙과 같은 것을 써야 머리와
 * 본문이 같은 사람을 같은 이름으로 부른다.
 *
 * 두 사람은 `×` 로 잇는다. 목록이 이미 그렇게 적고 있고(`line.ts`), 조사를 안 쓰므로
 * 이름 끝의 받침에 따라 「과」와 「와」가 갈리는 자리를 아예 안 만든다.
 *
 * **이름을 못 구했으면 갈래 이름만 세운다.** 「님의 사주풀이」처럼 앞이 빈 제목을
 * 세우느니, 누구 것인지 모른다는 사실이 그대로 보이는 편이 낫다.
 */
export function sharedTitle(kind: ShareKind, nameA: string | null, nameB: string | null): string {
  const a = nameA === null ? '' : calledName(nameA);
  const b = nameB === null ? '' : calledName(nameB);

  if (kind === 'private') {
    return a !== '' && b !== '' ? `${a} × ${b} 궁합풀이` : '두 사람의 궁합풀이';
  }

  return a !== '' ? `${a}의 사주풀이` : '사주풀이';
}

/**
 * 받은 공유본의 머리 한 줄과 끝의 초대. 내 풀이와 저장한 사람의 풀이는 받은 사람에게 둘 다 「사주풀이」 한 편이라 같은 글자다.
 * 궁합풀이는 글이 달라 제 줄이 있다.
 */
const SAJU_SHARE = {
  eyebrow: '공유받은 사주풀이',
  invitation: {
    heading: '내 사주도 직접 읽어보세요',
    note: '생년월일시를 입력하면 나만의 사주를 확인하고, 그 근거를 바탕으로 풀이를 받아볼 수 있어요.',
  },
} as const;

export const SHARE_COPY: Record<ShareKind, { eyebrow: string; invitation: { heading: string; note: string } }> = {
  self: SAJU_SHARE,
  person: SAJU_SHARE,
  private: {
    eyebrow: '공유받은 궁합풀이',
    invitation: {
      heading: '다른 사람과의 궁합도 읽어보세요',
      note: '두 사람의 생년월일시를 입력하면 두 사람의 궁합을 확인하고, 그 근거를 바탕으로 풀이를 받아볼 수 있어요.',
    },
  },
};
