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
  /** 이번에 올린 번호 범위 — 올린 것이 없으면 null */
  readonly firstId: number | null;
  readonly lastId: number | null;
};

/** 한 파일의 행 수 — 한 달 치 운영자 읽기를 넉넉히 넘는다 */
export const BATCH_ROWS = 5000;
/** 한 번에 올리는 파일 수 — 밀린 날이 있어도 한 번 실행이 끝나게 */
const MAX_OBJECTS = 20;

/** 어느 걸음에서 넘어졌나 — 실패의 분류가 된다 */
type Step = 'batch' | 'upload' | 'done';

class ExportStepError extends Error {
  constructor(readonly step: Step, readonly reason: unknown) {
    super(`audit-export: ${step}`);
  }
}

async function step<T>(name: Step, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw new ExportStepError(name, error);
  }
}

export async function exportOnce(source: ExportSource, upload: Upload, now: () => Date): Promise<ExportResult> {
  const objects: string[] = [];
  let rows = 0;
  let firstId: number | null = null;
  let lastId: number | null = null;

  for (let round = 0; round < MAX_OBJECTS; round += 1) {
    const lines = await step('batch', () => source.batch(BATCH_ROWS));
    if (lines.length === 0) break;

    const bundle = bundleOf(lines, lines[0].after_id, now());
    await step('upload', () => upload(bundle));
    await step('done', () => source.done(bundle));

    objects.push(bundle.key);
    rows += bundle.head.rows;
    firstId ??= bundle.head.first_id;
    lastId = bundle.head.last_id;
    if (lines.length < BATCH_ROWS) break;
  }

  return { objects, rows, firstId, lastId };
}

/**
 * 실패의 분류 — **문장이 아니라 이름만.** 오류 문장에는 열쇠 · 버킷 이름 · 역할 ARN 이 섞일 수 있다. DB 의
 * 검사식(`^[a-z0-9_.:-]{1,60}$`) 안에 들게 줄인다. 예: `upload:accessdenied` · `batch:57014` · `done:23514`.
 */
export function errorClassOf(error: unknown): string {
  const stepName = error instanceof ExportStepError ? error.step : 'run';
  const cause = error instanceof ExportStepError ? error.reason : error;
  const named = cause as { readonly name?: unknown; readonly code?: unknown } | null;
  const raw =
    (typeof named?.code === 'string' && named.code) ||
    (typeof named?.name === 'string' && named.name !== 'Error' && named.name) ||
    'unknown';
  const safe = raw.toLowerCase().replace(/[^a-z0-9_.:-]+/g, '-');
  return `${stepName}:${safe}`.slice(0, 60);
}

/** 반출의 두 방식 — 오래 사는 접근 키, 또는 Vercel OIDC 로 받는 단기 역할(runbook 「반출」 — 역할이 기본안) */
type ExportCredentials =
  | { readonly kind: 'keys'; readonly accessKeyId: string; readonly secretAccessKey: string }
  | { readonly kind: 'role'; readonly roleArn: string };

export type ExportConfig = {
  readonly bucket: string;
  readonly region: string;
  readonly credentials: ExportCredentials;
};

type ExportEnvName =
  | 'AUDIT_EXPORT_BUCKET'
  | 'AUDIT_EXPORT_REGION'
  | 'AUDIT_EXPORT_ROLE_ARN'
  | 'AUDIT_EXPORT_ACCESS_KEY_ID'
  | 'AUDIT_EXPORT_SECRET_ACCESS_KEY';

type MaybeEnv = Readonly<Record<ExportEnvName, string | undefined>>;

/**
 * 켜는 값을 셋으로 가른다.
 *
 * - **꺼짐(`off`)** — 다섯이 **모두** 비었다. AWS 계정이 아직 없다(2026-09-24) — 조용히 「설정 안 됨」
 * - **켜짐(`ready`)** — 버킷 · 지역에 자격 하나: 역할 ARN, 또는 접근 키 둘
 * - **오설정(`partial`)** — 그 밖 전부. 하나라도 넣었으면 켜려던 것이다 — 조용히 끄지 않고 실패로 적고 알린다.
 *   빠진 이름(`missing:region.secret_access_key`)이나 두 자격을 함께 넣은 것(`conflict:credentials`)을 분류로 든다
 */
export type ConfigState =
  | { readonly state: 'off' }
  | { readonly state: 'partial'; readonly problem: string }
  | { readonly state: 'ready'; readonly config: ExportConfig };

