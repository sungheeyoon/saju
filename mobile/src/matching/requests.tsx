import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  CONSENT_FLOW_CAVEAT,
  CONSENT_FLOW_STEPS,
  ELEMENT_EXCHANGE_LABEL,
  MATCH_ACCEPT_HEAD,
  MATCH_ACCEPT_HIDDEN,
  MATCH_ACCEPT_OPENS,
  REJECTION_IS_FINAL_NOTE,
  REQUEST_STATUS_TEXT,
  type RequestStatus,
} from '@consent/index';
import type { DecidedRequest, PastRequests } from '@matching/history';
import type { InboxRequest } from '@matching/inbox';
import { CANCEL_REQUEST_LABEL, CANCEL_REQUEST_NOTE } from '@matching/index';
import { CANCEL_REQUEST_TITLE } from '@matching/copy';
import { cancelledNote, when } from '@matching/requests';
import { ELEMENT_PICTURE_KO, type Element } from '@saju';

import { ElementSymbol } from '@/ui/element-symbol';
import { Icon } from '@/ui/icons';
import { PrimaryButton } from '@/ui/parts';
import { ConfirmModal, DialogStrong, DialogText, SheetModal } from '@/ui/sheet-modal';
import { COLOR, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { Card, RowCard, Tile } from '@/ui/surfaces';

import { cancelRequest, respondToRequest } from './doors';
import { BlockDialog, Face, PartnerSheet, ReportDialog } from './people';

/** 수락하면 무엇이 일어나는가 — 받은 카드와 보내는 창이 같은 한 벌을 읽는다(ADR 0008). 글자는 사용자 약속이라 상수 그대로다 */
export function MatchAcceptNotice({ side }: { side: keyof typeof MATCH_ACCEPT_HEAD }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeHead}>{MATCH_ACCEPT_HEAD[side]}</Text>
      {MATCH_ACCEPT_OPENS.map((line) => (
        <View key={line} style={styles.noticeRow}>
          <Text style={styles.noticeText}>•</Text>
          <Text style={[styles.noticeText, styles.flex]}>{line}</Text>
        </View>
      ))}
      <Text style={styles.noticeHidden}>{MATCH_ACCEPT_HIDDEN}</Text>
    </View>
  );
}

function Mark({ element }: { element: Element }) {
  return (
    <View style={styles.mark}>
      <View style={[styles.markFace, { backgroundColor: ELEMENT_TONE[element].soft }]}>
        <ElementSymbol element={element} size={20} />
      </View>
      <Text style={[styles.markName, { color: ELEMENT_TONE[element].ink }]}>{ELEMENT_PICTURE_KO[element]}</Text>
    </View>
  );
}

/** 오행 주고받기 두 칸 — 그림은 낭독기에서 숨고, 같은 사실을 문장으로 읽는다 */
export function ElementExchange({ request }: { request: InboxRequest }) {
  const said = [request.suppliedToMe, request.suppliedToThem].filter((line): line is string => line !== null).join(' ');
  const cells = [
    { key: 'toMe', label: ELEMENT_EXCHANGE_LABEL.toMe, from: request.nickname, to: '나', elements: request.elementsToMe },
    { key: 'toThem', label: ELEMENT_EXCHANGE_LABEL.toThem, from: '나', to: request.nickname, elements: request.elementsToThem },
  ];
  return (
    <View style={styles.exchange}>
      {(request.elementsToMe.length > 0 || request.elementsToThem.length > 0) && (
        <View style={styles.pair} accessible accessibilityLabel={said}>
          {cells.map((cell) => (
            <View key={cell.key} style={styles.cell}>
              <Text style={styles.cellLabel}>{cell.label}</Text>
              <View style={styles.cellWay}>
                <Text style={styles.cellWayText} numberOfLines={1}>
                  {cell.from}
                </Text>
                <Icon name="arrow" size={12} color={COLOR.secondary} />
                <Text style={styles.cellWayText} numberOfLines={1}>
                  {cell.to}
                </Text>
              </View>
              {cell.elements.length > 0 ? (
                <View style={styles.marks}>
                  {cell.elements.map((element) => (
                    <Mark key={element} element={element} />
                  ))}
                </View>
              ) : (
                <Text style={styles.cellNone}>{ELEMENT_EXCHANGE_LABEL.none}</Text>
              )}
            </View>
          ))}
          <View style={styles.swap}>
            <Icon name="exchange" size={16} color={COLOR.secondary} />
          </View>
        </View>
      )}
      <View style={styles.balance}>
        <Text style={styles.balanceTag}>{ELEMENT_EXCHANGE_LABEL.balance}</Text>
        <Text style={[styles.small, styles.flex]}>{request.balanceShort}</Text>
      </View>
    </View>
  );
}

