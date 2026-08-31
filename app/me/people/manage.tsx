'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { BirthFields } from '../../birth-form';
import { DEFAULT_QUERY, missingAnswer, type Query } from '../../query';
import {
  RELATIONS,
  RELATION_INTRO,
  RELATION_LABEL,
  type Relation,
} from '@/src/lib/people';

import { NOTE_MAX } from '../../revision';
import { addManagedPerson, removeFromList, updateNote, updateRelation } from '../actions';

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
export function AddPerson({ remaining }: { remaining: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<Query>({ ...DEFAULT_QUERY, name: '' });
  const [note, setNote] = useState('');
  const [relation, setRelation] = useState<Relation | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const missing = missingAnswer(query);

  const save = () => {
    setFailure(null);
    startSaving(async () => {
      const result = await addManagedPerson(query, note, relation);
      if (result.ok) {
        setQuery({ ...DEFAULT_QUERY, name: '' });
        setNote('');
        setRelation(null);
        setOpen(false);
        router.refresh();
      } else {
        setFailure(result.message);
      }
    });
  };

  if (remaining <= 0) {
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
          {remaining <= 5 && ` 앞으로 ${remaining}명 더 등록할 수 있습니다.`}
        </p>
      </header>

      <BirthFields value={query} onChange={setQuery} idPrefix="add" namePlaceholder="엄마" />

      <RelationField value={relation} onChange={setRelation} idPrefix="add" />
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

/**
 * 무슨 사이인지 고르는 칸 — **안 고르는 것도 답이다.**
 *
 * 필수로 두지 않는다. 모를 수도 있고 말하기 싫을 수도 있는데, 필수로 두면 사람들은
 * 아무거나 고른다 — 그러면 **틀린 값이 「모른다」보다 나쁜 자리에 앉는다.** 안 고르면
 * 궁합 풀이가 어느 쪽으로도 단정하지 않는 장면으로 쓴다.
 *
 * 라디오로 두는 것은 넷뿐이라서다. 고른 것을 되돌릴 수 있어야 하므로 「아직 모르겠음」이
 * 나란히 선다 — 라디오는 스스로 풀리지 않는다.
 */
function RelationField({
  value,
  onChange,
  idPrefix,
}: {
  value: Relation | null;
  onChange: (next: Relation | null) => void;
  idPrefix: string;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-xs text-secondary">나와 무슨 사이인가요? (선택)</legend>
      <div className="flex flex-wrap gap-2 pt-1">
        {[...RELATIONS, null].map((choice) => {
          const id = `${idPrefix}-relation-${choice ?? 'unknown'}`;
          const label = choice === null ? '아직 모르겠음' : RELATION_LABEL[choice];
          const chosen = value === choice;

          return (
            <label
              key={id}
              htmlFor={id}
              className={`relative cursor-pointer rounded-full border px-3 py-1.5 text-sm
                has-[:focus-visible]:outline has-[:focus-visible]:outline-3
                has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-soft ${
                  chosen
                    ? 'border-accent bg-accent-wash text-accent'
                    : 'border-border text-secondary hover:border-accent'
                }`}
            >
              {/*
                칸 전체를 덮는 라디오 — 보이지는 않지만 **이것이 눌린다.**
                `sr-only` 로 숨기면 글자만 누를 수 있는 칸이 되고, 라벨을 못 짚는
                손에는 누를 것이 없는 칸이 된다(`birth-form.tsx` 와 같은 규율).
              */}
              <input
                type="radio"
                id={id}
                name={`${idPrefix}-relation`}
                checked={chosen}
                onChange={() => onChange(choice)}
                className="absolute inset-0 cursor-pointer appearance-none opacity-0"
              />
              {label}
            </label>
          );
        })}
      </div>
      <p className="text-xs text-muted">{RELATION_INTRO}</p>
    </fieldset>
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
 * 무슨 사이인지 고쳐 적는 자리 — **판본이 되지 않는다.**
 *
 * 메모와 나란히 선다. 둘 다 여덟 글자를 안 바꾸므로 판본이 안 쌓이고, 그래서
 * 생년월일시를 고치는 폼과는 갈라 둔다.
 *
 * **누르면 바로 저장한다.** 라디오 하나에 「저장」 버튼을 더 두면 고른 것과 저장된
 * 것이 갈리는 상태가 생기고, 사용자는 고르기만 하고 떠난다.
 */
export function RelationForm({
  personId,
  relation,
}: {
  personId: string;
  relation: Relation | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(relation);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const choose = (next: Relation | null) => {
    setValue(next);
    setFailure(null);
    startSaving(async () => {
      const result = await updateRelation(personId, next);
      if (result.ok) router.refresh();
      else {
        // 저장 못 했으면 화면도 되돌린다 — 안 되돌리면 고른 척만 하고 서 있게 된다.
        setValue(relation);
        setFailure(result.message);
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <RelationField value={value} onChange={choose} idPrefix={personId} />
      {saving && <span className="text-xs text-muted">저장하는 중…</span>}
      {failure !== null && <span className="text-xs text-muted">{failure}</span>}
    </div>
  );
}

/**
 * 메모만 고치는 자리 — **판본이 되지 않는다.**
 *
 * 생년월일시를 고치는 폼과 나란히 두지 않는다. 한쪽은 새 판본을 쌓고 한쪽은 안
 * 쌓는데, 한 버튼 아래 두면 무엇이 쌓이는지가 흐려진다.
 */
export function NoteForm({ personId, note }: { personId: string; note: string }) {
  const router = useRouter();
  const [value, setValue] = useState(note);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const changed = value.trim() !== note.trim();

  const save = () => {
    setFailure(null);
    startSaving(async () => {
      const result = await updateNote(personId, value);
      if (result.ok) router.refresh();
      else setFailure(result.message);
    });
  };

  return (
    <div className="flex flex-col gap-2">
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
        {failure !== null && <span className="text-xs text-muted">{failure}</span>}
      </div>
    </div>
  );
}

/**
 * 목록에서 뺀다 — **한 번 더 묻는다.**
 *
 * 되돌릴 수 없다. 엣지가 사라지면 그 Person 은 더 이상 보이지 않으므로, 잘못 눌렀을
 * 때 스스로 되돌릴 방법이 없다. 그래서 누르는 순간이 아니라 확인한 순간에 지운다.
 */
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
        {removing ? '빼는 중…' : '뺀다'}
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
