import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  READING_KINDS,
  READING_POLICY,
  READING_PROMPTS,
  SELF_QUALITY_CASE_SET,
  blindKeyForAll,
  type QualityCaseId,
  type ReadingKind,
} from '@/src/lib/reading';

import { supabaseOnServer } from '../../../auth/server-client';
import { CARD } from '../../../card';
import { CopyText } from '../copy-text';
import { readingArtifacts, currentReading, lastReadingRun } from '../current';
import type { ReadingTarget } from '../pipeline';
import { qualityCasePreview, selfReadingPreview, type PreviewResult } from '../preview';
import { RubricSheet } from '../rubric';

export const metadata = {
  title: '해석 내부 보기 — 만세력',
  description: '실제로 보낸 프롬프트와 근거, 그리고 마지막 시도의 결과를 봅니다.',
};

/**
 * **내부 테스트 화면.**
 *
 * 9단계는 해석 완성이 아니라 실험 인프라다(PRD). 실험이 되려면 **무엇을 보냈고 무엇이
 * 돌아왔는지**를 볼 수 있어야 하는데, 그 값들은 사용자가 읽는 화면에 서면 안 된다 —
 * 결과 화면에 무엇이 나가는가에 한 문장으로 답할 수 있어야 하기 때문이다(ADR 0008).
 *
 * 그래서 자리를 따로 둔다. 여기서 나오는 것은 **내 대상의 것뿐**이고, 그 자료는 이미
 * 내가 볼 수 있는 범위로 잘려 있다(공유 궁합이면 동의 범위까지). 새로 열리는 것이 없다.
 *
 * 대상은 주소로 고른다 — `?kind=self` · `?kind=private&a=…&b=…` · `?kind=match&m=…`.
 */
export default async function InspectPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; a?: string; b?: string; m?: string; case?: string }>;
}) {
  const supabase = await supabaseOnServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const params = await searchParams;
  const target = targetFrom(params);

  /**
   * **한 번만 짓는다.** 두 칸이 각자 부르면 근거도 기준 시각도 둘이 되고, 그때
   * 「지금 보낼 프롬프트」와 그 아래 변형들은 **서로 다른 자료를 읽는다** — 견주려고
   * 만든 자리가 견줄 수 없는 자리가 된다.
   */
  const preview = await selfReadingPreview();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">해석 내부 보기</h1>
        <p className="max-w-2xl text-sm text-secondary">
          실제로 모델에 보낸 프롬프트와 근거, 마지막 시도의 결과입니다. 사용자 화면에는
          서지 않는 값들입니다. 아래 <strong className="font-medium">지금 보낼 프롬프트</strong>는
          모델을 부르지 않고 지어 본 것이라, 게이트웨이 열쇠가 없어도 복사해서 다른 곳에
          붙여 볼 수 있습니다.
        </p>
        <p className="flex flex-wrap gap-4 text-sm">
          <Link href="/me" className="text-accent underline underline-offset-2">
            내 사주
          </Link>
          <Link href="/me/reading/inspect?kind=self" className="text-accent underline underline-offset-2">
            자기 풀이
          </Link>
        </p>
      </header>

      <section className={`${CARD} flex flex-col gap-2 text-sm`}>
        <h2 className="text-base font-semibold">지금 서 있는 계약</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted">프롬프트 판본</dt>
          <dd>{READING_POLICY.version}</dd>
          <dt className="text-muted">엔진·AI 경계</dt>
          <dd>{READING_POLICY.boundary}</dd>
          <dt className="text-muted">기존 지표</dt>
          <dd>{READING_POLICY.index}</dd>
        </dl>
      </section>

      {target === null ? (
        <p className={`${CARD} text-sm text-secondary`}>
          주소로 대상을 고릅니다 — <code>?kind=self</code> ·{' '}
          <code>?kind=private&amp;a=…&amp;b=…</code> · <code>?kind=match&amp;m=…</code>
        </p>
      ) : (
        <Inspected target={target} />
      )}

      <SelfPreview preview={preview} />

      <ExperimentVariants preview={preview} />

      <QualityCases chosen={qualityCaseFrom(params.case)} />

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">프롬프트 몸통 (자료 없이)</h2>
        <p className="text-sm text-secondary">
          세 kind 가 갈리는 곳은 여기와 자료의 범위 둘뿐입니다. 몸통만 고쳐 볼 때는 이것을
          복사해 자료를 손으로 붙이면 됩니다.
        </p>
        {READING_KINDS.map((kind) => (
          <details key={kind} className={CARD}>
            <summary className="cursor-pointer text-sm font-medium">{kind}</summary>
            <div className="mt-2 flex justify-end">
              <CopyText text={READING_PROMPTS[kind]} label="몸통 복사" />
            </div>
            <Pre text={READING_PROMPTS[kind]} />
          </details>
        ))}
      </section>
    </main>
  );
}

