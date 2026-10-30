import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import type { SkippableRead } from '@db-error';
import { accountLabel } from '@ops/account-label';
import {
  GRANT_MAX,
  GRANT_REASONS,
  HISTORY_FILTERS,
  NOTE_MAX,
  NOT_REFUNDABLE,
  REVOKE_REASONS,
  grantBlocked,
  grantPlan,
  historyAmount,
  historyCause,
  historyKindLabel,
  revokeBlocked,
  samePlan as sameGrant,
  sourceLabel,
  type GrantKind,
  type GrantPlan,
  type HistoryCursor,
  type HistoryFilter,
  type HistoryLine,
} from '@ops/credit-grant';
import { QUERY_MAX, queryOf, type CreditSource, type Member, type MemberGrantLedger, type MemberSanctions } from '@ops/members';
import { NO_NICKNAME, WARNING_LABEL, accountStatusLabel, evidenceTime } from '@ops/report-labels';
import {
  NOTE_MAX as STATUS_NOTE_MAX,
  UNRECORDED,
  doneNote as statusDoneNote,
  isStatusReason,
  reasonsOf,
  samePlan as sameStatus,
  sanctionKindLabel,
  sanctionReasonLabel,
  statusAction,
  statusPlan,
  type SanctionEntry,
  type StatusKind,
  type StatusPlan,
} from '@ops/suspension';

import { UUID } from '@uuid';

import { Panel, PrimaryButton, SecondaryButton } from '@/ui/parts';

import { DENIED, type Denied } from './denial';
import { Body, ConfirmSheet, DangerButton, DoneNote, FailureLine, Fact, Fine, LinkText, Mono, Note, NoteField, OpsAbsent, OpsShell, OpsWaiting, PageHead, Pick, SPACE, SearchRow, SectionTitle, Tag, Tags, go, useOneAtATime, useOpsRead } from './parts';
import { memberCreditHistory, memberGrantLedger, memberSanctions, operatorMember, type MemberHistory } from './read';
import { bookCreditGrant, changeMemberStatus, newRequestId } from './write';

const NOTE_HINT = '이용자에게는 보이지 않습니다. 이메일 · 실명 · 연락처는 적지 않습니다.';

type MemberPage = {
  readonly found: SkippableRead<Member | null>;
  readonly ledger: SkippableRead<MemberGrantLedger | null> | null;
  readonly history: SkippableRead<MemberHistory> | null;
  readonly sanctions: SkippableRead<MemberSanctions | null> | null;
};

async function loadMember(query: string | null, filter: HistoryFilter, before: HistoryCursor | null): Promise<Denied | MemberPage> {
  const found = await operatorMember(query);
  if (found === DENIED) return DENIED;
  const member = found.ok ? found.value : null;
  if (member === null) return { found, ledger: null, history: null, sanctions: null };
  const [ledger, history, sanctions] = await Promise.all([memberGrantLedger(member.userId), memberCreditHistory(member.userId, filter, before), memberSanctions(member.userId)]);
  if (ledger === DENIED || history === DENIED || sanctions === DENIED) return DENIED;
  return { found, ledger, history, sanctions };
}

/** 회원 찾기 — 닉네임이나 계정 id 로 한 명. 이메일로는 안 찾는다. 찾고 보고 쓸 때마다 접속기록에 남는다(G-110 ③ · G-111, ADR 0185 · 0187 · 0189) */
export default function MembersScreen() {
  const params = useLocalSearchParams<{ q?: string; report?: string }>();
  const query = queryOf(params.q);
  const reportId = typeof params.report === 'string' && UUID.test(params.report) ? params.report.toLowerCase() : null;
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [before, setBefore] = useState<HistoryCursor | null>(null);
  const load = useCallback(() => loadMember(query, filter, before), [query, filter, before]);
  const state = useOpsRead('members.find', query === null ? '/ops/members' : `/ops/members?q=${encodeURIComponent(query)}`, load);
  const [draft, setDraft] = useState(query ?? '');


  if (state.kind === 'waiting') return <OpsWaiting />;
  if (state.kind === 'absent') return <OpsAbsent />;
  const { found, ledger, history, sanctions } = state.value;
  const member = found.ok ? found.value : null;
  return (
    <OpsShell>
      <PageHead title="회원" note="닉네임이나 계정 id 로 회원을 찾아 상태 · 풀이권 · 처분 이력을 봅니다." />
      <Panel>
        <SearchRow
          label="닉네임 또는 계정 id"
          value={draft}
          onChange={setDraft}
          maxLength={QUERY_MAX}
          button={WARNING_LABEL.search}
          onSubmit={() => {
            setBefore(null);
            router.setParams({ q: draft.trim() });
          }}
        />
      </Panel>
      {query === null ? null : !found.ok ? (
        <FailureLine onRetry={state.reload}>회원을 읽지 못했습니다.</FailureLine>
      ) : member === null ? (
        <Note>찾는 회원이 없습니다.</Note>
      ) : (
        <>
          <Account member={member} sanctions={sanctions} reload={state.reload} />
          <Credits member={member} ledger={ledger} reportId={reportId} reload={state.reload} />
          {history !== null && (
            <History
              history={history}
              filter={filter}
              paged={before !== null}
              reload={state.reload}
              onFilter={(next) => {
                setFilter(next);
                setBefore(null);
              }}
              onPage={setBefore}
            />
          )}
          {sanctions !== null && <Sanctions sanctions={sanctions} reload={state.reload} />}
        </>
      )}
    </OpsShell>
  );
}

