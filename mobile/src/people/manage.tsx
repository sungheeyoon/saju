import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { NOTE_MAX } from '@input/edit';
import { missingAnswer } from '@input/query';
import type { PersonSlots } from '@people';
import { endsWithBatchim } from '@saju-text/batchim';

import { FieldLabel, PrimaryButton, SecondaryButton, TextButton } from '@/ui/parts';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { Card, EmptySlot } from '@/ui/surfaces';

import { BirthFields, useBirthForm } from './birth-fields';
import { addPerson, removeFromList, updateNote } from './data';
import { ConfirmDialog, FailureLine, go, styles as shared } from './parts';
import { SameChartAsk, type SameChartQuestion } from './same-chart-ask';

/** 메모 칸 — 사주 계산에 쓰지 않는다 */
function NoteField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <View>
      <FieldLabel>메모 (선택)</FieldLabel>
      <TextInput
        style={styles.note}
        value={value}
        onChangeText={(next) => onChange(next.slice(0, NOTE_MAX))}
        maxLength={NOTE_MAX}
        multiline
        numberOfLines={2}
        placeholder="기억해 둘 것 — 사주 계산에는 쓰지 않아요"
        placeholderTextColor={COLOR.muted}
        accessibilityLabel="메모 (선택)"
      />
    </View>
  );
}

/**
 * 한 사람을 등록한다 — 판정은 DB 가 하고 여기는 그 답을 보여 준다(`app/me/people/manage.tsx`).
 * 단추를 잠그지 않는다 — 빠진 칸은 누른 그때 경고 색으로 말한다(ADR 0160).
 */
export function AddPerson({ slots, startOpen, onSaved }: { slots: PersonSlots | null; startOpen: boolean; onSaved: () => void }) {
  const remaining = slots?.remaining ?? null;
  const [open, setOpen] = useState(startOpen);
  /* 닫았다 다시 열어도 적은 값이 남는다 — 저장한 뒤에만 비운다(대장 home 「사람 추가 폼」) */
  const [round, setRound] = useState(0);

  if (remaining !== null && remaining <= 0) {
    return (
      <EmptySlot style={styles.full}>
        <Text style={shared.body}>저장할 수 있는 {slots?.limit}명을 다 채웠어요. 목록에서 한 명을 빼면 다시 추가할 수 있습니다.</Text>
      </EmptySlot>
    );
  }

  return (
    <>
      {!open && (
        <View style={styles.addRow}>
          <PrimaryButton label="사람 추가" onPress={() => setOpen(true)} />
          {remaining !== null && remaining <= 5 && <Text style={shared.meta}>앞으로 {remaining}명 더 저장할 수 있어요.</Text>}
        </View>
      )}
      <View style={open ? undefined : styles.hidden}>
        <AddForm
          key={round}
          remaining={remaining}
          onCancel={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            setRound(round + 1);
            onSaved();
          }}
        />
      </View>
    </>
  );
}