/**
 * **지금 누르면 갈 프롬프트** — 자기 풀이 것.
 *
 * 저장된 artifact 는 성공한 시도가 있어야 나오는데 게이트웨이가 붙기 전에는 그 자리가
 * 비어 있다. 그래서 프롬프트를 고쳐 놓고도 무엇이 나가는지 볼 수가 없었다. 여기서
 * 짓는 것은 모델을 부르지도 시도를 열지도 않는다(`selfReadingPreview`).
 *
 * 자기 풀이만 있는 까닭은 `preview.ts` 가 든다 — 나머지 둘은 판본과 차례를 DB 가
 * 정하고, 그 규칙을 앱이 다시 적으면 미리보기가 「보낼 것」이 아니게 된다.
 */
function SelfPreview({ preview: result }: { preview: PreviewResult }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">지금 보낼 프롬프트 — 자기 풀이</h2>

      {!result.ok ? (
        <p className={`${CARD} text-sm text-secondary`}>{result.message}</p>
      ) : (
        <div className={`${CARD} flex flex-col gap-3`}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span>
                <dt className="inline">판본</dt> <dd className="inline text-foreground">{READING_POLICY.version}</dd>
              </span>
              <span>
                <dt className="inline">전체</dt>{' '}
                <dd className="inline text-foreground">{bytes(result.preview.prompt)} 바이트</dd>
              </span>
              <span>
                <dt className="inline">자료</dt>{' '}
                <dd className="inline text-foreground">{bytes(result.preview.evidence)} 바이트</dd>
              </span>
            </dl>
            <div className="flex gap-2">
              <CopyText text={result.preview.prompt} label="프롬프트 전체 복사" />
              <CopyText text={result.preview.evidence} label="자료만 복사" />
            </div>
          </div>

          {/*
            **기준 시각을 함께 적는다.** 운은 부르는 순간으로 짚으므로 실제 생성은 그때의
            시각으로 자료를 다시 짓는다. 안 적어 두면 여기서 복사한 것과 나중에 저장된
            것이 다를 때 무엇이 달라진 것인지 알 수 없다.
          */}
          <p className="text-xs text-muted">
            이 화면을 연 시각({result.preview.viewedAt})으로 운을 짚었습니다. 실제로 만들 때는
            그때의 시각으로 다시 짓습니다.
          </p>

          <Pre text={result.preview.prompt} />
        </div>
      )}
    </section>
  );
}

/** 자료 크기는 글자 수가 아니라 **UTF-8 바이트**로 잰다 — 모델이 받는 것이 그것이다 */
const bytes = (text: string) => new TextEncoder().encode(text).length;

/**
 * **실험판** — 같은 근거로 지은 형제 넷.
 *
 * 위의 「지금 보낼 프롬프트」는 건드리지 않는다. 토글 하나로 그 자리를 갈아 끼우면
 * 기준판이 무엇이었는지가 화면에서 사라지고, 그러면 견주는 사람이 자기가 무엇과
 * 무엇을 견주는지 잊는다. 카드를 따로 세워 두면 기준이 늘 눈에 남는다.
 *
 * 접어 두는 것은 46KB 짜리 넷을 한 번에 펴면 화면이 자료가 되기 때문이다.
 */
function ExperimentVariants({ preview: result }: { preview: PreviewResult }) {
  if (!result.ok) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">실험용 변형 — 실제 생성에는 쓰지 않습니다</h2>
        <p className="text-sm text-secondary">
          위와 <strong className="font-medium">같은 근거·같은 기준 시각</strong>으로 지었습니다.
          변형은 기준판에서 하나씩만 벗어나고 서로 쌓이지 않습니다 — 쌓으면 이긴 변형이
          무엇 덕에 이겼는지 알 수 없습니다.
        </p>
      </div>

      {result.preview.variants.map((variant) => (
        <details key={variant.id} className={CARD}>
          <summary className="cursor-pointer text-sm font-medium">
            {variant.label}{' '}
            <code className="ml-1 text-xs font-normal text-muted">{variant.id}</code>
          </summary>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs leading-5 text-muted">
              {variant.changes} · {bytes(variant.prompt)} 바이트
            </p>
            <CopyText text={variant.prompt} label="이 변형 복사" />
          </div>
          <Pre text={variant.prompt} />
        </details>
      ))}
    </section>
  );
}

