import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { rpcArgs } from '@db';
import { userFacingDbMessage } from '@db-error';
import { FOCUS_CENTER, PHOTO_VARIANTS, VARIANTS_REFUSED, focusOf, oversizeMessage, sameFocus, shrunkSize, variantSize, type PhotoFocus, type PhotoUploadMode, type PhotoVariant } from '@profile';
import type { DoorSave } from '@reading/door';

import { supabase } from '@/auth/client';
import { NOT_READY } from '@/auth/signup';
import type { DoorAnswer } from '@/reading/api';
import { saveFailureOf } from '@/reading/chart-writes';
import { followRefusal } from '@/reading/panel';
import { addStoredPhoto, readPhotoUploadMode, replaceStoredPhoto, type BakedVariants } from '@/reading/photo-writes';

import type { Answer } from './settings';

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL;

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
 * 올리기의 길 — 이 배포의 저장소가 켜졌는지는 서버만 알아 앱의 문이 답한다(ADR 0211 추기). 웹의 `photoUploadMode` 와 같은 값이다.
 * 못 물었으면 멈춘 것으로 보인다 — 어느 길로 보낼지 모르면 보내지 않는다. 거절 자체는 DB 가 한다.
 */
export async function photoUploadMode(): Promise<PhotoUploadMode> {
  const answer = await readPhotoUploadMode();
  return answer.ok ? answer.value.mode : 'paused';
}

/** 받아 둔 그림 — 판본은 장마다 하나라 같은 판본은 같은 바이트다 */
const seen = new Map<number, string>();

/**
 * 그림을 화면에 세울 주소 — 같은 판정의 문(`photo_at`)을 바로 부른다. 저장소에 사는 장은 `base64` 가 비어 앱의 사진 문으로 받는다(`photoResponse`).
 * 못 받으면 `null` 이다.
 */
export async function photoSource(photo: MyPhoto, userId?: string): Promise<string | null> {
  const known = seen.get(photo.version);
  if (known !== undefined) return known;
  if (supabase === null) return null;
  const { data: auth } = await supabase.auth.getSession();
  const owner = userId ?? auth.session?.user.id;
  if (owner === undefined) return null;
  const { data, error } = await supabase.rpc('photo_at', { p_user_id: owner, p_position: photo.position });
  const row = error === null ? data?.[0] : undefined;
  if (row === undefined) return null;
  const source = row.base64 ? `data:${row.content_type};base64,${row.base64}` : await storedSource(owner, photo.position, auth.session?.access_token);
  if (source !== null) seen.set(row.version, source);
  return source;
}

/** 저장소에 사는 장의 작은 벌을 그 사람의 토큰으로 받아 화면이 쓸 주소로 */
async function storedSource(owner: string, position: number, token: string | undefined): Promise<string | null> {
  if (!SITE_URL || token === undefined) return null;
  try {
    const response = await fetch(`${SITE_URL}/api/mobile/photo/${owner}?n=${position}&s=card`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((done) => {
      const reader = new FileReader();
      reader.onload = () => done(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => done(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
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

type Asset = { uri: string; width: number; height: number };

/** 큰 벌이 상한을 넘을 때 한 번 더 굽는 품질 — 웹 `bakeVariants` 와 같다 */
const SECOND_QUALITY = 0.72;

/** 저장소로 보낼 두 벌 — 웹 `bakeVariants` 와 같은 크기 · 상한이다. 받은 서버가 `checkVariants` 로 다시 잰다 */
async function bakedVariants(asset: Asset): Promise<{ ok: true; variants: BakedVariants } | { ok: false; message: string }> {
  const save = async (variant: PhotoVariant, quality: number) => {
    const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
    context.resize(variantSize(variant, asset.width, asset.height));
    const rendered = await context.renderAsync();
    return rendered.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: quality, base64: true });
  };
  const bytes = (base64: string | undefined) => Math.floor(((base64?.length ?? 0) * 3) / 4);
  const card = await save('card', 0.85);
  let large = await save('large', 0.85);
  if (bytes(large.base64) > PHOTO_VARIANTS.large.maxBytes) large = await save('large', SECOND_QUALITY);
  /* 넘으면 안 보낸다 — 서버도 같은 상한으로 거절하니 왕복과 하루 한도의 자리만 든다(웹 `bakeVariants`) */
  if (bytes(large.base64) > PHOTO_VARIANTS.large.maxBytes || bytes(card.base64) > PHOTO_VARIANTS.card.maxBytes) return { ok: false, message: VARIANTS_REFUSED };
  return { ok: true, variants: { card: card.uri, large: large.uri, contentType: 'image/jpeg' } };
}

/** 문의 답을 화면의 값으로 — 자격 거절은 그 길로 옮겨 가고 까닭 줄은 비지 않게 둔다 */
function fromDoor(answer: DoorAnswer<DoorSave>): Answer {
  if (answer.ok) return answer.value;
  followRefusal(answer.refused);
  return { ok: false, message: saveFailureOf(answer) ?? NOT_READY };
}

/** 맨 뒤에 더한다 — 상한 · 형식 · 여섯 장 · 하루 한도는 DB 가 다시 본다. 저장소 길이면 앱의 문을 지난다(ADR 0211 추기) */
export async function addPhoto(asset: Asset, focus: PhotoFocus, uploads: PhotoUploadMode): Promise<Answer> {
  if (uploads === 's3') {
    const baked = await bakedVariants(asset);
    return baked.ok ? fromDoor(await addStoredPhoto(baked.variants, focus)) : baked;
  }
  if (supabase === null) return { ok: false, message: NOT_READY };
  const photo = await baked(asset);
  if (!photo.ok) return photo;
  const { data: placed, error } = await supabase.rpc('add_my_photo', rpcArgs<'add_my_photo'>({ p_content_type: photo.contentType, p_base64: photo.base64 }));
  if (error !== null) return { ok: false, message: userFacingDbMessage(error, 'add_my_photo') };
  return savedFocus(placed, null, focus);
}

/** 그 자리에서 바꾼다 — 판본은 화면이 본 그 장이다. 그 사이 목록이 바뀌었으면 DB 가 거절한다 */
export async function replacePhoto(target: MyPhoto, asset: Asset, focus: PhotoFocus, uploads: PhotoUploadMode): Promise<Answer> {
  if (uploads === 's3') {
    const baked = await bakedVariants(asset);
    if (!baked.ok) return baked;
    const answer = await replaceStoredPhoto(target, baked.variants, focus);
    return fromDoor(answer.ok ? { ok: true, value: answer.value.ok ? { ok: true } : answer.value } : answer);
  }
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
