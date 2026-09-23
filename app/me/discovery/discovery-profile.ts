import { preferGenderOf, type DiscoveryProfile } from '@/src/lib/discovery';

import { supabaseOnServer } from '../../auth/server-client';
import { read, unread, type SkippableRead } from '../../db-error';

/**
 * 내 **DiscoveryProfile** 을 읽는 문 — `discovery_profile` 을 읽는 자리는 여기 하나다.
 *
 * 줄이 없으면 `null` 이다 — 참여를 한 번도 안 연 사람이다. **못 읽으면 값으로 말한다**
 * (`SkippableRead`, ADR 0078). 부르는 쪽 셋 모두 이 값이 본체가 아니다: 홈과 매칭은 끈
 * 사람을 미리 거르는 데만 쓰고(못 읽으면 안 거른 채 RPC 가 다시 묻는다), 설정은 그 칸을
 * 비운다 — 기본값으로 메우면 끈 사람에게 「켜져 있다」고 말하게 된다.
 */
export async function myDiscoveryProfile(): Promise<SkippableRead<DiscoveryProfile | null>> {
  const supabase = await supabaseOnServer();
  const { data, error } = await supabase
    .from('discovery_profile')
    .select('prefer_gender, opted_out_at')
    .maybeSingle();
  if (error) return unread(error, 'discovery_profile');
  if (data === null) return read(null);
  return read({
    preferGender: preferGenderOf(data.prefer_gender),
    optedOut: data.opted_out_at != null,
  });
}