/** 얼굴 · 이름 줄 — 누르면 상대 프로필 시트가 열린다. 소개는 카드에 없고 그 시트에서만 본다(운영자 2026-10-27) */
function RequestHead({ request, large = false }: { request: InboxRequest; large?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.head}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${request.nickname} 님 자세히`} onPress={() => setOpen(true)} style={styles.face}>
        <Face userId={request.counterpartUserId} nickname={request.nickname} hasPhoto={request.hasPhoto} focus={request.photoFocus} size={large ? 52 : 40} />
        <View style={styles.flex}>
          <View style={styles.nameRow}>
            <Text style={large ? styles.nameLarge : styles.name} numberOfLines={1}>
              {request.nickname}
            </Text>
            <Icon name="chevron" size={16} color={COLOR.secondary} />
          </View>
          <Text style={styles.meta}>{when(request.createdAt)}</Text>
        </View>
      </Pressable>
      <ElementExchange request={request} />
      <PartnerSheet
        open={open}
        onClose={() => setOpen(false)}
        partner={{
          userId: request.counterpartUserId,
          nickname: request.nickname,
          intro: request.intro,
          photoCount: request.photoUrls.length,
          photoFocus: request.photoFocuses,
          tone: null,
        }}
      />
    </View>
  );
}

/**
 * 받은 요청에 답한다 — 동의 문장은 카드가 열릴 때부터 단추 위에 있다. 거절은 한 번 더 묻는다(ADR 0166).
 * 수락이 성립하면 그 Match 의 방으로 간다(ADR 0130). 무효로 끝났으면 그렇게 말한다.
 */
function RespondButtons({ requestId, nickname, onChanged }: { requestId: string; nickname: string; onChanged: () => void }) {
  const [failure, setFailure] = useState<string | null>(null);
  const [settled, setSettled] = useState<RequestStatus | null>(null);
  const [asking, setAsking] = useState(false);
  const [working, setWorking] = useState(false);

  const answer = async (accept: boolean) => {
    setFailure(null);
    setWorking(true);
    const result = await respondToRequest(requestId, accept);
    setWorking(false);
    if (!result.ok) {
      setFailure(result.message);
      return;
    }
    setAsking(false);
    if (result.status !== 'accepted' && result.status !== 'rejected') setSettled(result.status);
    if (result.status === 'accepted' && result.matchId !== undefined) router.push(`/me/chat/${result.matchId}` as never);
    onChanged();
  };

  if (settled !== null) return <Text style={styles.small}>{REQUEST_STATUS_TEXT[settled].received}</Text>;

  return (
    <View style={styles.answers}>
      <PrimaryButton label={working && !asking ? '보내는 중…' : '수락하고 대화하기'} onPress={() => answer(true)} disabled={working} />
      <Pressable accessibilityRole="button" disabled={working} onPress={() => setAsking(true)} style={[styles.secondary, working && styles.off]}>
        <Text style={styles.secondaryText}>거절</Text>
      </Pressable>
      {failure !== null && !asking && (
        <Text style={styles.failure} accessibilityRole="alert">
          답하지 못했어요. {failure}
        </Text>
      )}
      <ConfirmModal
        open={asking}
        onClose={() => {
          setAsking(false);
          setFailure(null);
        }}
        title={`${nickname} 님의 요청을 거절할까요?`}
        confirmLabel={working ? '보내는 중…' : '거절하기'}
        onConfirm={() => answer(false)}
        danger
        busy={working}
        failure={failure === null ? null : `답하지 못했어요. ${failure}`}
      >
        <DialogText>{REJECTION_IS_FINAL_NOTE}</DialogText>
      </ConfirmModal>
    </View>
  );
}

function QuietButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.quiet, disabled && styles.off]}>
      <Text style={styles.quietText}>{label}</Text>
    </Pressable>
  );
}

function BlockButton({ userId, nickname, onChanged }: { userId: string; nickname: string; onChanged: () => void }) {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <QuietButton label="차단" onPress={() => setAsking(true)} />
      <BlockDialog userId={userId} nickname={nickname} open={asking} onClose={() => setAsking(false)} onBlocked={onChanged} />
    </>
  );
}

function ReportButton({ userId, nickname }: { userId: string; nickname: string }) {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <QuietButton label="신고" onPress={() => setAsking(true)} />
      <ReportDialog userId={userId} nickname={nickname} open={asking} onClose={() => setAsking(false)} />
    </>
  );
}

/** 보낸 요청 취소 — 되살릴 길이 없어 한 번 더 묻는다. 닫는 쪽은 「닫기」다(대장 matching-09) */
function CancelButton({ requestId, onCancelled }: { requestId: string; onCancelled: (note: string | null) => void }) {
  const [failure, setFailure] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [working, setWorking] = useState(false);
  const cancel = async () => {
    setFailure(null);
    setWorking(true);
    const result = await cancelRequest(requestId);
    setWorking(false);
    if (!result.ok) {
      setFailure(result.message);
      return;
    }
    setAsking(false);
    onCancelled(cancelledNote(result.status));
  };
  return (
    <>
      <QuietButton label={CANCEL_REQUEST_LABEL} onPress={() => setAsking(true)} disabled={working} />
      {failure !== null && !asking && <Text style={styles.failure}>{failure}</Text>}
      <ConfirmModal
        open={asking}
        onClose={() => {
          setAsking(false);
          setFailure(null);
        }}
        title={CANCEL_REQUEST_TITLE}
        confirmLabel={working ? '취소하는 중…' : CANCEL_REQUEST_LABEL}
        cancelLabel="닫기"
        onConfirm={cancel}
        danger
        busy={working}
        failure={failure}
        irreversible={CANCEL_REQUEST_NOTE}
      >
        <DialogText>
          임시로 차감된 <DialogStrong>풀이권 1장</DialogStrong>은 바로 돌려드려요.
        </DialogText>
      </ConfirmModal>
    </>
  );
}

/** 「궁합 요청은 어떻게 진행되나요?」 접이칸 */
export function ConsentGuide() {
  const [open, setOpen] = useState(false);
  return (
    <RowCard style={styles.fold}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.foldHead}>
        <Text style={styles.foldTitle}>궁합 요청은 어떻게 진행되나요?</Text>
        <View style={open && styles.turned}>
          <Icon name="chevron" size={16} color={COLOR.muted} />
        </View>
      </Pressable>
      {open && (
        <View style={styles.foldBody}>
          {CONSENT_FLOW_STEPS.map((step, index) => (
            <View key={step.title} style={styles.step}>
              <View style={styles.stepNo}>
                <Text style={styles.stepNoText}>{index + 1}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.small}>{step.body}</Text>
              </View>
            </View>
          ))}
          <Text style={styles.caveat}>{CONSENT_FLOW_CAVEAT}</Text>
        </View>
      )}
    </RowCard>
  );
}

/** 인연 탭 맨 위의 「받은 요청 N」 띠 — 누르면 그 자리에서 카드 시트가 올라온다. 동의는 시트 안의 카드가 받는다 */
export function RequestsBand({ received, onChanged }: { received: readonly InboxRequest[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  if (received.length === 0) return null;
  return (
    <>
      <Tile tone={COLOR.accent} accessibilityRole="button" onPress={() => setOpen(true)} style={styles.band}>
        <View style={styles.flex}>
          <Text style={styles.bandTitle}>받은 요청 {received.length}</Text>
          <Text style={styles.bandLine} numberOfLines={1}>
            {received.map((request) => request.nickname).join(' · ')} — 수락하면 채팅방이 열려요
          </Text>
        </View>
        <Icon name="chevron" size={16} color={COLOR.onAccent} />
      </Tile>
      <SheetModal open={open} title="받은 요청" onClose={() => setOpen(false)}>
        {received.map((request) => (
          <Card key={request.requestId} style={styles.card}>
            <RequestHead request={request} large />
            <MatchAcceptNotice side="received" />
            <RespondButtons requestId={request.requestId} nickname={request.nickname} onChanged={onChanged} />
            <View style={styles.quietRow}>
              <BlockButton userId={request.counterpartUserId} nickname={request.nickname} onChanged={onChanged} />
              <ReportButton userId={request.counterpartUserId} nickname={request.nickname} />
            </View>
          </Card>
        ))}
        <ConsentGuide />
      </SheetModal>
    </>
  );
}

function DecidedLine({ request }: { request: DecidedRequest }) {
  const text = REQUEST_STATUS_TEXT[request.status];
  return (
    <View style={styles.flex}>
      <View style={styles.decidedHead}>
        <Text style={styles.name}>{request.nickname}</Text>
        <Text style={styles.statusTag}>{text.label}</Text>
        <Text style={[styles.meta, styles.right]}>{when(request.decidedAt ?? request.createdAt)}</Text>
      </View>
      <Text style={styles.small}>{request.direction === 'sent' ? text.sent : text.received}</Text>
    </View>
  );
}

/** 지난 요청 — 보낸 요청 · 끝난 요청 · 차단 수. 성립한 줄은 그 인연 궁합으로 간다(못 여는 Match 면 글자만) */
export function PastRequestList({ past, guide, onChanged, onNote }: { past: PastRequests; guide: boolean; onChanged: () => void; onNote: (note: string) => void }) {
  const { sent, decided, blocked } = past;
  if (sent.length === 0 && decided.length === 0 && blocked === 0) return null;
  return (
    <View style={styles.past}>
      {sent.length > 0 && (
        <View style={styles.pastGroup}>
          <Text style={styles.pastHead}>보낸 요청</Text>
          {sent.map((request) => (
            <RowCard key={request.requestId} style={styles.row}>
              <RequestHead request={request} />
              <Text style={styles.small}>{REQUEST_STATUS_TEXT.pending.sent}</Text>
              <View style={styles.quietRow}>
                <CancelButton
                  requestId={request.requestId}
                  onCancelled={(note) => {
                    if (note !== null) onNote(note);
                    onChanged();
                  }}
                />
                <BlockButton userId={request.counterpartUserId} nickname={request.nickname} onChanged={onChanged} />
              </View>
            </RowCard>
          ))}
        </View>
      )}
      {decided.length > 0 && (
        <View style={styles.pastGroup}>
          <Text style={styles.pastHead}>끝난 요청</Text>
          {decided.map((request) =>
            request.matchHref === null ? (
              <View key={request.requestId} style={styles.decided}>
                <DecidedLine request={request} />
              </View>
            ) : (
              <Pressable key={request.requestId} accessibilityRole="link" onPress={() => router.push(request.matchHref as never)} style={styles.decided}>
                <DecidedLine request={request} />
                <Icon name="chevron" size={16} color={COLOR.muted} />
              </Pressable>
            ),
          )}
        </View>
      )}
      {guide && <ConsentGuide />}
      {blocked > 0 && <Text style={styles.blocked}>차단한 사람 {blocked}명. 누구인지는 여기 적지 않고, 차단은 되돌리지 않습니다.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  right: { marginLeft: 'auto' },
  off: { opacity: 0.55 },
  small: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.secondary },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 19, color: COLOR.danger },
  notice: { gap: 2, paddingHorizontal: 16, paddingVertical: 12, borderRadius: RADIUS.control, backgroundColor: COLOR.cream },
  noticeHead: { fontFamily: FONT.bold, fontSize: TYPE.sm, lineHeight: 24, color: COLOR.creamInk },
  noticeRow: { flexDirection: 'row', gap: 8 },
  noticeText: { fontFamily: FONT.medium, fontSize: TYPE.sm, lineHeight: 24, color: COLOR.creamInk },
  noticeHidden: { marginTop: 4, fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.creamInk },
  mark: { alignItems: 'center' },
  markFace: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.border },
  markName: { fontFamily: FONT.bold, fontSize: TYPE.fine, lineHeight: 16 },
  exchange: { gap: 8 },
  pair: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, minWidth: 0, gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: RADIUS.control, backgroundColor: COLOR.surfaceSunken },
  cellLabel: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.foreground },
  cellWay: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: -8 },
  cellWayText: { flexShrink: 1, fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.secondary },
  cellNone: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.muted },
  marks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  swap: { position: 'absolute', left: '50%', top: '50%', width: 28, height: 28, marginLeft: -14, marginTop: -14, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface },
  balance: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  balanceTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, overflow: 'hidden', backgroundColor: COLOR.surfaceSunken, fontFamily: FONT.bold, fontSize: TYPE.fine, color: COLOR.secondary },
  head: { gap: 12 },
  face: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  name: { flexShrink: 1, fontFamily: FONT.bold, fontSize: TYPE.field, color: COLOR.foreground },
  nameLarge: { flexShrink: 1, fontFamily: FONT.bold, fontSize: TYPE.lead, color: COLOR.foreground },
  meta: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.muted },
  answers: { gap: 8 },
  secondary: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.borderStrong, backgroundColor: COLOR.surface },
  secondaryText: { fontFamily: FONT.bold, fontSize: TYPE.field, color: COLOR.foreground },
  quiet: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  quietText: { fontFamily: FONT.bold, fontSize: TYPE.sm, color: COLOR.secondary },
  quietRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, paddingTop: 4, borderTopWidth: 1, borderTopColor: COLOR.border },
  card: { gap: 16 },
  row: { gap: 8 },
  fold: { paddingVertical: 0 },
  foldHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48 },
  foldTitle: { flexShrink: 1, fontFamily: FONT.bold, fontSize: TYPE.sm, color: COLOR.foreground },
  turned: { transform: [{ rotate: '90deg' }] },
  foldBody: { gap: 16, paddingVertical: 16, borderTopWidth: 1, borderTopColor: COLOR.border },
  step: { flexDirection: 'row', gap: 12 },
  stepNo: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOR.cream },
  stepNoText: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.creamInk },
  stepTitle: { fontFamily: FONT.bold, fontSize: TYPE.sm, color: COLOR.foreground, marginBottom: 4 },
  caveat: { paddingTop: 16, borderTopWidth: 1, borderTopColor: COLOR.border, fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.muted },
  band: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 16, paddingVertical: 8 },
  bandTitle: { fontFamily: FONT.bold, fontSize: TYPE.body, lineHeight: 20, color: COLOR.onAccent },
  bandLine: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 18, color: COLOR.onAccent, opacity: 0.9 },
  past: { gap: 20 },
  pastGroup: { gap: 8 },
  pastHead: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.secondary },
  decided: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLOR.border },
  decidedHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 },
  statusTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, overflow: 'hidden', backgroundColor: COLOR.surfaceSunken, fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.secondary },
  blocked: { paddingHorizontal: 4, fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.muted },
});
