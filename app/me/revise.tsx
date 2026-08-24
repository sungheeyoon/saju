'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { BirthFields } from '../birth-form';
import { missingAnswer, type Query } from '../query';
import { samePillarInput } from '../revision';
import { reviseSelfPerson } from './actions';

/**
 * 저장된 출생정보를 고치는 자리.
 *
 * 접어 둔다. 이 화면의 주된 일은 저장된 사주를 보는 것이고, 고치는 것은 가끔이다.
 * 폼을 늘 펼쳐 두면 「지금 보고 있는 것」과 「고치는 중인 것」이 한 화면에서 섞인다.
 *
 * 여기서도 익명 화면과 **같은 폼**을 쓴다.
 */
export function ReviseChart({ personId, current }: { personId: string; current: Query }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(current);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const missing = missingAnswer(query);
  const nameChanged = query.name.trim() !== current.name.trim();
  const pillarsSame = samePillarInput(current, query);

  const save = () => {
    setFailure(null);
    startSaving(async () => {
      const result = await reviseSelfPerson(personId, query);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setFailure(result.message);
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setQuery(current);
          setOpen(true);
        }}
        className="self-start text-sm text-accent underline underline-offset-2"
      >
        생년월일시 고치기
      </button>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">고치기</h2>
        <p className="text-sm text-secondary">
          지금 판본은 지워지지 않습니다. 고친 것이 새 판본으로 쌓이고, 이 화면은 새것을
          보여줍니다.
        </p>
      </header>

      <BirthFields value={query} onChange={setQuery} idPrefix="revise" />

      {/*
        무엇이 일어날지 누르기 전에 말한다. 이름은 여덟 글자를 바꾸지 않으므로
        판본이 되지 않는데, 그걸 안 말해 주면 「고쳤는데 판본이 안 늘었다」로 보인다.
      */}
      {pillarsSame && (
        <p className="text-xs text-muted">
          {nameChanged
            ? '이름만 바뀌었습니다. 부르는 이름은 여덟 글자를 바꾸지 않으므로 판본은 새로 생기지 않습니다.'
            : '바뀐 것이 없습니다.'}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={missing !== null || saving || (pillarsSame && !nameChanged)}
          className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-60 sm:h-10"
        >
          {saving ? '저장하는 중…' : pillarsSame ? '이름 저장' : '새 판본으로 저장'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={saving}
          className="text-sm text-secondary underline underline-offset-2"
        >
          그만두기
        </button>
        {missing !== null && <span className="text-xs text-muted">{missing}</span>}
      </div>

      {failure !== null && <p className="text-sm text-muted">저장하지 못했습니다 — {failure}</p>}
    </section>
  );
}
