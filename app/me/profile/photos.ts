import { supabaseOnServer } from '../../auth/server-client';
import { dbFailure } from '../../db-error';

/** 내 사진 한 장 — 자리와 판본. **바이트는 없다** — 그림은 주소로 받아 간다 */
export type MyPhoto = {
  /** 1부터 — 1 이 대표 사진 */
  readonly position: number;
  /** 그 장을 올린 시각에서 온 수. 옮겨도 안 바뀌어 주소의 `?v=` 가 그 장을 가리킨다 */
  readonly version: number;
};

/**
 * 내 사진들 — 자리 순서로(G-60).
 *
 * 프로필 화면이 이것으로 편집 칸을 세운다. 못 읽은 것은 「사진이 없다」가 아니다 — 그 칸만 비울
 * 말이 없어 화면째 오류 경계로 간다(ADR 0078).
 */
export async function myPhotos(): Promise<MyPhoto[]> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('my_photos');
  if (error) throw dbFailure(error, 'my_photos');

  return (data ?? []).map((row) => ({ position: row.position, version: row.version }));
}
