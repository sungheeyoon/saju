import { TYPE_TITLE } from './ui/surfaces';

/**
 * 궁합 화면의 머리 — **버튼 없이 선다.** 시작하는 누름은 바로 아래 칸 안의 「궁합 보기」 하나다. 탭 사이를 오가는 것은
 * 머리글이 한다 — 한 사람의 사주(`/saju`)는 홈 탭, 두 사람의 궁합은 궁합 탭이다(ADR 0144).
 *
 * 머리의 모양은 부드러움의 제목 단(`TYPE_TITLE`, 둥근 서체)을 따른다 — 앱 안의 한 화면이라 첫 화면의 큰 머리가 아니다.
 */
export function CompatHero() {
  return (
    <header className="flex min-w-0 flex-col gap-2">
      <p className="text-[13px] font-semibold text-secondary">궁합</p>
      <h1 className={TYPE_TITLE}>두 사람의 궁합을 살펴봅니다.</h1>
      <div className="flex max-w-prose flex-col gap-1 text-[15px] leading-6 text-secondary">
        <p>두 사람의 사주를 바탕으로 서로에게 생기는 관계와 오행의 보완을 봐요.</p>
        <p>
          좋고 나쁨을 단순한 숫자로 보여 주기보다,<br />
          어떤 관계가 왜 나타나는지 근거를 설명해요.
        </p>
      </div>
    </header>
  );
}
