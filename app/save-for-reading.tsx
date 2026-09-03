'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type ReactNode } from 'react';

import { noRoomToSave, type PersonSlots, type Relation } from '@/src/lib/people';

import { supabaseInBrowser } from './auth/browser-client';
import { CARD } from './card';
import { savePersonForReading } from './me/actions';
import { savePairForReading, type PairAnswers } from './me/compat/actions';
import { personSlotsFrom } from './person-slots';
import type { Query } from './query';
import { RelationChoice } from './relation-choice';
import { SameChartAsk, type SaveOutcome, type SameChartQuestion } from './same-chart-ask';

/**
 * 직접 입력한 사람으로 **풀이까지 가는 길** — 사주 한 장과 궁합 둘이 같은 칸을 쓴다.
 *
 * ## 이 화면들에는 왜 AI 가 없었나
 *
 * 시도도 잠금도 풀이권도 **대상**에 건다(ADR 0013). `/` 와 `/compat` 은 아무것도 저장하지
 * 않고 브라우저에서 계산하므로(ADR 0007) 걸 대상이 없었다. 궁합 쪽에 「두 분은 무슨
 * 사이인가요」가 없던 것도 그 사실의 그림자다 — 읽어 갈 프롬프트가 없는 자리에서 라디오는
 * **아무것도 바꾸지 않는 칸**이라, 한 번 세웠다가 걷어 낸 적이 있다.
 *
 * ## 두 입구가 한 파일에 산다
 *
 * 저장 하나냐 둘이냐만 다르고 **나머지가 같다** — 무엇이 목록에 남는지 미리 적는 것,
 * 자리가 없을 때 버튼 대신 할 일을 세우는 것, 실패를 그 자리에서 말하는 것. 갈라 두면
 * 한쪽만 고쳐지고, 그때 조용히 실패하는 쪽이 남는다.
 *
 * ## 저장이 곧 풀이는 아니다
 *
 * 눌러도 글이 나오지 않는다. 저장하고 **그 사람의 화면으로 데려다줄 뿐**이고, 풀이권을
 * 쓰는 누름은 거기서 사용자가 한다. 되돌릴 수 없는 누름을 대신 눌러 주지 않는다
 * (ADR 0028). 그래서 버튼도 「풀이 받기」가 아니라 **어디로 가는지**를 적는다.
 *
 * ## 도착지가 부르는 이름을 그대로 쓴다
 *
 * 처음에는 이 칸의 제목이 「AI 풀이로 이어 보기」였다. 앱 어디에도 없는 **세 번째
 * 이름**이었다 — 화면이 부르는 말은 한 사람짜리 「사주풀이」와 두 사람짜리 「궁합 풀이」
 * 둘뿐이다. 그래서 제목과 버튼이 서로 다른 것을 가리키고 있었다: 「AI 풀이로 이어
 * 보기」라고 해 놓고 버튼은 「궁합 풀이로 가기」였다.
 *
 * **이름은 부르는 쪽이 짓지 않는다**(ADR 0026·0027). 이 다리가 데려다주는 화면이
 * 그것을 뭐라고 부르는지가 답이고, 제목·설명·버튼이 그 한 낱말을 함께 쓴다.
 */

/**
 * 로그인했는가와 자리가 몇 남았는가 — **둘 다 브라우저에서 묻는다.**
 *
 * `/` 는 공개 화면이고 빌드 때 미리 그려진다. 서버에서 읽으면 세션도 없는 방문마다
 * Supabase 를 두드리게 된다 — 헤더가 잔액을 브라우저에서 읽는 것과 같은 까닭이다.
 *
 * **세션을 따로 묻는 것이 요점이다.** 로그인하지 않은 사람에게 `my_person_slots` 는
 * 그냥 실패하는데, 그 실패를 「못 읽었다」와 한 값으로 묶으면 **로그인도 안 한 사람에게
 * 저장 버튼이 서고 눌러야 거절을 만난다.** 못 읽은 것과 로그인 안 한 것은 다른 사실이고,
 * 화면이 할 말도 다르다.
 */
type SaveContext =
  /** 아직 모른다 — 아무것도 안 그린다. 깜빡이는 것보다 늦게 서는 편이 낫다 */
  | { state: 'unknown' }
  | { state: 'out' }
  /** `slots` 가 `null` 이면 못 읽은 것이다 — 그때는 막지 않는다 */
  | { state: 'in'; slots: PersonSlots | null };

