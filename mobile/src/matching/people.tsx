import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { REPORT_DETAIL_MAX, REPORT_DONE, REPORT_NOTE, REPORT_REASONS, type ReportReason } from '@account/index';
import { BLOCK_FINAL_NOTE, BLOCK_KEEPS_NOTE, BLOCK_NOTE } from '@consent/index';
import { initialOf, type PhotoFocus } from '@profile';
import type { Element } from '@saju';

import { Field, Select } from '@/ui/parts';
import { Icon } from '@/ui/icons';
import { Photo } from '@/ui/photo';
import { ConfirmDialog, DialogText } from '@/ui/confirm-dialog';
import { DetailSheet } from '@/ui/sheet';
import { COLOR, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { Tile } from '@/ui/surfaces';

import { blockUser, reportUser } from './doors';

/**
 * 사진 한 장 — 있으면 사진, 없거나 앱이 못 받는 장이면 **그 사람 색 판에 첫 글자**다(웹의 `CandidatePhoto` 와 같은 자리).
 * 볼 수 있는가는 사진 문의 `photo_at` 이 답한다(`@/ui/photo`).
 */
export function PersonPhoto({
  userId,
  nickname,
  position = 1,
  hasPhoto,
  focus,
  tone,
  initialSize = 48,
  initialAbove = false,
  variant = 'large',
}: {
  userId: string;
  nickname: string;
  position?: number;
  hasPhoto: boolean;
  focus?: PhotoFocus;
  tone: Element | null;
  initialSize?: number;
  /** 첫 글자를 글 판 위쪽에 세운다 — 카드는 아래 끝을 이름 · 점수가 덮는다 */
  initialAbove?: boolean;
  /** 작은 자리(얼굴)는 `card` */
  variant?: 'card' | 'large';
}) {
  return (
    <Photo
      fill
      size={0}
      userId={userId}
      position={position}
      hasPhoto={hasPhoto}
      focus={focus}
      variant={variant}
      fallback={
        <View aria-hidden style={[StyleSheet.absoluteFill, styles.initialBox, initialAbove && styles.initialAbove, { backgroundColor: tone === null ? COLOR.noneSoft : ELEMENT_TONE[tone].soft }]}>
          <Text style={[styles.initial, { fontSize: initialSize, lineHeight: initialSize * 1.3, color: tone === null ? COLOR.none : ELEMENT_TONE[tone].ink }]}>
            {initialOf(nickname)}
          </Text>
        </View>
      }
    />
  );
}

/** 동그란 얼굴 */
export function Face({ userId, nickname, hasPhoto, focus, size, tone = null }: { userId: string; nickname: string; hasPhoto: boolean; focus?: PhotoFocus; size: number; tone?: Element | null }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
      <PersonPhoto userId={userId} nickname={nickname} hasPhoto={hasPhoto} focus={focus} tone={tone} initialSize={size * 0.45} variant="card" />
    </View>
  );
}

export type Partner = {
  userId: string;
  nickname: string;
  intro: string | null;
  photoCount: number;
  photoFocus: readonly PhotoFocus[];
  tone: Element | null;
};

/** 상대 프로필 시트 — 사진(4:5) → 소개. 소개는 접지 않는다. 궁합 줄은 대화방의 몫이라 여기 없다 */
export function PartnerSheet({ partner, open, onClose, menu }: { partner: Partner; open: boolean; onClose: () => void; menu?: React.ReactNode }) {
  const [at, setAt] = useState(0);
  const intro = partner.intro !== null && partner.intro.trim() !== '' ? partner.intro : null;
  return (
    <DetailSheet open={open} title={`${partner.nickname} 님 자세히`} onClose={onClose} menu={menu}>
      <Tile tone={COLOR.surfaceSunken} style={styles.photoFrame}>
        <PersonPhoto
          userId={partner.userId}
          nickname={partner.nickname}
          position={at + 1}
          hasPhoto={partner.photoCount > 0}
          focus={partner.photoFocus[at]}
          tone={partner.tone}
          initialSize={72}
        />
        {partner.photoCount > 1 && <PhotoBars count={partner.photoCount} at={at} onPick={setAt} />}
      </Tile>
      {intro !== null && (
        <View style={styles.intro}>
          <Text style={styles.introHead}>소개</Text>
          <Text style={styles.introBody}>{intro}</Text>
        </View>
      )}
    </DetailSheet>
  );
}

