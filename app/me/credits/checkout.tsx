'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';

import { bundleMark, discountAgainstSingles, READING_BUNDLES } from '@/src/lib/reading/bundle';

import { actionAnswer } from '../../ui/action-answer';
import { BUTTON_PRIMARY, BUTTON_TERTIARY } from '../../ui/buttons';
import { FailureLine } from '../../ui/failure-line';
import { CARD, TYPE_META, TYPE_NAME } from '../../ui/surfaces';
import { openReadingOrder } from './actions';
import type { PortoneCheckout } from './payment';
import { loadPortOne } from './portone-sdk';

/** 원 단위 가격 — 「4,900원」 */
const won = (amount: number): string => `${amount.toLocaleString('ko-KR')}원`;

/**
 * 결제 전 고지가 가리키는 글 셋. 이용약관 · 환불정책 화면은 바닥글 일(#666)이 세운다 — 주소는 그 일과 맞춘다.
 */
const POLICY_LINKS = [
  { href: '/terms', label: '이용약관' },
  { href: '/refund', label: '환불정책' },
  { href: '/privacy', label: '처리방침' },
] as const;

/**
 * **풀이권 고르기 · 결제 전 고지 · 「결제하기」** (G-21, ADR 0171).
 *
 * 묶음 넷과 고지는 누구에게나 선다. 결제 단추는 서버가 결제창 값(`checkout`)을 넘긴 사람 — 판매가 열린 사람(지금은 카드사 심사
 * 계정)이고 상점 번호 · 채널 키가 있는 배포 — 에게만 선다. 누르면 주문을 먼저 열고(금액은 DB 의 가격표), 그 주문 번호로 결제창을
 * 띄운다. 결제가 됐는지는 이 화면이 정하지 않는다 — 웹훅이 PortOne 에서 다시 받아 승인한 주문을 결제 뒤 화면이 읽는다.
 */
export function Checkout({ checkout }: { checkout: PortoneCheckout | null }) {
  const router = useRouter();
  const [credits, setCredits] = useState<number>(READING_BUNDLES[0].credits);
  const [agreed, setAgreed] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [paying, startPaying] = useTransition();
  /* 이 화면에서 같은 묶음을 다시 누르면 같은 주문이다 — 결제창을 닫고 다시 열어도 결제 번호가 하나다 */
  const [visit] = useState(() => crypto.randomUUID());
  const agreeId = useId();
  const chosen = READING_BUNDLES.find((bundle) => bundle.credits === credits) ?? READING_BUNDLES[0];

  const pay = () => {
    if (checkout === null) return;
    if (!agreed) {
      setFailure('결제 전 안내를 확인해 주세요.');
      return;
    }
    setFailure(null);
    startPaying(async () => {
      const opened = await actionAnswer(openReadingOrder(chosen.credits, `buy-${visit}-${chosen.credits}`));
      if (!opened.ok) {
        setFailure(opened.message);
        return;
      }
      let response;
      try {
        const portone = await loadPortOne();
        response = await portone.requestPayment({
          storeId: checkout.storeId,
          channelKey: checkout.channelKey,
          paymentId: opened.paymentId,
          orderName: opened.orderName,
          totalAmount: opened.amount,
          currency: 'CURRENCY_KRW',
          payMethod: 'CARD',
          redirectUrl: `${window.location.origin}/me/credits/done`,
        });
      } catch {
        setFailure('결제창을 열지 못했어요. 잠시 뒤 다시 시도해 주세요.');
        return;
      }
      /* 폰은 페이지가 옮겨 가 여기 안 온다. 데스크톱은 결제창이 닫힌 뒤 답이 온다 */
      if (response === undefined) return;
      if (response.code !== undefined) {
        setFailure('결제를 마치지 못했어요.');
        return;
      }
      router.push(`/me/credits/done?paymentId=${encodeURIComponent(opened.paymentId)}`);
    });
  };

  return (
    <>
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">풀이권 고르기</legend>
        {READING_BUNDLES.map((bundle) => {
          const discount = discountAgainstSingles(bundle.credits, bundle.price);
          const mark = bundleMark(bundle.credits);
          const on = bundle.credits === credits;
          return (
            <label
              key={bundle.credits}
              className={`flex min-h-16 cursor-pointer items-center gap-4 rounded-[1.25rem] border px-4 py-3 ${
                on ? 'border-accent bg-surface ring-2 ring-accent' : 'border-border bg-surface hover:border-border-strong'
              }`}
            >
              <input
                type="radio"
                name="bundle"
                value={bundle.credits}
                checked={on}
                onChange={() => setCredits(bundle.credits)}
                className="size-5 shrink-0 accent-[var(--accent)]"
              />
              <span className="flex flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={TYPE_NAME}>{bundle.credits}회</span>
                  {mark !== null && (
                    <span className="rounded-full bg-cream px-2 py-0.5 text-[12px] font-semibold text-cream-ink">
                      {mark}
                    </span>
                  )}
                </span>
                {discount > 0 && <span className={TYPE_META}>1회권 대비 {discount}% 할인</span>}
              </span>
              <span className="text-[15px] font-semibold tabular-nums text-foreground">{won(bundle.price)}</span>
            </label>
          );
        })}
      </fieldset>

      <section aria-labelledby={`${agreeId}-title`} className={`${CARD} flex flex-col gap-4`}>
        <h2 id={`${agreeId}-title`} className={TYPE_NAME}>
          결제 전에 확인해 주세요
        </h2>
        <ul className="flex flex-col gap-2 text-[15px] leading-7 text-secondary">
          <li>
            <strong className="font-semibold text-foreground">
              풀이권 {chosen.credits}회 · {won(chosen.price)}
            </strong>{' '}
            (부가세 포함)
          </li>
          <li>풀이권 1개로 사주풀이나 궁합풀이 한 편을 받아요.</li>
          <li>결제하면 바로 더해지고, 기한 없이 써요.</li>
          <li>안 쓴 풀이권은 언제든 돌려드려요. 이미 받은 풀이는 돌려드리지 않아요.</li>
        </ul>
        <p className="flex flex-wrap gap-x-4">
          {POLICY_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={BUTTON_TERTIARY}>
              {link.label}
            </Link>
          ))}
        </p>

        {checkout === null ? (
          <p className={TYPE_META}>아직 판매 전이에요.</p>
        ) : (
          <>
            <label htmlFor={agreeId} className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] text-foreground">
              <input
                id={agreeId}
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                className="size-5 shrink-0 accent-[var(--accent)]"
              />
              위 내용을 확인했어요
            </label>
            <button type="button" onClick={pay} disabled={paying} className={BUTTON_PRIMARY}>
              {paying ? '결제창 여는 중…' : `${won(chosen.price)} 결제하기`}
            </button>
            {failure !== null && <FailureLine>{failure}</FailureLine>}
          </>
        )}
      </section>
    </>
  );
}
