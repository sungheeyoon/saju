import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DISCOVERY_EMPTY, DISCOVERY_TEASER } from '@discovery/copy';
import { elementOf, supplyOf, type DeckCard } from '@matching/deck-card';
import { PASSED_LIMIT } from '@matching/deck-state';
import { REQUEST_UNSURE } from '@matching/requests';
import { activityText } from '@presence';
import { REQUEST_RESERVES_NOTE, CREDITS_AVAILABLE_LABEL, CREDITS_REQUIRED_LABEL, CREDITS_SHORTAGE_TITLE, SALE_CLOSED_NOTE, SALE_CLOSED_OK } from '@reading/notes';
import { ELEMENT_PICTURE_KO, type Element } from '@saju';

import { ElementSymbol } from '@/ui/element-symbol';
import { Icon } from '@/ui/icons';
import { PrimaryButton } from '@/ui/parts';
import { ConfirmDialog, DialogStrong, DialogText } from '@/ui/confirm-dialog';
import { DetailSheet } from '@/ui/sheet';
import { ELEVATION } from '@design';
import { COLOR, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { Card, CardFrame, Paper, RowCard, Tile } from '@/ui/surfaces';

import { PersonPhoto, PhotoBars, ReportBlock } from './people';
import { MatchAcceptNotice } from './requests';

const tileOf = (element: Element | null) => (element === null ? COLOR.noneSoft : ELEMENT_TONE[element].soft);

/** 오늘의 인연 한 장 — 사진이 주인공이고 그 위에 고르는 데 필요한 것만 선다. 끌어서 넘기지 않는다(운영자 2026-09-25) */
export function TodayCard({ card, onInfo, onBlocked }: { card: DeckCard; onInfo: () => void; onBlocked: () => void }) {
  const [at, setAt] = useState(0);
  const count = card.photoUrls?.length ?? 0;
  const names = card.highlights.map((highlight) => {
    const known = elementOf(highlight.element);
    return known !== null ? ELEMENT_PICTURE_KO[known] : highlight.element;
  });
  const top = count > 1 ? 32 : 12;

  return (
    <Tile tone={tileOf(supplyOf(card))} key={card.candidateUserId} style={styles.card}>
      <PersonPhoto
        userId={card.candidateUserId}
        nickname={card.nickname}
        position={at + 1}
        hasPhoto={card.hasPhoto}
        focus={card.photoFocus?.[at]}
        tone={card.avatarElement ?? supplyOf(card)}
        initialSize={120}
        initialAbove
      />
      {count > 1 && <PhotoBars count={count} at={at} onPick={setAt} />}

      {card.exploration && (
        <View style={[styles.exploration, { top }]}>
          <Icon name="spark" size={16} />
          <Text style={styles.explorationText}>색다른 인연</Text>
        </View>
      )}
      <View style={[styles.onPhoto, { top }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="자세히 보기" onPress={onInfo} style={styles.info}>
          <Text style={styles.infoText}>i</Text>
        </Pressable>
        <ReportBlock userId={card.candidateUserId} nickname={card.nickname} onPhoto onBlocked={onBlocked} />
      </View>

      <View style={styles.face} pointerEvents="none">
        <FaceScrim />
        <View style={styles.faceHead}>
          <View style={styles.flex}>
            <Text style={styles.nickname} numberOfLines={1}>
              {card.nickname}
            </Text>
            {card.activity != null && <Text style={styles.activity}>{activityText(card.activity)}</Text>}
          </View>
          <View style={styles.score} accessible accessibilityLabel={['나와의 예측 궁합 점수', card.previewScore, '/ 100'].join(' ')}>
            <Text style={styles.scoreNumber}>{card.previewScore}</Text>
            <Text style={styles.scoreOf}> / 100</Text>
          </View>
        </View>
        <Text style={styles.verdict}>{card.verdict}</Text>
        {card.highlights.length > 0 && (
          <View style={styles.supply} accessible accessibilityLabel={card.highlights.map((highlight) => highlight.text).join(' ')}>
            <View style={styles.dots}>
              {card.highlights.map((highlight, index) => {
                const known = elementOf(highlight.element);
                return (
                  <View key={highlight.element} style={[styles.dot, { backgroundColor: tileOf(known), marginLeft: index === 0 ? 0 : -10 }]}>
                    <ElementSymbol element={known} size={24} />
                  </View>
                );
              })}
            </View>
            <View style={styles.flex}>
              <Text style={styles.supplyHead}>이 사람이 채워 주는 기운</Text>
              <Text style={styles.supplyNames} numberOfLines={1}>
                {names.join(' · ')}
              </Text>
            </View>
          </View>
        )}
        {card.intro !== null && (
          <Text style={styles.introLine} numberOfLines={1}>
            {card.intro}
          </Text>
        )}
      </View>
    </Tile>
  );
}

/**
 * 글 밑의 어둠막 — 흰 사진 위에서도 흰 글자가 읽히게. 멈춤은 웹의 `FACE_SCRIM` 과 같다.
 * SVG 로 그리면 안드로이드에서 처음 잰 크기로 굳어 카드 일부만 덮는다 — 뷰의 그라디언트는 뷰를 따라간다.
 */
const FACE_SCRIM = 'linear-gradient(to top, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.78) 30%, rgba(0,0,0,0.62) 55%, rgba(0,0,0,0.38) 72%, rgba(0,0,0,0.14) 86%, rgba(0,0,0,0) 100%)';

function FaceScrim() {
  return <View style={[StyleSheet.absoluteFill, { backgroundImage: FACE_SCRIM }]} />;
}

/** 단추 줄 — 사진 아래. 「궁합 요청」이 채운 주 단추로 가장 넓다 */
export function DeckButtons({ canUndo, busy, onUndo, onPass, onRequest }: { canUndo: boolean; busy: boolean; onUndo: () => void; onPass: () => void; onRequest: () => void }) {
  return (
    <View style={styles.buttons}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="이전 인연으로 되돌리기"
        accessibilityState={{ disabled: !canUndo }}
        disabled={!canUndo}
        onPress={onUndo}
        style={[styles.undo, !canUndo && styles.off]}
      >
        <Icon size={20} name="undo" color={canUndo ? COLOR.foreground : COLOR.muted} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="다음 인연으로 지나가기"
        disabled={busy}
        onPress={onPass}
        style={[styles.pass, busy && styles.off]}
      >
        <Icon size={20} name="close" />
        <Text style={styles.passText}>다음 인연</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="궁합 요청" disabled={busy} onPress={onRequest} style={[styles.request, busy && styles.off]}>
        <Text style={styles.requestText}>궁합 요청</Text>
      </Pressable>
    </View>
  );
}

/** 판정의 까닭 · 채워 주는 기운 — ⓘ 시트와 지나친 인연 시트가 같은 것을 든다 */
export function CardDetails({ card, explorationNote }: { card: DeckCard; explorationNote: string | null }) {
  return (
    <>
      <View style={styles.reasonBox}>
        <Text style={styles.detailVerdict}>{card.verdict}</Text>
        <Text style={styles.body}>{card.reason}</Text>
      </View>
      <CardFrame style={styles.supplyBox}>
        <Text style={styles.supplyTitle}>이 사람이 채워 주는 기운</Text>
        {card.highlights.length > 0 ? (
          card.highlights.map((highlight) => {
            const known = elementOf(highlight.element);
            return (
              <View key={highlight.element} style={styles.supplyRow}>
                <View style={[styles.supplyDot, { backgroundColor: tileOf(known) }]}>
                  <ElementSymbol element={known} size={24} />
                </View>
                <View style={styles.flex}>
                  {known !== null && <Text style={[styles.supplyName, { color: ELEMENT_TONE[known].ink }]}>{ELEMENT_PICTURE_KO[known]}</Text>}
                  <Text style={styles.small}>{highlight.text}</Text>
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.body}>{card.reason}</Text>
        )}
        <Text style={styles.small}>{card.balanceLabel}</Text>
        {card.exploration && explorationNote !== null && <Text style={styles.note}>{explorationNote}</Text>}
      </CardFrame>
      <CardFrame style={styles.letter}>
        {card.intro !== null ? (
          <>
            <Text style={styles.letterText}>{card.intro}</Text>
            <Text style={styles.signature}>— {card.nickname}</Text>
          </>
        ) : (
          <Text style={styles.small}>자기소개 없음</Text>
        )}
      </CardFrame>
    </>
  );
}

/** 폰의 ⓘ 시트 — 사진 위에 못 둔 것 전부와 참고 점수 고지 */
export function CardSheet({
  card,
  open,
  onClose,
  explorationNote,
  notice,
  onBlocked,
}: {
  card: DeckCard;
  open: boolean;
  onClose: () => void;
  explorationNote: string | null;
  notice: string | null;
  onBlocked: () => void;
}) {
  return (
    <DetailSheet open={open} title={card.nickname} onClose={onClose} menu={<ReportBlock userId={card.candidateUserId} nickname={card.nickname} onBlocked={onBlocked} />}>
      <CardDetails card={card} explorationNote={explorationNote} />
      <Text style={styles.fine}>{DISCOVERY_TEASER}</Text>
      {notice !== null && <Text style={styles.meta}>{notice}</Text>}
    </DetailSheet>
  );
}

/** 요청 확인 창 — 풀이권 문단과 「상대가 수락하면」 목록을 누르기 전에 읽는다(ADR 0038 · 대장 matching-12) */
export function RequestConfirm({ card, open, onClose, onConfirm, busy }: { card: DeckCard; open: boolean; onClose: () => void; onConfirm: () => void; busy: boolean }) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title={`${card.nickname} 님에게 상세 궁합을 요청할까요?`}
      confirmLabel="요청 보내기"
      onConfirm={onConfirm}
      busy={busy}
      lead={
        <View style={styles.confirmLead}>
          <View style={styles.confirmFace}>
            <PersonPhoto userId={card.candidateUserId} nickname={card.nickname} hasPhoto={card.hasPhoto} focus={card.photoFocus?.[0]} tone={card.avatarElement ?? supplyOf(card)} initialSize={24} />
          </View>
          <View style={[styles.supplyDot, { backgroundColor: tileOf(supplyOf(card)) }]}>
            <ElementSymbol element={supplyOf(card)} size={24} />
          </View>
        </View>
      }
    >
      <DialogText>
        요청하면 <DialogStrong>풀이권 1장</DialogStrong>이 임시로 차감되고, 상대가 수락하면 확정돼요. {REQUEST_RESERVES_NOTE}
      </DialogText>
      <MatchAcceptNotice side="sent" />
    </ConfirmDialog>
  );
}

/**
 * 풀이권 창 — 0장이면 요청 확인 창 대신 선다. 앱은 풀이권을 팔지 않으므로 웹의 판매가 닫힌 꼴 하나다: 한 줄과 「확인」(`useBuyCredits` 의 닫힌 꼴).
 */
export function useCreditsNotice() {
  const [shown, setShown] = useState(false);
  const offer = () => setShown(true);
  const close = () => setShown(false);
  const notice = (
    <ConfirmDialog open={shown} onClose={close} title={CREDITS_SHORTAGE_TITLE} confirmLabel={SALE_CLOSED_OK} cancelLabel={null} onConfirm={close}>
      <View style={styles.creditRow}>
        <DialogText>{CREDITS_AVAILABLE_LABEL}</DialogText>
        <DialogStrong>0장</DialogStrong>
      </View>
      <View style={styles.creditRow}>
        <DialogText>{CREDITS_REQUIRED_LABEL}</DialogText>
        <DialogStrong>1장</DialogStrong>
      </View>
      <DialogText>{SALE_CLOSED_NOTE}</DialogText>
    </ConfirmDialog>
  );
  return { offer, notice };
}

/** 실패 · 방금 한 일 — 한 자리에 한 줄. 요청이 갔는지 모르면 인연 기록으로 가는 길을 단다 */
export function Feedback({ failure, flash }: { failure: string | null; flash: string }) {
  return (
    <>
      {failure !== null && (
        <RowCard style={styles.failureBox}>
          <Text style={styles.failure} accessibilityRole="alert">
            {failure}
          </Text>
          {failure === REQUEST_UNSURE && (
            <Pressable accessibilityRole="link" onPress={() => router.push('/me/matching/history')} style={styles.textLink}>
              <Text style={styles.textLinkText}>인연 기록 보기</Text>
            </Pressable>
          )}
        </RowCard>
      )}
      {flash !== '' && (
        <View style={styles.flashBox} accessibilityLiveRegion="polite">
          <Text style={styles.flash}>{flash}</Text>
        </View>
      )}
    </>
  );
}

/** 소개할 사람이 없다 — 궤도 그림은 앱에 아직 없다(G-123). 두 줄과 갈 길 둘 */
export function EmptyDeck() {
  const links: readonly { href: string; label: string }[] = [
    { href: '/', label: '다른 사람 사주 보기' },
    { href: '/me/compat', label: '궁합 보러 가기' },
  ];
  return (
    <Paper style={styles.quiet}>
      <Text style={styles.quietTitle}>{DISCOVERY_EMPTY.title}</Text>
      <Text style={styles.body}>{DISCOVERY_EMPTY.line}</Text>
      {links.map((link) => (
        <CardFrame key={link.href} accessibilityRole="link" onPress={() => router.push(link.href as never)} style={styles.quietLink}>
          <Text style={[styles.quietLinkText, styles.flex]}>{link.label}</Text>
          <Icon name="arrow" size={16} color={COLOR.secondary} />
        </CardFrame>
      ))}
    </Paper>
  );
}

/** 덱이 서지 않는 자리 — 이유 한 줄과 갈 길 하나 */
export function QuietPlace({ title, line, href, action }: { title: string; line: string; href: string; action: string }) {
  return (
    <Paper style={styles.quiet}>
      <Text style={styles.quietTitle}>{title}</Text>
      <Text style={styles.body}>{line}</Text>
      <PrimaryButton label={action} onPress={() => router.push(href as never)} />
    </Paper>
  );
}

/** 지나친 인연 — 최근 순 타일. 누르면 ⓘ 와 같은 시트가 펴지고 「다시 만나보기」는 그 안에만 선다 */
export function PassedConnections({
  cards,
  working,
  explorationNote,
  onRestore,
  onBack,
  feedback,
}: {
  cards: readonly DeckCard[];
  working: boolean;
  explorationNote: string | null;
  onRestore: (card: DeckCard) => Promise<string | null>;
  onBack: () => void;
  feedback: React.ReactNode;
}) {
  const [looking, setLooking] = useState<DeckCard | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  return (
    <View style={styles.passed}>
      <View style={styles.passedHead}>
        <Text style={styles.quietTitle} accessibilityRole="header">
          지나친 인연
          {cards.length > 0 && (
            <Text style={styles.count}>
              {'  '}
              {cards.length} / {PASSED_LIMIT}
            </Text>
          )}
        </Text>
        {cards.length > 0 && <Text style={styles.body}>잠깐 지나쳤어도, 다시 궁금해질 수 있으니까요.</Text>}
      </View>
      {cards.length === 0 ? (
        <View style={styles.passedEmpty}>
          <View style={styles.passedEmptyIcon}>
            <Icon size={20} name="undo" color={COLOR.creamInk} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.name}>지나친 인연이 여기에 모여요</Text>
            <Text style={styles.body}>다시 궁금해진 사람을 살펴보고,</Text>
            <Text style={styles.body}>한 번 더 알아갈 수 있는 자리예요.</Text>
          </View>
        </View>
      ) : (
        <View style={styles.tiles}>
          {cards.map((card) => (
            <Card
              key={card.candidateUserId}
              accessibilityRole="button"
              onPress={() => {
                setFailure(null);
                setLooking(card);
              }}
              style={styles.tile}
            >
              <View style={styles.tilePhoto}>
                <PersonPhoto userId={card.candidateUserId} nickname={card.nickname} hasPhoto={card.hasPhoto} focus={card.photoFocus?.[0]} tone={card.avatarElement ?? supplyOf(card)} initialSize={48} />
                <View style={[styles.tileDot, { backgroundColor: tileOf(supplyOf(card)) }]}>
                  <ElementSymbol element={supplyOf(card)} size={20} />
                </View>
              </View>
              <View style={styles.tileBody}>
                <Text style={styles.name} numberOfLines={1}>
                  {card.nickname}
                </Text>
                <Text style={styles.tileScore}>궁합 {card.previewScore}점</Text>
                <Text style={styles.small} numberOfLines={2}>
                  {card.highlights[0]?.text ?? card.reason}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      )}
      {feedback}
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.textLink}>
        <Text style={styles.textLinkText}>오늘의 인연 계속 보기</Text>
      </Pressable>
      <Text style={styles.fine}>최근 {PASSED_LIMIT}명을 보관해요. 목록에서 빠진 인연은 마지막으로 넘긴 뒤 하루가 지나면 다시 추천될 수 있어요.</Text>

      {looking !== null && (
        <DetailSheet open title={looking.nickname} onClose={() => setLooking(null)}>
          <CardDetails card={looking} explorationNote={explorationNote} />
          {failure !== null && (
            <Text style={styles.failure} accessibilityRole="alert">
              {failure}
            </Text>
          )}
          <PrimaryButton
            label={restoring ? '복원하는 중…' : '다시 만나보기'}
            disabled={working || restoring}
            onPress={async () => {
              setRestoring(true);
              setFailure(null);
              const message = await onRestore(looking);
              setRestoring(false);
              if (message === null) setLooking(null);
              else setFailure(message);
            }}
          />
        </DetailSheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  off: { opacity: 0.55 },
  card: { flex: 1, minHeight: 320, padding: 0, overflow: 'hidden', boxShadow: ELEVATION.float },
  exploration: { position: 'absolute', left: 16, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, paddingHorizontal: 12, borderRadius: RADIUS.pill, backgroundColor: COLOR.surface },
  explorationText: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.foreground },
  onPhoto: { position: 'absolute', right: 12, flexDirection: 'row', gap: 8 },
  info: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: 'rgba(0, 0, 0, 0.42)' },
  infoText: { fontFamily: FONT.bold, fontStyle: 'italic', fontSize: TYPE.heading, color: '#ffffff' },
  face: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 10, paddingHorizontal: 20, paddingTop: 96, paddingBottom: 20 },
  faceHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  nickname: { fontFamily: FONT.bold, fontSize: 32, lineHeight: 40, color: '#ffffff' },
  activity: { fontFamily: FONT.bold, fontSize: TYPE.small, color: 'rgba(255, 255, 255, 0.85)' },
  score: { flexDirection: 'row', alignItems: 'baseline' },
  scoreNumber: { fontFamily: FONT.bold, fontSize: 44, lineHeight: 48, color: '#ffffff' },
  scoreOf: { fontFamily: FONT.bold, fontSize: TYPE.small, color: 'rgba(255, 255, 255, 0.85)' },
  verdict: { fontFamily: FONT.medium, fontSize: TYPE.lead, lineHeight: 24, color: 'rgba(255, 255, 255, 0.95)' },
  supply: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dots: { flexDirection: 'row', paddingLeft: 4 },
  dot: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, borderWidth: 2, borderColor: COLOR.surface },
  supplyHead: { fontFamily: FONT.bold, fontSize: TYPE.fine, lineHeight: 16, color: 'rgba(255, 255, 255, 0.75)' },
  supplyNames: { fontFamily: FONT.bold, fontSize: TYPE.heading, lineHeight: 28, color: '#ffffff' },
  introLine: { fontFamily: FONT.medium, fontSize: TYPE.note, lineHeight: 20, color: 'rgba(255, 255, 255, 0.85)' },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  undo: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface },
  pass: { flex: 1, flexDirection: 'row', minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.borderStrong, backgroundColor: COLOR.surface },
  passText: { fontFamily: FONT.bold, fontSize: TYPE.field, color: COLOR.foreground },
  request: { flex: 1.3, minHeight: 56, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: RADIUS.pill, backgroundColor: COLOR.accent },
  requestText: { fontFamily: FONT.bold, fontSize: TYPE.field, color: COLOR.onAccent },
  reasonBox: { gap: 4 },
  detailVerdict: { fontFamily: FONT.bold, fontSize: TYPE.heading, lineHeight: 28, color: COLOR.foreground },
  body: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.secondary },
  supplyBox: { gap: 8, padding: 16 },
  supplyTitle: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.foreground },
  supplyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  supplyDot: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.border },
  supplyName: { fontFamily: FONT.bold, fontSize: TYPE.lead, lineHeight: 22 },
  small: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.secondary },
  note: { paddingTop: 12, borderTopWidth: 1, borderTopColor: COLOR.border, fontFamily: FONT.medium, fontSize: TYPE.fine, lineHeight: 20, color: COLOR.secondary },
  letter: { gap: 8, paddingHorizontal: 20, paddingVertical: 16 },
  letterText: { fontFamily: FONT.medium, fontSize: TYPE.field, lineHeight: 28, color: COLOR.foreground },
  signature: { alignSelf: 'flex-end', fontFamily: FONT.medium, fontSize: TYPE.body, color: COLOR.creamInk },
  fine: { fontFamily: FONT.medium, fontSize: TYPE.fine, lineHeight: 20, color: COLOR.secondary },
  meta: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.muted },
  confirmLead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  confirmFace: { width: 56, height: 56, borderRadius: RADIUS.pill, overflow: 'hidden' },
  creditRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  failureBox: { gap: 4 },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 19, color: COLOR.danger },
  textLink: { minHeight: 44, justifyContent: 'center' },
  textLinkText: { fontFamily: FONT.bold, fontSize: TYPE.note, color: COLOR.foreground },
  flashBox: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface },
  flash: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.foreground },
  quiet: { gap: 24 },
  quietTitle: { fontFamily: FONT.bold, fontSize: TYPE.heading, lineHeight: 28, color: COLOR.foreground },
  quietLink: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 12 },
  quietLinkText: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
  passed: { gap: 20 },
  passedHead: { gap: 4 },
  count: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.secondary },
  passedEmpty: { flexDirection: 'row', gap: 12 },
  passedEmptyIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOR.surfaceSunken },
  name: { fontFamily: FONT.bold, fontSize: TYPE.field, color: COLOR.foreground },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { width: '47.5%', padding: 0, overflow: 'hidden' },
  tilePhoto: { aspectRatio: 1 },
  tileDot: { position: 'absolute', left: 8, bottom: 8, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, borderWidth: 2, borderColor: COLOR.surface },
  tileBody: { gap: 4, padding: 12 },
  tileScore: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.foreground },
});
