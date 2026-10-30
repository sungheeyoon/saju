import { accountStateOf, type AccountState, type Suspension } from '@account/index';
import { preferGenderOf, type PreferGender } from '@discovery';
import { userFacingDbMessage } from '@db-error';

import { supabase } from '@/auth/client';
import { NOT_READY } from '@/auth/signup';

export type Answer = { ok: true } | { ok: false; message: string };

/** 정지의 닉네임 · 갈래 — 부속 정보다. 못 읽으면 그 구를 뺀 문장이 선다(웹 `app/me/account.ts`) */
async function readSuspension(): Promise<Suspension | null> {
  if (supabase === null) return null;
  const { data, error } = await supabase.rpc('my_suspension');
  if (error !== null) return null;
  const found = data?.[0];
  return found === undefined ? null : { nickname: found.nickname, reason: found.reason };
}

/** 정책이 자기 행만 내주므로 `where` 를 안 적는다. 어디에 서 있는지는 웹과 같은 `accountStateOf` 가 답한다 */
export async function readAccount<T extends { status: string; self_person_id?: string | null }>(columns: string): Promise<{ state: AccountState; row: T | null }> {
  if (supabase === null) return { state: accountStateOf({ ok: false, reason: 'unreachable' }), row: null };
  const { data, error } = await supabase.from('app_user').select(columns).maybeSingle();
  if (error !== null) {
    console.error('app_user', error.code);
    return { state: accountStateOf({ ok: false, reason: 'unreachable' }), row: null };
  }
  if (data === null) return { state: accountStateOf({ ok: false, reason: 'missing' }), row: null };
  const row = data as unknown as T;
  return {
    state: accountStateOf({
      ok: true,
      account: {
        status: row.status,
        selfPersonId: 'self_person_id' in row ? row.self_person_id : undefined,
        suspension: row.status === 'suspended' ? await readSuspension() : undefined,
      },
    }),
    row,
  };
}

export type SettingsAccount = {
  status: string;
  nickname: string | null;
  improvement_consent: boolean | null;
  contact_consent: boolean | null;
  notice_version: string | null;
  notice_ack_at: string | null;
};

/** 못 읽은 칸은 값으로 말한다 — 기본값으로 메우면 끈 사람에게 「켜져 있다」고 말한다(ADR 0078) */
export type DiscoveryRead = { ok: true; optedOut: boolean; preferGender: PreferGender } | { ok: false; reason: string };

export type SettingsData = {
  state: AccountState;
  account: SettingsAccount | null;
  discovery: DiscoveryRead;
  email: string | undefined;
  userId: string | null;
};

export async function readSettings(): Promise<SettingsData> {
  const unread = { ok: false as const, reason: NOT_READY };
  if (supabase === null) {
    return { state: accountStateOf({ ok: false, reason: 'unreachable' }), account: null, discovery: unread, email: undefined, userId: null };
  }
  const [{ state, row }, profile, session] = await Promise.all([
    readAccount<SettingsAccount>('status, nickname, improvement_consent, contact_consent, notice_version, notice_ack_at'),
    supabase.from('discovery_profile').select('prefer_gender, opted_out_at').maybeSingle(),
    supabase.auth.getSession(),
  ]);
  const user = session.data.session?.user;
  return {
    state,
    account: row,
    discovery:
      profile.error !== null
        ? { ok: false, reason: userFacingDbMessage(profile.error, 'discovery_profile') }
        : {
            ok: true,
            optedOut: profile.data?.opted_out_at != null,
            preferGender: profile.data === null ? 'any' : preferGenderOf(profile.data.prefer_gender),
          },
    email: user?.email,
    userId: user?.id ?? null,
  };
}

/** 끄는 쪽의 지움은 DB 가 같은 트랜잭션에서 한다(ADR 0022). 문을 나눠 부른다 — 웹의 `setOptionalConsent` */
export async function setOptionalConsent(key: 'improvement' | 'contact', consent: boolean): Promise<Answer> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  const { error } = await supabase.rpc(key === 'improvement' ? 'set_improvement_consent' : 'set_contact_consent', { p_consent: consent });
  return error !== null ? { ok: false, message: userFacingDbMessage(error, 'set_optional_consent') } : { ok: true };
}

/** 정책이 열어 준 칸이다. 처음인지 먼저 묻는다 — 못 읽은 것은 「처음이다」가 아니다(웹의 `savePreferGender`) */
export async function savePreferGender(value: PreferGender): Promise<Answer> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  const { data: existing, error: readError } = await supabase.from('discovery_profile').select('user_id').maybeSingle();
  if (readError !== null) return { ok: false, message: userFacingDbMessage(readError, 'discovery_profile.select') };
  const { error } = existing
    ? await supabase.from('discovery_profile').update({ prefer_gender: value }).eq('user_id', existing.user_id)
    : await supabase.from('discovery_profile').insert({ prefer_gender: value });
  return error !== null ? { ok: false, message: userFacingDbMessage(error, 'discovery_profile.upsert') } : { ok: true };
}

export async function requestAccountDeletion(): Promise<Answer> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  const { error } = await supabase.rpc('request_account_deletion');
  return error !== null ? { ok: false, message: userFacingDbMessage(error, 'request_account_deletion') } : { ok: true };
}
