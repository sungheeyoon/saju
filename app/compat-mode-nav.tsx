import Link from 'next/link';

export function CompatModeNav({ mode }: { mode: 'direct' | 'saved' }) {
  const modes = [
    { key: 'direct', href: '/compat', label: '두 사람 직접 입력', note: '저장하지 않고 바로 보기' },
    { key: 'saved', href: '/me/compat', label: '저장한 사람 선택', note: '저장한 사람 목록에서 고르기' },
  ] as const;

  return (
    <nav aria-label="궁합 입력 방법" className="grid gap-2 rounded-2xl bg-surface-sunken p-1.5 sm:grid-cols-2">
      {modes.map((item) => {
        const active = mode === item.key;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-xl px-4 py-3 ${active ? 'bg-surface shadow-sm' : 'text-secondary hover:bg-surface/60 hover:text-foreground'}`}
          >
            <span className="block text-sm font-bold">{item.label}</span>
            <span className="mt-0.5 block text-xs text-muted">{item.note}</span>
          </Link>
        );
      })}
    </nav>
  );
}
