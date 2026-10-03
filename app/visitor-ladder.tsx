'use client';

import { SERVICE_NAME } from '@/src/lib/brand';

import { useBrowserSession } from './auth/browser-session';
import { BUTTON_PRIMARY } from './ui/buttons';
import { Icon, type IconName } from './ui/icons';
import { TYPE_SECTION } from './ui/surfaces';

/**
 * 현관 아래의 사다리 — **지금 되는 것 → 가입하면 열리는 것 → 그다음**(그로스 시안, 2026-10-03).
 *
 * 첫 화면은 폼 하나로 끝났다. 처음 온 사람은 사주를 보고 나서 「여기서 더 무엇을 하나」를 알 길이 없었고, 그래서
 * 가입할 까닭이 결과의 잠긴 목차 한 곳에만 걸려 있었다. 여기서는 **폼 아래에** 세 칸을 세운다 — 폼을 밀어내지 않는다.
 *
 * 적는 것은 **코드가 지금 하는 것만**이다. 수 · 기한 · 가격은 안 적는다 — 저장 자리 10명은 지금 코드의 한도이고(`docs/prd.md`
 * 「사람」), 풀이권 · 무료 몫은 바뀔 수 있어 적지 않는다.
 *
 * 회원에게는 안 선다. 모르는 동안에는 선다 — 현관과 같은 까닭이다(`home-hero.tsx` 「모르는 동안에는 현관을 세운다」).
 */
export function VisitorLadder() {
  const { session } = useBrowserSession();
  if (session === 'in') return null;

  /* `#calculator` 로 가면 계산기가 주소의 `#` 뒤를 입력으로 읽는다 — 주소를 안 건드리고 스크롤만 한다 */
  const toForm = () => document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <section aria-labelledby="ladder-title" className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5 px-1">
        <p className="text-[13px] font-semibold text-cream-ink">{SERVICE_NAME}에서 할 수 있는 것</p>
        <h2 id="ladder-title" className={TYPE_SECTION}>
          사주 한 장에서 시작해, 사람 사이까지
        </h2>
      </header>

      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className={`${step.tone} flex flex-col gap-3 rounded-[1.5rem] bg-[var(--tile)] p-5`}>
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-full bg-surface text-[var(--ink)]">
                <Icon name={step.icon} className="size-[18px]" />
              </span>
              <span className="text-[13px] font-semibold text-[var(--ink)]">
                {index + 1} · {step.when}
              </span>
            </div>
            <p className="font-rounded text-[1.2rem] leading-7 text-foreground">{step.title}</p>
            <ul className="flex flex-col gap-1.5 text-[14px] leading-6 text-secondary">
              {step.items.map((item) => (
                <li key={item} className="flex gap-1.5">
                  <Icon name="check" className="mt-1 size-3.5 shrink-0 text-[var(--ink)]" />
                  {item}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <div className="flex flex-col items-start gap-2 px-1">
        <button type="button" onClick={toForm} className={`${BUTTON_PRIMARY} w-full sm:w-auto`}>
          무료로 내 사주 보기
        </button>
        <p className="text-[13px] leading-5 text-secondary">
          지금은 비공개 베타라 가입하려면 테스트 코드가 필요해요. 사주와 궁합 첫 신호는 코드 없이 볼 수 있어요.
        </p>
      </div>
    </section>
  );
}

const STEPS: readonly { when: string; title: string; icon: IconName; tone: string; items: readonly string[] }[] = [
  {
    when: '지금 바로',
    title: '내 사주와 궁합 첫 신호',
    icon: 'spark',
    tone: 'tone-wood',
    items: ['로그인 없이 생일만 넣으면', '여덟 글자와 오행 분포', '두 사람의 궁합 한 줄'],
  },
  {
    when: '가입하면',
    title: '나를 읽어 주는 사주풀이',
    icon: 'reading',
    tone: 'tone-fire',
    items: ['내 사주를 읽고 쓴 풀이 한 편', '가족 · 친구를 최대 10명 저장', '두 사람의 궁합풀이와 점수'],
  },
  {
    when: '그다음',
    title: '사주로 만나는 인연',
    icon: 'heart',
    tone: 'tone-water',
    items: ['사주가 어울리는 사람을 카드로', '서로 동의하면 인연 궁합', '서로 동의한 상대와 대화'],
  },
];