function AddForm({ remaining, onCancel, onSaved }: { remaining: number | null; onCancel: () => void; onSaved: () => void }) {
  const form = useBirthForm();
  const [note, setNote] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [question, setQuestion] = useState<SameChartQuestion | null>(null);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const missing = missingAnswer(form.query);

  const attempt = async (evenIfSameChart: boolean) => {
    setSaving(true);
    setFailure(null);
    const result = await addPerson(form.query, note, evenIfSameChart);
    setSaving(false);
    setQuestion(null);
    if (result.ok) {
      onSaved();
      return;
    }
    if (result.kind === 'failed') {
      setFailure(result.message);
      return;
    }
    const { same } = result;
    setQuestion({
      label: same.label,
      answer: (sameperson) => {
        /* 「맞다」면 아무것도 등록하지 않고 그 사람에게 간다 — 자리도 안 쓰고 대상도 안 는다 */
        if (sameperson) {
          setQuestion(null);
          go(same.isSelfPerson ? '/me' : `/me/people/${same.personId}`);
        } else {
          void attempt(true);
        }
      },
    });
  };

  const save = () => {
    if (missing !== null) {
      setTried(true);
      return;
    }
    setTried(false);
    void attempt(false);
  };

  return (
    <Card style={styles.form}>
      <Text style={shared.section}>사람 추가</Text>
      <Text style={shared.body}>
        부를 이름은 <Text style={shared.bodyStrong}>나만 봐요.</Text> 같은 사람도 부르는 사람마다 이름이 다를 수 있어서, 이 이름은 내 목록에만 붙어요.
        {remaining !== null && remaining <= 5 && ` 앞으로 ${remaining}명 더 저장할 수 있어요.`}
      </Text>
      <BirthFields form={form} namePlaceholder="엄마" />
      <NoteField value={note} onChange={setNote} />
      {question !== null ? (
        <SameChartAsk question={question} busy={saving} />
      ) : (
        <View style={styles.actions}>
          <PrimaryButton label={saving ? '저장하는 중…' : '등록'} onPress={save} disabled={saving} />
          <SecondaryButton label="취소" onPress={onCancel} disabled={saving} />
          {missing !== null && <Text style={tried ? styles.warn : shared.meta}>{missing}</Text>}
        </View>
      )}
      {failure !== null && <FailureLine>저장하지 못했어요. {failure}</FailureLine>}
    </Card>
  );
}

export function NoteEditor({ personId, note, onDone, onCancel }: { personId: string; note: string; onDone: () => void; onCancel: () => void }) {
  const [value, setValue] = useState(note);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const changed = value.trim() !== note.trim();

  const save = async () => {
    setFailure(null);
    setSaving(true);
    const result = await updateNote(personId, value);
    setSaving(false);
    if (result.ok) onDone();
    else setFailure(result.message);
  };

  return (
    <Card style={styles.noteForm}>
      <NoteField value={value} onChange={setValue} />
      <PrimaryButton label={saving ? '저장하는 중…' : '메모 저장'} onPress={save} disabled={!changed || saving} />
      <TextButton label="작성 그만두기" onPress={onCancel} disabled={saving} />
      {failure !== null && <FailureLine>{failure}</FailureLine>}
    </Card>
  );
}

/** 목록에서 빼기 — 되돌릴 수 없는 누름이라 한 번 묻는다. 이름표 그대로에 조사만 붙인다(`RemoveConfirm`) */
export function RemoveConfirm({ personId, label, onDone, onCancel }: { personId: string; label: string; onDone: () => void; onCancel: () => void }) {
  const [failure, setFailure] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const remove = async () => {
    setFailure(null);
    setRemoving(true);
    const result = await removeFromList(personId);
    setRemoving(false);
    if (result.ok) onDone();
    else setFailure(result.message);
  };

  return (
    <ConfirmDialog
      title={`${label}${endsWithBatchim(label) ? '을' : '를'} 삭제할까요?`}
      body="삭제하면 저장한 출생 정보와 이 사람의 풀이가 목록에서 사라져요."
      irreversible="삭제한 사람은 되돌릴 수 없어요."
      confirmLabel={removing ? '삭제하는 중…' : '삭제'}
      busy={removing}
      failure={failure === null ? null : `삭제하지 못했어요. ${failure}`}
      onConfirm={remove}
      onClose={onCancel}
    />
  );
}

const styles = StyleSheet.create({
  full: { paddingVertical: 16 },
  addRow: { gap: 8 },
  hidden: { display: 'none' },
  form: { gap: 20 },
  actions: { gap: 8 },
  warn: { fontSize: TYPE.sm, fontFamily: FONT.medium, color: COLOR.danger },
  note: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    borderColor: COLOR.borderStrong,
    backgroundColor: COLOR.surface,
    fontFamily: FONT.medium,
    fontSize: TYPE.field,
    color: COLOR.foreground,
    textAlignVertical: 'top',
  },
  noteForm: { gap: 12, padding: 16, borderWidth: 0 },
});