function useSaveContext(): SaveContext {
  const [context, setContext] = useState<SaveContext>({ state: 'unknown' });

  useEffect(() => {
    let alive = true;

    void (async () => {
      const { data } = await supabaseInBrowser().auth.getSession();
      if (!alive) return;
      if (data.session === null) {
        setContext({ state: 'out' });
        return;
      }

      const read = await supabaseInBrowser().rpc('my_person_slots');
      if (alive) setContext({ state: 'in', slots: personSlotsFrom(read.data, read.error) });
    })();

    return () => {
      alive = false;
    };
  }, []);

  return context;
}

function SaveCard({
  needed,
  /** 도착지가 그 글을 부르는 말 — 「사주풀이」이거나 「궁합 풀이」다 */
  reading,
  saveWhat,
  ask,
  label,
  note,
  onSave,
}: {
  /** 이 입구가 저장하려는 사람 수 — 자리가 모자란지는 이 수가 정한다 */
  needed: number;
  reading: string;
  /** 무엇을 저장하는가 — 「이 사람」·「두 사람」 */
  saveWhat: string;
  /** 저장하면서 함께 적을 것 — 궁합만 쓴다 */
  ask?: ReactNode;
  label: string;
  note: ReactNode;
  onSave: () => Promise<SaveOutcome>;
}) {
  const context = useSaveContext();
  const [failure, setFailure] = useState<string | null>(null);
  /**
   * 물어야 할 것이 있으면 여기 선다 — **물음이 서 있는 동안 저장 버튼은 자리를 비운다.**
   * 둘을 함께 세우면 사용자가 답하지 않고 다시 누를 수 있고, 그러면 같은 물음이 또 온다.
   */
  const [question, setQuestion] = useState<SameChartQuestion | null>(null);
  const [saving, startSaving] = useTransition();

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
    startSaving(async () => settle(await onSave()));
  };

  const answer = (sameperson: boolean) => {
    if (question === null) return;
    setFailure(null);
    startSaving(async () => settle(await question.answer(sameperson)));
  };

  /** 아직 모르는 동안은 자리를 비운다 — 버튼을 세웠다 지우면 화면이 흔들린다 */
  if (context.state === 'unknown') return null;

  if (context.state === 'out') {
    return (
      <section className={`${CARD} flex flex-col gap-2`}>
        <h2 className="text-base font-semibold">{reading}로 이어 보기</h2>
        <p className="text-sm leading-6 text-secondary">
          저장은 로그인한 뒤에 할 수 있습니다. 로그인하면 여기서 저장하고 바로 {reading}를
          만들 수 있어요.
        </p>
        <Link
          href="/auth"
          className="self-start text-sm font-medium text-accent underline underline-offset-2"
        >
          로그인하기 →
        </Link>
      </section>
    );
  }

  const { slots } = context;
  const noRoom = noRoomToSave(needed, slots);

  return (
    <section className={`${CARD} flex flex-col gap-4`}>
      <div>
        <h2 className="text-base font-semibold">{reading}로 이어 보기</h2>
        <p className="mt-1.5 text-sm leading-6 text-secondary">
          이 화면은 입력을 저장하지 않아서 여기서는 {reading}를 만들 수 없습니다.{' '}
          {saveWhat}을 저장하면 {reading}를 만들 수 있고, 다음에 다시 찾아볼 수도 있습니다.
        </p>
      </div>

      {ask}

      {question !== null ? (
        /*
          **물음이 서면 저장 버튼은 내려간다.** 둘을 함께 세우면 답하지 않고 다시 누를 수
          있고, 그러면 같은 물음이 또 온다 — 그때 사용자는 자기 답이 안 먹혔다고 읽는다.
        */
        <SameChartAsk question={question} busy={saving} onAnswer={answer} />
      ) : noRoom !== null ? (
        /*
          **버튼 자리에 무엇을 해야 하는지가 선다.** 잠긴 버튼만 두면 왜 안 눌리는지
          찾아야 하고, 그냥 눌리게 두면 눌러도 아무 일이 안 일어난다 — 한 문으로
          저장하므로 통째로 되돌아가기 때문이다.
        */
        <div className="flex flex-col gap-2 rounded-xl bg-surface-sunken px-4 py-3">
          <p className="text-sm leading-6">{noRoom}</p>
          <Link
            href="/me/people"
            className="self-start text-sm font-medium text-accent underline underline-offset-2"
          >
            사람 탭에서 자리 비우기 →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="h-11 w-full rounded-md bg-accent-strong px-5 text-sm font-medium text-on-accent transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-auto sm:self-start"
          >
            {saving ? '저장하는 중…' : label}
          </button>

          {/*
            **무엇이 일어나는지 누르기 전에 적는다.** 지우는 길은 사람 탭에 있다. 누르고
            나서 알게 되면 그 목록은 사용자가 만든 것이 아니라 화면이 만든 것이 된다.
          */}
          <p className="text-xs leading-5 text-muted">
            {note}
            {slots !== null && ` 앞으로 ${slots.remaining}명 더 저장할 수 있습니다.`} 목록에서
            빼는 것은 사람 탭에서 할 수 있습니다.
          </p>
        </div>
      )}

      {failure !== null && (
        <p role="alert" className="text-sm leading-6 text-danger">
          저장하지 못했습니다. {failure}
        </p>
      )}
    </section>
  );
}