export function configOf(env: MaybeEnv): ConfigState {
  const value = (name: ExportEnvName) => env[name]?.trim() || null;
  const bucket = value('AUDIT_EXPORT_BUCKET');
  const region = value('AUDIT_EXPORT_REGION');
  const roleArn = value('AUDIT_EXPORT_ROLE_ARN');
  const accessKeyId = value('AUDIT_EXPORT_ACCESS_KEY_ID');
  const secretAccessKey = value('AUDIT_EXPORT_SECRET_ACCESS_KEY');

  if (!bucket && !region && !roleArn && !accessKeyId && !secretAccessKey) return { state: 'off' };

  if (roleArn && (accessKeyId || secretAccessKey)) return { state: 'partial', problem: 'conflict:credentials' };

  const missing = [
    !bucket && 'bucket',
    !region && 'region',
    ...(roleArn
      ? []
      : !accessKeyId && !secretAccessKey
        ? ['credentials']
        : [!accessKeyId && 'access_key_id', !secretAccessKey && 'secret_access_key']),
  ].filter((name): name is string => Boolean(name));
  if (missing.length > 0 || !bucket || !region) {
    return { state: 'partial', problem: `missing:${missing.join('.')}`.slice(0, 60) };
  }

  const credentials: ExportCredentials = roleArn
    ? { kind: 'role', roleArn }
    : { kind: 'keys', accessKeyId: accessKeyId ?? '', secretAccessKey: secretAccessKey ?? '' };
  return { state: 'ready', config: { bucket, region, credentials } };
}

type FinishOutcome = 'succeeded' | 'failed' | 'not_configured' | 'misconfigured';

export type Finish = {
  readonly outcome: FinishOutcome;
  readonly rows?: number;
  readonly objects?: number;
  readonly firstId?: number | null;
  readonly lastId?: number | null;
  readonly errorClass?: string | null;
};

/** 실행 하나를 여닫는 DB 의 두 문(`audit_export_begin` · `audit_export_finish`) */
export type RunLedger = {
  readonly begin: () => Promise<{ readonly attemptId: number; readonly busy: boolean }>;
  readonly finish: (attemptId: number, result: Finish) => Promise<void>;
};

export type RunResult =
  | { readonly kind: 'busy' }
  | { readonly kind: 'off' }
  | { readonly kind: 'misconfigured'; readonly problem: string }
  | { readonly kind: 'failed'; readonly errorClass: string }
  | { readonly kind: 'succeeded'; readonly result: ExportResult };

/**
 * 반출 실행 하나 — **시작을 적고, 겹치면 물러나고, 어떻게 끝났든 결과를 적는다** (`20261014090000`).
 *
 * 겹쳐 돈 실행은 시작 문이 「도는 중」으로 이미 적었다 — 아무것도 안 올리고 끝난다. 설정이 없으면 조용히,
 * 반쯤이면 실패로 적는다(DB 가 알린다). 결과를 적는 문이 넘어져도 반출의 결과는 그대로 돌려준다 — 결과 한 줄을
 * 못 적었다고 이미 올린 것을 실패로 말하지 않는다. 그 경우 다음 실행이 시작할 때 임대가 지난 시도를 본다.
 */
export async function runExport(
  ledger: RunLedger,
  config: ConfigState,
  source: ExportSource,
  uploadFor: (config: ExportConfig) => Upload,
  now: () => Date,
): Promise<RunResult> {
  const { attemptId, busy } = await ledger.begin();
  if (busy) return { kind: 'busy' };

  const settle = async (result: Finish) => {
    try {
      await ledger.finish(attemptId, result);
    } catch (error) {
      console.error('audit-export: 결과를 적지 못했다', errorClassOf(error));
    }
  };

  if (config.state === 'off') {
    await settle({ outcome: 'not_configured' });
    return { kind: 'off' };
  }
  if (config.state === 'partial') {
    await settle({ outcome: 'misconfigured', errorClass: config.problem });
    return { kind: 'misconfigured', problem: config.problem };
  }

  try {
    const result = await exportOnce(source, uploadFor(config.config), now);
    await settle({
      outcome: 'succeeded',
      rows: result.rows,
      objects: result.objects.length,
      firstId: result.firstId,
      lastId: result.lastId,
    });
    return { kind: 'succeeded', result };
  } catch (error) {
    const errorClass = errorClassOf(error);
    await settle({ outcome: 'failed', errorClass });
    return { kind: 'failed', errorClass };
  }
}
