import { rpcArgs } from '@db';
import { userFacingDbMessage } from '@db-error';
import {
  FEEDBACK_COMMENT,
  FEEDBACK_FOLDED_NOTE,
  FEEDBACK_SCALE,
  FEEDBACK_SCOPE_NOTE,
  FEEDBACK_THANKS,
  FELT_LENGTHS,
  FELT_LENGTH_LABEL,
  ISSUE_TAGS,
  ISSUE_TAG_LABEL,
  feedbackQuestions,
  type FeedbackQuestion,
  type FeedbackScore,
  type FeltLength,
  type IssueTag,
  type ReadingAnswer,
} from '@reading/feedback';
import { FEEDBACK_UNEXPECTED_NOTE } from '@reading/notes';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { supabase } from '@/auth/client';
import { NOT_READY } from '@/auth/signup';
import { CardFrame, Cell, Paper } from '@/ui/surfaces';
import { PrimaryButton, TextButton } from '@/ui/parts';
import { COLOR, CONTROL, FONT, RADIUS, TYPE } from '@/ui/tokens';

import type { ReadingTarget } from './api';

/** 답을 남긴다 — 그 사람의 토큰으로 바로 부른다. 내 시도인지 · 동의했는지는 DB 가 본다(웹의 `submitReadingFeedback`) */
async function leaveFeedback(runId: string, answer: ReadingAnswer): Promise<{ ok: true } | { ok: false; message: string }> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  const { error } = await supabase.rpc(
    'leave_reading_feedback',
    rpcArgs<'leave_reading_feedback'>({
      p_run_id: runId,
      p_usefulness: answer.usefulness,
      p_perceived_fit: answer.perceivedFit,
      p_felt_length: answer.feltLength,
      p_issue_tags: [...answer.issueTags],
      p_comment: answer.comment,
    }),
  );
  return error !== null ? { ok: false, message: userFacingDbMessage(error, 'leave_reading_feedback', FEEDBACK_UNEXPECTED_NOTE) } : { ok: true };
}

/**
 * 읽고 나서 답하는 자리 — **글 바로 아래**다. 물음 · 글자는 웹과 같은 `@reading/feedback` 이고 차례도 `app/me/reading/feedback.tsx` 와 같다.
 * 처음에는 한 줄로 접혀 서고, 이미 답한 사람의 「답 고치기」는 펼친 채 지금 답으로 열린다 — 빈 칸으로 다시 보내면 적어 둔 글이 지워진다.
 * 셋을 다 골라야 보내지고, 단추를 잠그지 않아 덜 고르고 누르면 곁의 말이 경고가 된다(ADR 0160).
 */
export function ReadingFeedback({ target, runId, given }: { target: ReadingTarget; runId: string; given: ReadingAnswer | null }) {
  const [answer, setAnswer] = useState(given);
  const [open, setOpen] = useState(given === null);
  const [unfolded, setUnfolded] = useState(false);
  const [usefulness, setUsefulness] = useState<FeedbackScore | null>(given?.usefulness ?? null);
  const [fit, setFit] = useState<FeedbackScore | null>(given?.perceivedFit ?? null);
  const [feltLength, setFeltLength] = useState<FeltLength | null>(given?.feltLength ?? null);
  const [tags, setTags] = useState<IssueTag[]>([...(given?.issueTags ?? [])]);
  const [comment, setComment] = useState(given?.comment ?? '');
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const questions = feedbackQuestions(target.kind);

  if (answer !== null && !open) {
    return (
      <Paper style={styles.thanks}>
        <Text style={styles.thanksText}>{FEEDBACK_THANKS}</Text>
        <TextButton label="답 고치기" onPress={() => setOpen(true)} />
      </Paper>
    );
  }

  const ready = usefulness !== null && fit !== null && feltLength !== null;

  const send = async () => {
    if (!ready) {
      setTried(true);
      return;
    }
    setFailure(null);
    setSaving(true);
    const sent: ReadingAnswer = {
      usefulness,
      perceivedFit: fit,
      feltLength,
      issueTags: tags,
      comment: comment.trim() === '' ? null : comment.trim(),
    };
    const result = await leaveFeedback(runId, sent);
    setSaving(false);
    if (result.ok) {
      setAnswer(sent);
      setOpen(false);
    } else {
      setFailure(result.message);
    }
  };

  const foldable = given === null && answer === null;
  const shown = foldable ? unfolded : true;
  const head = (
    <View style={styles.headWords}>
      <Text style={styles.headTitle}>이 풀이는 어떠셨어요?</Text>
      <Text style={styles.small}>{foldable ? FEEDBACK_FOLDED_NOTE : FEEDBACK_SCOPE_NOTE}</Text>
    </View>
  );

  return (
    <CardFrame>
      {foldable ? (
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: shown }} onPress={() => setUnfolded(!shown)} style={styles.head}>
          {head}
          <Text style={styles.chevron}>{shown ? '⌃' : '⌄'}</Text>
        </Pressable>
      ) : (
        <View style={styles.head}>{head}</View>
      )}

      {shown && (
        <View style={styles.body}>
          {foldable && <Text style={styles.small}>{FEEDBACK_SCOPE_NOTE}</Text>}
          <Scale question={questions.usefulness} value={usefulness} onChange={setUsefulness} />
          <Scale question={questions.perceivedFit} value={fit} onChange={setFit} />

          <View style={styles.part}>
            <Text style={styles.legend}>분량은 어땠나요?</Text>
            <View style={styles.chips}>
              {FELT_LENGTHS.map((choice) => (
                <Chip key={choice} role="radio" grow picked={feltLength === choice} onPick={() => setFeltLength(choice)}>
                  {FELT_LENGTH_LABEL[choice]}
                </Chip>
              ))}
            </View>
          </View>

          <View style={styles.part}>
            <Text style={styles.legend}>
              아쉬운 점이 있다면요? <Text style={styles.small}>중복 선택 가능</Text>
            </Text>
            <View style={styles.chipsWrap}>
              {ISSUE_TAGS.map((tag) => (
                <Chip
                  key={tag}
                  role="checkbox"
                  picked={tags.includes(tag)}
                  onPick={() => setTags((now) => (now.includes(tag) ? now.filter((one) => one !== tag) : [...now, tag]))}
                >
                  {ISSUE_TAG_LABEL[tag]}
                </Chip>
              ))}
            </View>
          </View>

          <View style={styles.part}>
            <Text style={styles.legend}>{FEEDBACK_COMMENT.label}</Text>
            <Text style={styles.small}>{FEEDBACK_COMMENT.hint}</Text>
            <TextInput
              multiline
              numberOfLines={3}
              value={comment}
              maxLength={FEEDBACK_COMMENT.limit}
              onChangeText={(next) => setComment(next.slice(0, FEEDBACK_COMMENT.limit))}
              accessibilityLabel={FEEDBACK_COMMENT.label}
              style={styles.comment}
            />
            <Text style={styles.count}>
              {comment.length} / {FEEDBACK_COMMENT.limit}자
            </Text>
          </View>

          {failure !== null && <Text accessibilityRole="alert" style={styles.warn}>답을 남기지 못했어요. {failure}</Text>}

          {!ready && <Text accessibilityRole={tried ? 'alert' : undefined} style={tried ? styles.warn : styles.small}>필수 질문 3개에 답하면 보낼 수 있어요.</Text>}
          <PrimaryButton label={saving ? '보내는 중…' : '의견 보내기'} onPress={() => void send()} disabled={saving} />
        </View>
      )}
    </CardFrame>
  );
}

