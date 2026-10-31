import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { isBlocked, type AccountState } from '@account/index';
import { rpcArgs } from '@db';
import { userFacingDbMessage } from '@db-error';
import { INTRO_MAX, NICKNAME_AVAILABLE_NOTE, NICKNAME_MAX, NICKNAME_MIN, NICKNAME_TAKEN_NOTE, missingInProfile, missingNickname, nicknameKey, type PhotoUploadMode, type ProfileInput } from '@profile';

import { supabase } from '@/auth/client';
import { NOT_READY, checkNickname } from '@/auth/signup';
import { Field, Panel, PrimaryButton } from '@/ui/parts';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { TopBar } from '@/ui/top-bar';

import { AccountNotice, FailureLine, settingsText, useDoneNote } from './parts';
import { PhotoGrid } from './photo-grid';
import { BirthSection } from './birth-section';
import { myPhotos, photoUploadMode, type MyPhoto } from './photos';
import { readAccount, type Answer } from './settings';

const NICKNAME_CHECK_AFTER_MS = 500;
const READ_FAILED = '계정을 확인하지 못했어요.';

type Loaded = { state: AccountState; current: ProfileInput | null; photos: readonly MyPhoto[]; uploads: PhotoUploadMode; userId: string | null } | { failed: true };

async function saveProfile(profile: ProfileInput): Promise<Answer> {
  const missing = missingInProfile(profile);
  if (missing !== null) return { ok: false, message: missing };
  if (supabase === null) return { ok: false, message: NOT_READY };
  const { error } = await supabase.rpc('save_my_profile', rpcArgs<'save_my_profile'>({ p_nickname: profile.nickname.trim(), p_intro: profile.intro.trim() || null }));
  return error !== null ? { ok: false, message: userFacingDbMessage(error, 'save_my_profile') } : { ok: true };
}

async function load(): Promise<Loaded> {
  const { state, row } = await readAccount<{ status: string; nickname: string | null; intro: string | null }>('status, nickname, intro');
  if (isBlocked(state) || row === null) return { state, current: null, photos: [], uploads: 'paused', userId: null };
  try {
    const [photos, uploads, session] = await Promise.all([myPhotos(), photoUploadMode(), supabase?.auth.getSession()]);
    return { state, current: { nickname: row.nickname ?? '', intro: row.intro ?? '' }, photos, uploads, userId: session?.data.session?.user.id ?? null };
  } catch {
    return { failed: true };
  }
}

/**
 * 프로필 — 웹 `app/me/profile/page.tsx`. 사진은 고르는 순간 저장되고, 닉네임 · 소개는 단추로 저장한다. 사진이 맨 위이고 출생 정보가 맨 아래다.
 */
