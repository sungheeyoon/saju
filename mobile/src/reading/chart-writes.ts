import { toSearchParams, type Query } from '@input/query';
import type { DoorSave } from '@reading/door';

import { door, type DoorAnswer } from './api';

/**
 * **풀에 오르는 값을 쓰는 앱의 문**(ADR 0211) — 이 넷은 열쇠로만 열려 Supabase 를 바로 못 부른다. 앱이 보내는 것은 입력뿐이고 여덟 글자 ·
 * 요약 · 사람 id 는 서버가 짓는다. 답의 `ok: false` 문장은 그대로 세운다(웹과 같은 글자다).
 */
const post = (path: string, payload: object, method = 'POST'): Promise<DoorAnswer<DoorSave>> =>
  door(`/api/mobile/me/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

/**
 * 쓰기의 거절을 화면의 한 줄로 — 자격 거절(로그인 · 가입 · 종료)은 그 길로 옮겨 가므로 `null` 이다. 대상이 틀린 답은 없는 화면과 같은 글자다.
 */
export function saveFailureOf(answer: DoorAnswer<DoorSave>): string | null {
  if (answer.ok) return answer.value.ok ? null : answer.value.message;
  if (answer.refused.refused === 'unavailable') return answer.refused.message;
  return answer.refused.refused === 'not-found' ? '페이지를 찾을 수 없어요' : null;
}

/** 내 사주를 저장한다 — 이미 있으면 됐다고 답한다 */
export const saveSelfPerson = (query: Query) => post('self-person', { query: toSearchParams(query).toString() });

/** 저장된 입력을 고친다 */
export const editPersonInput = (personId: string, query: Query) =>
  post('person-input', { personId, query: toSearchParams(query).toString() });

/** 매칭 참여를 켜고 끈다 */
export const setParticipation = (on: boolean) => post('participation', { on });

/** 홈이 열릴 때 참여를 연다 — 끈 사람은 안 열린다. 못 열어도 홈을 세운다 */
export const openParticipation = () => post('participation', {}, 'PUT');
