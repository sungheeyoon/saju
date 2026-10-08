'use client';

import Link from 'next/link';

import { useBrowserSession } from './auth/browser-session';
import { SERVICE_FEATURES } from './service-features';
import { Icon, type IconName } from './ui/icons';
import { TYPE_SECTION } from './ui/surfaces';

/**
 * 로그인 전 첫 화면의 **「할 수 있는 것」** — 폼 아래. 서비스 소개(`/about`)의 같은 구역 이름이다.
 *
 * 앞 판의 첫 화면은 입력 폼에서 끝났다. 폼을 채우기 전의 사람은 「사주를 보면 그다음은?」을 알 길이 없었고, 사주풀이 ·
 * 궁합 · 인연은 로그인한 뒤에야 탭으로 처음 보였다. 그 셋을 카드 한 장씩 — 이름과 무엇을 하는지만 — 보이고 자세한 것은
 * 서비스 소개로 넘긴다. **로그인 · 풀이권 조건은 싣지 않는다**(운영자 결정 2026-10-08) — 홈은 관심과 이해를 먼저 만들고,
 * 조건은 그 일을 하는 자리(로그인 단추 · 비용 확인)와 서비스 소개가 말한다.
 *
 * 폼과 같은 42rem 한 축에 아이콘이 왼쪽인 낮은 카드로 쌓인다 — 넓은 화면에서도. 세 칸으로 나누면 그 폭에서 설명이 여섯
 * 줄로 접혔다.
 *
 * **로그인한 사람에게는 안 선다** — 그 사람은 `/` 에 머물지 않고(ADR 0144) 넷은 이미 탭에 있다. 세션을 모르는 동안에도
 * 안 세운다(머리글과 같은 까닭 — 회원에게 한 번 깜빡이는 거짓말을 안 보인다).
 */
export function LandingGuide() {
  const { session } = useBrowserSession();
  if (session !== 'out') return null;

  return (
    <section
      aria-labelledby="landing-guide"
      className="mx-auto flex w-full max-w-[42rem] flex-col gap-5 border-t border-border pt-8 sm:gap-6 sm:pt-10"
    >
      {/* 폰에서는 제목이 두 줄로 갈리지 않게 링크가 아랫줄로 내려간다 */}
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <h2 id="landing-guide" className={TYPE_SECTION}>
          할 수 있는 것
        </h2>
        <Link href="/about" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-foreground">
          서비스 소개
          <Icon name="arrow" className="size-4" />
        </Link>
      </div>
      <ul className="grid gap-3">
        {SERVICE_FEATURES.filter((feature) => feature.title !== '사주').map((feature) => (
          <li
            key={feature.title}
            className="flex gap-4 rounded-[1.5rem] border border-border bg-surface p-5 sm:p-6"
          >
            <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${TONES[feature.icon] ?? TONE_DEFAULT}`}>
              <Icon name={feature.icon} className="size-[22px]" />
            </span>
            <div className="min-w-0">
              <h3 className="font-rounded text-[1.25rem] leading-7 text-foreground">{feature.title}</h3>
              <p className="mt-1 text-pretty text-[15px] leading-7 text-secondary">{feature.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * 카드 아이콘의 면 — 일의 아이콘에 오행 파스텔 하나씩(로고의 점과 같은 결). 순서가 아니라 아이콘에 매달아 둔다 — 넷에 일이
 * 더해지거나 차례가 바뀌어도 색이 다른 일로 옮겨 가지 않고, 짝이 없는 일은 기본 면을 받는다.
 */
const TONES: Partial<Record<IconName, string>> = {
  reading: 'bg-fire-soft text-fire',
  taiji: 'bg-water-soft text-water',
  people: 'bg-wood-soft text-wood',
};
const TONE_DEFAULT = 'bg-surface-soft text-foreground';
