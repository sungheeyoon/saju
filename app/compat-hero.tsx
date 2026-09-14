import Link from 'next/link';

import { TAB_ACTION_PRIMARY, TAB_ACTION_SECONDARY, TabActions, TabHero } from './tab-hero';

/**
 * 궁합 화면의 머리 — **「사주·궁합」 탭의 두 사람 쪽.**
 *
 * **아래에 있던 나눔 탭을 걷었다**(ADR 0054). 「두 사람 직접 입력」과 「저장한 사람
 * 선택」이 화면 둘로 갈려 있었는데, 나뉜 것은 사람이 아니라 **한 칸의 입력 방법**이라
 * 지금은 칸마다 고른다.
 *
 * **여기 있던 길은 `/me` 로 나갔다.** 「내 사주로 돌아가기」 하나뿐이었는데 그것은 다른
 * 탭이다 — 머리글은 이 화면과 `/` 를 한 줄로 묶어 두고, 화면은 사용자를 그 줄 밖으로
 * 내보내고 있었다. 이제 한 사람 쪽(`/`)과 같은 모양의 버튼 줄을 쓴다(`tab-hero.tsx`).
 *
 * `pick` 은 **이 화면에서 시작하는 길**이다. 고르는 칸이 같은 화면에 있으면 그 자리로
 * (`#pair`), 결과가 사는 화면이면 고르는 화면으로(`/compat`) 간다. 막힌 계정에는
 * 안 넘긴다 — 시작할 수 없는 사람에게 시작하는 버튼을 세우지 않는다.
 */
export function CompatHero({ pick }: { pick?: string }) {
  return (
    <TabHero
      eyebrow="사주·궁합 · 두 사람"
      title="두 사람의 궁합을 살펴봅니다."
      lede={
        <>
          <p>두 사람의 사주를 바탕으로 서로에게 생기는 관계와 오행의 보완을 살펴봅니다.</p>
          <p>
            좋고 나쁨을 단순한 숫자로 보여주기보다,<br />
            어떤 관계가 왜 나타나는지 근거를 설명합니다.
          </p>
        </>
      }
      actions={
        <TabActions>
          {pick !== undefined && (
            <Link href={pick} className={TAB_ACTION_PRIMARY}>
              두 사람 고르기
            </Link>
          )}
          <Link href="/" className={TAB_ACTION_SECONDARY}>
            <span>사주 보기</span>
          </Link>
        </TabActions>
      }
    />
  );
}
