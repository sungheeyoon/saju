import Link from 'next/link';

import { BUTTON_SECONDARY } from '../ui/buttons';
import { Icon } from '../ui/icons';
import { OpenHashed } from './open-hashed';
import { CARD, DISCLOSURE_SUMMARY, TYPE_META, TYPE_SECTION, TYPE_TITLE } from '../ui/surfaces';

export const metadata = {
  title: '자주 묻는 질문',
  description: '테스트 코드 · 풀이권 · 궁합 · 공유 링크 · 탈퇴에 대해 답해 드려요.',
};

/**
 * 자주 묻는 질문 — **화면이 한 번도 설명하지 않던 낱말을 답하는 자리.**
 *
 * 머리글에는 「풀이권 N번 중 M번 남음」이 늘 서는데, 그것이 무엇이고 언제 줄고 언제 돌아오는지는 확인 창이 열릴 때에야
 * 한 줄씩 보였다. 테스트 코드 · 궁합 · 공유 링크 · 인연 찾기 쉬기 · 탈퇴도 같다 — 저마다 제 화면 안에서만 답한다.
 * 여기는 그 답을 한 장에 모은다.
 *
 * **「입력한 생년월일시는 저장되나요?」는 세우지 않는다** — 로그인 전 입력이 서버로 오고 여덟 글자가 국외 모델 제공자로
 * 가는 일(ADR 0143)을 어떻게 고지하는가가 열린 변호사 검토 G-66 에 걸려 있다. 답이 서면 처리방침과 함께 이 자리에 둔다.
 *
 * **정적이다.** 답은 PRD 「자원」 · 「사주풀이를 링크로 보낸다」 · 「들어오는 문」이 말하는 것만 적고, 이미 화면에 선 글자는
 * 그대로 옮긴다. 수(풀이권 · 저장 자리)는 바뀌므로 적지 않고 그 수가 서는 자리를 가리킨다.
 * 각 물음은 `id` 를 들어 다른 화면이 바로 가리킬 수 있다(`/help#credits` 처럼).
 */