async function Inspected({ target }: { target: ReadingTarget }) {
  const [artifacts, reading, run] = await Promise.all([
    readingArtifacts(target),
    currentReading(target),
    lastReadingRun(target),
  ]);

  return (
    <section className="flex flex-col gap-4">
      <div className={`${CARD} flex flex-col gap-2 text-sm`}>
        <h2 className="text-base font-semibold">{target.kind}</h2>
        {run === null ? (
          <p className="text-secondary">아직 시도한 적이 없습니다.</p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted">마지막 시도</dt>
            <dd>{run.status}</dd>
            {run.failureCode !== null && (
              <>
                <dt className="text-muted">실패 코드</dt>
                <dd>{run.failureCode}</dd>
              </>
            )}
          </dl>
        )}
        {reading !== null && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted">모델</dt>
            <dd>{reading.model}</dd>
            <dt className="text-muted">점수</dt>
            <dd>{reading.score ?? '—'}</dd>
            <dt className="text-muted">기준 시각</dt>
            <dd>{reading.viewedAt}</dd>
          </dl>
        )}
      </div>

      {artifacts === null ? (
        <p className={`${CARD} text-sm text-secondary`}>저장된 결과가 없습니다.</p>
      ) : (
        <>
          <details className={CARD} open>
            <summary className="cursor-pointer text-sm font-medium">
              실제로 보낸 프롬프트 ({artifacts.promptVersion})
            </summary>
            <div className="mt-2 flex justify-end">
              <CopyText text={artifacts.prompt} label="프롬프트 복사" />
            </div>
            <Pre text={artifacts.prompt} />
          </details>
          <details className={CARD}>
            <summary className="cursor-pointer text-sm font-medium">
              보낸 근거 ({bytes(artifacts.evidence)} 바이트)
            </summary>
            <div className="mt-2 flex justify-end">
              <CopyText text={artifacts.evidence} label="자료 복사" />
            </div>
            <Pre text={artifacts.evidence} />
          </details>
          <div className={`${CARD} text-sm`}>
            <h3 className="font-medium">생성 설정</h3>
            <Pre text={JSON.stringify(artifacts.generation, null, 2)} />
          </div>
        </>
      )}
    </section>
  );
}

