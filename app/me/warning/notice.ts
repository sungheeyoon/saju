import type { WarningNotice } from '@/src/lib/account';

import { supabaseOnServer } from '../../auth/server-client';
import { signedInUser } from '../../auth/signed-in';
import { read, unread, type SkippableRead } from '../../db-error';

/**
 * 내가 아직 확인하지 않은 경고 하나 — **부속 정보**다(ADR 0078 · 0108).
 *
 * 로그인한 화면의 머리에 서는 안내라 못 읽으면 그 자리만 비운다 — 화면 본체를 경고 하나 때문에 무너뜨리지 않는다. 무엇을
 * 내주는가는 문(`my_warning_notice`)이 정한다: 안내번호 · 갈래 · 경고한 날뿐이고, 이용이 정지된 계정 · 탈퇴 대기에는 아무것도
 * 없다. 가장 오래된 하나만 온다 — 확인하면 다음 것이 선다.
 */
export async function readWarningNotice(): Promise<SkippableRead<WarningNotice | null>> {
  const supabase = await supabaseOnServer();
  /*
    **로그인하지 않았으면 묻지 않는다**(G-78). 이 안내는 `/me` 레이아웃에 서서 화면이 로그인으로 보내기(`redirect('/auth')`) 전에
    먼저 돈다 — 비회원으로 부르면 문이 `42501` 로 거절하고 그 줄이 서버 기록에 남았다. 안 보이는 것은 같다.
  */
  if ((await signedInUser(supabase)) === null) return read(null);
  const { data, error } = await supabase.rpc('my_warning_notice');
  if (error) return unread(error, 'my_warning_notice');

  const row = data?.[0];
  if (row === undefined) return read(null);
  return read({ ref: row.warning_ref, category: row.category, warnedOn: row.warned_on });
}
