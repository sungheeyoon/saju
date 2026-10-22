/**
 * 사진의 바이트가 사는 **저장소** — 무엇에 쓰고 읽고 지우나만 안다(G-120, `20261227090000`).
 *
 * 진짜는 AWS S3 서울(`s3-store.ts`)이고, 시험과 로컬은 메모리(`memoryPhotoStore`)다 — 같은 꼴이라 올리기 · 청소기의 차례를
 * 가짜로 잰다. **저장소는 판정하지 않는다** — 누가 무엇을 볼 수 있나는 DB 의 `may_see_photo` 가 답하고, 여기 닿는 열쇠는
 * DB 가 지은 것뿐이다.
 *
 * ## 켜는 값 — 꺼짐 · 켜짐 · 오설정
 *
 * 다섯 이름(`PHOTO_STORE_*`)이 **모두** 비면 꺼짐이고, 사진은 지금처럼 DB 에 산다. 버킷 · 지역에 자격 하나(역할 ARN, 또는 접근 키
 * 둘)면 켜짐이다. 그 밖은 오설정이다 — 올리기는 꺼짐처럼 DB 길로 가고(사진이 안 사라진다), 청소기는 실패로 답해 알린다.
 * 반출(`app/api/cron/audit-export/export.ts` 의 `configOf`)과 같은 셈이다.
 */

export type StoredObject = { readonly body: Uint8Array; readonly contentType: string };

export type PhotoStore = {
  /** 한 객체를 쓴다 — 같은 키면 덮는다 */
  readonly put: (key: string, body: Uint8Array, contentType: string) => Promise<void>;
  /** 한 객체 — 없으면 `null` */
  readonly get: (key: string) => Promise<StoredObject | null>;
  /** 여럿을 지운다 — 없는 키는 지운 것이다. 못 지운 키를 돌려준다 */
  readonly remove: (keys: readonly string[]) => Promise<{ readonly failed: readonly string[] }>;
};

type StoreCredentials =
  | { readonly kind: 'keys'; readonly accessKeyId: string; readonly secretAccessKey: string }
  | { readonly kind: 'role'; readonly roleArn: string };

export type StoreConfig = {
  readonly bucket: string;
  readonly region: string;
  readonly credentials: StoreCredentials;
};

type StoreEnvName =
  | 'PHOTO_STORE_BUCKET'
  | 'PHOTO_STORE_REGION'
  | 'PHOTO_STORE_ROLE_ARN'
  | 'PHOTO_STORE_ACCESS_KEY_ID'
  | 'PHOTO_STORE_SECRET_ACCESS_KEY';

export type StoreEnv = Readonly<Record<StoreEnvName, string | undefined>>;

export type StoreState =
  | { readonly state: 'off' }
  | { readonly state: 'partial'; readonly problem: string }
  | { readonly state: 'ready'; readonly config: StoreConfig };

export function photoStoreConfigOf(env: StoreEnv): StoreState {
  const value = (name: StoreEnvName) => env[name]?.trim() || null;
  const bucket = value('PHOTO_STORE_BUCKET');
  const region = value('PHOTO_STORE_REGION');
  const roleArn = value('PHOTO_STORE_ROLE_ARN');
  const accessKeyId = value('PHOTO_STORE_ACCESS_KEY_ID');
  const secretAccessKey = value('PHOTO_STORE_SECRET_ACCESS_KEY');

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
  if (missing.length > 0 || !bucket || !region) return { state: 'partial', problem: `missing:${missing.join('.')}`.slice(0, 60) };

  const credentials: StoreCredentials = roleArn
    ? { kind: 'role', roleArn }
    : { kind: 'keys', accessKeyId: accessKeyId ?? '', secretAccessKey: secretAccessKey ?? '' };
  return { state: 'ready', config: { bucket, region, credentials } };
}

/**
 * 메모리 저장소 — 시험과 로컬의 가짜 S3. `fail` 에 넣은 키는 쓰기 · 지우기가 실패한다(망 · 권한 오류의 대신).
 *
 * 받은 바이트를 복사해 둔다 — 부른 쪽이 버퍼를 다시 써도 든 것이 안 바뀐다.
 */
export function memoryPhotoStore(fail: { put?: Set<string>; remove?: Set<string> } = {}) {
  const objects = new Map<string, StoredObject>();
  const store: PhotoStore = {
    put: async (key, body, contentType) => {
      if (fail.put?.has(key)) throw Object.assign(new Error('put refused'), { name: 'AccessDenied' });
      objects.set(key, { body: body.slice(), contentType });
    },
    get: async (key) => objects.get(key) ?? null,
    remove: async (keys) => {
      const failed = keys.filter((key) => fail.remove?.has(key));
      for (const key of keys) if (!failed.includes(key)) objects.delete(key);
      return { failed };
    },
  };
  return { store, objects };
}

/**
 * 실패의 분류 — **문장이 아니라 이름만**(오류 문장에는 버킷 · 역할 ARN 이 섞일 수 있다). DB 검사식(`^[a-z0-9_.:-]{1,60}$`)
 * 안에 든다. 예: `put:accessdenied` · `delete:nosuchbucket`.
 */
export function storeErrorClassOf(step: string, error: unknown): string {
  const named = error as { readonly name?: unknown; readonly Code?: unknown; readonly code?: unknown } | null;
  const raw =
    (typeof named?.Code === 'string' && named.Code) ||
    (typeof named?.code === 'string' && named.code) ||
    (typeof named?.name === 'string' && named.name !== 'Error' && named.name) ||
    'unknown';
  return `${step}:${raw.toLowerCase().replace(/[^a-z0-9_.:-]+/g, '-')}`.slice(0, 60);
}
