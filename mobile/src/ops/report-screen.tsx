import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import type { SkippableRead } from '@db-error';
import { accountLabel } from '@ops/account-label';
import { NO_FILTERS } from '@ops/report-filters';
import { CHOSEN_MESSAGE_LABEL, NO_NICKNAME, NO_REVIEW_RECORD, SIDE_LABEL, UNKNOWN_SIDE_LABEL, WARNING_LABEL, accountStatusLabel, evidenceTime, reasonLabel, reviewOutcomeLabel, reviewStateLabel } from '@ops/report-labels';
import {
  HELD_SUSPENSION,
  NOTE_MAX,
  OUTCOMES,
  SIDE_NAME,
  WARNING_CATEGORIES,
  actionLabel,
  doneNote,
  reviewPlan,
  samePlan,
  sanctionLabel,
  sanctions,
  suspensionBlocked,
  warningSentence,
  type Outcome,
  type Party,
  type ReportNow,
  type ReviewLogLine,
  type ReviewPlan,
} from '@ops/report-review';
import type { AccountNow, PartySummary, ReportDetail, Snapshot, WarningRecord } from '@ops/reports';

import { Panel, PrimaryButton, SecondaryButton } from '@/ui/parts';

import { DENIED, type Denied } from './denial';
import { Body, ConfirmSheet, DangerButton, DoneNote, FailureLine, Fact, Fine, LinkText, Mono, Note, NoteField, OpsAbsent, OpsShell, OpsWaiting, PageHead, Pick, SPACE, SectionTitle, Tag, Tags, go, useOneAtATime, useOpsRead } from './parts';
import { operatorReport, operatorReports, reportParties } from './read';
import { newRequestId, writeReview } from './write';

type Loaded = {
  readonly report: ReportDetail | null;
  readonly parties: SkippableRead<readonly PartySummary[]> | null;
  readonly next: string | null;
};

/** 「다음 신고」 — 처리 필요 중 급한 순의 첫 건. 못 읽으면 안 세운다. 목록 문을 한 번 더 부르므로 접속기록에 목록 한 줄이 함께 남는다 */
async function nextOpen(reportId: string): Promise<string | null> {
  const listed = await operatorReports(NO_FILTERS);
  if (listed === DENIED || !listed.ok) return null;
  return listed.value.rows.find((row) => row.reportId !== reportId)?.reportId ?? null;
}

async function loadReport(reportId: string): Promise<Denied | 'missing' | Loaded> {
  const found = await operatorReport(reportId);
  if (found === DENIED) return DENIED;
  if (found.ok && found.value === null) return 'missing';
  const report = found.ok ? found.value : null;
  if (report === null) return { report: null, parties: null, next: null };
  const [parties, next] = await Promise.all([reportParties(reportId), report.isOpen ? Promise.resolve(null) : nextOpen(reportId)]);
  return { report, parties, next };
}

const memberHref = (userId: string, reportId: string): string => `/ops/members?q=${userId}&report=${reportId}`;

/** 신고 한 건과 근거 · 처분 — 근거는 신고 당시의 불변 사본뿐이다(ADR 0091). 대화방으로 가는 길은 없다(G-24 · G-111 ②, ADR 0103 · 0188) */
export default function ReportScreen() {
  const { reportId: raw } = useLocalSearchParams<{ reportId: string }>();
  const reportId = typeof raw === 'string' ? raw : '';
  const load = useCallback(() => loadReport(reportId), [reportId]);
  const state = useOpsRead('reports.detail', `/ops/reports/${reportId}`, load, { reportId });
  if (state.kind === 'waiting') return <OpsWaiting />;
  if (state.kind === 'absent' || state.value === 'missing') return <OpsAbsent />;
  const { report, parties, next } = state.value;
  const known = parties !== null && parties.ok ? parties.value : [];
  return (
    <OpsShell>
      <LinkText label="신고 목록" onPress={() => go('/ops/reports')} />
      <PageHead title="신고 내용" />
      {report === null ? (
        <FailureLine onRetry={state.reload}>신고를 읽지 못했습니다.</FailureLine>
      ) : (
        <>
          <Panel style={SPACE.card}>
            <Fact label="접수 시각">{evidenceTime(report.createdAt)}</Fact>
            <Fact label="신고 사유">{reasonLabel(report.reason)}</Fact>
            <Fact label="덧붙인 내용">{report.detail ?? '없음'}</Fact>
            <Account title="신고한 계정" who={report.reporter} />
            <Account title="신고받은 계정" who={report.reported} />
          </Panel>
          <Evidence snapshot={report.snapshot} />
          <Parties parties={parties} reportId={reportId} reload={state.reload} />
          <Panel style={SPACE.card}>
            <SectionTitle>처분</SectionTitle>
            <Tags>
              <Tag>{reviewStateLabel(report.isOpen)}</Tag>
            </Tags>
            <ReviewPanel
              now={{ reportId, reason: report.reason, isOpen: report.isOpen, outcome: report.review?.outcome ?? null, version: report.version }}
              parties={known}
              reload={state.reload}
            >
              <Result report={report} next={next} />
            </ReviewPanel>
            {report.reviewLog.length > 0 && <ReviewLog lines={report.reviewLog} />}
          </Panel>
        </>
      )}
    </OpsShell>
  );
}

