import {
  PROMPT_VARIANTS,
  ReadingEvidenceError,
  readingEvidenceOf,
  readingPromptOf,
  type PromptVariantId,
} from '@/src/lib/reading';

import { supabaseOnServer } from '../../auth/server-client';
import { chartOf } from '../../chart';
import { UnreadableRevisionError, queryFromRevision, type StoredRevision } from '../../revision';
import { READING_CHART_NAMES } from './pipeline';

/**
 * **지금 보내면 갈 프롬프트** — 모델을 부르지 않고, 시도도 열지 않고.
 *
 * 저장된 artifact(`readingArtifacts`)는 **성공한 시도가 있어야** 나온다. 게이트웨이가
 * 붙기 전에는 그 자리가 영영 비어 있고, 그러면 프롬프트를 고쳐 볼 방법이 없다 —
 * 고쳐 놓고도 무엇이 나가는지 못 본다. 9단계가 만든 것이 「해석」이 아니라 **실험
 * 인프라**라면, 열쇠 없이도 실험의 입력은 손에 쥘 수 있어야 한다.
 *
 * ## 자기 풀이만 짓는다
 *
 * 판본과 차례를 정하는 것은 `reading_scope` 이고, 그 문은 `authenticated` 에게 닫혀
 * 있다(definer 안에서만 열린다). 비공개 궁합은 두 사람을 uuid 로 줄 세우고(`least`·
 * `greatest`) 공유 궁합은 Match 가 차례를 정한다 — 그 규칙을 여기서 다시 적으면
 * **판정하는 자리가 둘이 되고**, 그 둘이 갈리는 날 미리보기는 「보낼 것」이 아니라
 * 「보낼 뻔한 것」이 된다.
 *
 * 자기 풀이에는 그 물음이 없다. 대상은 내 selfPerson 하나이고 차례도 없다. 그래서
 * 여기서 짓는 것은 **정확히** 그때 갈 문자열이다 — 조립도 `readingPromptOf` 한 곳이
 * 하므로 프롬프트 몸통·요약 머리·자료 붙는 자리가 전부 같다.
 *
 * 딱 하나 다른 것은 기준 시각이다. 운은 부르는 순간으로 짚으므로, 실제 생성은 그때의
 * `viewedAt` 으로 다시 짓는다. 그래서 **돌려주는 값에 그 시각을 함께 싣는다.**
 */
export type ReadingPreview = {
  readonly prompt: string;
  readonly evidence: string;
  readonly viewedAt: string;
  /**
   * 손으로 견줄 변형들 — **같은 근거 한 벌에서 난다.**
   *
   * 근거와 기준 시각을 변형마다 새로 지으면 서로 다른 자료를 읽게 되고, 그때 견주는
   * 것은 프롬프트가 아니라 운이 짚힌 시각이다. 한 번 지어 모든 변형이 나눠 쓴다.
   */
  readonly variants: readonly {
    readonly id: PromptVariantId;
    readonly label: string;
    readonly changes: string;
    readonly prompt: string;
  }[];
};

export type PreviewResult =
  | { ok: true; preview: ReadingPreview }
  /** 못 지은 이유 — 「없다」로 뭉개지 않는다. 화면이 그대로 보여준다 */
  | { ok: false; message: string };

export async function selfReadingPreview(): Promise<PreviewResult> {
  const supabase = await supabaseOnServer();

  // 정책이 자기 행만 내주므로 `where` 를 적지 않는다 — `/me` 와 같은 자리, 같은 규율.
  const { data: account } = await supabase
    .from('app_user')
    .select('status, self_person_id')
    .maybeSingle();

  if (!account) return { ok: false, message: '계정을 읽지 못했습니다.' };
  if (account.status !== 'active') return { ok: false, message: '지금은 결과를 만들 수 없는 계정입니다.' };
  if (account.self_person_id === null) return { ok: false, message: '내 사주를 먼저 등록해 주세요.' };

  const { data: person } = await supabase
    .from('person')
    .select('current_revision_id')
    .eq('id', account.self_person_id)
    .maybeSingle();

  if (!person?.current_revision_id) return { ok: false, message: '저장된 입력을 찾지 못했습니다.' };

  const { data: revision } = await supabase
    .from('person_chart_revision')
    .select(
      'id, calendar, original_date, solar_date, birth_time, gender, city, late_night_rule, time_basis',
    )
    .eq('id', person.current_revision_id)
    .maybeSingle();

  if (!revision) return { ok: false, message: '현재 판본을 찾지 못했습니다.' };

  /**
   * 이름 자리에 **파이프라인이 쓰는 말**을 넣는다(`READING_CHART_NAMES`).
   *
   * 실은 이 값은 자료에 닿지 않는다 — `chartOf` 는 `Query` 에서 날짜·시각·성별과
   * 계산 옵션만 뽑아 엔진에 넘기고 이름은 두고 간다. 그래도 같은 것을 쓰는 이유는,
   * 언젠가 이름이 계산에 닿게 되는 날 **미리보기만 조용히 다른 값을 쓰지 않게**
   * 하려는 것이다. 지금 갈려도 아무 일도 안 일어나는 자리가 가장 늦게 발견된다.
   */
  const viewedAt = new Date();
  try {
    const chart = chartOf(queryFromRevision(revision as StoredRevision, READING_CHART_NAMES[0]));
    const evidence = readingEvidenceOf('self', { a: chart }, viewedAt);

    return {
      ok: true,
      preview: {
        // 기준판은 **인자 없이** 부른다 — 실제 파이프라인이 부르는 것과 같은 꼴이어야
        // 「지금 보낼 프롬프트」가 정말 그것이 된다.
        prompt: readingPromptOf(evidence),
        evidence: JSON.stringify(evidence.evidence),
        viewedAt: viewedAt.toISOString(),
        variants: PROMPT_VARIANTS.map(({ id, label, changes, assembly }) => ({
          id,
          label,
          changes,
          prompt: readingPromptOf(evidence, assembly),
        })),
      },
    };
  } catch (failure) {
    if (failure instanceof UnreadableRevisionError) return { ok: false, message: failure.message };
    if (failure instanceof ReadingEvidenceError) return { ok: false, message: failure.message };
    throw failure;
  }
}
