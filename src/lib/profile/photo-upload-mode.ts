/**
 * 사진 올리기가 지금 어느 길로 가나 — **DB 의 스위치 하나**(`photo_upload_switch`, G-120 · ADR 0204).
 *
 * - `db` — 지금 길(바이트를 DB 에). 기본값이다
 * - `paused` — 모든 올리기를 거절한다. 옛 사진을 지우고 저장소로 바꾸는 동안이다
 * - `s3` — 저장소 길만 받는다
 *
 * 판정은 DB 가 한다 — 올리는 문마다 스위치를 보고 제 길이 아니면 거절한다. 화면은 같은 값을 읽어 그 길로 보내거나, 멈춘 동안
 * 안내를 세운다. 운영자가 SQL 한 줄로 바꾸고 배포 없이 다음 요청부터 듣는다(`docs/ops/runbook/photo-store.md`).
 */
export const PHOTO_UPLOAD_MODES = ['db', 'paused', 's3'] as const;

export type PhotoUploadMode = (typeof PHOTO_UPLOAD_MODES)[number];

/** DB 가 낸 값 — 모르는 값이면 멈춘 것으로 읽는다(어느 길로 보낼지 모르면 보내지 않는다) */
export const photoUploadModeOf = (value: unknown): PhotoUploadMode =>
  (PHOTO_UPLOAD_MODES as readonly unknown[]).includes(value) ? (value as PhotoUploadMode) : 'paused';

/**
 * 화면이 보이는 길 — 스위치가 `s3` 인데 이 배포의 저장소가 꺼졌으면(값이 아직 안 들었다) 멈춘 것으로 보인다. 그 길로 보내도
 * 「올리지 못했어요」뿐이다. DB 는 이것과 무관하게 스위치대로 거절한다.
 */
export const photoUploadsOnScreen = (mode: PhotoUploadMode, storeReady: boolean): PhotoUploadMode =>
  mode === 's3' && !storeReady ? 'paused' : mode;
