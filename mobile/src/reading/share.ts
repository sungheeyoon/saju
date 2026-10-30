import { rpcArgs } from '@db';
import { userFacingDbMessage } from '@db-error';
import { sharePath, type ShareKind } from '@reading/share-path';
import { isShareable, shareTargetArgs } from '@reading/target';

import { supabase } from '@/auth/client';

import { readReadingView, type ReadingTarget } from './api';

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL;

/** 링크를 못 냈다 — 까닭을 우리가 못 고를 때 이 단추가 세우는 한 문장 */
const NOT_ISSUED = '공유 링크를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.';

/**
 * 풀이를 공유본으로 내놓고 **주소를 받는다** — 웹의 `app/me/reading/share.ts` 와 같은 차례다. `share_my_reading` 은 그 사람의 토큰으로 바로 부른다.
 *
 * 화면이 든 글을 그대로 안 보낸다 — 문으로 한 번 더 읽어 근거 절을 자른 지금 글을 넘기고, 받은 글이 저장된 원문 안의 글인지는 DB 가 본다.
 * 인연 궁합은 못 내보낸다. 생성이 없어 풀이권은 안 움직인다.
 */
export async function shareMyReading(target: ReadingTarget): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  if (!isShareable(target)) return { ok: false, message: '인연 궁합은 공유 링크를 만들 수 없어요.' };
  if (supabase === null || !SITE_URL) return { ok: false, message: NOT_ISSUED };

  const read = await readReadingView(target);
  if (!read.ok) return { ok: false, message: read.refused.refused === 'unavailable' ? read.refused.message : NOT_ISSUED };
  const reading = read.value.view === 'reading' ? read.value.reading : null;
  if (reading === null) return { ok: false, message: '아직 공유할 풀이가 없어요. 풀이를 먼저 받아 주세요.' };

  const { data, error } = await supabase.rpc(
    'share_my_reading',
    rpcArgs<'share_my_reading'>({ p_body: reading.output, p_metaphor: reading.metaphor, ...shareTargetArgs(target) }),
  );
  if (error !== null) return { ok: false, message: userFacingDbMessage(error, 'share_my_reading', NOT_ISSUED) };
  if (typeof data !== 'string' || data === '') return { ok: false, message: NOT_ISSUED };

  return { ok: true, url: `${SITE_URL}${sharePath(target.kind as ShareKind, data)}` };
}