function Account({ title, who }: { title: string; who: AccountNow }) {
  return (
    <Fact label={title}>
      <Body>{who.nickname ?? NO_NICKNAME}</Body>
      <Mono>{who.userId}</Mono>
      <Fine>{`지금 계정 상태 · ${accountStatusLabel(who.status)}`}</Fine>
    </Fact>
  );
}

function Evidence({ snapshot }: { snapshot: Snapshot | null }) {
  return (
    <Panel style={SPACE.card}>
      <SectionTitle>신고 당시 대화</SectionTitle>
      {snapshot === null ? (
        <Note>이 신고에는 저장된 대화 근거가 없습니다.</Note>
      ) : (
        <>
          <Note>신고 당시 저장된 대화 일부입니다. 전체 대화는 열 수 없습니다.</Note>
          <Fine>{`저장 시각 ${evidenceTime(snapshot.capturedAt)} · 신고한 메시지 앞 ${snapshot.contextBefore}건 · 뒤 ${snapshot.contextAfter}건까지`}</Fine>
          {snapshot.messages.map((message) => (
            <View key={message.seq} style={message.chosen ? SPACE.chosen : SPACE.plain}>
              <Tags>
                <Tag>{message.side === null ? UNKNOWN_SIDE_LABEL : SIDE_LABEL[message.side]}</Tag>
                {message.chosen && <Tag tone="strong">{CHOSEN_MESSAGE_LABEL}</Tag>}
              </Tags>
              <Fine>{evidenceTime(message.sentAt)}</Fine>
              <Body>{message.body}</Body>
            </View>
          ))}
        </>
      )}
    </Panel>
  );
}

function Parties({ parties, reportId, reload }: { parties: SkippableRead<readonly PartySummary[]> | null; reportId: string; reload: () => void }) {
  if (parties === null) return null;
  if (!parties.ok) return <FailureLine onRetry={reload}>대상 회원을 읽지 못했습니다.</FailureLine>;
  const reported = parties.value.find((party) => party.side === 'reported');
  const reporter = parties.value.find((party) => party.side === 'reporter');
  return (
    <Panel style={SPACE.card}>
      <SectionTitle>대상 회원</SectionTitle>
      {reported !== undefined && (
        <View style={SPACE.stack}>
          <Fine>{SIDE_NAME.reported}</Fine>
          <Body>{`${reported.nickname ?? NO_NICKNAME} · ${reported.userId.slice(0, 8)}`}</Body>
          <Tags>
            <Tag>{accountStatusLabel(reported.status)}</Tag>
            {reported.isOperator && <Tag tone="strong">운영자 계정</Tag>}
          </Tags>
          <Note>{`현재 신고 기준 최근 12개월 경고 ${reported.warnings12m}회`}</Note>
          {reported.recent.map((line) => (
            <Fine key={`${line.at}-${line.kind}`}>{`${evidenceTime(line.at)} · ${sanctionLabel(line)}`}</Fine>
          ))}
          <LinkText label="회원 열기" onPress={() => go(memberHref(reported.userId, reportId))} />
        </View>
      )}
      {reporter !== undefined && (
        <View style={SPACE.line}>
          <Fine>{SIDE_NAME.reporter}</Fine>
          <Body>{`${reporter.nickname ?? NO_NICKNAME} · ${accountStatusLabel(reporter.status)}`}</Body>
          <LinkText label="회원 열기" onPress={() => go(memberHref(reporter.userId, reportId))} />
        </View>
      )}
      <Fine>탈퇴한 신고자의 분리 보관 경고는 런북 SQL 로 따로 셉니다.</Fine>
    </Panel>
  );
}

