'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { INPUT_EDIT_CHANGE_CONFIRM } from '@/src/lib/consent';

import { BirthFields } from '../birth-form';
import { missingAnswer, type Query } from '@/src/lib/input/query';
import {
  INPUT_EDIT_REPLACED_NOTE,
  samePillarInput,
} from '@/src/lib/input/edit';
import { editPersonInput } from './actions';

/**
 * 저장된 출생 정보를 고치는 자리.
 *
 * 접어 둔다. 이 화면의 주된 일은 저장된 사주를 보는 것이고, 고치는 것은 가끔이다.
 * 폼을 늘 펼쳐 두면 「지금 보고 있는 것」과 「고치는 중인 것」이 한 화면에서 섞인다.
 *
 * 여기서도 익명 화면과 **같은 폼**을 쓴다.
 */
export function EditInput({
  personId,
  current,
  embedded = false,
  variant = 'link',
  editableName = true,
  confirmsRequests = false,
}: {
  personId: string;
  current: Query;
  embedded?: boolean;
  /**
   * 여덟 글자를 바꾸기 전에 **요청이 취소된다고 한 번 묻는가.**
   *
   * 인연 요청은 내 명식에만 걸리므로 내 사주(`/me`)만 켠다. 저장한 사람을 고치는 자리는
   * 걸린 요청이 없어 물을 것이 없다.
   */
  confirmsRequests?: boolean;
  /**
   * 여는 손잡이의 모양 — **글자냐 카드 모서리의 아이콘이냐.**
   *
   * 저장한 사람 카드가 손대는 것들을 오른쪽 위 구석의 아이콘 하나로 모은 뒤로, 내
   * 명식 카드만 밑줄 친 글자로 열고 있었다. 두 화면이 같은 일을 다른 모양으로 내밀면
   * 사용자는 그것이 같은 일인지부터 확인해야 한다.
   *
   * **부르는 이름은 그대로 「출생 정보 수정」이다** — 모양이 달라져도 보조기기와
   * 시험이 읽는 이름은 한 벌이어야 한다.
   */
  variant?: 'link' | 'corner';
  /** selfPerson 은 계정 닉네임으로 부르므로 이 폼에서 이름을 고치지 않는다 */
  editableName?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (variant === 'corner') {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen((now) => !now)}
          aria-expanded={open}
          aria-label="출생 정보 수정"
          className="absolute right-4 top-4 grid size-10 place-items-center rounded-full border border-border bg-surface text-secondary hover:border-accent hover:text-accent sm:right-5 sm:top-5"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-4.5 fill-none stroke-current"
            strokeWidth="1.7"
            strokeLinejoin="round"
          >
            <path d="M4 16.2 14.1 6.1a1.9 1.9 0 0 1 2.7 2.7L6.7 18.9l-3.2.5Z" />
          </svg>
        </button>
        {open && (
          <div className="mt-5">
            <EditInputForm
              personId={personId}
              current={current}
              editableName={editableName}
              confirmsRequests={confirmsRequests}
              onDone={() => setOpen(false)}
              onCancel={() => setOpen(false)}
            />
          </div>
        )}
      </>
    );
  }

  if (open) {
    return (
      <EditInputForm
        personId={personId}
        current={current}
        embedded={embedded}
        editableName={editableName}
        confirmsRequests={confirmsRequests}
        onDone={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      /*
        `self-start` 를 달지 않는다. 이 버튼은 다른 것들과 한 줄에 설 수 있는데,
        `self-start` 가 그 줄의 `items-center` 를 이겨서 **혼자만 위로 솟아 있었다.**
        늘어나는 것을 막아야 하는 자리(`embedded`)에서만 단다.
      */
      className={`text-sm text-accent underline underline-offset-2 ${embedded ? 'self-start' : ''}`}
    >
      출생 정보 수정
    </button>
  );
}

/**
 * 고치는 폼 그 자체 — **여는 자리를 밖에서 정한다.**
 *
 * `/me` 는 버튼 하나로 열고(`EditInput`), 저장한 사람 목록은 카드의 관리 메뉴에서
 * 연다(`PersonActions`). 여는 방법이 둘이라고 폼이 둘이면 한쪽만 고쳐진다.
 */
export function EditInputForm({
  personId,
  current,
  embedded = false,
  editableName = true,
  confirmsRequests = false,
  onDone,
  onCancel,
}: {
  personId: string;
  current: Query;
  embedded?: boolean;
  editableName?: boolean;
  confirmsRequests?: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(current);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const missing = missingAnswer(query);
  const nameChanged = editableName && query.name.trim() !== current.name.trim();
  const pillarsSame = samePillarInput(current, query);

  const save = () => {
    setConfirming(false);
    setFailure(null);
    startSaving(async () => {
      const result = await editPersonInput(personId, query);
      if (result.ok) {
        onDone();
        router.refresh();
      } else {
        setFailure(result.message);
      }
    });
  };

  return (
    <section className={`flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 ${embedded ? 'col-span-full' : ''}`}>
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">수정하기</h2>
        <p className="text-sm text-secondary">{INPUT_EDIT_REPLACED_NOTE}</p>
      </header>

      {!editableName && (
        <div className="rounded-lg bg-surface-soft px-3 py-2 text-sm">
          <span className="text-muted">닉네임</span>{' '}
          <strong className="font-medium">{current.name}</strong>
          <p className="mt-0.5 text-xs text-muted">내 이름은 프로필 닉네임으로 표시됩니다.</p>
        </div>
      )}

      <BirthFields value={query} onChange={setQuery} idPrefix="edit-input" showName={editableName} />

      {/*
        무엇이 일어날지 누르기 전에 말한다. 이름은 여덟 글자를 바꾸지 않으므로
        판본이 되지 않는데, 그걸 안 말해 주면 「고쳤는데 판본이 안 늘었다」로 보인다.
      */}
      {pillarsSame && (
        <p className="text-xs text-muted">
          {nameChanged
            ? '이름만 바뀌었습니다. 부르는 이름은 여덟 글자를 바꾸지 않으므로 저장된 출생 정보는 그대로입니다.'
            : '바뀐 것이 없습니다.'}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          /* 여덟 글자가 바뀌는 누름만 묻는다 — 이름만 고치는 것은 요청을 안 건드린다 */
          onClick={confirmsRequests && !pillarsSame ? () => setConfirming(true) : save}
          disabled={missing !== null || saving || (pillarsSame && !nameChanged)}
          className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-60 sm:h-10"
        >
          {saving ? '저장하는 중…' : pillarsSame ? '이름 저장' : '변경 사항 저장'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="text-sm text-secondary underline underline-offset-2"
        >
          그만두기
        </button>
        {missing !== null && <span className="text-xs text-muted">{missing}</span>}
      </div>

      {failure !== null && <p className="text-sm text-muted">저장하지 못했습니다 — {failure}</p>}

      {confirming && (
        <EditInputConfirm personId={personId} onConfirm={save} onCancel={() => setConfirming(false)} />
      )}
    </section>
  );
}

/**
 * 내 출생 정보를 바꾸기 직전의 확인 — **경고는 되돌릴 수 없는 누름 직전에 선다**(ADR 0028).
 *
 * 바꾸면 답을 기다리던 인연 요청이 취소된다. 그 사실을 바꾼 뒤에 소식으로만 알면 사고처럼
 * 읽힌다. 문구는 `INPUT_EDIT_CHANGE_CONFIRM` 한 자리에서 읽는다.
 */
function EditInputConfirm({
  personId,
  onConfirm,
  onCancel,
}: {
  personId: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirming = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (confirming.current !== null && !confirming.current.open) confirming.current.showModal();
  }, []);

  return (
    <dialog
      ref={confirming}
      aria-labelledby={`edit-input-confirm-${personId}`}
      onClose={onCancel}
      className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-2xl border border-border bg-surface p-6 text-foreground shadow-[var(--shadow-float)] backdrop:bg-black/40"
    >
      <h3 id={`edit-input-confirm-${personId}`} className="text-base font-bold">
        {INPUT_EDIT_CHANGE_CONFIRM.title}
      </h3>
      <div className="mt-2 flex flex-col gap-1.5 text-sm leading-6 text-secondary">
        {INPUT_EDIT_CHANGE_CONFIRM.body.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
        <button
          type="button"
          onClick={onConfirm}
          className="h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent shadow-sm sm:h-10"
        >
          {INPUT_EDIT_CHANGE_CONFIRM.confirm}
        </button>
        <button
          type="button"
          onClick={() => confirming.current?.close()}
          className="h-11 rounded-xl border border-border px-5 text-sm text-secondary hover:border-border-strong hover:text-foreground sm:h-10"
        >
          {INPUT_EDIT_CHANGE_CONFIRM.cancel}
        </button>
      </div>
    </dialog>
  );
}