/** 긴 글은 가로로 흐르게 둔다 — 본문이 아니라 자료라서 줄바꿈을 지어내지 않는다 */
function Pre({ text }: { text: string }) {
  return (
    <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-surface-sunken p-3 text-xs whitespace-pre-wrap break-all">
      {text}
    </pre>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 주소로 들어온 값이라 모양부터 본다 — 틀린 것은 「고르지 않은 것」과 같다 */
function targetFrom(params: {
  kind?: string;
  a?: string;
  b?: string;
  m?: string;
}): ReadingTarget | null {
  const kind = READING_KINDS.find((known): known is ReadingKind => known === params.kind);
  if (kind === undefined) return null;

  if (kind === 'self') return { kind };

  if (kind === 'private') {
    if (!params.a || !params.b || !UUID.test(params.a) || !UUID.test(params.b)) return null;
    return { kind, personA: params.a, personB: params.b };
  }

  if (!params.m || !UUID.test(params.m)) return null;
  return { kind, matchId: params.m };
}

/**
 * **고정 사례 실험** — 저장된 판본이 아니라 못박아 둔 다섯으로 잰다.
 *
 * 내 판본 하나로는 「이 변형이 낫다」가 아니라 「나에게 낫다」만 나온다. 특히 뻔한
 * 문장은 **여러 명식에서 표현이 얼마나 되풀이되는지**를 봐야 드러나므로, 사례가 하나면
 * 원리적으로 못 잰다.
 *
 * 스무 칸(다섯 × 넷)을 한 번에 펴지 않는다. 사례 하나를 고르면 그 사례의 넷만 선다 —
 * 46KB 짜리 스물이면 화면이 자료가 된다.
 */
function QualityCases({ chosen }: { chosen: QualityCaseId | null }) {
  const set = SELF_QUALITY_CASE_SET;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">
          고정 사례 실험 <code className="text-xs font-normal text-muted">{set.version}</code>
        </h2>
        <p className="text-sm text-secondary">
          골든 케이스를 <strong className="font-medium">가리켜</strong> 씁니다 — 입력을 베끼면
          저쪽이 고쳐졌을 때 두 벌이 조용히 갈립니다. 기준 시각은 {set.viewedAt} 으로
          못박혀 있어, 어제 잰 것과 오늘 잰 것을 이어 붙일 수 있습니다.
        </p>
      </div>

      <nav aria-label="고정 사례" className="flex flex-wrap gap-2">
        {set.cases.map((one) => (
          <Link
            key={one.id}
            href={`/me/reading/inspect?kind=self&case=${one.id}`}
            aria-current={chosen === one.id ? 'page' : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
              chosen === one.id
                ? 'border-accent bg-accent-wash text-accent-strong'
                : 'border-border-strong bg-surface hover:border-accent hover:text-accent'
            }`}
          >
            {one.id}
          </Link>
        ))}
      </nav>

      {chosen === null ? (
        <p className={`${CARD} text-sm text-secondary`}>
          사례를 하나 고르면 그 근거로 지은 네 벌이 섭니다.
        </p>
      ) : (
        <ChosenCase caseId={chosen} />
      )}

      <BlindKey />
    </section>
  );
}

function ChosenCase({ caseId }: { caseId: QualityCaseId }) {
  const built = qualityCasePreview(caseId);

  return (
    <div className="flex flex-col gap-3">
      <div className={`${CARD} flex flex-col gap-2 text-sm`}>
        <p className="font-semibold">{built.dimension}</p>
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>
            <dt className="inline">골든</dt> <dd className="inline text-foreground">{built.golden}</dd>
          </span>
          <span>
            <dt className="inline">자료</dt>{' '}
            <dd className="inline text-foreground">
              {built.evidenceBytes} 바이트 · {built.evidenceDigest}
            </dd>
          </span>
        </dl>
      </div>

      {built.prompts.map((one) => (
        <details key={one.blind} className={CARD}>
          <summary className="cursor-pointer text-sm font-medium">
            {one.blind}{' '}
            <code className="ml-1 text-xs font-normal text-muted">{one.promptDigest}</code>
          </summary>
          <div className="mt-2 flex justify-end">
            <CopyText text={one.prompt} label="이 프롬프트 복사" />
          </div>
          <Pre text={one.prompt} />
        </details>
      ))}

      <div className={CARD}>
        {/*
          **짝을 넘기지 않는다.** 채점표가 `variant` 를 알면 언젠가 그것이 파일로 새고,
          첫 사례를 끝내는 순간 남은 넷의 블라인드가 깨진다. 짝은 아래 「짝 공개」가 든다.
        */}
        <RubricSheet
          caseId={built.caseId}
          setVersion={built.setVersion}
          viewedAt={built.viewedAt}
          evidenceDigest={built.evidenceDigest}
          promptVersion={READING_POLICY.version}
          rows={built.prompts.map(({ blind, promptDigest }) => ({ blind, promptDigest }))}
        />
      </div>
    </div>
  );
}

/**
 * **짝 공개** — 다섯 사례를 다 채점한 뒤에만 편다.
 *
 * 접어 두는 것으로 족하다. 여기서 지키려는 것은 남이 못 보게 하는 것이 아니라
 * **내가 채점하다 눈에 걸리지 않게** 하는 것이다. 사례별 기록에 짝이 없는 것이
 * 진짜 방어이고(`RubricSheet`), 이 칸은 마지막에 한 번 여는 자리다.
 */
function BlindKey() {
  const pairs = blindKeyForAll();

  return (
    <details className={CARD}>
      <summary className="cursor-pointer text-sm font-medium">
        짝 공개 — 다섯 사례를 다 채점한 뒤에 여세요
      </summary>
      <p className="mt-2 text-xs leading-5 text-muted">
        채점 중에 이것을 보면 재는 것이 글이 아니라 기대가 됩니다. 사례별 기록에는 짝이
        들어 있지 않으니, 백업을 먼저 다 모으고 마지막에 여기서 맞춰 보세요.
      </p>
      <Pre text={pairs.map((one) => `${one.blind}\t${one.variant}`).join('\n')} />
      <div className="mt-2 flex justify-end">
        <CopyText
          text={JSON.stringify({ setVersion: SELF_QUALITY_CASE_SET.version, pairs }, null, 2)}
          label="짝 복사 (JSON)"
        />
      </div>
    </details>
  );
}

/** 주소로 들어온 값이라 모양부터 본다 — 틀린 것은 「고르지 않은 것」과 같다 */
function qualityCaseFrom(value: string | undefined): QualityCaseId | null {
  const found = SELF_QUALITY_CASE_SET.cases.find((one) => one.id === value);
  return found?.id ?? null;
}