function Account({ member, sanctions, reload }: { member: Member; sanctions: SkippableRead<MemberSanctions | null> | null; reload: () => void }) {
  const standing = sanctions !== null && sanctions.ok ? sanctions.value : null;
  const action = standing === null ? null : statusAction(standing);
  return (
    <Panel style={SPACE.card}>
      <SectionTitle>{member.nickname ?? NO_NICKNAME}</SectionTitle>
      <Tags>
        <Tag>{accountStatusLabel(standing?.status ?? member.status)}</Tag>
        {action?.kind === 'operator' && <Tag tone="strong">운영자 계정</Tag>}
      </Tags>
      <Fact label="사용 가능한 풀이권">
        <SectionTitle>{`${member.credits.available}장`}</SectionTitle>
      </Fact>
      <Fact label="계정 id">
        <Mono>{member.userId}</Mono>
      </Fact>
      {standing !== null && action !== null && (action.kind === 'suspend' || action.kind === 'unsuspend') && (
        <StatusPanel kind={action.kind} userId={member.userId} nickname={member.nickname} version={standing.version} reload={reload} />
      )}
      {action?.kind === 'none' && <Note>{action.note}</Note>}
    </Panel>
  );
}

function Source({ title, receivedLabel, source }: { title: string; receivedLabel: string; source: CreditSource }) {
  return (
    <View style={SPACE.line}>
      <Body>{title}</Body>
      <Fine>{`${receivedLabel} ${source.received}장 · 사용 ${source.used}장 · 남은 ${source.left}장`}</Fine>
    </View>
  );
}

function Credits({ member, ledger, reportId, reload }: { member: Member; ledger: SkippableRead<MemberGrantLedger | null> | null; reportId: string | null; reload: () => void }) {
  const { credits } = member;
  return (
    <Panel style={SPACE.card}>
      <SectionTitle>풀이권 출처</SectionTitle>
      <Note>출처별은 장부 기준이라 합이 잔액과 다를 수 있습니다.</Note>
      <Source title="가입 무료" receivedLabel="받은" source={credits.free} />
      <Source title="운영 지급" receivedLabel="받은" source={credits.granted} />
      <Source title="유료 구매" receivedLabel="구매한" source={credits.bought} />
      <Tags>
        <Tag>{`예약 중 ${credits.reserved}장`}</Tag>
        <Tag>{`환불 확보 중 ${credits.held}장`}</Tag>
        <Tag>{`환불한 풀이권 ${credits.bought.refunded}장`}</Tag>
        <Tag>{`풀이 ${credits.usedAll}회`}</Tag>
        {credits.outsideUsed > 0 && <Tag>{`몫 밖 풀이 ${credits.outsideUsed}회`}</Tag>}
      </Tags>
      {member.orderNumbers.map((orderNumber) => (
        <LinkText key={orderNumber} label={orderNumber} onPress={() => go(`/ops/orders?order=${encodeURIComponent(orderNumber)}`)} />
      ))}
      {ledger === null ? null : !ledger.ok ? (
        <FailureLine onRetry={reload}>무상 지급분을 읽지 못했습니다.</FailureLine>
      ) : ledger.value === null ? null : (
        <>
          <Tags>
            <Tag>현금 환불 대상 아님</Tag>
          </Tags>
          <Note>{`운영 지급 중 회수할 수 있는 것 ${ledger.value.revocable}장${ledger.value.reserved > 0 ? ` · 예약 중 ${ledger.value.reserved}장` : ''}`}</Note>
          <GrantPanel userId={member.userId} nickname={member.nickname} ledger={ledger.value} reserved={ledger.value.reserved} reportId={reportId} status={member.status} reload={reload} />
        </>
      )}
    </Panel>
  );
}

