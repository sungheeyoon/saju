import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { accountLabel } from '@ops/account-label';
import { REFUND_REASONS, orderStatusLabel, refundReasonLabel, seoulTime } from '@ops/order-labels';
import { NO_ORDER, refundForAllUnused, type OrderLine, type RefundHold } from '@ops/orders';
import { BOOK_LABEL, preparePlan, samePlan, type Owner, type PreparePlan } from '@ops/refund-confirm';
import { isPenalizedRefund, readingOrderIdOf, refundBreakdown, won } from '@reading/bundle';

import { Panel, PrimaryButton } from '@/ui/parts';

import { Body, ConfirmSheet, DoneNote, FailureLine, Fact, Fine, LineField, LinkText, Mono, Note, OpsAbsent, OpsShell, OpsWaiting, PageHead, Pick, SPACE, SearchRow, SectionTitle, Strong, Tag, Tags, go, useOneAtATime, useOpsRead } from './parts';
import { refundBasis } from './read';
import { bookRefund, holdRefund, newRequestId } from './write';

const orderHref = (orderNumber: string): string => `/ops/orders?order=${encodeURIComponent(orderNumber)}`;

/**
 * 주문 — 번호로 찾아 환불을 준비하고 취소 번호로 장부에 확정한다(G-110 ②, ADR 0184). PG 취소는 부르지 않는다.
 * **「준비 취소」는 앱에 없다** — 서버 열쇠로 PortOne 취소 내역을 견주는 확인이 앱에서 안 돈다(`write.ts`). 그 동작은 웹에서 한다.
 */
export default function OrdersScreen() {
  const { order } = useLocalSearchParams<{ order?: string }>();
  const typed = typeof order === 'string' ? order.trim() : '';
  const orderId = typed === '' ? null : readingOrderIdOf(typed);
  const load = useCallback(() => refundBasis(orderId ?? NO_ORDER), [orderId]);
  const back = useMemo(() => (typed === '' ? '/ops/orders' : orderHref(typed)), [typed]);
  const state = useOpsRead('credits.refund_basis', back, load);
  const [draft, setDraft] = useState(typed);

  if (state.kind === 'waiting') return <OpsWaiting />;
  if (state.kind === 'absent') return <OpsAbsent />;
  const found = state.value;
  return (
    <OpsShell>
      <PageHead title="주문" note="주문 번호로 주문을 찾아 환불 금액을 셈하고 장부에 적습니다." />
      <Panel>
        <SearchRow label="주문 번호" value={draft} onChange={setDraft} onSubmit={() => router.setParams({ order: draft.trim() })} button="찾기" placeholder="rdo_…" />
      </Panel>
      {typed === '' ? null : orderId === null ? (
        <Note>주문 번호는 rdo_ 로 시작하는 36자입니다.</Note>
      ) : !found.ok ? (
        <FailureLine onRetry={state.reload}>주문을 읽지 못했습니다.</FailureLine>
      ) : found.value === null ? (
        <Note>이 번호의 주문이 없습니다.</Note>
      ) : (
        <>
          {found.value.asked !== null ? (
            <Asked line={found.value.asked} hold={found.value.hold} reload={state.reload} />
          ) : (
            found.value.hold !== null && <Departed orderId={orderId} hold={found.value.hold} reload={state.reload} />
          )}
          {found.value.others.length > 0 && <Others lines={found.value.others} />}
        </>
      )}
    </OpsShell>
  );
}

function Asked({ line, hold, reload }: { line: OrderLine; hold: RefundHold | null; reload: () => void }) {
  const bundle = line.bundle;
  return (
    <Panel style={SPACE.card}>
      <Tags>
        <Tag tone="strong">{`${bundle === null ? '묶음 없음' : `풀이권 ${bundle.credits}장`} · ${won(line.amount)}`}</Tag>
        <Tag>{orderStatusLabel(line.status)}</Tag>
      </Tags>
      <Mono>{line.orderNumber}</Mono>
      <Note>{`회원 ${accountLabel(line.owner.nickname, line.owner.ref)}`}</Note>
      <Fact label="결제">{line.approvedAt === null ? '결제 전' : seoulTime(line.approvedAt)}</Fact>
      <Fact label="거래 번호">{line.paymentId ?? '없음'}</Fact>
      <Fact label="돌려준 금액">{won(line.refundedAmount)}</Fact>
      {bundle !== null && (
        <>
          <Fact label="회차">
            {`산 ${bundle.credits} · 쓴 ${bundle.used} · 예약 중 ${bundle.reserved} · 걷은 ${bundle.refundedCredits}${hold !== null ? ` · 환불 진행 중 ${hold.credits}` : ''} · 안 쓴 ${bundle.unused}`}
          </Fact>
          <Fact label="유효기간">{`${bundle.validUntil}까지`}</Fact>
        </>
      )}
      {hold !== null ? (
        <HoldPanel hold={hold} orderId={line.orderId} reload={reload} />
      ) : bundle === null ? (
        <Note>결제되지 않은 주문이라 환불할 것이 없습니다.</Note>
      ) : bundle.unused === 0 ? (
        <Note>{bundle.reserved > 0 ? '예약 중인 회차는 풀린 뒤에 걷을 수 있습니다.' : '걷을 수 있는 회차가 없습니다.'}</Note>
      ) : line.status !== 'approved' && line.status !== 'partially_refunded' ? (
        <Note>환불할 수 없는 상태의 주문입니다.</Note>
      ) : (
        <>
          <Note>
            {`안 쓴 ${bundle.unused}장을 다 걷으면 ${won(refundForAllUnused(line, false))}, 청약철회 기간 경과 후(10% 공제)면 ${won(refundForAllUnused(line, true))}입니다.`}
            {bundle.reserved > 0 ? ` 예약 중 ${bundle.reserved}장은 풀린 뒤에 걷을 수 있습니다.` : ''}
          </Note>
          <PrepareForm
            orderId={line.orderId}
            orderNumber={line.orderNumber}
            owner={line.owner}
            paid={line.amount}
            refundedAmount={line.refundedAmount}
            credits={bundle.credits}
            refundedCredits={bundle.refundedCredits}
            penalizedCredits={bundle.penalizedCredits}
            unused={bundle.unused}
            reload={reload}
          />
        </>
      )}
    </Panel>
  );
}