export function ProfileScreen() {
  const [data, setData] = useState<Loaded | null>(null);
  const [lifting, setLifting] = useState(false);
  const reloadAll = useCallback(async () => setData(await load()), []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 여는 때 읽는다 - setState 는 await 뒤라 렌더와 겹치지 않는다
    void reloadAll();
  }, [reloadAll]);

  const reloadPhotos = useCallback(async () => {
    try {
      const [photos, uploads] = await Promise.all([myPhotos(), photoUploadMode()]);
      setData((was) => (was !== null && !('failed' in was) ? { ...was, photos, uploads } : was));
    } catch {
      /* 못 읽었으면 앞 목록이 그대로 선다 — 다음 쓰기는 DB 가 판본으로 다시 본다 */
    }
  }, []);

  if (data === null) {
    return (
      <View style={styles.screen}>
        <TopBar title="프로필" fallback="/me/settings" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <TopBar title="프로필" fallback="/me/settings" />
      <KeyboardAvoidingView style={styles.screen} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" scrollEnabled={!lifting}>
          <Text style={settingsText.meta}>앱에서 쓸 닉네임과 프로필을 정해요.</Text>

          {'failed' in data ? (
            <FailureLine onRetry={() => void reloadAll()}>{READ_FAILED}</FailureLine>
          ) : data.current === null ? (
            <AccountNotice state={data.state} onRetry={() => void reloadAll()} />
          ) : (
            <>
              <PhotoGrid userId={data.userId} photos={data.photos} uploads={data.uploads} reload={reloadPhotos} onLifting={setLifting} />
              <ProfileForm current={data.current} onSaved={(saved) => setData((was) => (was !== null && !('failed' in was) ? { ...was, current: saved } : was))} />
              <BirthSection />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** 닉네임 · 소개 — 웹 `form.tsx` 와 같다: 멈추면 스스로 확인하고, 저장도 그 답을 기다린다. 단추를 잠그지 않고 누르면 빠진 것을 말한다 */
function ProfileForm({ current, onSaved }: { current: ProfileInput; onSaved: (saved: ProfileInput) => void }) {
  const [profile, setProfile] = useState(current);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState<{ key: string; available: boolean } | null>(null);
  const done = useDoneNote();
  const nicknameRef = useRef<ComponentRef<typeof TextInput>>(null);

  const missing = missingInProfile(profile);
  const nicknameChanged = nicknameKey(profile.nickname) !== nicknameKey(current.nickname);
  const changed = profile.nickname.trim() !== current.nickname.trim() || profile.intro.trim() !== current.intro.trim();
  const answer = nicknameChanged && checked?.key === nicknameKey(profile.nickname) ? checked : null;

  useEffect(() => {
    if (!nicknameChanged || missingNickname(profile.nickname) !== null) return;
    const name = profile.nickname;
    const timer = setTimeout(async () => {
      setChecking(true);
      const result = await checkNickname(name);
      setChecking(false);
      if (result.ok) setChecked({ key: nicknameKey(name), available: result.available });
      else setFailure(result.message);
    }, NICKNAME_CHECK_AFTER_MS);
    return () => clearTimeout(timer);
  }, [profile.nickname, nicknameChanged]);

  const save = async () => {
    if (saving) return;
    if (missing !== null) {
      setTried(true);
      nicknameRef.current?.focus();
      return;
    }
    if (!changed) return;
    if (answer?.available === false) {
      nicknameRef.current?.focus();
      return;
    }
    setFailure(null);
    done.clear();
    setSaving(true);
    if (nicknameChanged && answer === null) {
      const asked = await checkNickname(profile.nickname);
      if (!asked.ok) {
        setSaving(false);
        setFailure(`저장하지 못했어요. ${asked.message}`);
        return;
      }
      setChecked({ key: nicknameKey(profile.nickname), available: asked.available });
      if (!asked.available) {
        setSaving(false);
        nicknameRef.current?.focus();
        return;
      }
    }
    const result = await saveProfile(profile);
    setSaving(false);
    if (!result.ok) {
      setFailure(`저장하지 못했어요. ${result.message}`);
      return;
    }
    setTried(false);
    onSaved({ nickname: profile.nickname.trim(), intro: profile.intro.trim() });
    done.say('저장했어요');
  };

  const nicknameWrong = (tried && missing !== null) || answer?.available === false;
  const nicknameNote =
    tried && missing !== null ? missing : answer !== null ? (answer.available ? NICKNAME_AVAILABLE_NOTE : NICKNAME_TAKEN_NOTE) : checking && nicknameChanged ? '확인하는 중…' : '';

  return (
    <Panel style={styles.form}>
      <View style={styles.group}>
        <Text style={settingsText.fieldLabel}>닉네임</Text>
        <Field
          inputRef={nicknameRef}
          label="닉네임"
          value={profile.nickname}
          maxLength={NICKNAME_MAX}
          autoCapitalize="none"
          placeholder={`${NICKNAME_MIN}~${NICKNAME_MAX}자`}
          refused={nicknameWrong}
          onChange={(nickname) => setProfile({ ...profile, nickname })}
        />
        <Text accessibilityLiveRegion="polite" style={[styles.note, nicknameWrong && styles.wrong]}>
          {nicknameNote}
        </Text>
      </View>
      <View style={styles.group}>
        <Text style={settingsText.fieldLabel}>소개 (선택)</Text>
        <TextInput
          accessibilityLabel="소개 (선택)"
          multiline
          value={profile.intro}
          maxLength={INTRO_MAX}
          placeholder="간단한 소개를 입력해 주세요"
          placeholderTextColor={COLOR.muted}
          onChangeText={(intro) => setProfile({ ...profile, intro })}
          style={styles.area}
        />
        <Text style={styles.count}>
          {profile.intro.length}/{INTRO_MAX}
        </Text>
      </View>
      <View style={styles.action}>
        <View style={missing !== null || !changed ? styles.quiet : undefined}>
          <PrimaryButton label={saving ? '저장하는 중…' : '닉네임 · 소개 저장'} onPress={() => void save()} />
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.note}>
          {changed ? '' : done.note}
        </Text>
        {failure !== null && <FailureLine>{failure}</FailureLine>}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, gap: 20, padding: 16, paddingBottom: 40 },
  form: { gap: 20 },
  group: { gap: 6 },
  note: { minHeight: 20, fontSize: TYPE.sm, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.secondary },
  wrong: { color: COLOR.danger },
  area: { minHeight: 96, paddingHorizontal: 14, paddingVertical: 12, borderRadius: RADIUS.control, borderWidth: 1, borderColor: COLOR.borderStrong, backgroundColor: COLOR.surface, fontFamily: FONT.medium, fontSize: TYPE.field, lineHeight: 24, color: COLOR.foreground, textAlignVertical: 'top' },
  count: { alignSelf: 'flex-end', fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.secondary },
  action: { gap: 8, paddingTop: 20, borderTopWidth: 1, borderTopColor: COLOR.border },
  quiet: { opacity: 0.55 },
});
