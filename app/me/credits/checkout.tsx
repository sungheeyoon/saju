'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';

import {
  bundleMark,
  bundleOrderName,
  discountAgainstSingles,
  READING_BUNDLE_VALID_YEARS,
  READING_BUNDLES,
  won,
} from '@/src/lib/reading/bundle';

import { actionAnswer } from '../../ui/action-answer';
import { BUTTON_PRIMARY, BUTTON_TERTIARY_FACE } from '../../ui/buttons';
import { FailureLine } from '../../ui/failure-line';
import { TYPE_META, TYPE_NAME } from '../../ui/surfaces';
import { openReadingOrder } from './actions';
import type { PortoneCheckout } from './payment';
import { loadPortOne } from './portone-sdk';
import { withReturnTo, type ReturnTo } from './return-to';

/**
 * **풀이권 고르기 · 동의 체크 · 「결제하기」 · 유의사항** (G-21, ADR 0171 · 0175).
 *
 * 리디 충전 화면의 꼴이다(ADR 0175) — 묶음 목록 → 동의 체크(필수) → 결제 단추 → 그 아래 작은 글씨 유의사항 다섯 줄과
 * 「자세히 알아보기」(`/refund`). 고른 묶음의 값은 단추 글자(「N원 결제하기」)가 들어 따로 요약 줄을 세우지 않는다. 이용약관 ·
 * 처리방침은 바닥글이 든다. 묶음과 유의사항은 누구에게나 선다. 유의사항의 환불 신청 줄(`refundLine`)은 서버가 사업자 이메일로
 * 지어 넘긴다(`checkoutRefundLine`).
 * 결제 단추는 서버가 결제창 값(`checkout`)을 넘긴 사람 — 판매가 열린 사람(지금은 카드사 심사 계정)이고 상점 번호 · 채널 키가 있는 배포 — 에게만 선다. 누르면 주문을 먼저 열고(금액은 DB 의 가격표), 그 주문 번호로 결제창을
 * 띄운다. 결제가 됐는지는 이 화면이 정하지 않는다 — 웹훅이 PortOne 에서 다시 받아 승인한 주문을 결제 뒤 화면이 읽는다.
 */
export function Checkout({
  checkout,
  refundLine,
  back,
}: {
  checkout: PortoneCheckout | null;
  refundLine: string;
  back: ReturnTo | null;
}) {
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
          redirectUrl: `${window.location.origin}${withReturnTo('/me/credits/done', back)}`,
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
      router.push(withReturnTo(`/me/credits/done?paymentId=${encodeURIComponent(opened.paymentId)}`, back));
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
              className={`flex min-h-16 cursor-pointer items-center gap-4 rounded-card border px-4 py-3 ${
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
                  <span className={TYPE_NAME}>{bundleOrderName(bundle.credits)}</span>
                  {mark !== null && (
                    <span className="rounded-full bg-cream px-2 py-0.5 text-fine font-semibold text-cream-ink">
                      {mark}
                    </span>
                  )}
                </span>
                {discount > 0 && <span className={TYPE_META}>1장 대비 {discount}% 할인</span>}
              </span>
              <span className="text-body font-semibold tabular-nums text-foreground">{won(bundle.price)}</span>
            </label>
          );
        })}
      </fieldset>

      <div className="flex flex-col gap-3">
        {checkout === null ? (
          <p className={TYPE_META}>풀이권 판매 준비 중이에요.</p>
        ) : (
          <>
            <label htmlFor={agreeId} className="flex min-h-11 cursor-pointer items-start gap-3 py-1 text-note leading-6 text-foreground">
              <input
                id={agreeId}
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
              />
              상품, 가격, 할인 정보, 유의 사항 등을 확인하였으며 구매에 동의합니다. (필수)
            </label>
            <button type="button" onClick={pay} disabled={paying} className={BUTTON_PRIMARY}>
              {paying ? '결제창 여는 중…' : `${won(chosen.price)} 결제하기`}
            </button>
            {failure !== null && <FailureLine>{failure}</FailureLine>}
          </>
        )}

        <ul aria-label="유의사항" className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-fine leading-[1.125rem] text-secondary">
          <li>
            미사용 유료 풀이권은 실제 결제한 금액을 기준으로 환불합니다. 청약철회 기간(7일)이 지난 뒤 단순 변심으로 환불하면,
            미사용분에 해당하는 금액의 10%를 환불수수료로 공제합니다.
          </li>
          <li>{refundLine}</li>
          <li>
            정상적으로 제공된 풀이는 단순 변심으로 환불되지 않습니다. 풀이가 제공되지 않거나 표시·광고 또는 계약 내용과
            다르게 제공된 경우에는 관계 법령에 따라 재제공 또는 환불을 요청할 수 있습니다.
          </li>
          <li>구매 전 무료 풀이권으로 풀이 한 편을 먼저 받아 볼 수 있습니다.</li>
          <li>
            {/* 시행일 전에 받은 몫은 시행일부터 센다 — 약관 제13조⑦ · 환불정책과 같은 기준(ADR 0173 추기) */}
            유료 풀이권은 구매일로부터 {READING_BUNDLE_VALID_YEARS}년, 무료로 받은 풀이권은 받은 날(약관 시행일 전에 받은 풀이권은
            시행일)로부터 1년이 지나면 소멸됩니다.
          </li>
        </ul>
        <Link href={withReturnTo('/refund?from=credits', back)} className={`${BUTTON_TERTIARY_FACE} self-start text-fine font-medium text-secondary`}>
          자세히 알아보기
        </Link>
      </div>
    </>
  );
}