function Departed({ orderId, hold, reload }: { orderId: string; hold: RefundHold; reload: () => void }) {
  return (
    <Panel style={SPACE.card}>
      <Tags>
        <Tag tone="strong">{won(hold.paidAmount)}</Tag>
        <Tag>탈퇴한 계정의 주문</Tag>
      </Tags>
      <Mono>{hold.orderNumber}</Mono>
      <Note>결제 기록은 보관 중입니다. 진행 중인 환불을 마무리합니다.</Note>
      <HoldPanel hold={hold} orderId={orderId} reload={reload} />
    </Panel>
  );
}

function Others({ lines }: { lines: readonly OrderLine[] }) {
  return (
    <Panel style={SPACE.card}>
      <SectionTitle>같은 계정의 다른 주문</SectionTitle>
      {lines.map((line) => (
        <View key={line.orderId} style={SPACE.line}>
          <Body>{`${line.bundle === null ? '묶음 없음' : `풀이권 ${line.bundle.credits}장`} · ${won(line.amount)}`}</Body>
          <Tags>
            <Tag>{orderStatusLabel(line.status)}</Tag>
            {line.bundle !== null && <Tag>{`안 쓴 ${line.bundle.unused}장`}</Tag>}
          </Tags>
          <LinkText label={line.orderNumber} onPress={() => go(orderHref(line.orderNumber))} />
        </View>
      ))}
    </Panel>
  );
}

const Target = ({ orderNumber, owner }: { orderNumber: string; owner: Owner }) => (
  <>
    <Fact label="주문">{orderNumber}</Fact>
    <Fact label="회원">{accountLabel(owner.nickname, owner.ref)}</Fact>
  </>
);

function PrepareForm({
  orderId,
  orderNumber,
  owner,
  paid,
  refundedAmount,
  credits,
  refundedCredits,
  penalizedCredits,
  unused,
  reload,
}: {
  orderId: string;
  orderNumber: string;
  owner: Owner;
  paid: number;
  refundedAmount: number;
  credits: number;
  refundedCredits: number;
  penalizedCredits: number;
  unused: number;
  reload: () => void;
}) {
  const [chosen, setTake] = useState(unused);
  const take = Math.min(chosen, unused);
  const [reason, setReason] = useState<string>(REFUND_REASONS[0].value);
  const [plan, setPlan] = useState<PreparePlan | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const { saving, run } = useOneAtATime();
  const penalizedNow = isPenalizedRefund(reason);
  const figures = { paid, credits, refundedCredits, refundedAmount, penalizedCredits };
  const { penalty, owed: amount } = refundBreakdown(figures, take, penalizedNow);

  const open = () => {
    setFailure(null);
    setPlan(samePlan(plan, orderId, take, reason, amount) ? plan : preparePlan({ orderId, ...figures }, take, reason, newRequestId()));
    setConfirming(true);
  };
  const confirm = () => {
    if (plan === null) return;
    run(async () => {
      const answer = await holdRefund(plan.request);
      if (answer.ok) {
        setConfirming(false);
        setPlan(null);
        reload();
        return;
      }
      /* 어느 실패든 창은 열어 두고 실패 줄을 창 안에 세운다(ADR 0184 덧). 답을 못 받았을 때만 요청 번호를 지킨다 */
      setFailure(answer.message);
      if (answer.unreached !== true) setPlan(Object.freeze({ ...plan, request: Object.freeze({ ...plan.request, requestId: newRequestId() }) }));
      reload();
    });
  };

  return (
    <View style={SPACE.card}>
      <Pick label="걷을 회차" value={take} onPick={setTake} options={Array.from({ length: unused }, (_, i) => unused - i).map((n) => ({ value: n, label: `${n}장` }))} />
      <Pick label="사유" value={reason} onPick={setReason} options={REFUND_REASONS} />
      <Fact label="돌려줄 금액">
        <SectionTitle>{won(amount)}</SectionTitle>
        <Fine>
          {`${won(paid)} × ${refundedCredits + take} ÷ ${credits}`}
          {penalty > 0 ? (penalizedNow ? ` − 환불수수료 ${won(penalty)}` : ` − 앞서 공제한 환불수수료 ${won(penalty)}`) : ''}
          {refundedAmount > 0 ? ` − 이미 돌려준 ${won(refundedAmount)}` : ''}
        </Fine>
      </Fact>
      <Note>준비하면 이 회차가 잠겨 이용자가 쓰지 못합니다. 그다음 PortOne 콘솔에서 취소합니다.</Note>
      {failure !== null && !confirming && <FailureLine>{failure}</FailureLine>}
      <PrimaryButton label="환불 준비" onPress={open} disabled={saving} />
      <DoneNote>{saving ? '준비하는 중…' : null}</DoneNote>
      {plan !== null && (
        <ConfirmSheet open={confirming} onClose={() => setConfirming(false)} title="환불을 준비할까요?" confirmLabel={plan.confirmLabel} cancelLabel="닫기" onConfirm={confirm} busy={saving} failure={failure}>
          <Target orderNumber={orderNumber} owner={owner} />
          <Fact label="회차 · 금액">{`${plan.request.credits}장 · ${won(plan.request.expectedAmount)}`}</Fact>
          <Fact label="사유">{refundReasonLabel(plan.request.reason)}</Fact>
          <Note>이 회차가 잠겨 이용자가 쓰지 못합니다. 그다음 PortOne 콘솔에서 이 금액을 취소합니다.</Note>
        </ConfirmSheet>
      )}
    </View>
  );
}

