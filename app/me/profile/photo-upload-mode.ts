import { photoUploadModeOf, photoUploadsOnScreen, type PhotoUploadMode } from '@/src/lib/profile';

import { supabaseOnServer } from '../../auth/server-client';
import { dbFailure } from '../../db-error';
import { photoStoreIsOn } from '../photo/store-env';

/**
 * 사진 올리기가 지금 어느 길인가 — DB 의 스위치(`photo_upload_mode()`, G-120 · ADR 0203)와 이 배포의 저장소를 함께 본다.
 *
 * 프로필 화면이 이것으로 사진 판의 길을 고른다. 못 읽으면 사진 목록과 같이 화면째 오류 경계로 간다 — 그 자리만 비울 말이
 * 없다(`myPhotos` 와 같은 갈래, ADR 0078). 거절 자체는 DB 가 하므로 화면의 값이 낡아도 열리지 않는다.
 */
export async function photoUploadMode(): Promise<PhotoUploadMode> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('photo_upload_mode');
  if (error) throw dbFailure(error, 'photo_upload_mode');

  return photoUploadsOnScreen(photoUploadModeOf(data), photoStoreIsOn());
}
