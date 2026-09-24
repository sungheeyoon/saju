import { createHash } from 'node:crypto';

/**
 * 운영자 접속기록 **한 묶음을 파일 하나로** 짓는다 — 매일 S3 로 나가는 모양 (G-23 ⑩, ADR 0105).
 *
 * 파일은 JSON Lines 다. **첫 줄이 머리**(행 수 · 첫/마지막 번호 · 이어지는 자리 · 본문의 sha256)이고 그 뒤가
 * 한 줄에 한 행이다. 해시는 머리를 뺀 본문(행 줄들, 끝 줄바꿈 포함)의 것이다 — 머리가 제 해시를 품을 수 없어서다.
 * 받는 쪽은 첫 줄을 떼고 나머지의 sha256 을 머리와 견주면 된다.
 *
 * **객체 키는 범위가 정한다** — `operator-access/<첫 줄의 서울 날짜>/<첫 번호>-<마지막 번호>.jsonl`. 올리고
 * 나서 범위를 적지 못해 다음 날 같은 범위를 다시 올려도 같은 키가 된다(Versioning 이 판을 하나 더 둘 뿐이다).
 * 번호는 열두 자리로 채운다 — 키를 이름순으로 늘어놓으면 번호순이 된다.
 *
 * 여기 드는 칸은 DB 가 기록한 것뿐이다 — 운영자 id · 시각 · 동작 · 대상 신고 id · 거른 조건 · CLI 의 목적과 해시 ·
 * 성공/거절. 반출본은 Compliance 로 잠겨 지울 수 없으므로 **이용자 개인정보 원문을 이 모양에 더하지 않는다.**
 */

/** DB 의 한 줄 — `audit_export_batch` 가 내는 칸 그대로 */
export type AccessLine = {
  readonly id: number;
  readonly at: string;
  readonly channel: string;
  readonly actor_user_id: string | null;
  readonly actor_name: string | null;
  readonly action: string;
  readonly target_report_id: string | null;
  readonly filter_summary: string | null;
  readonly purpose: string | null;
  readonly sql_sha256: string | null;
  readonly outcome: string;
  /** CLI 결과 줄이면 그 결과가 가리키는 질의 줄의 번호 · 성공/실패 · 오류 분류(`20261014090000`) */
  readonly result_of: number | null;
  readonly result: string | null;
  readonly error_class: string | null;
};

export type BundleHead = {
  readonly kind: 'saju-operator-access';
  /** 2 — CLI 결과 칸 셋이 더해졌다(`20261014090000`). 1 은 그 전의 파일이다 */
  readonly version: 2;
  readonly rows: number;
  readonly first_id: number;
  readonly last_id: number;
  /** 이 묶음이 이어지는 자리 — 앞 반출의 마지막 번호. 처음이면 0 */
  readonly after_id: number;
  readonly sha256: string;
  readonly exported_at: string;
};

export type Bundle = {
  readonly key: string;
  readonly body: string;
  readonly head: BundleHead;
};

const pad = (id: number) => String(id).padStart(12, '0');

/** 서울 날짜 — `YYYY/MM/DD`. 서버는 UTC 라 시간대를 적지 않으면 자정 무렵 줄이 전날로 간다 */
function seoulDay(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((one) => one.type === type)?.value ?? '00';
  return `${part('year')}/${part('month')}/${part('day')}`;
}

/** 칸의 차례를 고정한다 — DB 가 칸을 더해도 파일의 모양은 여기서만 바뀐다 */
const lineOf = (line: AccessLine): string =>
  JSON.stringify({
    id: line.id,
    at: line.at,
    channel: line.channel,
    actor_user_id: line.actor_user_id,
    actor_name: line.actor_name,
    action: line.action,
    target_report_id: line.target_report_id,
    filter_summary: line.filter_summary,
    purpose: line.purpose,
    sql_sha256: line.sql_sha256,
    outcome: line.outcome,
    result_of: line.result_of,
    result: line.result,
    error_class: line.error_class,
  });

export const sha256Hex = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

/**
 * @param lines 번호 차례로, 비어 있지 않게 — 빈 묶음은 올리지 않는다
 * @throws 비었거나 번호 차례가 아니면. 그런 묶음을 올리면 머리의 범위가 거짓이 된다
 */
export function bundleOf(lines: readonly AccessLine[], afterId: number, exportedAt: Date): Bundle {
  if (lines.length === 0) throw new Error('audit-export: 빈 묶음은 짓지 않는다');
  for (let at = 0; at < lines.length; at += 1) {
    const previous = at === 0 ? afterId : lines[at - 1].id;
    if (lines[at].id <= previous) throw new Error('audit-export: 번호가 차례가 아니다');
  }

  const rows = `${lines.map(lineOf).join('\n')}\n`;
  const first = lines[0];
  const last = lines[lines.length - 1];
  const head: BundleHead = {
    kind: 'saju-operator-access',
    version: 2,
    rows: lines.length,
    first_id: first.id,
    last_id: last.id,
    after_id: afterId,
    sha256: sha256Hex(rows),
    exported_at: exportedAt.toISOString(),
  };

  return {
    key: `operator-access/${seoulDay(first.at)}/${pad(first.id)}-${pad(last.id)}.jsonl`,
    body: `${JSON.stringify(head)}\n${rows}`,
    head,
  };
}