function HoldPanel({ hold, orderId, reload }: { hold: RefundHold; orderId: string; reload: () => void }) {
  const [refundId, setRefundId] = useState('');
  const [frozenRefundId, setFrozenRefundId] = useState('');
  const [dialog, setDialog] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [booked, setBooked] = useState<string | null>(null);
  const { saving, run } = useOneAtATime();

  const book = () =>
    run(async () => {
      const answer = await bookRefund({ orderId, holdId: hold.holdId, refundId: frozenRefundId });
      if (answer.ok) {
        setDialog(false);
        setBooked(`장부에 확정했습니다 — ${orderStatusLabel(answer.status)}`);
      } else setFailure(answer.message);
      reload();
    });

  return (
    <View style={SPACE.sunken}>
      <Tags>
        <Tag tone="danger">환불 진행 중</Tag>
        <Tag>{`${seoulTime(hold.heldAt)} 준비`}</Tag>
      </Tags>
      <Fact label="취소할 금액">{won(hold.amount)}</Fact>
      <Fact label="결제 금액">{won(hold.paidAmount)}</Fact>
      <Fact label="취소 후 잔액">{won(hold.remainingAmount)}</Fact>
      <Fact label="걷는 회차">{`${hold.credits}장`}</Fact>
      <Fact label="사유">{refundReasonLabel(hold.reason)}</Fact>
      <Fact label="회원">{accountLabel(hold.owner.nickname, hold.owner.ref)}</Fact>
      <Fact label="결제 번호">{hold.orderNumber}</Fact>
      <Fact label="거래 번호">{hold.paymentId ?? '없음'}</Fact>
      <Note>{`PortOne 콘솔에서 이 결제를 ${won(hold.amount)} 취소합니다.`}</Note>
      <Note>취소 번호를 적고 장부에 확정합니다.</Note>
      <LineField label="PG 취소 번호" value={refundId} onChange={setRefundId} />
      {failure !== null && !dialog && <FailureLine>{failure}</FailureLine>}
      <PrimaryButton
        label={BOOK_LABEL}
        disabled={saving || refundId.trim() === ''}
        onPress={() => {
          setFailure(null);
          setFrozenRefundId(refundId.trim());
          setDialog(true);
        }}
      />
      <DoneNote>{saving ? '처리하는 중…' : booked}</DoneNote>
      <ConfirmSheet open={dialog} onClose={() => setDialog(false)} title="장부에 확정할까요?" confirmLabel={BOOK_LABEL} cancelLabel="닫기" onConfirm={book} busy={saving} failure={dialog ? failure : null}>
        <Target orderNumber={hold.orderNumber} owner={hold.owner} />
        <Fact label="회차 · 금액">{`${hold.credits}장 · ${won(hold.amount)}`}</Fact>
        <Fact label="사유">{refundReasonLabel(hold.reason)}</Fact>
        <Fact label="PG 취소 번호">{frozenRefundId}</Fact>
        <Note>
          콘솔에서 <Strong>이 금액을 취소한 뒤에만</Strong> 누릅니다. 장부에 환불이 적히고 회차가 걷힙니다.
        </Note>
      </ConfirmSheet>
    </View>
  );
}
