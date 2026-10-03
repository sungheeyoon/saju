'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { BirthFields } from '../birth-form';
import { BUTTON_PRIMARY } from '../ui/buttons';
import { Icon } from '../ui/icons';
import { ElementSymbol } from '../ui/element-symbol';
import { PAPER, TYPE_TITLE } from '../ui/surfaces';
import { ELEMENTS } from '@/src/lib/saju';
import { DEFAULT_QUERY, missingAnswer, type Query } from '@/src/lib/input/query';
import { saveSelfPerson } from './actions';

/**
 * 자기 사주를 한 번 등록하는 화면.
 *
 * 익명 화면과 **같은 폼**을 쓴다(`BirthFields`). 저장하는 화면이라고 다른 폼을 두면
 * 한쪽만 고쳐져서 「같은 값을 넣었는데 다른 사주가 나오는」 상태가 생긴다.
 *
 * 여기서는 계산해 보여주지 않는다. 저장하면 그 자리에서 저장된 것으로 다시 그리므로,
 * 미리 계산해 보여주면 **저장된 것이 아닌 사주**를 저장된 것처럼 보여주게 된다.
 *
 * 홈에서 할 일이 이것 하나인 때라 크림 종이 판 하나에 주 단추 하나만 선다(부드러움 5차). 다섯 상징은
 * 장식이다 — 저장하면 그 자리에 내 일간의 색이 선다.
 */
export function Onboarding({ nickname }: { nickname: string }) {
  const router = useRouter();
  const [query, setQuery] = useState<Query>({ ...DEFAULT_QUERY, name: nickname });
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const missing = missingAnswer(query);

  const save = () => {
    setFailure(null);
    startSaving(async () => {
      const result = await saveSelfPerson(query);
      if (result.ok) router.refresh();
      else setFailure(result.message);
    });
  };

  return (
    <section className={`${PAPER} flex flex-col gap-6`}>
      <span aria-hidden="true" className="flex gap-2">
        {ELEMENTS.map((element) => (
          <ElementSymbol key={element} element={element} className="size-10 rounded-full bg-[var(--tile)] p-2 sm:size-12" />
        ))}
      </span>
      {/*
        **이미 한 걸음 왔다는 것을 보인다**(그로스 시안, 2026-10-03). 가입을 마친 사람이 빈 폼만 보면 처음부터 다시
        시작하는 느낌이다 — 지나온 걸음에 표를 달고, 이 폼이 마지막에서 두 번째라는 것을 세운다. 걸음은 코드의 차례
        그대로다: 가입 → 내 사주 저장 → 홈의 내 사주 카드에서 사주풀이 받기.
      */}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold" aria-label="시작하는 차례">
        {ONBOARDING_STEPS.map((step, index) => (
          <li key={step} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden="true" className="h-px w-4 bg-border-strong" />}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${
                index === 0 ? 'bg-surface text-secondary' : index === 1 ? 'bg-accent text-on-accent' : 'text-secondary'
              }`}
              aria-current={index === 1 ? 'step' : undefined}
            >
              {index === 0 && <Icon name="check" className="size-3.5" />}
              {step}
            </span>
          </li>
        ))}
      </ol>
      <header className="flex flex-col gap-2">
        <h2 className={TYPE_TITLE}>내 사주 등록</h2>
        <p className="max-w-prose text-[15px] leading-6 text-secondary">
          <strong className="font-semibold text-foreground">{nickname}</strong> 님의 출생 정보를 입력해 주세요.
          나중에 언제든 고칠 수 있어요. 고치면 그때부터 새 정보로 계산해요.
        </p>
        <p className="max-w-prose text-[15px] leading-6 text-foreground">저장하면 바로 홈에 내 사주 카드가 서고, 거기서 사주풀이를 받을 수 있어요.</p>
      </header>

      <BirthFields value={query} onChange={setQuery} showName={false} />

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={missing !== null || saving} className={BUTTON_PRIMARY}>
          {saving ? '저장하는 중…' : '내 사주로 저장'}
        </button>
        {/* 버튼을 잠근 이유를 그대로 말한다 — 잠긴 버튼만 있으면 왜인지 알 수 없다 */}
        {missing !== null && <span className="text-[13px] text-secondary">{missing}</span>}
      </div>

      {failure !== null && <p role="alert" className="text-sm text-danger">저장하지 못했어요. {failure}</p>}
    </section>
  );
}

/** 처음 쓰는 사람이 걷는 차례 — 가입은 이미 지났고 지금은 둘째다 */
const ONBOARDING_STEPS = ['가입', '내 사주 저장', '사주풀이 받기'] as const;
