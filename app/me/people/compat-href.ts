/**
 * 한 사람에서 궁합의 첫 걸음(`/compat`)으로 가는 주소 — **두 칸을 person id 로만 채운다.**
 *
 * 저장한 사람 타일 · 사람 상세 · 홈의 「나와 궁합」이 같은 길을 낸다. 고르는 칸은 주소의 `#` 뒤에서
 * `a.person` · `b.person` 을 읽어 그 사람을 앉힌다(`compat-picker.tsx`). 출생 원문은 싣지 않는다 — 남이
 * 등록해 준 가족의 생년월일시가 주소창에 실리는 것은 ADR 0007 이 막으려던 일이다. id 는 불투명하고 접근은
 * RLS 가 잠근다.
 *
 * - 내 사주가 있고 다른 사람이면 **나 × 그 사람**으로 두 칸이 다 찬다 — 궁합을 보러 오는 사람은 대개 자기와
 *   누군가를 견주려는 것이다.
 * - 내 사주가 없거나 그 사람이 나면 **첫 칸만** 그 사람으로 찬다(ADR 0036). 둘째 칸을 비워 두는 것은
 *   고르는 칸이 첫 칸을 목록의 첫 사람으로 메우다가 같은 사람을 두 칸에 앉히지 않게 하려는 것이다.
 */
export function compatHrefFor(selfPersonId: string | null, personId: string): string {
  if (selfPersonId === null || selfPersonId === personId) return `/compat#a.person=${personId}`;
  return `/compat#a.person=${selfPersonId}&b.person=${personId}`;
}
