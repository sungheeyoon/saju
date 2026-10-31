import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { INPUT_EDIT_CHANGE_CONFIRM } from '@consent/index';
import { INPUT_EDIT_REPLACED_NOTE, samePillarInput } from '@input/edit';
import { missingAnswer, type Query } from '@input/query';

import { editPersonInput, saveFailureOf } from '@/reading/chart-writes';
import { followRefusal } from '@/reading/panel';
import { PrimaryButton, TextButton } from '@/ui/parts';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { Card } from '@/ui/surfaces';

import { BirthFields, useBirthForm } from './birth-fields';
import { FailureLine, Sheet, styles as shared } from './parts';

/**
 * 저장된 출생 정보를 고치는 폼 — 웹의 `app/me/edit-input.tsx` 와 같은 판정 · 글자다. 여덟 글자는 서버가 이 입력에서 센다(ADR 0211).
 * 단추를 잠그지 않는다 — 저장할 것이 없으면 누른 그때 곁의 말이 경고 색으로 선다(ADR 0160).
 */
export function EditInputForm({
  personId,
  current,
  editableName = true,
  confirmsRequests = false,
  nameNote = true,
  onDone,
  onCancel,
}: {
  personId: string;
  current: Query;
  editableName?: boolean;
  /** 내 출생 정보 — 바꾸면 답을 기다리던 인연 요청이 취소되므로 묻는다 */
  confirmsRequests?: boolean;
  nameNote?: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const form = useBirthForm(current);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [tried, setTried] = useState(false);

  const { query } = form;
  const missing = missingAnswer(query);
  const nameChanged = editableName && query.name.trim() !== current.name.trim();
  const pillarsSame = samePillarInput(current, query);
  const unchanged = pillarsSame && !nameChanged;
  const blocked = missing !== null || unchanged;
  const warn = tried && blocked;

  const save = async () => {
    setConfirming(false);
    setFailure(null);
    setSaving(true);
    const answer = await editPersonInput(personId, query);
    setSaving(false);
    if (answer.ok && answer.value.ok) {
      onDone();
      return;
    }
    setFailure(saveFailureOf(answer));
    if (!answer.ok) followRefusal(answer.refused);
  };

  const press = () => {
    if (blocked) {
      setTried(true);
      return;
    }
    if (confirmsRequests && !pillarsSame) setConfirming(true);
    else void save();
  };

  return (
    <Card style={styles.form}>
      <View style={styles.head}>
        <Text style={shared.section}>수정하기</Text>
        <Text style={shared.body}>{INPUT_EDIT_REPLACED_NOTE}</Text>
      </View>

      {!editableName && nameNote && (
        <View style={styles.nameNote}>
          <Text style={shared.body}>
            닉네임 <Text style={shared.bodyStrong}>{current.name}</Text>
          </Text>
          <Text style={shared.meta}>내 이름은 프로필 닉네임으로 보여요.</Text>
        </View>
      )}

      <BirthFields form={form} showName={editableName} />

      {pillarsSame && (
        <Text style={warn && unchanged && missing === null ? styles.warn : shared.meta}>
          {nameChanged ? '이름만 바뀌었어요. 이름은 여덟 글자에 들어가지 않아서 출생 정보와 사주는 그대로예요.' : '바뀐 것이 없어요.'}
        </Text>
      )}

      <View style={styles.actions}>
        <PrimaryButton label={saving ? '저장하는 중…' : pillarsSame && nameChanged ? '이름 저장' : '변경 사항 저장'} onPress={press} disabled={saving} />
        <TextButton label="작성 그만두기" onPress={onCancel} disabled={saving} />
        {missing !== null && <Text style={warn ? styles.warn : shared.meta}>{missing}</Text>}
      </View>

      {failure !== null && <FailureLine>저장하지 못했어요. {failure}</FailureLine>}

      {confirming && (
        <Sheet label={INPUT_EDIT_CHANGE_CONFIRM.cancel} onClose={() => setConfirming(false)}>
          <Text style={shared.section}>{INPUT_EDIT_CHANGE_CONFIRM.title}</Text>
          {INPUT_EDIT_CHANGE_CONFIRM.body.map((line) => (
            <Text key={line} style={shared.noticeBody}>{line}</Text>
          ))}
          <PrimaryButton label={INPUT_EDIT_CHANGE_CONFIRM.confirm} onPress={() => void save()} />
          <TextButton label={INPUT_EDIT_CHANGE_CONFIRM.cancel} onPress={() => setConfirming(false)} />
        </Sheet>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16, padding: 16 },
  head: { gap: 4 },
  actions: { gap: 8 },
  nameNote: { gap: 2, paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.cell, backgroundColor: COLOR.surfaceSunken },
  warn: { fontSize: TYPE.note, fontFamily: FONT.medium, color: COLOR.danger },
});