function History({
  history,
  filter,
  paged,
  reload,
  onFilter,
  onPage,
}: {
  history: SkippableRead<MemberHistory>;
  filter: HistoryFilter;
  paged: boolean;
  reload: () => void;
  onFilter: (next: HistoryFilter) => void;
  onPage: (next: HistoryCursor | null) => void;
}) {
  return (
    <Panel style={SPACE.card}>
      <SectionTitle>풀이권 이력</SectionTitle>
      <Pick value={filter} onPick={onFilter} options={HISTORY_FILTERS} />
      {!history.ok ? (
        <FailureLine onRetry={reload}>이력을 읽지 못했습니다.</FailureLine>
      ) : history.value.lines.length === 0 ? (
        <Note>풀이권 이력이 없습니다.</Note>
      ) : (
        history.value.lines.map((line) => <HistoryRow key={line.key} line={line} />)
      )}
      {history.ok && (history.value.next !== null || paged) && (
        <View style={SPACE.row}>
          {history.value.next !== null && <SecondaryButton label="더 보기" onPress={() => onPage(history.value.next)} />}
          {paged && <SecondaryButton label="처음으로" onPress={() => onPage(null)} />}
        </View>
      )}
    </Panel>
  );
}

function HistoryRow({ line }: { line: HistoryLine }) {
  const amount = historyAmount(line);
  return (
    <View style={SPACE.line}>
      <Tags>
        <Tag tone="strong">{historyKindLabel(line.kind)}</Tag>
        <Tag>{sourceLabel(line.source)}</Tag>
        {amount !== '' && <Tag>{amount}</Tag>}
      </Tags>
      <Fine>{evidenceTime(line.at)}</Fine>
      <Body>{historyCause(line)}</Body>
      {line.note !== null && <Note>{line.note}</Note>}
      {line.orderNumber !== null && <LinkText label={line.orderNumber} onPress={() => go(`/ops/orders?order=${encodeURIComponent(line.orderNumber as string)}`)} />}
      {line.actorNickname !== null && <Fine>{`실행자 ${line.actorNickname}`}</Fine>}
      {line.reportId !== null && <LinkText label="관련 신고 보기" onPress={() => go(`/ops/reports/${line.reportId}`)} />}
    </View>
  );
}

function Sanctions({ sanctions, reload }: { sanctions: SkippableRead<MemberSanctions | null>; reload: () => void }) {
  return (
    <Panel style={SPACE.card}>
      <SectionTitle>처분 이력</SectionTitle>
      {sanctions.ok && sanctions.value !== null && <Tags><Tag>{`현재 신고 기준 최근 12개월 경고 ${sanctions.value.warnings12m}회`}</Tag></Tags>}
      <Note>탈퇴한 신고자의 분리 보관 경고는 런북 SQL 로 따로 셉니다.</Note>
      {!sanctions.ok ? (
        <FailureLine onRetry={reload}>처분 이력을 읽지 못했습니다.</FailureLine>
      ) : sanctions.value === null || sanctions.value.entries.length === 0 ? (
        <Note>현재 신고와 계정에 적힌 처분이 없습니다.</Note>
      ) : (
        sanctions.value.entries.map((entry) => <SanctionRow key={`${entry.source}-${entry.id}`} entry={entry} />)
      )}
    </Panel>
  );
}