const called = (name: string, fallback: string) => name.trim() || fallback;

/**
 * 두 사람 — **묻는 것과 저장하는 것이 한 누름이다.**
 *
 * 사이를 따로 저장하게 두면 골라 놓고 나가 버린 사람의 답이 사라지고, 그때 사용자는
 * 자기가 고른 것이 무슨 소용이었는지 알 수 없다(`PairPicker` 와 같은 규율).
 *
 * **안 고르는 것도 답이다.** 필수로 두면 모르는 사람이 아무거나 고르고, 그러면 틀린
 * 값이 「모른다」보다 나쁜 자리에 앉는다. 안 고른 채로 저장되면 궁합 3번 절이 중립
 * 물음으로 나간다 — 그것이 맞는 동작이다(`MEETING_SECTION`).
 */
export function SaveForReading({ a, b }: { a: Query; b: Query }) {
  const router = useRouter();
  const [relation, setRelation] = useState<Relation | null>(null);

  /**
   * **두 번 물을 수 있다.** 둘 다 이미 저장돼 있으면 한쪽씩 답한다.
   *
   * 답한 쪽은 `answered` 에 남아 다시 안 묻는다 — `null` 이 「아니라고 답했다」이고
   * 없는 것이 「아직 안 물었다」다. 그 둘을 한 값으로 합치면 「아니다」라고 답한 사람이
   * 같은 물음을 영영 다시 받는다.
   */
  const savePair = async (answered: PairAnswers): Promise<SaveOutcome> => {
    const saved = await savePairForReading(a, b, relation, answered);
    if (saved.ok) {
      router.push(`/me/compat?a=${saved.personA}&b=${saved.personB}`);
      return { done: true };
    }
    if (saved.kind === 'failed') return { failed: saved.message };

    return {
      ask: {
        label: saved.same.label,
        answer: (sameperson) =>
          savePair({ ...answered, [saved.side]: sameperson ? saved.same.personId : null }),
      },
    };
  };

  return (
    <SaveCard
      needed={2}
      reading="궁합 풀이"
      saveWhat="두 사람"
      ask={
        <RelationChoice
          value={relation}
          onChange={setRelation}
          idPrefix="save-for-reading"
          className="rounded-xl bg-surface-sunken px-4 py-3"
        />
      }
      label="두 사람을 저장하고 궁합 풀이로 가기"
      note={`저장한 사람 목록에 ${called(a.name, '첫 번째 사람')} · ${called(b.name, '두 번째 사람')} 두 분이 추가됩니다.`}
      onSave={() => savePair({})}
    />
  );
}

/**
 * 한 사람 — **사이를 묻지 않는다.** 혼자 보는 풀이에는 물을 상대가 없다.
 *
 * 저장하고 나면 그 사람의 화면으로 간다(`/me/people/{id}`). 거기가 저장한 사람의 풀이가
 * 사는 자리이고, 이 입구가 흘려보내는 것은 정확히 그 흐름(`person`)이다.
 */
export function SavePersonForReading({ query }: { query: Query }) {
  const router = useRouter();

  /**
   * 「맞다」면 **아무것도 저장하지 않고** 그 사람에게 간다. 자리도 안 쓰고 대상도 안 는다 —
   * 그것이 이 물음이 있는 이유다.
   */
  const savePerson = async (evenIfSameChart: boolean): Promise<SaveOutcome> => {
    const saved = await savePersonForReading(query, evenIfSameChart);
    if (saved.ok) {
      router.push(`/me/people/${saved.personId}`);
      return { done: true };
    }
    if (saved.kind === 'failed') return { failed: saved.message };

    const { same } = saved;
    return {
      ask: {
        label: same.label,
        answer: async (sameperson) => {
          if (!sameperson) return savePerson(true);
          router.push(same.isSelf ? '/me' : `/me/people/${same.personId}`);
          return { done: true };
        },
      },
    };
  };

  return (
    <SaveCard
      needed={1}
      reading="사주풀이"
      saveWhat="이 사람"
      label="이 사람을 저장하고 사주풀이로 가기"
      note={`저장한 사람 목록에 ${called(query.name, '이 사람')}이(가) 추가됩니다.`}
      onSave={() => savePerson(false)}
    />
  );
}