const GROUPS: readonly {
  title: string;
  items: readonly { id: string; q: string; a: readonly string[]; link?: { href: string; label: string } }[];
}[] = [
  {
    title: '시작하기',
    items: [
      {
        id: 'signup-code',
        q: '테스트 코드는 어디서 받나요?',
        a: [
          '지금은 비공개 베타라 운영자가 테스터에게 직접 알려 드려요.',
          '구글로 로그인한 뒤 가입 화면에서 코드와 닉네임을 넣으면 가입이 끝나요.',
        ],
      },
      {
        id: 'without-sign-in',
        q: '로그인하지 않고 무엇을 볼 수 있나요?',
        a: [
          '첫 화면에서 한 사람의 사주(여덟 글자와 오행)와 두 사람의 궁합 첫 신호를 볼 수 있어요.',
          '사주풀이 · 궁합풀이 · 저장 · 인연은 로그인한 뒤에 이용할 수 있어요.',
        ],
        link: { href: '/about', label: '서비스 소개' },
      },
    ],
  },
  {
    title: '풀이권',
    items: [
      {
        id: 'credits',
        q: '풀이권은 무엇인가요?',
        a: [
          '사주풀이나 궁합풀이를 새로 받을 때 1번씩 써요. 누르기 전에 확인 창이 먼저 열려요.',
          '이미 받은 풀이를 다시 여는 것은 풀이권을 쓰지 않아요. 만드는 도중에 실패해도 쓰지 않은 것으로 남아요.',
          '남은 수는 화면 위의 「풀이권」 칸에서 볼 수 있어요.',
        ],
      },
      {
        id: 'credits-match',
        q: '인연 궁합에도 풀이권이 드나요?',
        a: [
          '궁합을 요청할 때 1번이 예약돼요. 상대가 동의하면 그것으로 인연 궁합이 만들어지고, 거절하거나 답이 없으면 돌아와요.',
          '요청을 받은 쪽은 풀이권을 쓰지 않아요.',
        ],
      },
    ],
  },
  {
    title: '궁합',
    items: [
      {
        id: 'compat-without-saving',
        q: '궁합을 보려면 꼭 사람을 저장해야 하나요?',
        a: [
          '아니요. 궁합 화면에서 「직접 입력」을 고르면 저장하지 않고 볼 수 있어요.',
          '직접 입력한 사람은 저장한 사람에 추가되지 않아요.',
        ],
      },
    ],
  },
  {
    title: '공유와 인연',
    items: [
      {
        id: 'share',
        q: '사주풀이를 다른 사람에게 보낼 수 있나요?',
        a: [
          '다 만들어진 풀이의 「공유 링크 복사」를 누르면 로그인 없이 열리는 주소가 복사돼요.',
          '링크를 아는 사람은 누구나 이 풀이를 볼 수 있어요. 인연 궁합은 보낼 수 없어요.',
        ],
      },
      {
        id: 'matching-off',
        q: '인연 찾기에서 내 프로필을 숨기려면요?',
        a: ['계정 관리의 「인연 찾기」에서 쉴 수 있어요. 쉬는 동안에는 다른 사람에게 소개되지 않아요.'],
        link: { href: '/me/settings', label: '계정 관리' },
      },
    ],
  },
  {
    title: '계정',
    items: [
      {
        id: 'leave',
        q: '탈퇴는 어떻게 하나요?',
        a: ['계정 관리 맨 아래 「탈퇴」를 누르면 신청하기 전에 자세한 내용을 먼저 보여 드려요.'],
        link: { href: '/me/settings', label: '계정 관리' },
      },
      {
        id: 'contact',
        q: '더 묻고 싶은 것이 있어요.',
        a: ['처리방침에 적힌 연락처로 알려 주세요.'],
        link: { href: '/privacy', label: '처리방침' },
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <main className="app-shell flex w-full max-w-3xl flex-1 flex-col gap-8 py-8 sm:py-12">
      <OpenHashed />
      <header className="flex flex-col gap-2">
        <h1 className={TYPE_TITLE}>자주 묻는 질문</h1>
        <p className="text-[15px] leading-7 text-secondary">궁금한 물음을 누르면 답이 펼쳐져요.</p>
      </header>

      {/* 묶음으로 바로 가는 줄 — 긴 목록에서 「풀이권」만 찾는 사람이 끝까지 내리지 않게 */}
      <nav aria-label="묶음">
        <ul className="flex flex-wrap gap-2">
          {GROUPS.map((group) => (
            <li key={group.title}>
              <a
                href={`#${group.items[0].id}`}
                className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-semibold text-foreground hover:border-border-strong"
              >
                {group.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {GROUPS.map((group) => (
        <section key={group.title} className="flex flex-col gap-3">
          <h2 className={TYPE_SECTION}>{group.title}</h2>
          <ul className={`flex flex-col divide-y divide-border !py-1 ${CARD}`}>
            {group.items.map((item) => (
              <li key={item.id} id={item.id} className="scroll-mt-24">
                <details className="group py-1">
                  <summary className={`${DISCLOSURE_SUMMARY} py-2 text-[15px] font-semibold`}>
                    {item.q}
                    <Icon name="chevron" className="size-4 shrink-0 text-secondary transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="flex flex-col gap-2 pb-3">
                    {item.a.map((line) => (
                      <p key={line} className="text-[15px] leading-7 text-secondary">
                        {line}
                      </p>
                    ))}
                    {item.link && (
                      <Link href={item.link.href} className={`${TYPE_META} w-fit font-semibold text-foreground underline underline-offset-4`}>
                        {item.link.label} →
                      </Link>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p>
        <Link href="/about" className={BUTTON_SECONDARY}>
          서비스 소개
        </Link>
      </p>
    </main>
  );
}
