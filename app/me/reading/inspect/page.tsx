import Link from 'next/link';
import { redirect } from 'next/navigation';

import { READING_KINDS, READING_POLICY, READING_PROMPTS, type ReadingKind } from '@/src/lib/reading';

import { supabaseOnServer } from '../../../auth/server-client';
import { CARD } from '../../../card';
import { readingArtifacts, currentReading, lastReadingRun } from '../current';
import type { ReadingTarget } from '../pipeline';

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
  searchParams: Promise<{ kind?: string; a?: string; b?: string; m?: string }>;
}) {
  const supabase = await supabaseOnServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const params = await searchParams;
  const target = targetFrom(params);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">해석 내부 보기</h1>
        <p className="max-w-2xl text-sm text-secondary">
          실제로 모델에 보낸 프롬프트와 근거, 마지막 시도의 결과입니다. 사용자 화면에는
          서지 않는 값들입니다.
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

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">프롬프트 몸통 (자료 없이)</h2>
        {READING_KINDS.map((kind) => (
          <details key={kind} className={CARD}>
            <summary className="cursor-pointer text-sm font-medium">{kind}</summary>
            <Pre text={READING_PROMPTS[kind]} />
          </details>
        ))}
      </section>
    </main>
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
            <Pre text={artifacts.prompt} />
          </details>
          <details className={CARD}>
            <summary className="cursor-pointer text-sm font-medium">
              보낸 근거 ({new TextEncoder().encode(artifacts.evidence).length} 바이트)
            </summary>
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
