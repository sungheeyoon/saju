'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

import { BirthFields, focusMissingField } from '../birth-form';
import { BUTTON_PRIMARY } from '../ui/buttons';
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

  /**
   * **눌러 본 적이 있는가** — 첫 화면 계산기와 같은 규율이다(`saju-calculator.tsx` 의 `tried`). 잠근 단추 옆에 「생년월일을
   * 입력해 주세요.」가 늘 서 있었다 — 아직 아무것도 안 한 사람에게 하는 말이었고, 잠긴 단추는 초점도 안 받았다. 이제
   * 누르게 두고, 막히면 그 까닭을 단추 곁에 세우고 고칠 칸으로 초점을 옮긴다.
   */
  const [tried, setTried] = useState(false);
  const form = useRef<HTMLElement>(null);

  const save = () => {
    if (missing !== null) {
      setTried(true);
      focusMissingField(form.current, query);
      return;
    }
    setFailure(null);
    startSaving(async () => {
      const result = await saveSelfPerson(query);
      if (result.ok) router.refresh();
      else setFailure(result.message);
    });
  };

  return (
    <section ref={form} className={`${PAPER} flex flex-col gap-6`}>
      <span aria-hidden="true" className="flex gap-2">
        {ELEMENTS.map((element) => (
          <ElementSymbol key={element} element={element} className="size-10 rounded-full bg-[var(--tile)] p-2 sm:size-12" />
        ))}
      </span>
      <header className="flex flex-col gap-2">
        <h2 className={TYPE_TITLE}>내 사주 등록</h2>
        <p className="max-w-prose text-[15px] leading-6 text-secondary">
          <strong className="font-semibold text-foreground">{nickname}</strong> 님의 출생 정보를 입력해 주세요.
          나중에 언제든 고칠 수 있어요. 고치면 그때부터 새 정보로 계산해요.
        </p>
      </header>

      <BirthFields value={query} onChange={setQuery} showName={false} tried={tried} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          aria-describedby={tried && missing !== null ? 'onboarding-missing' : undefined}
          className={BUTTON_PRIMARY}
        >
          {saving ? '저장하는 중…' : '내 사주로 저장'}
        </button>
        {/* 눌렀는데 못 간 이유를 단추 곁에서 말한다 — 누르기 전에는 이 자리가 비어 있다 */}
        {tried && missing !== null && (
          <p id="onboarding-missing" role="alert" className="text-sm font-medium text-danger">
            {missing}
          </p>
        )}
      </div>

      {failure !== null && <p role="alert" className="text-sm text-danger">저장하지 못했어요. {failure}</p>}
    </section>
  );
}