function WarningItems({ warning }: { warning: WarningRecord }) {
  return (
    <>
      <Fact label={WARNING_LABEL.ref}>{warning.ref}</Fact>
      {warning.category !== null && <Fact label={WARNING_LABEL.category}>{reasonLabel(warning.category)}</Fact>}
      <Fact label={WARNING_LABEL.acknowledged}>{warning.acknowledgedAt === null ? WARNING_LABEL.notYet : evidenceTime(warning.acknowledgedAt)}</Fact>
    </>
  );
}

function Result({ report, next }: { report: ReportDetail; next: string | null }) {
  const review = report.review;
  const sanctioned = review?.sanctioned ?? null;
  const target = sanctioned === null ? null : report[sanctioned];
  const held = report.heldSuspension;
  const member = target ?? (held === null ? null : report[held]);
  return (
    <View style={SPACE.stack}>
      <Fact label="결과">{review === null ? NO_REVIEW_RECORD : `${reviewStateLabel(report.isOpen)} · ${reviewOutcomeLabel(review.outcome)}`}</Fact>
      {target !== null && sanctioned !== null && (
        <Fact label="제재 대상">
          <Body>{`${target.nickname ?? NO_NICKNAME} · ${SIDE_LABEL[sanctioned]}`}</Body>
          <Fine>{`지금 ${accountStatusLabel(target.status)}`}</Fine>
        </Fact>
      )}
      {report.warning !== null && <WarningItems warning={report.warning} />}
      {review !== null && <Fact label="판단 근거">{review.note ?? '없음'}</Fact>}
      <Fact label="실행자 · 시각">
        <Body>{review?.reviewerNickname ?? NO_NICKNAME}</Body>
        {report.reviewedAt !== null && <Fine>{evidenceTime(report.reviewedAt)}</Fine>}
      </Fact>
      {held !== null && <Note>{`${SIDE_LABEL[held]} · ${HELD_SUSPENSION}`}</Note>}
      {next !== null && <SecondaryButton label="다음 신고" onPress={() => go(`/ops/reports/${next}`)} />}
      {member !== null && <SecondaryButton label="회원 열기" onPress={() => go(memberHref(member.userId, report.reportId))} />}
    </View>
  );
}

function ReviewLog({ lines }: { lines: readonly ReviewLogLine[] }) {
  return (
    <View style={SPACE.stack}>
      <SectionTitle>{`처분 이력 ${lines.length}건`}</SectionTitle>
      {lines.map((line) => (
        <View key={line.version} style={SPACE.line}>
          <Fine>{`${line.version}차 · ${evidenceTime(line.at)} · ${line.carriedOver ? '기록 이전' : (line.actorNickname ?? NO_NICKNAME)}`}</Fine>
          <Body>
            {line.outcome === null ? NO_REVIEW_RECORD : reviewOutcomeLabel(line.outcome)}
            {line.sanctionedSide !== null ? ` · ${SIDE_LABEL[line.sanctionedSide]}` : ''}
            {line.warningCategory !== null ? ` · ${reasonLabel(line.warningCategory)}` : ''}
          </Body>
          {line.note !== null && <Note>{line.note}</Note>}
        </View>
      ))}
    </View>
  );
}