/** 사진 막대 — 왼쪽 · 오른쪽 반 누름으로 넘긴다. 끝에서는 돌지 않는다. 막대의 이름은 웹과 같다 */
export function PhotoBars({ count, at, onPick }: { count: number; at: number; onPick: (next: number) => void }) {
  return (
    <>
      <Pressable style={styles.halfLeft} accessibilityElementsHidden importantForAccessibility="no" onPress={() => at > 0 && onPick(at - 1)} />
      <Pressable style={styles.halfRight} accessibilityElementsHidden importantForAccessibility="no" onPress={() => at < count - 1 && onPick(at + 1)} />
      <View style={styles.bars}>
        {Array.from({ length: count }, (_, index) => (
          <Pressable
            key={index}
            accessibilityRole="button"
            accessibilityLabel={`사진 ${index + 1} / ${count}`}
            accessibilityState={{ selected: index === at }}
            onPress={() => onPick(index)}
            style={styles.barHit}
          >
            <View style={[styles.bar, index === at && styles.barOn]} />
          </Pressable>
        ))}
      </View>
    </>
  );
}

/** 차단을 한 번 더 묻는 창 — 글자는 웹의 `BlockDialog` 와 같은 상수다. 첫 자리는 「취소」 */
export function BlockDialog({ userId, nickname, open, onClose, onBlocked }: { userId: string; nickname: string; open: boolean; onClose: () => void; onBlocked?: () => void }) {
  const [failure, setFailure] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const block = async () => {
    setFailure(null);
    setWorking(true);
    const result = await blockUser(userId);
    setWorking(false);
    if (!result.ok) {
      setFailure(result.message);
      return;
    }
    onClose();
    onBlocked?.();
  };
  return (
    <ConfirmDialog
      open={open}
      onClose={() => {
        setFailure(null);
        onClose();
      }}
      title={`${nickname} 님을 차단할까요?`}
      confirmLabel={working ? '차단하는 중…' : '차단하기'}
      onConfirm={block}
      danger
      busy={working}
      failure={failure}
      irreversible={BLOCK_FINAL_NOTE}
    >
      <DialogText>{BLOCK_NOTE}</DialogText>
      <DialogText>{BLOCK_KEEPS_NOTE}</DialogText>
    </ConfirmDialog>
  );
}

/** 신고 창 — 사유 넷과 덧붙일 말. 보내면 접수 문장과 「차단으로 넘어가기」가 선다. 신고는 관계를 끊지 않는다 */
export function ReportDialog({ userId, nickname, open, onClose, onBlock }: { userId: string; nickname: string; open: boolean; onClose: () => void; onBlock?: () => void }) {
  const [reason, setReason] = useState<ReportReason>(REPORT_REASONS[0].value);
  const [detail, setDetail] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [reported, setReported] = useState(false);

  const close = () => {
    setReason(REPORT_REASONS[0].value);
    setDetail('');
    setFailure(null);
    setReported(false);
    onClose();
  };
  const send = async () => {
    setFailure(null);
    setWorking(true);
    const result = await reportUser(userId, reason, detail);
    setWorking(false);
    if (result.ok) setReported(true);
    else setFailure(result.message);
  };

  return (
    <DetailSheet open={open} title={`${nickname} 님 신고`} onClose={close}>
      {reported ? (
        <Text style={styles.body} accessibilityRole="alert">
          {REPORT_DONE}
        </Text>
      ) : (
        <>
          <Text style={styles.small}>{REPORT_NOTE}</Text>
          <Text style={styles.label}>신고 사유</Text>
          <View style={styles.reasonBox}>
            <Select value={reason} options={REPORT_REASONS} onPick={setReason} />
          </View>
          <Text style={styles.label}>덧붙일 말 (선택)</Text>
          <Field value={detail} onChange={setDetail} maxLength={REPORT_DETAIL_MAX} label="덧붙일 말 (선택)" />
          {failure !== null && (
            <Text style={styles.failure} accessibilityRole="alert">
              {failure}
            </Text>
          )}
        </>
      )}
      <View style={styles.reportActions}>
        {reported ? (
          <Pressable accessibilityRole="button" onPress={close} style={styles.reportMain}>
            <Text style={styles.reportMainText}>닫기</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" disabled={working} onPress={send} style={[styles.reportMain, working && styles.off]}>
            <Text style={styles.reportMainText}>{working ? '보내는 중…' : '신고하기'}</Text>
          </Pressable>
        )}
        {onBlock !== undefined && (
          <Pressable
            accessibilityRole="button"
            disabled={working}
            onPress={() => {
              close();
              onBlock();
            }}
            style={styles.reportQuiet}
          >
            <Text style={styles.reportQuietText}>차단으로 넘어가기</Text>
          </Pressable>
        )}
      </View>
    </DetailSheet>
  );
}

