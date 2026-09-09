'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import type { PersonSlots } from '@/src/lib/people';

import { BirthFields } from '../../birth-form';
import { DEFAULT_QUERY, missingAnswer, type Query } from '@/src/lib/input/query';
import { NOTE_MAX } from '@/src/lib/input/revision';
import { addManagedPerson, removeFromList, updateNote } from '../actions';
import { SameChartAsk, type SaveOutcome, type SameChartQuestion } from '../../same-chart-ask';

/**
 * 목록을 손대는 세 자리 — 추가·메모·빼기.
 *
 * 메모와 빼기는 **여는 버튼을 안 가진다.** 카드의 관리 메뉴(`person-menu.tsx`)가 열고,
 * 여기 있는 것은 열린 칸과 닫는 길뿐이다.
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
 *
 * **자리 수는 받아서 쓴다.** 「스무 명을 다 채웠습니다」가 이 화면의 문장에 박혀 있었다 —
 * 한도를 옮기는 날 DB 는 열에서 막는데 화면은 계속 스물이라고 말한다. 그래서 남은 자리만
 * 받지 않고 한 줄을 통째로 받는다: 한도는 `person_limit()` 이 들고 `my_person_slots()`
 * 가 그것을 내준다(ADR 0032).
 */
export function AddPerson({ slots }: { slots: PersonSlots | null }) {
  // 못 읽었으면 `null` — 그때는 막지도 않고 수를 말하지도 않는다.
  const remaining = slots?.remaining ?? null;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<Query>({ ...DEFAULT_QUERY, name: '' });
  const [note, setNote] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  /** 같은 명식이 이미 있으면 여기 선다 — 서 있는 동안 등록 버튼은 자리를 비운다 */
  const [question, setQuestion] = useState<SameChartQuestion | null>(null);
  const [saving, startSaving] = useTransition();

  const missing = missingAnswer(query);

  /**
   * 「맞다」면 **아무것도 등록하지 않고** 그 사람에게 간다 — 자리도 안 쓰고 대상도 안 는다.
   * 목적은 중복 행이 아니라 **풀이권이 두 번 나가는 것**을 막는 것이다(ADR 0034).
   */
  const attempt = async (evenIfSameChart: boolean): Promise<SaveOutcome> => {
    const result = await addManagedPerson(query, note, evenIfSameChart);

    if (result.ok) {
      setQuery({ ...DEFAULT_QUERY, name: '' });
      setNote('');
      setOpen(false);
      router.refresh();
      return { done: true };
    }
    if (result.kind === 'failed') return { failed: result.message };

    const { same } = result;
    return {
      ask: {
        label: same.label,
        answer: async (sameperson) => {
          if (!sameperson) return attempt(true);
          router.push(same.isSelf ? '/me' : `/me/people/${same.personId}`);
          return { done: true };
        },
      },
    };
  };

  const settle = (outcome: SaveOutcome) => {
    if ('failed' in outcome) {
      setFailure(outcome.failed);
      setQuestion(null);
      return;
    }
    setQuestion('ask' in outcome ? outcome.ask : null);
  };

  const save = () => {
    setFailure(null);
    startSaving(async () => settle(await attempt(false)));
  };

  // 못 읽었으면(`null`) 막지 않는다 — 막는 것은 DB 이고 화면은 먼저 말해 줄 뿐이다.
  if (remaining !== null && remaining <= 0) {
    return (
      <p className="rounded-[1.75rem] border border-border bg-surface-sunken p-5 text-sm text-muted">
        등록할 수 있는 {slots?.limit}명을 다 채웠습니다. 목록에서 누군가를 빼면 다시 등록할 수
        있습니다.
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
    <section className="flex flex-col gap-4 rounded-[1.75rem] border border-border bg-surface p-5 sm:p-6">
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

      {question !== null ? (
        /*
          **물음이 서면 등록 버튼은 내려간다.** 둘을 함께 세우면 답하지 않고 다시 누를 수
          있고, 그러면 같은 물음이 또 온다 — 그때 사용자는 자기 답이 안 먹혔다고 읽는다.
        */
        <SameChartAsk
          question={question}
          busy={saving}
          onAnswer={(sameperson) => {
            setFailure(null);
            startSaving(async () => settle(await question.answer(sameperson)));
          }}
        />
      ) : (
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
      )}

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
 * 메모 — **카드의 관리 메뉴가 연다.**
 *
 * 늘 펼쳐 두었더니 빈 칸 하나가 카드 높이의 삼분지 일을 먹었다. 목록이 길면 그
 * 빈 칸이 스무 개다. **꼭 필요한 값이 아닌 것이 자리를 제일 많이 차지하고 있었다.**
 *
 * 그 뒤로는 스스로 여는 버튼을 달고 다른 조작들과 한 줄에 섰는데, 그 줄이 밑줄 친
 * 글자 셋이 되어 카드 아래가 지저분해졌다. 이제 여는 자리는 하나(`PersonActions`)이고
 * 여기 있는 것은 열린 칸뿐이다.
 *
 * **적어 둔 메모는 카드가 직접 보인다.** 버튼 이름으로만 「메모 고치기」라고 말하던 때는
 * 접힌 것이 곧 비어 있다는 뜻으로 읽혔다 — 적어 둔 사람이 자기 메모를 잃은 줄 안다.
 *
 * 생년월일시를 고치는 폼과는 여전히 갈라 둔다. 한쪽은 새 판본을 쌓고 한쪽은 안
 * 쌓는데, 한 버튼 아래 두면 무엇이 쌓이는지가 흐려진다.
 */
export function NoteEditor({
  personId,
  note,
  onDone,
  onCancel,
}: {
  personId: string;
  note: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(note);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const changed = value.trim() !== note.trim();

  const save = () => {
    setFailure(null);
    startSaving(async () => {
      const result = await updateNote(personId, value);
      if (result.ok) {
        onDone();
        router.refresh();
      } else {
        setFailure(result.message);
      }
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
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="text-xs text-secondary underline underline-offset-2"
        >
          닫기
        </button>
        {failure !== null && <span className="text-xs text-muted">{failure}</span>}
      </div>
    </div>
  );
}

/**
 * 목록에서 빼기 — **묻는 자리만 남았다.**
 *
 * 되돌릴 수 없는 누름이므로 한 번 묻는다. 경고는 그 누름 직전에만 서므로, 메뉴에서
 * 고르기 전에는 이 말이 화면에 없다.
 */
export function RemoveConfirm({
  personId,
  label,
  onCancel,
}: {
  personId: string;
  label: string;
  onCancel: () => void;
}) {
  const router = useRouter();
  const confirming = useRef<HTMLDialogElement>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [removing, startRemoving] = useTransition();

  useEffect(() => {
    if (confirming.current !== null && !confirming.current.open) confirming.current.showModal();
  }, []);

  const remove = () => {
    setFailure(null);
    startRemoving(async () => {
      const result = await removeFromList(personId);
      if (result.ok) router.refresh();
      else setFailure(result.message);
    });
  };

  return (
    <dialog
      ref={confirming}
      aria-labelledby={`remove-person-${personId}`}
      onCancel={(event) => {
        if (removing) event.preventDefault();
      }}
      onClose={onCancel}
      className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-2xl border border-border bg-surface p-6 text-foreground shadow-[var(--shadow-float)] backdrop:bg-black/40"
    >
      <h3 id={`remove-person-${personId}`} className="text-base font-bold">
        {label} 님을 목록에서 뺄까요?
      </h3>
      <p className="mt-2 text-sm leading-6 text-secondary">
        저장한 출생 정보와 이 사람의 풀이는 목록에서 사라지며 되돌릴 수 없습니다.
      </p>
      {failure !== null && <p className="mt-3 text-sm text-danger">빼지 못했습니다 — {failure}</p>}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
        <button
          type="button"
          onClick={remove}
          disabled={removing}
          className="h-11 rounded-xl bg-danger px-5 text-sm font-semibold text-white shadow-sm disabled:opacity-60 sm:h-10"
        >
          {removing ? '빼는 중…' : '목록에서 빼기'}
        </button>
        <button
          type="button"
          onClick={() => confirming.current?.close()}
          disabled={removing}
          className="h-11 rounded-xl border border-border px-5 text-sm text-secondary hover:border-border-strong hover:text-foreground sm:h-10"
        >
          취소
        </button>
      </div>
    </dialog>
  );
}