function ReviewPanel({ now, parties, reload, children }: { now: ReportNow; parties: readonly Party[]; reload: () => void; children: ReactNode }) {
  const [editing, setEditing] = useState(now.isOpen);
  const [outcome, setOutcome] = useState<Outcome>('no_action');
  const [side, setSide] = useState<Party['side']>('reported');
  const [category, setCategory] = useState(now.reason);
  const [note, setNote] = useState('');
  const [plan, setPlan] = useState<ReviewPlan | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { saving, run } = useOneAtATime();
  const showForm = now.isOpen || editing;
  const target = parties.find((party) => party.side === side);
  const blocked = outcome === 'suspension' ? suspensionBlocked(target) : null;
  const noParties = sanctions(outcome) && parties.length === 0;
  const input = { outcome, side, warningCategory: category, note };

  const submit = (frozen: ReviewPlan) => {
    run(async () => {
      const answer = await writeReview(frozen.request);
      setConfirming(false);
      if (answer.ok) {
        setPlan(null);
        setNote('');
        setOutcome('no_action');
        setEditing(false);
        setDone(doneNote(!now.isOpen, frozen.request.outcome, answer.replayed));
      } else {
        setFailure(answer.message);
        if (answer.unreached !== true) setPlan(null);
      }
      reload();
    });
  };
  const open = () => {
    setFailure(null);
    setDone(null);
    if (note.trim() === '') {
      setFailure('판단 근거를 적어 주세요.');
      return;
    }
    if (blocked !== null) {
      setFailure(blocked);
      return;
    }
    const frozen = samePlan(plan, now, parties, input) && plan !== null ? plan : reviewPlan(now, parties, input, newRequestId());
    setPlan(frozen);
    if (frozen.confirm) setConfirming(true);
    else submit(frozen);
  };
  const label = saving ? '처리 중…' : actionLabel(now, outcome);

  return (
    <View style={SPACE.card}>
      <DoneNote>{done}</DoneNote>
      {!showForm ? (
        <>
          {failure !== null && <FailureLine>{failure}</FailureLine>}
          {children}
          <SecondaryButton
            label="처분 바꾸기"
            onPress={() => {
              setEditing(true);
              setFailure(null);
              setDone(null);
            }}
          />
        </>
      ) : (
        <>
          {!now.isOpen && children}
          <Pick label="결과" value={outcome} onPick={setOutcome} options={OUTCOMES.map((one) => ({ value: one, label: reviewOutcomeLabel(one) }))} />
          {sanctions(outcome) && parties.length > 0 && (
            <Pick label="제재 대상" value={side} onPick={setSide} options={parties.map((party) => ({ value: party.side, label: `${SIDE_NAME[party.side]} · ${accountLabel(party.nickname, party.userId)}` }))} />
          )}
          {noParties && <FailureLine>대상 회원을 읽지 못해 경고 · 이용 정지를 고를 수 없습니다.</FailureLine>}
          {outcome === 'warning' && target !== undefined && (
            <>
              <Pick label="경고 갈래" value={category} onPick={setCategory} options={WARNING_CATEGORIES} />
              <Note>{warningSentence(target)}</Note>
            </>
          )}
          {outcome === 'suspension' && blocked !== null && <Note>{blocked}</Note>}
          <NoteField label="판단 근거" value={note} onChange={setNote} max={NOTE_MAX} hint="이메일 · 실명 · 연락처는 적지 않습니다." />
          {failure !== null && !confirming && <FailureLine>{failure}</FailureLine>}
          {outcome === 'suspension' ? <DangerButton label={label} onPress={open} disabled={saving || noParties} /> : <PrimaryButton label={label} onPress={open} disabled={saving || noParties} />}
          {!now.isOpen && <SecondaryButton label="취소" onPress={() => setEditing(false)} disabled={saving} />}
          {plan !== null && plan.confirm && (
            <ConfirmSheet open={confirming} onClose={() => setConfirming(false)} title={plan.title} confirmLabel={saving ? '처리 중…' : plan.confirmLabel} onConfirm={() => submit(plan)} danger={plan.danger} busy={saving}>
              <Fact label="신고">{plan.reportLine}</Fact>
              {plan.targetLine !== null && <Fact label="대상">{plan.targetLine}</Fact>}
              <Fact label="처분">{plan.changeLine}</Fact>
              <Fact label="근거">{plan.reasonLine}</Fact>
              {plan.resultLines.map((line) => (
                <Note key={line}>{line}</Note>
              ))}
            </ConfirmSheet>
          )}
        </>
      )}
    </View>
  );
}
