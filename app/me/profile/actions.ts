'use server';

import { revalidatePath } from 'next/cache';

import { supabaseOnServer } from '../../auth/server-client';
import type { SaveResult } from '../actions';
import { PHOTO_TYPES, missingInProfile, type ProfileInput } from '@/src/lib/profile';

/**
 * 프로필을 저장한다 — **RPC 를 지난다.**
 *
 * `discovery_profile` 때와 다르다. 그 표는 별명·소개 칸을 열 단위로 열어 두었고 서버
 * 액션이 그 칸에 직접 썼다. `app_user` 는 그렇게 열려 있지 않다 — 계정 상태와 안내 확인
 * 기록이 한 행에 있어서, 한 칸을 열면 그 옆 칸을 안 여는 이유를 정책이 매번 다시 대야
 * 한다. 거절의 문장도 DB 가 낸다(「이미 쓰고 있는 닉네임입니다」).
 */
export async function saveProfile(profile: ProfileInput): Promise<SaveResult> {
  const missing = missingInProfile(profile);
  if (missing !== null) return { ok: false, message: missing };

  const supabase = await supabaseOnServer();

  const { error } = await supabase.rpc('save_my_profile', {
    p_nickname: profile.nickname.trim(),
    p_intro: profile.intro.trim() || null,
  });

  if (error) return { ok: false, message: error.message };

  /*
    이름은 거의 모든 화면에 선다 — 후보 카드도 요청 목록도 소식도. 한 자리만 새로
    그리면 나머지는 옛 이름을 든 채로 남는다.
  */
  revalidatePath('/me', 'layout');
  return { ok: true };
}

/**
 * 이 이름을 쓸 수 있나 — **참·거짓 하나만 돌려받는다.**
 *
 * 누가 쓰고 있는지도, 비슷한 이름도, 대신 쓸 이름도 안 묻는다. 대안을 추천하려면 남들이
 * 쓰는 이름을 훑어야 하고, 그것은 이 문이 아니다.
 */
export async function checkNickname(
  nickname: string,
): Promise<{ ok: true; available: boolean } | { ok: false; message: string }> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('nickname_is_available', {
    p_nickname: nickname.trim(),
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true, available: data === true };
}

/**
 * 사진을 올린다 — **줄이는 일은 브라우저가 했다.**
 *
 * 여기 닿는 것은 이미 512px 안팎으로 줄여 놓은 바이트다(`shrinkToDataUrl`). 그렇다고
 * 믿지는 않는다 — 상한도 형식도 DB 가 다시 본다. 이 액션도 주소만 알면 부를 수 있다.
 */
export async function savePhoto(photo: {
  contentType: string;
  base64: string;
}): Promise<SaveResult> {
  if (!(PHOTO_TYPES as readonly string[]).includes(photo.contentType)) {
    return { ok: false, message: 'JPG · PNG · WebP 만 올릴 수 있습니다.' };
  }

  const supabase = await supabaseOnServer();

  const { error } = await supabase.rpc('set_my_photo', {
    p_content_type: photo.contentType,
    p_base64: photo.base64,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath('/me', 'layout');
  return { ok: true };
}

/** 사진을 내린다 — 행을 지운다. 「없음」이 두 값이 되지 않게 */
export async function clearPhoto(): Promise<SaveResult> {
  const supabase = await supabaseOnServer();

  const { error } = await supabase.rpc('clear_my_photo');
  if (error) return { ok: false, message: error.message };

  revalidatePath('/me', 'layout');
  return { ok: true };
}
