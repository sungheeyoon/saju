import { haltedText } from '@/src/lib/account';

/**
 * 살아 있지 않은 계정이 화면 대신 보는 것.
 *
 * **문구는 화면이 쓰지 않는다**(`src/lib/account`). 다섯 화면이 저마다 「중지된
 * 계정입니다」를 적고 있었고, 그래서 상태가 하나 늘어나는 순간 다섯 곳 중 하나는
 * 반드시 안 고쳐진다. 판정도 여기 없다 — 무엇이 막히는지는 DB 가 든다.
 */
export function Halted({ status }: { status: string }) {
  const text = haltedText(status);
  if (text === null) return null;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted">{text.title}</p>
      <p className="text-sm text-muted">{text.detail}</p>
    </div>
  );
}
