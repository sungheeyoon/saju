/** 읽었거나 못 읽었거나 — `app/db-error` 의 `SkippableRead` 와 같은 모양이고, 앱도 같은 것을 넘긴다 */
type Seen<T> = { readonly ok: true; readonly value: T } | { readonly ok: false };

/**
 * **방 머리의 궁합 단추가 드는 상태** — 그 Match 의 인연 궁합이 지금 어디까지 왔나(ADR 0155 「2026-10-11 저녁 덧」).
 *
 * - `ready` — 글이 섰다. 점수는 인연 궁합 화면의 「궁합풀이 점수」와 **같은 칸**(`my_reading` 의 `score`)이다 — 지어내지 않는다
 * - `making` — 도는 시도가 있다(수락이 연 자동 생성 · 누가 다시 받기를 누른 것)
 * - `failed` — 글이 없고 마지막 시도가 실패했다. 인연 궁합 화면에 「궁합풀이 받기」가 서 있다(ADR 0038)
 * - `quiet` — 말할 것이 없다: 못 읽었거나, 글도 시도도 없는 옛 Match 이거나, 점수가 없는 글이다. 단추는 이름만 선다
 */
export type RoomCompat =
  | { readonly kind: 'ready'; readonly score: number }
  | { readonly kind: 'making' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'quiet' };

/**
 * **시트의 궁합 한 줄이 보이는 글자**(`CompatRow`) — 왼쪽 낱말들(「궁합」 · 「82점」 · 「만드는 중…」)과 오른쪽 끝 글자(볼 풀이가 있으면
 * 「궁합풀이 보기」, 실패면 「다시 받기」). 읽는 이름(`name`)은 보이는 글자를 차례대로 이은 것이다 — 음성으로 누르는 사람이 보이는 글자로
 * 부를 수 있게(WCAG 2.5.3). 아이콘 · 「›」는 글자가 아니다.
 */
export function compatRowParts(compat: RoomCompat): { lead: readonly string[]; tail: string | null; name: string } {
  const lead =
    compat.kind === 'ready' ? ['궁합', `${compat.score}점`] : compat.kind === 'making' ? ['궁합', '만드는 중…'] : ['궁합'];
  const tail = compat.kind === 'ready' ? '궁합풀이 보기' : compat.kind === 'failed' ? '다시 받기' : null;
  return { lead, tail, name: [...lead, ...(tail === null ? [] : [tail])].join(' ') };
}

/** 읽은 글 — 없으면 `null` */
export type ReadingSeen = { readonly score: number | null } | null;

/** 마지막 시도의 상태 — 시도가 없으면 `null` */
export type RunSeen = string | null;

/**
 * 두 읽기를 단추의 상태 하나로 접는다. **글이 이긴다** — 글이 있는 인연 궁합에는 다시 받기가 없어(ADR 0038) 뒤의 시도가 없다.
 * 글을 못 읽은 날은 시도만으로 「실패」를 말하지 않는다 — 글이 있는데 못 읽은 것일 수 있다.
 */
export function roomCompatOf(reading: Seen<ReadingSeen>, run: Seen<RunSeen>): RoomCompat {
  if (!reading.ok) return { kind: 'quiet' };
  if (reading.value !== null) {
    return reading.value.score === null ? { kind: 'quiet' } : { kind: 'ready', score: reading.value.score };
  }
  if (!run.ok) return { kind: 'quiet' };
  if (run.value === 'running') return { kind: 'making' };
  if (run.value === 'failed') return { kind: 'failed' };
  return { kind: 'quiet' };
}

/**
 * 단추를 읽는 이름 — 보이는 글자를 품는다(폰에서 글자가 빠져도 이름은 같다). 글자는 운영자 시안(2026-10-11 저녁)이다 — 이 단추에는
 * 「인연」을 쓰지 않는다(ADR 0155 「2026-10-11 저녁 덧」).
 */
export function compatChipName(compat: RoomCompat): string {
  switch (compat.kind) {
    case 'ready':
      return `궁합 ${compat.score}점`;
    case 'making':
      return '궁합 만드는 중';
    case 'failed':
      return '궁합 다시 받기';
    case 'quiet':
      return '궁합';
  }
}
