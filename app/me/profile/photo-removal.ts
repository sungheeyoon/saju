/** 사진 지우기를 묻는 창의 글자(대장 settings-06) */
export const PHOTO_REMOVE_TITLE = '사진을 삭제할까요?';
export const PHOTO_REMOVE_CONFIRM = '삭제';
/** 지운 뒤 상태 줄(대장 36) */
export const PHOTO_REMOVED = '사진을 지웠어요';

type Removal = { ok: true } | { ok: false; message: string };

/** 묻는 창에 답한 뒤 — 창이 닫혔나, 그 장을 지웠나, 거절됐으면 그 까닭(창은 열린 채 선다) */
export type RemovalAnswer =
  | { open: false; removed: boolean }
  | { open: true; failure: string };

/**
 * **사진은 묻고 나서 지운다**(운영자 2026-10-23 「사진을 지울 때는 팝업을 띄어야지」, ADR 0205).
 *
 * 「취소」 · Esc · 바깥 누름은 서버에 아무것도 안 보낸다. 「삭제」는 그 장(판본)을 곧바로 지운다 — 되돌리기 띠는 없다(ADR 0165 의 3 을
 * 걷었다). 서버가 거절하면 창이 열린 채 까닭을 세운다.
 */
export async function answerRemoval(
  asking: number | null,
  answer: 'cancel' | 'confirm',
  remove: (version: number) => Promise<Removal>,
): Promise<RemovalAnswer> {
  if (asking === null || answer === 'cancel') return { open: false, removed: false };
  const result = await remove(asking);
  return result.ok ? { open: false, removed: true } : { open: true, failure: result.message };
}
