import {
  CARD,
} from '../card';
import {
  TIME_BASIS,
} from '../query';
import {
  type Saju,
} from '@/src/lib/saju';
import {
  round1,
} from './shared';



const pad = (n: number) => String(n).padStart(2, '0');

const signedMinutes = (n: number) => `${round1(n) >= 0 ? '+' : ''}${round1(n)}분`;


export function TimeCorrections({ saju }: { saju: Saju }) {
  const { meta, pillars } = saju;
  const civil = pillars.meta.civilTime;

  // 요청한 값이 아니라 실제로 적용된 보정에서 읽는다.
  const applied = new Set(meta.corrections.map((correction) => correction.kind));
  const basis = applied.has('equationOfTime')
    ? 'trueSolar'
    : applied.has('longitude')
      ? 'localMean'
      : 'record';

  return (
    <section id="corrections" className={`${CARD} scroll-mt-20`}>
      <h2 className="text-base font-semibold">
        적용된 보정
        <span className="ml-2 text-secondary normal-case">{TIME_BASIS[basis].label}</span>
      </h2>

      {meta.inputTime.hour === null ? (
        <p className="mt-2 mb-3 text-sm text-secondary">
          출생 시각을 몰라 정오를 기준으로 계산했습니다. 아래는 그 시각에 적용된 보정
          기록일 뿐입니다 — 시주는 뽑지 않았고, 연·월주는 절대 시각으로 판정하며,
          일주는 정오라 이 보정으로는 넘어가지 않습니다.
        </p>
      ) : (
        <p className="mt-2 mb-3 text-sm">
          <span className="tabular-nums">
            {pad(meta.inputTime.hour)}:{pad(meta.inputTime.minute)}
          </span>
          <span className="mx-2 text-muted">→</span>
          <span className="tabular-nums font-medium">
            {pad(civil.hour)}:{pad(civil.minute)}
          </span>
          <span className="ml-2 text-secondary">
            총 {signedMinutes(meta.totalCorrectionMinutes)}
          </span>
        </p>
      )}

      <table className="w-full border-collapse text-sm">
        <tbody>
          {meta.corrections.map((correction) => (
            <tr key={correction.kind} className="border-t border-border">
              <td className="py-1.5 pr-3 whitespace-nowrap">{correction.label}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">
                {correction.minutes === 0 ? (
                  <span className="text-muted">—</span>
                ) : (
                  signedMinutes(correction.minutes)
                )}
              </td>
              <td className="py-1.5 text-secondary">{correction.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}


export function Warnings({ saju }: { saju: Saju }) {
  if (saju.meta.warnings.length === 0) return null;

  return (
    <section className={`${CARD} bg-surface-sunken`}>
      <h2 className="text-base font-semibold">경계 주의</h2>
      <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-sm text-secondary">
        {saju.meta.warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </section>
  );
}