function SanctionRow({ entry }: { entry: SanctionEntry }) {
  const reason = sanctionReasonLabel(entry);
  return (
    <View style={SPACE.line}>
      <Tags>
        <Tag tone="strong">{sanctionKindLabel(entry)}</Tag>
        {reason !== null && <Tag>{reason}</Tag>}
        {!entry.recorded && <Tag tone="danger">{UNRECORDED}</Tag>}
        {entry.counted && <Tag>12개월 셈</Tag>}
      </Tags>
      <Fine>{evidenceTime(entry.at)}</Fine>
      {entry.note !== null && <Note>{entry.note}</Note>}
      {entry.actorNickname !== null && <Fine>{`실행자 ${entry.actorNickname}`}</Fine>}
      {entry.warningRef !== null && <Fine>{`${WARNING_LABEL.ref} ${entry.warningRef}`}</Fine>}
      {entry.source === 'report' && entry.kind === 'warning' && (
        <Fine>{entry.acknowledgedAt === null ? `이용자 ${WARNING_LABEL.notYet}` : `${WARNING_LABEL.acknowledged} ${evidenceTime(entry.acknowledgedAt)}`}</Fine>
      )}
      {entry.reportId !== null && <LinkText label="신고 내용 보기" onPress={() => go(`/ops/reports/${entry.reportId}`)} />}
    </View>
  );
}

function StatusPanel({ kind, userId, nickname, version, reload }: { kind: StatusKind; userId: string; nickname: string | null; version: number; reload: () => void }) {
  const reasons = reasonsOf(kind);
  const [opened, setOpened] = useState(false);
  const [reason, setReason] = useState<string>(reasons[0].value);
  const [note, setNote] = useState('');
  const [plan, setPlan] = useState<StatusPlan | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { saving, run } = useOneAtATime();
  const title = kind === 'suspend' ? '이용 정지' : '정지 해제';
  const chosen = isStatusReason(kind, reason) ? reason : reasons[0].value;
  const input = { kind, userId, reason: chosen, note };

  const open = () => {
    setFailure(null);
    if (note.trim() === '') {
      setFailure('메모를 적어 주세요.');
      return;
    }
    setPlan(sameStatus(plan, input) ? plan : statusPlan({ version }, input, newRequestId()));
    setConfirming(true);
  };
  const confirm = () => {
    if (plan === null) return;
    run(async () => {
      const answer = await changeMemberStatus(plan.request);
      setConfirming(false);
      if (answer.ok) {
        setOpened(false);
        setPlan(null);
        setNote('');
        setDone(statusDoneNote(plan.request.kind, answer.replayed));
      } else {
        setFailure(answer.message);
        if (answer.unreached !== true) setPlan(null);
      }
      /* 거절이어도 다시 읽는다 — 다른 운영자가 먼저 바꿨으면 그 상태 · 버전이 선다 */
      reload();
    });
  };
  const Act = kind === 'suspend' ? DangerButton : PrimaryButton;

  return (
    <View style={SPACE.stack}>
      {!opened && (
        <SecondaryButton
          label={title}
          disabled={saving}
          onPress={() => {
            setOpened(true);
            setReason(reasons[0].value);
            setNote('');
            setPlan(null);
            setFailure(null);
            setDone(null);
          }}
        />
      )}
      <DoneNote>{saving ? '처리 중…' : done}</DoneNote>
      {!opened && failure !== null && <FailureLine>{failure}</FailureLine>}
      {opened && (
        <View style={SPACE.sunken}>
          <Pick label="사유" value={chosen} onPick={setReason} options={reasons} />
          <NoteField label="메모" value={note} onChange={setNote} max={STATUS_NOTE_MAX} hint={NOTE_HINT} />
          {failure !== null && !confirming && <FailureLine>{failure}</FailureLine>}
          <Act label={title} onPress={open} disabled={saving} />
          <SecondaryButton label="취소" onPress={() => setOpened(false)} disabled={saving} />
        </View>
      )}
      {plan !== null && (
        <ConfirmSheet open={confirming} onClose={() => setConfirming(false)} title={plan.title} confirmLabel={plan.confirmLabel} onConfirm={confirm} danger={plan.request.kind === 'suspend'} busy={saving}>
          <Fact label="대상">{accountLabel(nickname, userId)}</Fact>
          <Fact label="처분">{plan.changeLine}</Fact>
          <Fact label="사유">{plan.reasonLine}</Fact>
          <Note>{plan.resultLine}</Note>
        </ConfirmSheet>
      )}
    </View>
  );
}

