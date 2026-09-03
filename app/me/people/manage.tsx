'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { BirthFields } from '../../birth-form';
import { DEFAULT_QUERY, missingAnswer, type Query } from '../../query';
import { NOTE_MAX } from '../../revision';
import { addManagedPerson, removeFromList, updateNote } from '../actions';

/**
 * 목록을 손대는 세 자리 — 추가·메모·빼기.
 *
 * 셋 다 **판정하지 않는다.** 한도는 DB 트리거가, 무엇을 고칠 수 있는지는 정책이
 * 들고 있고, 여기 있는 것은 그 답을 사람에게 보여주는 일뿐이다.
 */

const BUTTON =
  'h-11 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-60 sm:h-10';

/**
 * 가족·친구 한 사람을 등록한다.
 *
 * 익명 화면·온보딩과 **같은 폼**을 쓴다(`BirthFields`). 저장하는 화면이라고 다른 폼을
 * 두면 한쪽만 고쳐져서 「같은 값을 넣었는데 다른 사주가 나오는」 상태가 생긴다.
 */
export function AddPerson({ remaining }: { remaining: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<Query>({ ...DEFAULT_QUERY, name: '' });
  const [note, setNote] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const missing = missingAnswer(query);

  const save = () => {
    setFailure(null);
    startSaving(async () => {
      const result = await addManagedPerson(query, note);
      if (result.ok) {
        setQuery({ ...DEFAULT_QUERY, name: '' });
        setNote('');
        setOpen(false);
        router.refresh();
      } else {
        setFailure(result.message);
      }
    });
  };

  // 못 읽었으면(`null`) 막지 않는다 — 막는 것은 DB 이고 화면은 먼저 말해 줄 뿐이다.
  if (remaining !== null && remaining <= 0) {
    return (
      <p className="rounded-xl border border-border bg-surface-sunken p-4 text-sm text-muted">
        등록할 수 있는 스무 명을 다 채웠습니다. 목록에서 누군가를 빼면 다시 등록할 수 있습니다.
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${BUTTON} self-start`}>
        사람 추가
      </button>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">사람 추가</h2>
        <p className="text-sm text-secondary">
          부를 이름은 <strong className="font-medium">나만 봅니다.</strong> 같은 사람을 다른
          사람은 다르게 부를 수 있으므로, 이름은 그 사람이 아니라 나와 그 사람 사이에 붙습니다.
          {remaining !== null && remaining <= 5 && ` 앞으로 ${remaining}명 더 등록할 수 있습니다.`}
        </p>
      </header>

      <BirthFields value={query} onChange={setQuery} idPrefix="add" namePlaceholder="엄마" />

      <NoteField value={note} onChange={setNote} idPrefix="add" />

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={missing !== null || saving} className={BUTTON}>
          {saving ? '저장하는 중…' : '등록'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={saving}
          className="text-sm text-secondary underline underline-offset-2"
        >
          그만두기
        </button>
        {/* 버튼을 잠근 이유를 그대로 말한다 — 잠긴 버튼만 있으면 왜인지 알 수 없다 */}
        {missing !== null && <span className="text-xs text-muted">{missing}</span>}
      </div>

      {failure !== null && <p className="text-sm text-muted">저장하지 못했습니다 — {failure}</p>}
    </section>
  );
}

function NoteField({
  value,
  onChange,
  idPrefix,
}: {
  value: string;
  onChange: (next: string) => void;
  idPrefix: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-secondary">메모 (선택)</span>
      <textarea
        id={`${idPrefix}-note`}
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, NOTE_MAX))}
        maxLength={NOTE_MAX}
        rows={2}
        placeholder="기억해 둘 것 — 이 사람의 사주에는 들어가지 않습니다"
        className="rounded-md border border-border bg-surface px-2.5 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-wash"
      />
    </label>
  );
}

/**
 * 메모 — **접어 둔다.**
 *
 * 늘 펼쳐 두었더니 빈 칸 하나가 카드 높이의 삼분지 일을 먹었다. 스무 명이면 그
 * 빈 칸이 스무 개다. **꼭 필요한 값이 아닌 것이 자리를 제일 많이 차지하고 있었다.**
 *
 * 그래서 다른 조작들과 같은 줄에 버튼으로 서고, 누르면 그 아래에 열린다. 적어 둔
 * 메모가 있으면 버튼이 그것을 말한다 — 접힌 것이 **비어 있다는 뜻이 되면** 적어 둔
 * 사람이 자기 메모를 잃은 줄 안다.
 *
 * 생년월일시를 고치는 폼과는 여전히 갈라 둔다. 한쪽은 새 판본을 쌓고 한쪽은 안
 * 쌓는데, 한 버튼 아래 두면 무엇이 쌓이는지가 흐려진다.
 */
export function NoteForm({ personId, note }: { personId: string; note: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(note);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const changed = value.trim() !== note.trim();

  const save = () => {
    setFailure(null);
    startSaving(async () => {
      const result = await updateNote(personId, value);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setFailure(result.message);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="text-sm text-secondary underline underline-offset-2 hover:text-accent"
      >
        {note.trim() === '' ? '메모 넣기' : '메모 고치기'}
      </button>

      {/*
        `w-full` 이라 줄바꿈해서 제 줄에 선다 — 버튼들이 선 줄 아래다. 패널을 줄 밖에
        따로 두면 여는 버튼과 열리는 칸이 두 컴포넌트로 갈린다.
      */}
      {open && (
        <div className="flex w-full flex-col gap-2 pt-1">
          <NoteField value={value} onChange={setValue} idPrefix={personId} />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={!changed || saving}
              className="h-9 rounded-md border border-border px-3 text-xs text-secondary transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-50"
            >
              {saving ? '저장하는 중…' : '메모 저장'}
            </button>
            <button
              type="button"
              onClick={() => {
                setValue(note);
                setOpen(false);
              }}
              disabled={saving}
              className="text-xs text-secondary underline underline-offset-2"
            >
              닫기
            </button>
            {failure !== null && <span className="text-xs text-muted">{failure}</span>}
          </div>
        </div>
      )}
    </>
  );
}

export function RemoveFromList({ personId, label }: { personId: string; label: string }) {
  const router = useRouter();
  const [asked, setAsked] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [removing, startRemoving] = useTransition();

  const remove = () => {
    setFailure(null);
    startRemoving(async () => {
      const result = await removeFromList(personId);
      if (result.ok) router.refresh();
      else setFailure(result.message);
    });
  };

  if (!asked) {
    return (
      <button
        type="button"
        onClick={() => setAsked(true)}
        className="text-sm text-secondary underline underline-offset-2"
      >
        목록에서 빼기
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-secondary">{label} 님을 목록에서 뺍니다. 되돌릴 수 없습니다.</span>
      <button
        type="button"
        onClick={remove}
        disabled={removing}
        className="text-accent underline underline-offset-2 disabled:opacity-60"
      >
        {removing ? '빼는 중…' : '뺍니다'}
      </button>
      <button
        type="button"
        onClick={() => setAsked(false)}
        disabled={removing}
        className="text-secondary underline underline-offset-2"
      >
        그만두기
      </button>
      {failure !== null && <span className="text-xs text-muted">{failure}</span>}
    </span>
  );
}
