import { bundleOf, type AccessLine, type Bundle } from './bundle';

/**
 * 하루 한 번의 반출 — **읽고, 올리고, 적는다** (G-23 ⑩, ADR 0105).
 *
 * 차례가 곧 안전이다. 올리기 전에 범위를 적으면 올리다 실패한 날의 줄이 「나갔다」로 남아 빠진다. 그래서 올린
 * **뒤에** 적는다(`audit_export_done`). 올렸는데 적지 못하면 다음 실행이 같은 범위를 같은 키로 다시 올린다 —
 * 겹친 판은 버전으로 남고 기록은 한 벌이다. 적는 문은 앞 반출의 끝에서 이어지지 않으면 거절한다.
 *
 * 무엇을 부르는지는 밖에서 받는다 — DB 의 두 문과 올리는 손. 시험은 가짜 둘로 이 차례를 잰다
 * (`export.test.ts`). 진짜는 `route.ts` 가 잇는다.
 */

export type ExportSource = {
  /** 지난 반출 뒤의 줄 — 각 줄이 이어지는 자리(`after_id`)를 함께 든다 */
  readonly batch: (limit: number) => Promise<readonly (AccessLine & { readonly after_id: number })[]>;
  readonly done: (bundle: Bundle) => Promise<void>;
};

export type Upload = (bundle: Bundle) => Promise<void>;

export type ExportResult = {
  readonly objects: readonly string[];
  readonly rows: number;
};

/** 한 파일의 행 수 — 한 달 치 운영자 읽기를 넉넉히 넘는다 */
export const BATCH_ROWS = 5000;
/** 한 번에 올리는 파일 수 — 밀린 날이 있어도 한 번 실행이 끝나게 */
export const MAX_OBJECTS = 20;

export async function exportOnce(source: ExportSource, upload: Upload, now: () => Date): Promise<ExportResult> {
  const objects: string[] = [];
  let rows = 0;

  for (let round = 0; round < MAX_OBJECTS; round += 1) {
    const lines = await source.batch(BATCH_ROWS);
    if (lines.length === 0) break;

    const bundle = bundleOf(lines, lines[0].after_id, now());
    await upload(bundle);
    await source.done(bundle);

    objects.push(bundle.key);
    rows += bundle.head.rows;
    if (lines.length < BATCH_ROWS) break;
  }

  return { objects, rows };
}

/** 반출을 켜는 값 넷 — 하나라도 없으면 반출은 「설정 안 됨」으로 조용히 끝난다 */
export type ExportConfig = {
  readonly bucket: string;
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
};

type MaybeEnv = Readonly<Record<
  'AUDIT_EXPORT_BUCKET' | 'AUDIT_EXPORT_REGION' | 'AUDIT_EXPORT_ACCESS_KEY_ID' | 'AUDIT_EXPORT_SECRET_ACCESS_KEY',
  string | undefined
>>;

/**
 * 넷이 다 있어야 켜진다. **AWS 계정이 아직 없다**(2026-09-24) — 그동안 크론은 매일 「설정 안 됨」으로 200 을
 * 내고 끝난다. 실패로 세우면 켜기 전까지 날마다 붉은 줄이 서고, 그 붉음에 익으면 진짜 실패를 못 본다.
 * 셋만 있는 반쯤 넣은 상태도 「설정 안 됨」이다 — 올리다 실패하는 것보다 이름이 분명하다.
 */
export function configOf(env: MaybeEnv): ExportConfig | null {
  const bucket = env.AUDIT_EXPORT_BUCKET?.trim();
  const region = env.AUDIT_EXPORT_REGION?.trim();
  const accessKeyId = env.AUDIT_EXPORT_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.AUDIT_EXPORT_SECRET_ACCESS_KEY?.trim();
  if (!bucket || !region || !accessKeyId || !secretAccessKey) return null;
  return { bucket, region, accessKeyId, secretAccessKey };
}
