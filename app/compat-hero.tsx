import { SajuCompatTabs } from './segmented-nav';
import { TYPE_TITLE } from './ui/surfaces';

/**
 * 궁합 화면의 머리 — **버튼 없이 선다.**
 *
 * **아래에 있던 나눔 탭을 걷었다**(ADR 0054). 「두 사람 직접 입력」과 「저장한 사람
 * 선택」이 화면 둘로 갈려 있었는데, 나뉜 것은 사람이 아니라 **한 칸의 입력 방법**이라
 * 지금은 칸마다 고른다.
 *
 * ## 버튼 줄이 없다
 *
 * 진한 「두 사람 고르기」가 `#pair` 를 가리키고 서 있었다. 바로 아래 이미 보이는 칸으로
 * **스크롤만 하는 누름**이라, 화면에서 가장 크게 보이는 것이 아무것도 하지 않았다 —
 * 정작 시작하는 누름은 그 칸 안의 「궁합 보기」다. 옆의 「사주 보기」는 더 나빴다:
 * 궁합을 적으러 온 사람을 **입력칸 바로 위에서 사주로 내보내는 길**이다. 탭 사이를
 * 오가는 것은 머리글이 이미 한다.
 *
 * 한동안 `pick` 을 받아 「궁합 보러 가기」를 세웠다. 그 버튼이 필요했던 화면은 인자 없이
 * 열리는 `/me/compat` 이었고, 그 화면을 걷으면서(풀이 목록이 같은 일을 더 잘 한다)
 * 이 머리가 버튼을 들 자리도 없어졌다.
 *
 * ## 대신 토글이 선다
 *
 * 버튼을 걷고 나니 **사주로 돌아오는 길도 없어졌다.** 되돌린 것은 버튼이 아니라
 * `SajuCompatTabs` 다 — 두 화면은 위아래가 아니라 나란한 짝이고, 그 관계를 말하는
 * 부품은 지금 어디에 있는지 함께 보여 주는 한 덩이다. `/` 의 회원 머리가 **같은 자리에
 * 같은 것**을 든다(`home-hero.tsx`).
 *
 * 머리의 모양은 부드러움의 제목 단(`TYPE_TITLE`, 둥근 서체)을 따른다. `/` 의 큰 머리 껍데기(`tab-hero.tsx`)를 빌리지 않고
 * 여기 적는 것은 이 화면이 이제 홈에서 들어오는 앱 안의 한 화면이라서다 — 공개 현관의 큰 머리가 아니다.
 */
export function CompatHero() {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-[13px] font-semibold text-secondary">궁합</p>
        <h1 className={TYPE_TITLE}>두 사람의 궁합을 살펴봅니다.</h1>
        <div className="flex max-w-prose flex-col gap-1 text-[15px] leading-6 text-secondary">
          <p>두 사람의 사주를 바탕으로 서로에게 생기는 관계와 오행의 보완을 살펴봅니다.</p>
          <p>
            좋고 나쁨을 단순한 숫자로 보여주기보다,<br />
            어떤 관계가 왜 나타나는지 근거를 설명합니다.
          </p>
        </div>
      </div>
      <div className="w-full shrink-0 sm:w-64">
        <SajuCompatTabs current="compat" />
      </div>
    </header>
  );
}