function GrantPanel({
  userId,
  nickname,
  ledger,
  reserved,
  reportId,
  status,
  reload,
}: {
  userId: string;
  nickname: string | null;
  ledger: MemberGrantLedger;
  reserved: number;
  reportId: string | null;
  status: string;
  reload: () => void;
}) {
  const [mode, setMode] = useState<GrantKind | null>(null);
  const [credits, setCredits] = useState(1);
  const [reason, setReason] = useState<string>(GRANT_REASONS[0].value);
  const [note, setNote] = useState('');
  const [plan, setPlan] = useState<GrantPlan | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { saving, run } = useOneAtATime();
  const blocked = revokeBlocked(ledger.revocable, reserved);
  const grantShut = grantBlocked(status);
  const most = mode === 'revoke' ? ledger.revocable : GRANT_MAX;
  const chosen = Math.min(Math.max(credits, 1), Math.max(most, 1));
  const reasons = mode === 'revoke' ? REVOKE_REASONS : GRANT_REASONS;
  const input = mode === null ? null : { kind: mode, userId, credits: chosen, reason, note, reportId: mode === 'grant' ? reportId : null };

  const openForm = (kind: GrantKind) => {
    setMode(kind);
    setCredits(1);
    setReason((kind === 'revoke' ? REVOKE_REASONS : GRANT_REASONS)[0].value);
    setNote('');
    setPlan(null);
    setFailure(null);
    setDone(null);
  };
  const open = () => {
    if (input === null) return;
    setFailure(null);
    if (note.trim() === '') {
      setFailure('메모를 적어 주세요.');
      return;
    }
    setPlan(sameGrant(plan, input) ? plan : grantPlan(ledger, input, newRequestId()));
    setConfirming(true);
  };
  const confirm = () => {
    if (plan === null) return;
    run(async () => {
      const answer = await bookCreditGrant(plan.request);
      setConfirming(false);
      if (answer.ok) {
        const verb = plan.request.kind === 'grant' ? '지급' : '회수';
        setMode(null);
        setPlan(null);
        setNote('');
        setDone(answer.replayed ? `이미 ${verb}했습니다.` : `${verb}했습니다.`);
      } else {
        setFailure(answer.message);
        if (answer.unreached !== true) setPlan(null);
      }
      reload();
    });
  };

  return (
    <View style={SPACE.stack}>
      <SecondaryButton label="무상 풀이권 지급" onPress={() => openForm('grant')} disabled={saving || grantShut !== null} />
      <SecondaryButton label="무상 지급분 회수" onPress={() => openForm('revoke')} disabled={saving || blocked !== null} />
      <DoneNote>{saving ? '처리 중…' : done}</DoneNote>
      {grantShut !== null && <Fine>{grantShut}</Fine>}
      {blocked !== null && <Fine>{blocked}</Fine>}
      {mode !== null && input !== null && (
        <View style={SPACE.sunken}>
          <Note>{mode === 'grant' ? `무상 지급분은 ${NOT_REFUNDABLE}` : '무상 지급분만 회수합니다. 구매분 환불은 주문 화면에서.'}</Note>
          <Pick label="수량" value={chosen} onPick={setCredits} options={Array.from({ length: most }, (_, i) => ({ value: i + 1, label: `${i + 1}장` }))} />
          <Pick label="사유" value={reason} onPick={setReason} options={reasons} />
          <NoteField label="메모" value={note} onChange={setNote} max={NOTE_MAX} hint={NOTE_HINT} />
          {mode === 'grant' && reportId !== null && (
            <Fact label="관련 신고">
              <Mono>{reportId}</Mono>
            </Fact>
          )}
          {failure !== null && !confirming && <FailureLine>{failure}</FailureLine>}
          <PrimaryButton label={mode === 'grant' ? `${chosen}장 지급` : `${chosen}장 회수`} onPress={open} disabled={saving} />
          <SecondaryButton label="취소" onPress={() => setMode(null)} disabled={saving} />
        </View>
      )}
      {plan !== null && (
        <ConfirmSheet open={confirming} onClose={() => setConfirming(false)} title={plan.title} confirmLabel={plan.confirmLabel} onConfirm={confirm} danger={plan.request.kind === 'revoke'} busy={saving}>
          <Fact label="대상">{accountLabel(nickname, userId)}</Fact>
          <Fact label="수량">{plan.amountLine}</Fact>
          <Fact label="사유">{plan.reasonLine}</Fact>
          {plan.request.reportId !== null && <Fact label="관련 신고">{plan.request.reportId}</Fact>}
          <Note>{plan.resultLine}</Note>
        </ConfirmSheet>
      )}
    </View>
  );
}
