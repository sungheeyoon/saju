import type { DiscoveryProfile } from '@/src/lib/discovery';
import type { StoredChartResult } from '@/src/lib/input/stored';

import type { SkippableRead } from '../../db-error';
import type { InputVersions } from '../person-input';
import { selfSummaryOf, type SelfSummary } from '../summary';

/** 참여를 열 요약 — 열지 않을 때는 `null`. 홈(`participation.ts`)과 앱의 문(`app/api/mobile`, ADR 0211)이 같은 판단을 쓴다 */
export function selfToOpen(
  profile: SkippableRead<DiscoveryProfile | null>,
  selfPersonId: string,
  stood: StoredChartResult | null,
  versions: InputVersions | null,
): SelfSummary | null {
  /*
    **묻는 것이 「켰는가」에서 「껐는가」로 바뀌었다**(PRD 「추천은 여섯 자리 덱이다」). 참여가 기본으로 켜지면서
    안 켠 사람이라는 상태가 없어졌다. 남은 것은 직접 끈 사람이고, 그 하나만 안 연다.

    **읽지 않고 받는다**(2026-09-30). 홈이 참여 설정 · 내 입력 · 내 이름을 제 화면과 한 물결에 읽어 넘긴다 — 여기서 따로
    읽던 동안(참여 설정 → 계정 → 입력 · 이름 → 문) 이 줄이 홈 탭의 가장 긴 차례였다.
  */
  if (profile.ok && profile.value?.optedOut) return null;

  // 홈을 열며 곁들이는 일이다. 요약을 못 세웠으면 이번에는 안 열고 넘어간다 — 홈을 오류로 세우지 않는다
  let self: SelfSummary | null = null;
  try {
    self = stood === null || versions === null ? null : selfSummaryOf(selfPersonId, stood, versions);
  } catch {
    self = null;
  }
  return self;
}