/** 「⋯」 — 신고 · 차단 한 벌(ADR 0158). 카드 · 시트 머리 · 인연 궁합 머리가 쓴다 */
export function ReportBlock({ userId, nickname, onPhoto = false, onBlocked }: { userId: string; nickname: string; onPhoto?: boolean; onBlocked?: () => void }) {
  const [menu, setMenu] = useState(false);
  const [opened, setOpened] = useState<'report' | 'block' | null>(null);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="신고 · 차단"
        onPress={() => setMenu(true)}
        style={[styles.more, onPhoto && styles.moreOnPhoto]}
      >
        <Icon size={20} name="more" color={onPhoto ? '#ffffff' : COLOR.foreground} />
      </Pressable>
      <DetailSheet open={menu} title="신고 · 차단" onClose={() => setMenu(false)}>
        <Pressable
          accessibilityRole="button"
          style={styles.menuRow}
          onPress={() => {
            setMenu(false);
            setOpened('report');
          }}
        >
          <Icon name="flag" size={18} />
          <Text style={styles.menuText}>신고</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={styles.menuRow}
          onPress={() => {
            setMenu(false);
            setOpened('block');
          }}
        >
          <Icon name="block" size={18} color={COLOR.danger} />
          <Text style={[styles.menuText, styles.dangerText]}>차단</Text>
        </Pressable>
      </DetailSheet>
      <ReportDialog
        userId={userId}
        nickname={nickname}
        open={opened === 'report'}
        onClose={() => setOpened((now) => (now === 'report' ? null : now))}
        onBlock={() => setOpened('block')}
      />
      <BlockDialog
        userId={userId}
        nickname={nickname}
        open={opened === 'block'}
        onClose={() => setOpened((now) => (now === 'block' ? null : now))}
        onBlocked={onBlocked}
      />
    </>
  );
}

const styles = StyleSheet.create({
  initialBox: { alignItems: 'center', justifyContent: 'center' },
  initialAbove: { paddingBottom: '55%' },
  initial: { fontFamily: FONT.bold },
  photoFrame: { width: '100%', aspectRatio: 4 / 5, padding: 0, overflow: 'hidden' },
  intro: { gap: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLOR.border },
  introHead: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.muted },
  introBody: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 26, color: COLOR.foreground },
  halfLeft: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%' },
  halfRight: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '50%' },
  bars: { position: 'absolute', left: 12, right: 12, top: 6, flexDirection: 'row', gap: 4 },
  barHit: { flex: 1, height: 24, paddingTop: 4 },
  bar: { height: 3, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255, 255, 255, 0.4)' },
  barOn: { backgroundColor: '#ffffff' },
  body: { fontFamily: FONT.medium, fontSize: TYPE.note, lineHeight: 24, color: COLOR.secondary },
  small: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.secondary },
  label: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.secondary },
  reasonBox: { flexDirection: 'row' },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 19, color: COLOR.danger },
  reportActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 },
  reportMain: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderRadius: RADIUS.pill, backgroundColor: COLOR.accent },
  reportMainText: { fontFamily: FONT.bold, fontSize: TYPE.note, color: COLOR.onAccent },
  reportQuiet: { minHeight: 44, justifyContent: 'center' },
  reportQuietText: { fontFamily: FONT.bold, fontSize: TYPE.note, color: COLOR.danger },
  off: { opacity: 0.55 },
  more: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill },
  moreOnPhoto: { backgroundColor: 'rgba(0, 0, 0, 0.42)' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  menuText: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
  dangerText: { color: COLOR.danger },
});
