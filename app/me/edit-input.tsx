'use client';

import { useId, useRef, useState, useTransition } from 'react';

import { INPUT_EDIT_CHANGE_CONFIRM } from '@/src/lib/consent';

import { BirthFields, focusBirthGap } from '../birth-form';
import { missingAnswer, type Query } from '@/src/lib/input/query';
import {
  INPUT_EDIT_REPLACED_NOTE,
  samePillarInput,
} from '@/src/lib/input/edit';
import { editPersonInput } from './actions';
import { actionAnswer } from '../ui/action-answer';
import { BUTTON_PRIMARY, BUTTON_TERTIARY } from '../ui/buttons';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { TYPE_META, TYPE_NAME } from '../ui/surfaces';
import { FailureLine } from '../ui/failure-line';

/**
 * 저장된 출생 정보를 고치는 폼 — **여는 자리를 밖에서 정한다.** 익명 화면과 **같은 폼**(`BirthFields`)을 쓴다.
 *
 * 내 출생 정보는 프로필 수정 화면(`/me/profile`)의 「출생 정보」 칸이 열고(`profile/birth-section.tsx`, 2026-10-26 — 홈 카드의 연필을
 * 걷고 사진 · 닉네임 · 소개와 한 화면에 모았다), 저장한 사람은 카드의 관리 메뉴에서 연다(`PersonActions`). 여는 방법이 둘이라고
 * 폼이 둘이면 한쪽만 고쳐진다.
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
  confirmsRequests?: boolean;
  /**
   * 이름을 못 고칠 때 「닉네임 ○ — 내 이름은 프로필 닉네임으로 보여요」 상자를 세우는가. 프로필 수정 화면은 바로 위에 닉네임 칸이
   * 있어 안 세운다
   */
  nameNote?: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [query, setQueryNow] = useState(current);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [confirming, setConfirming] = useState(false);
  /** 저장을 눌러 봤나 — 곁의 말이 도움말에서 경고로 바뀌는 때(ADR 0160 의 3). 칸을 고치면 다시 도움말이다 */
  const [tried, setTried] = useState(false);
  const fields = useRef<HTMLDivElement>(null);
  const noteId = useId();

  const setQuery = (next: Query) => {
    setTried(false);
    setQueryNow(next);
  };

  const missing = missingAnswer(query);
  const nameChanged = editableName && query.name.trim() !== current.name.trim();
  const pillarsSame = samePillarInput(current, query);
  /** 저장할 것이 없다 — 빈 칸이 있거나 아무것도 안 바뀌었다. 단추는 가라앉되 누름을 받는다 */
  const unchanged = pillarsSame && !nameChanged;
  const blocked = missing !== null || unchanged;
  const warn = tried && blocked;

  /**
   * **단추를 잠그지 않는다**(운영자 결정 2026-10-18 G-97 ④, ADR 0160 의 3) — 저장할 것이 없으면 누른 그때 곁의 말을 경고 색으로
   * 세운다. 빈 칸이면 그 칸으로 데려간다(사람 추가의 「등록」과 같은 몸짓).
   */
  const press = () => {
    if (blocked) {
      setTried(true);
      if (missing !== null) focusBirthGap(fields.current);
      return;
    }
    if (confirmsRequests && !pillarsSame) setConfirming(true);
    else save();
  };

  const save = () => {
    setConfirming(false);
    setFailure(null);
    startSaving(async () => {
      const result = await actionAnswer(editPersonInput(personId, query));
      if (result.ok) onDone();
      else setFailure(result.message);
    });
  };

  return (
    <section
      className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 text-foreground shadow-card sm:p-5"
    >
      <header className="flex flex-col gap-1">
        <h2 className={TYPE_NAME}>수정하기</h2>
        <p className="text-body leading-6 text-secondary">{INPUT_EDIT_REPLACED_NOTE}</p>
      </header>

      {!editableName && nameNote && (
        <div className="rounded-cell bg-surface-sunken px-3.5 py-2.5 text-body">
          <span className="text-secondary">닉네임</span>{' '}
          <strong className="font-semibold">{current.name}</strong>
          <p className={`mt-0.5 ${TYPE_META}`}>내 이름은 프로필 닉네임으로 보여요.</p>
        </div>
      )}

      <div ref={fields}>
        <BirthFields value={query} onChange={setQuery} showName={editableName} surface="flat" />
      </div>

      {/*
        무엇이 일어날지 누르기 전에 말한다. 이름은 여덟 글자를 바꾸지 않으므로
        저장된 입력을 안 바꾸는데, 그걸 안 말해 주면 「고쳤는데 그대로다」로 보인다.
      */}
      {pillarsSame && (
        <p
          id={unchanged && missing === null ? noteId : undefined}
          role={warn && unchanged && missing === null ? 'alert' : undefined}
          className={warn && unchanged && missing === null ? WARN_NOTE : TYPE_META}
        >
          {nameChanged
            ? '이름만 바뀌었어요. 이름은 여덟 글자에 들어가지 않아서 출생 정보와 사주는 그대로예요.'
            : '바뀐 것이 없어요.'}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            /*
              여덟 글자가 바뀌는 누름만 묻는다 — 이름만 고치는 것은 요청을 안 건드린다.
              「이름 저장」은 이름만 바뀐 때뿐이다 — 아무것도 안 바뀐 가라앉은 단추가 그 이름이면 출생 정보 폼이 이름만 저장하는 것처럼 읽힌다.
            */
            onClick={press}
            disabled={saving}
            aria-disabled={blocked || undefined}
            aria-describedby={blocked ? noteId : undefined}
            className={BUTTON_PRIMARY}
          >
            {saving ? '저장하는 중…' : pillarsSame && nameChanged ? '이름 저장' : '변경 사항 저장'}
          </button>
          <button type="button" onClick={onCancel} disabled={saving} className={BUTTON_TERTIARY}>
            작성 그만두기
          </button>
        </div>
        {missing !== null && (
          <p id={noteId} role={warn ? 'alert' : undefined} className={warn ? WARN_NOTE : TYPE_META}>
            {missing}
          </p>
        )}
      </div>

      {failure !== null && (
        <FailureLine>저장하지 못했어요. {failure}</FailureLine>
      )}

      <EditInputConfirm open={confirming} onConfirm={save} onCancel={() => setConfirming(false)} />
    </section>
  );
}

/** 저장할 것이 없는데 누른 뒤의 곁의 말 — 사람 추가의 빠진 칸 말과 같은 모양(`app/me/people/manage.tsx`) */
const WARN_NOTE = 'text-sm font-medium text-danger';

/**
 * 내 출생 정보를 바꾸기 직전의 확인 — **경고는 되돌릴 수 없는 누름 직전에 선다**(ADR 0028).
 *
 * 바꾸면 답을 기다리던 인연 요청이 취소된다. 그 사실을 바꾼 뒤에 소식으로만 알면 사고처럼
 * 읽힌다. 문구는 `INPUT_EDIT_CHANGE_CONFIRM` 한 자리에서 읽는다. 창은 확인 창 한 벌이다 — 첫 초점은 「취소」(ADR 0166).
 */
function EditInputConfirm({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onCancel}
      title={INPUT_EDIT_CHANGE_CONFIRM.title}
      confirmLabel={INPUT_EDIT_CHANGE_CONFIRM.confirm}
      cancelLabel={INPUT_EDIT_CHANGE_CONFIRM.cancel}
      onConfirm={onConfirm}
    >
      {INPUT_EDIT_CHANGE_CONFIRM.body.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </ConfirmDialog>
  );
}
