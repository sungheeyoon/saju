import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { rpcArgs } from '@db';
import { userFacingDbMessage } from '@db-error';
import { FOCUS_CENTER, focusOf, oversizeMessage, photoUploadModeOf, photoUploadsOnScreen, sameFocus, shrunkSize, type PhotoFocus, type PhotoUploadMode } from '@profile';

import { supabase } from '@/auth/client';
import { NOT_READY } from '@/auth/signup';

import type { Answer } from './settings';

/** 내 사진 한 장 — 자리와 판본(웹 `app/me/profile/photos.ts`) */
export type MyPhoto = { readonly position: number; readonly version: number; readonly focus: PhotoFocus };

/** 고른 사진 — 기기의 주소와 줄인 바이트. 못 줄였으면 까닭 한 줄 */
export type Picked = { uri: string };
type Baked = { ok: true; contentType: string; base64: string } | { ok: false; message: string };

/** 사진 올리기를 막은, 우리가 안 쓴 문장 — 웹 `use-photo-uploads.ts` 와 같은 글자 */
export const UNREADABLE_PHOTO = '사진을 열지 못했어요. 다른 사진을 골라 주세요.';

export async function myPhotos(): Promise<MyPhoto[]> {
  if (supabase === null) throw new Error(NOT_READY);
  const { data, error } = await supabase.rpc('my_photos');
  if (error !== null) throw error;
  return (data ?? []).map((row) => ({ position: row.position, version: row.version, focus: focusOf(row.focus_x, row.focus_y) }));
}

/**
 * 올리기의 길 — **앱은 저장소 길을 못 간다.** `s3` 올리기는 서버가 저장소 열쇠로 바이트를 쓰는 서버 액션이라(`addStoredPhoto`) 앱에 문이
 * 없다. 그래서 웹이 「저장소가 꺼진 배포」에 쓰는 함수에 `false` 를 넘겨 멈춘 것으로 보인다 — 올리는 자리가 안 서고 첫 줄이 까닭을 말한다.
 */
export async function photoUploadMode(): Promise<PhotoUploadMode> {
  if (supabase === null) throw new Error(NOT_READY);
  const { data, error } = await supabase.rpc('photo_upload_mode');
  if (error !== null) throw error;
  return photoUploadsOnScreen(photoUploadModeOf(data), false);
}

/** 받아 둔 그림 — 판본은 장마다 하나라 같은 판본은 같은 바이트다 */
const seen = new Map<number, string>();

/**
 * 그림을 화면에 세울 주소. 웹의 주소(`/me/photo/…`)는 쿠키로 사람을 알아 앱이 못 쓴다 — 같은 판정의 문(`photo_at`)을 바로 부른다.
 * 저장소에 사는 장(`base64` 가 비었다)은 서버만 읽어 `null` 이다.
 */
export async function photoSource(photo: MyPhoto, userId?: string): Promise<string | null> {
  const known = seen.get(photo.version);
  if (known !== undefined) return known;
  if (supabase === null) return null;
  const owner = userId ?? (await supabase.auth.getSession()).data.session?.user.id;
  if (owner === undefined) return null;
  const { data, error } = await supabase.rpc('photo_at', { p_user_id: owner, p_position: photo.position });
  const row = error === null ? data?.[0] : undefined;
  if (row === undefined || !row.base64) return null;
  const source = `data:${row.content_type};base64,${row.base64}`;
  seen.set(row.version, source);
  return source;
}

/** 기기의 사진 창 — 아무 권한도 안 묻는다. 취소면 빈 목록이다 */
export async function pickPhotos(limit: number): Promise<ImagePicker.ImagePickerAsset[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 1,
  });
  return result.canceled ? [] : result.assets;
}

/**
 * 웹 `shrink` 와 같은 일 — 긴 변을 맞춰 줄이고 자르지 않으며, 상한을 다시 본다. 형식은 웹이 WebP 를 못 구울 때 물러서는 JPEG(같은 품질
 * 0.85)다 — 받아 주는 형식이고 어느 기기에서나 구워진다. 사진을 못 읽으면 던진다.
 */
async function baked(asset: { uri: string; width: number; height: number }): Promise<Baked> {
  const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
  context.resize(shrunkSize(asset.width, asset.height));
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.85, base64: true });
  if (!saved.base64) return { ok: false, message: UNREADABLE_PHOTO };
  const oversize = oversizeMessage(Math.floor((saved.base64.length * 3) / 4));
  return oversize !== null ? { ok: false, message: oversize } : { ok: true, contentType: 'image/jpeg', base64: saved.base64 };
}

async function savedFocus(position: number, version: number | null, focus: PhotoFocus): Promise<Answer> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  if (sameFocus(focus, FOCUS_CENTER)) return { ok: true };
  const { error } = await supabase.rpc(
    'set_my_photo_focus',
    rpcArgs<'set_my_photo_focus'>({ p_position: position, p_x: focus.x, p_y: focus.y, ...(version === null ? {} : { p_version: version }) }),
  );
  return error !== null ? { ok: false, message: userFacingDbMessage(error, 'set_my_photo_focus') } : { ok: true };
}

/** 맨 뒤에 더한다 — 상한 · 형식 · 여섯 장 · 하루 한도는 DB 가 다시 본다 */
export async function addPhoto(asset: { uri: string; width: number; height: number }, focus: PhotoFocus): Promise<Answer> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  const photo = await baked(asset);
  if (!photo.ok) return photo;
  const { data: placed, error } = await supabase.rpc('add_my_photo', rpcArgs<'add_my_photo'>({ p_content_type: photo.contentType, p_base64: photo.base64 }));
  if (error !== null) return { ok: false, message: userFacingDbMessage(error, 'add_my_photo') };
  return savedFocus(placed, null, focus);
}

/** 그 자리에서 바꾼다 — 판본은 화면이 본 그 장이다. 그 사이 목록이 바뀌었으면 DB 가 거절한다 */
export async function replacePhoto(target: MyPhoto, asset: { uri: string; width: number; height: number }, focus: PhotoFocus): Promise<Answer> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  const photo = await baked(asset);
  if (!photo.ok) return photo;
  const { data, error } = await supabase.rpc(
    'replace_my_photo',
    rpcArgs<'replace_my_photo'>({ p_position: target.position, p_version: target.version, p_content_type: photo.contentType, p_base64: photo.base64 }),
  );
  if (error !== null) return { ok: false, message: userFacingDbMessage(error, 'replace_my_photo') };
  return savedFocus(target.position, data, focus);
}

export async function setPhotoFocus(photo: MyPhoto, focus: PhotoFocus): Promise<Answer> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  const { error } = await supabase.rpc('set_my_photo_focus', rpcArgs<'set_my_photo_focus'>({ p_position: photo.position, p_x: focus.x, p_y: focus.y, p_version: photo.version }));
  return error !== null ? { ok: false, message: userFacingDbMessage(error, 'set_my_photo_focus') } : { ok: true };
}

export async function removePhoto(photo: MyPhoto): Promise<Answer> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  const { error } = await supabase.rpc('remove_my_photo', rpcArgs<'remove_my_photo'>({ p_position: photo.position, p_version: photo.version }));
  return error !== null ? { ok: false, message: userFacingDbMessage(error, 'remove_my_photo') } : { ok: true };
}

export async function movePhoto(photo: MyPhoto, to: number): Promise<Answer> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  const { error } = await supabase.rpc('move_my_photo', rpcArgs<'move_my_photo'>({ p_from: photo.position, p_to: to, p_version: photo.version }));
  return error !== null ? { ok: false, message: userFacingDbMessage(error, 'move_my_photo') } : { ok: true };
}
