import {
  Fold,
  SectionTitle,
} from './fold';
import {
  TIME_BASIS,
} from '@/src/lib/input/query';
import {
  type Saju,
} from '@/src/lib/saju';
import {
  appliedBasisOf,
  clockLine,
  signedMinutes,
} from '@/src/lib/saju/view';
import { HOUR_UNKNOWN_CORRECTION_NOTE } from '@/src/lib/saju/view/notes';
import { CARD_FACE } from '../ui/surfaces';



export function TimeCorrections({ saju }: { saju: Saju }) {
  const { meta, pillars } = saju;
  const civil = pillars.meta.civilTime;

  const basis = appliedBasisOf(saju);

  return (
    <Fold
      id="corrections"
      title={
        <>
          적용된 보정
          <span className="ml-2 text-secondary">{TIME_BASIS[basis].label}</span>
        </>
      }
    >

      {meta.inputTime.hour === null ? (
        <p className="mb-3 text-sm text-secondary">
          {HOUR_UNKNOWN_CORRECTION_NOTE}
        </p>
      ) : (
        <p className="mb-3 text-sm">
          <span className="tabular-nums">
            {clockLine(meta.inputTime.hour, meta.inputTime.minute)}
          </span>
          <span className="mx-2 text-muted">→</span>
          <span className="tabular-nums font-medium">
            {clockLine(civil.hour, civil.minute)}
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
    </Fold>
  );
}


export function Warnings({ saju }: { saju: Saju }) {
  if (saju.meta.warnings.length === 0) return null;

  return (
    <section className={`${CARD_FACE} border-warning/25 bg-warning-wash p-5 sm:p-6`}>
      <SectionTitle>경계 주의</SectionTitle>
      <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-sm text-secondary">
        {saju.meta.warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </section>
  );
}

