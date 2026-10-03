'use client';

import Link from 'next/link';

import { useBrowserSession } from './auth/browser-session';
import { SERVICE_FEATURES } from './service-features';
import { Icon } from './ui/icons';
import { TYPE_META, TYPE_SECTION } from './ui/surfaces';

/**
 * 로그인 전 첫 화면의 **「여기서 더 할 수 있는 것」 줄** — 폼 아래.
 *
 * 앞 판의 첫 화면은 입력 폼에서 끝났다. 폼을 채우기 전의 사람은 「사주를 보면 그다음은?」을 알 길이 없었고, 사주풀이 ·
 * 궁합 · 인연은 로그인한 뒤에야 탭으로 처음 보였다. 넷을 한 줄씩만 보이고 자세한 것은 서비스 소개로 넘긴다.
 *
 * **로그인한 사람에게는 안 선다** — 그 사람에게 `/` 는 「다른 사람 사주 보기」 계산기이고 넷은 이미 탭에 있다. 세션을
 * 모르는 동안에도 안 세운다(머리글과 같은 까닭 — 회원에게 한 번 깜빡이는 거짓말을 안 보인다).
 */
export function LandingGuide() {
  const { session } = useBrowserSession();
  if (session !== 'out') return null;

  return (
    <section aria-labelledby="landing-guide" className="flex flex-col gap-4">
      {/* 폰에서는 제목이 두 줄로 갈리지 않게 링크가 아랫줄로 내려간다 */}
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <h2 id="landing-guide" className={TYPE_SECTION}>
          로그인하면 더 볼 수 있어요
        </h2>
        <Link href="/about" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-foreground">
          서비스 소개
          <Icon name="arrow" className="size-4" />
        </Link>
      </div>
      <ul className="grid gap-2 sm:grid-cols-3">
        {SERVICE_FEATURES.filter((feature) => feature.title !== '사주').map((feature) => (
          <li key={feature.title} className="flex gap-3 rounded-[1.25rem] border border-border bg-surface px-4 py-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-soft text-foreground">
              <Icon name={feature.icon} className="size-[18px]" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[15px] font-semibold text-foreground">{feature.title}</span>
              <span className="text-sm leading-6 text-secondary">{feature.body}</span>
              <span className={TYPE_META}>{feature.note}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
