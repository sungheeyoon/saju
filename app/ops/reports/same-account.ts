/**
 * **지금 쪽에서** 신고받은 계정마다 처리 필요 건수 — 목록의 「이 쪽에서 처리 필요 N건」 딱지가 읽는다.
 *
 * 전체가 아니라 쪽 안의 수다. 목록 문(`operator_reports`)은 계정마다의 전체 건수를 안 내주고, 이 화면은 새 문을 안 세웠다 —
 * 그래서 딱지의 글자도 「이 쪽에서」를 든다. 계정마다의 전체 수가 필요해지면 문이 그 칸을 내야 한다.
 */
export function openByReported(
  rows: readonly { readonly isOpen: boolean; readonly reported: { readonly userId: string } }[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.isOpen) counts.set(row.reported.userId, (counts.get(row.reported.userId) ?? 0) + 1);
  }
  return counts;
}