/** 1~5 눈금 — 양 끝의 말이 함께 선다. 숫자만 읽어 주면 무엇을 매기는지 안 들려 양 끝은 이름으로 읽힌다 */
function Scale({ question, value, onChange }: { question: FeedbackQuestion; value: FeedbackScore | null; onChange: (next: FeedbackScore) => void }) {
  return (
    <Cell style={styles.scale}>
      <Text style={styles.legend}>{question.label}</Text>
      <View accessibilityRole="radiogroup" style={styles.chips}>
        {FEEDBACK_SCALE.map((score) => (
          <Chip
            key={score}
            role="radio"
            grow
            picked={value === score}
            onPick={() => onChange(score)}
            label={score === 1 ? `1 — ${question.low}` : score === 5 ? `5 — ${question.high}` : String(score)}
          >
            {score}
          </Chip>
        ))}
      </View>
      <View style={styles.ends}>
        <Text style={styles.end}>{question.low}</Text>
        <Text style={styles.end}>{question.high}</Text>
      </View>
    </Cell>
  );
}

function Chip({
  role,
  picked,
  onPick,
  label,
  grow = false,
  children,
}: {
  role: 'radio' | 'checkbox';
  picked: boolean;
  onPick: () => void;
  label?: string;
  grow?: boolean;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked: picked }}
      accessibilityLabel={label}
      onPress={onPick}
      style={[styles.chip, grow && styles.grow, picked && styles.chipOn]}
    >
      <Text style={[styles.chipText, picked && styles.chipTextOn]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  thanks: { gap: 4 },
  thanksText: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.creamInk },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  headWords: { flex: 1, minWidth: 0, gap: 4 },
  headTitle: { fontFamily: FONT.bold, fontSize: TYPE.lead, color: COLOR.foreground },
  chevron: { fontSize: TYPE.lead, color: COLOR.secondary },
  body: { gap: 20, paddingHorizontal: 20, paddingBottom: 20 },
  part: { gap: 10, paddingTop: 20, borderTopWidth: 1, borderTopColor: COLOR.border },
  scale: { gap: 10 },
  legend: { fontFamily: FONT.bold, fontSize: TYPE.body, lineHeight: 22, color: COLOR.foreground },
  small: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.secondary },
  chips: { flexDirection: 'row', gap: 8 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grow: { flex: 1, minWidth: 0 },
  chip: { minHeight: CONTROL, minWidth: CONTROL, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface },
  chipOn: { borderColor: COLOR.accent, backgroundColor: COLOR.accent },
  chipText: { fontFamily: FONT.medium, fontSize: TYPE.note, color: COLOR.foreground },
  chipTextOn: { fontFamily: FONT.bold, color: COLOR.onAccent },
  ends: { flexDirection: 'row', justifyContent: 'space-between' },
  end: { fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.secondary },
  comment: { minHeight: 88, paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.cell, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface, fontFamily: FONT.medium, fontSize: TYPE.field, lineHeight: 24, color: COLOR.foreground, textAlignVertical: 'top' },
  count: { textAlign: 'right', fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.secondary },
  warn: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.danger },
});
