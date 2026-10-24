/**
 * AWS 마법사(`scripts/aws-wizard.sh`)가 **몇 번 돌려도 하나만 만들고, 멈춘 자리에서 잇고, 순서를 지키는가** (G-23 ⑩).
 *
 * 실제 AWS · Vercel 에는 아무것도 안 간다 — `aws` · `vercel` · `npm` 을 가짜로 바꿔 PATH 앞에 둔다. 가짜 `aws` 는 버킷 ·
 * Object Lock · OIDC 제공자 · 역할을 JSON 하나에 들고 진짜처럼 답한다(없으면 `NoSuchEntity`, 겹치면 `EntityAlreadyExists`,
 * 보존이 걸린 버전 지우기는 `AccessDenied`). 가짜 `vercel crons run` 은 반출 하나를 흉내 내 버킷에 객체 하나를 놓는다.
 * 마법사의 물음에는 화면 글자를 보고 답한다(`[y/N]` · `[Enter]` · 버킷 이름).
 */
import { type ChildProcessWithoutNullStreams, spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const WIZARD = resolve(__dirname, 'aws-wizard.sh');

/**
 * 마법사를 돌릴 bash — 4.4 이상이어야 한다(`inherit_errexit` · `declare -A`). macOS 의 `/bin/bash` 는 3.2 라 경로를 박지
 * 않고 부른 사람의 PATH 에서 찾는다(Homebrew 의 `/opt/homebrew/bin/bash`). 모자라면 시험 스물여덟이 같은 `shopt` 오류로
 * 붉는 대신 여기서 한 번, 까는 길과 함께 선다.
 */
const BASH = ((): string => {
  const probe = spawnSync('bash', ['-c', 'echo "${BASH_VERSINFO[0]} ${BASH_VERSINFO[1]} $BASH"'], { encoding: 'utf8' });
  const [major, minor, path] = probe.stdout.trim().split(' ');
  if (Number(major) > 4 || (Number(major) === 4 && Number(minor) >= 4)) return path;
  throw new Error(`aws-wizard 시험은 PATH 에 bash 4.4 이상이 있어야 돈다 — 지금은 ${major}.${minor}(${path}). macOS 면 brew install bash`);
})();
const ACCOUNT = '123456789012';
const ADMIN_ARN = `arn:aws:iam::${ACCOUNT}:user/saju-admin`;

/** 가짜 셋이 함께 쓰는 몸통 — 이름(`aws` · `vercel` · `npm`)으로 갈린다. 상태는 `$FAKE_DIR/world.json` */
const FAKE_BODY = String.raw`
const fs = require('node:fs');
const path = require('node:path');
const dir = process.env.FAKE_DIR;
const worldPath = path.join(dir, 'world.json');
const world = JSON.parse(fs.readFileSync(worldPath, 'utf8'));
const save = () => fs.writeFileSync(worldPath, JSON.stringify(world, null, 2));
const argv = process.argv.slice(2);
fs.appendFileSync(path.join(dir, 'calls.log'), TOOL + ' ' + argv.join(' ') + '\n');
const flag = (name) => { const i = argv.indexOf(name); return i < 0 ? undefined : argv[i + 1]; };
const has = (name) => argv.includes(name);
const fail = (code, message) => { process.stderr.write('An error occurred (' + code + '): ' + message + '\n'); process.exit(254); };
const out = (text) => process.stdout.write(text + '\n');

if (TOOL === 'aws') {
  if (has('--version')) { out(world.awsVersion || 'aws-cli/2.33.1 Python/3.13.7 Linux/6 exe/x86_64'); process.exit(0); }
  const words = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) i++; continue; }
    words.push(argv[i]);
  }
  const op = words.slice(0, 2).join(' ');
  const once = path.join(dir, 'failed-' + op.replace(/ /g, '-'));
  if (process.env.FAKE_AWS_FAIL === op && !fs.existsSync(once)) { fs.writeFileSync(once, ''); fail('ServiceUnavailable', 'injected'); }
  const bucket = world.buckets[flag('--bucket')];
  switch (words[0] === 'login' || words[0] === 'configure' ? words[0] : op) {
    case 'login': world.loggedIn = true; save(); break;
    case 'configure': { const p = flag('--profile'); world.profiles[p] = world.profiles[p] || {}; world.profiles[p][words[2]] = words[3]; save(); break; }
    case 'sts get-caller-identity':
      if (!world.loggedIn) fail('NoCredentials', 'Unable to locate credentials');
      out(flag('--query') === 'Account' ? '${ACCOUNT}' : world.callerArn); break;
    case 's3api list-buckets': out(Object.keys(world.buckets).filter((n) => n.startsWith('saju-audit-')).join('\t')); break;
    case 's3api head-bucket':
      if (bucket) break;
      if ((world.foreign || []).includes(flag('--bucket'))) fail('403', 'Forbidden');
      fail('404', 'Not Found');
    case 's3api create-bucket':
      if (bucket) fail('BucketAlreadyOwnedByYou', 'exists');
      world.buckets[flag('--bucket')] = { lock: has('--object-lock-enabled-for-bucket'), versioning: has('--object-lock-enabled-for-bucket') ? 'Enabled' : 'None', mode: null, days: null, publicBlock: false, objects: [], region: flag('--create-bucket-configuration') };
      save(); break;
    case 's3api get-object-lock-configuration':
      if (!bucket || !bucket.lock) fail('ObjectLockConfigurationNotFoundError', 'none');
      out(['Enabled', bucket.mode || 'None', bucket.days == null ? 'None' : String(bucket.days)].join('\t')); break;
    case 's3api get-bucket-versioning': out(bucket.versioning); break;
    case 's3api put-public-access-block': bucket.publicBlock = flag('--public-access-block-configuration'); save(); break;
    case 's3api put-object-lock-configuration': {
      const rule = JSON.parse(flag('--object-lock-configuration')).Rule.DefaultRetention;
      bucket.mode = rule.Mode; bucket.days = rule.Days; save(); break;
    }
    case 's3api list-objects-v2': out(String(bucket.objects.filter((o) => o.key.startsWith(flag('--prefix'))).length)); break;
    case 's3api put-object': {
      const version = 'p' + (bucket.objects.length + 1);
      bucket.objects.push({ key: flag('--key'), version, retained: Boolean(bucket.mode) }); save(); out(version); break;
    }
    case 's3api delete-object': {
      if (process.env.FAKE_DELETE_ERROR) fail('ServiceUnavailable', 'try later');
      const target = bucket.objects.find((o) => o.version === flag('--version-id'));
      if (!target) fail('NoSuchVersion', 'none');
      if (target.retained && !process.env.FAKE_DELETE_ALLOWED) fail('AccessDenied', 'locked');
      bucket.objects = bucket.objects.filter((o) => o !== target); save(); break;
    }
    case 'iam get-open-id-connect-provider': {
      const p = world.providers[flag('--open-id-connect-provider-arn')];
      if (!p) fail('NoSuchEntity', 'none');
      out(p.join('\t')); break;
    }
    case 'iam create-open-id-connect-provider': {
      const arn = 'arn:aws:iam::${ACCOUNT}:oidc-provider/' + flag('--url').replace('https://', '');
      if (world.providers[arn]) fail('EntityAlreadyExists', 'exists');
      world.providers[arn] = [flag('--client-id-list')]; save(); break;
    }
    case 'iam add-client-id-to-open-id-connect-provider': world.providers[flag('--open-id-connect-provider-arn')].push(flag('--client-id')); save(); break;
    case 'iam get-role': {
      const r = world.roles[flag('--role-name')];
      if (!r) fail('NoSuchEntity', 'none');
      out(r.arn); break;
    }
    case 'iam create-role': {
      const name = flag('--role-name');
      if (world.roles[name]) fail('EntityAlreadyExists', 'exists');
      world.roles[name] = { arn: 'arn:aws:iam::${ACCOUNT}:role/' + name, trust: JSON.parse(flag('--assume-role-policy-document')), policies: {} };
      save(); out(world.roles[name].arn); break;
    }
    case 'iam update-assume-role-policy': world.roles[flag('--role-name')].trust = JSON.parse(flag('--policy-document')); save(); break;
    case 'iam put-role-policy': world.roles[flag('--role-name')].policies[flag('--policy-name')] = JSON.parse(flag('--policy-document')); save(); break;
    default: fail('Unknown', 'fake aws does not know: ' + op);
  }
} else if (TOOL === 'vercel') {
  if (argv[0] === 'whoami') { out('someone'); }
  else if (argv[0] === 'env' && argv[1] === 'ls') { out(Object.keys(world.vercelEnv).map((n) => ' ' + n + '  Encrypted  Production  1d ago').join('\n')); }
  else if (argv[0] === 'env' && argv[1] === 'pull') {
    // 진짜처럼 Production 의 변수 전부(비밀 포함)를 dotenv 로 쓴다 — 마법사가 세 이름만 뽑고 곧 지우는지 시험이 본다
    if (process.env.FAKE_VERCEL_PULL_FAIL) { process.stderr.write('Error: pull failed\n'); process.exit(1); }
    const file = argv[2];
    fs.appendFileSync(path.join(dir, 'pulled.log'), file + '\n');
    fs.writeFileSync(file, '# Created by Vercel CLI\n' + Object.entries(world.vercelEnv).map(([n, v]) => n + '="' + v + '"').join('\n') + '\n');
  }
  else if (argv[0] === 'env' && argv[1] === 'add') {
    const name = argv[2];
    if (world.vercelEnv[name] !== undefined && !has('--force')) { process.stderr.write('already exists\n'); process.exit(1); }
    world.vercelEnv[name] = flag('--value') ?? fs.readFileSync(0, 'utf8'); save();
  } else if (argv[0] === 'crons' && argv[1] === 'run') {
    const b = world.buckets[world.vercelEnv.AUDIT_EXPORT_BUCKET];
    if (b) { const n = b.objects.length + 1; b.objects.push({ key: 'operator-access/2026/10/23/' + n + '.jsonl', version: 'v' + n, retained: Boolean(b.mode) }); save(); }
  } else { process.exit(2); }
} else if (TOOL === 'npm') {
  fs.appendFileSync(path.join(dir, 'npm-env.log'), (process.env.AWS_PROFILE || '-') + ' ' + (process.env.AUDIT_VERIFY_BUCKET || '-') + '\n');
  if (argv.includes('audit:verify')) process.exit(Number(process.env.FAKE_VERIFY_EXIT || 0));
  out(' last_outcome | succeeded');
}
`;

type World = {
  loggedIn: boolean;
  callerArn: string;
  awsVersion?: string;
  buckets: Record<
    string,
    {
      lock: boolean;
      versioning: string;
      mode: string | null;
      days: number | null;
      objects: { key: string; version: string; retained?: boolean }[];
    }
  >;
  foreign?: string[];
  providers: Record<string, string[]>;
  roles: Record<string, { arn: string; trust: unknown; policies: Record<string, unknown> }>;
  profiles: Record<string, Record<string, string>>;
  vercelEnv: Record<string, string>;
};

function setUp(world: Partial<World> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'aws-wizard-'));
  const bin = join(root, 'bin');
  const fake = join(root, 'fake');
  mkdirSync(bin);
  mkdirSync(fake);
  for (const tool of ['aws', 'vercel', 'npm']) {
    const file = join(bin, tool);
    writeFileSync(file, `#!${process.execPath}\nconst TOOL = '${tool}';\n${FAKE_BODY}`);
    chmodSync(file, 0o755);
  }
  // 브라우저를 열지 않는다 — 마법사 도서관이 찾는 이름 넷을 아무것도 안 하는 것으로
  for (const opener of ['wslview', 'explorer.exe', 'xdg-open', 'open']) {
    writeFileSync(join(bin, opener), '#!/bin/sh\nexit 0\n');
    chmodSync(join(bin, opener), 0o755);
  }
  const full: World = {
    loggedIn: false,
    callerArn: ADMIN_ARN,
    buckets: {},
    providers: {},
    roles: {},
    profiles: {},
    vercelEnv: {},
    ...world,
  };
  writeFileSync(join(fake, 'world.json'), JSON.stringify(full));
  writeFileSync(join(fake, 'calls.log'), '');
  const statePath = join(root, 'home', '.config', 'saju', 'aws-wizard.env');
  return {
    root,
    statePath,
    world: () => JSON.parse(readFileSync(join(fake, 'world.json'), 'utf8')) as World,
    calls: () => readFileSync(join(fake, 'calls.log'), 'utf8').split('\n').filter(Boolean),
    npmEnv: () => (existsSync(join(fake, 'npm-env.log')) ? readFileSync(join(fake, 'npm-env.log'), 'utf8') : ''),
    pulled: () =>
      existsSync(join(fake, 'pulled.log'))
        ? readFileSync(join(fake, 'pulled.log'), 'utf8').split('\n').filter(Boolean)
        : [],
    setWorld(change: (w: World) => void) {
      const w = JSON.parse(readFileSync(join(fake, 'world.json'), 'utf8')) as World;
      change(w);
      writeFileSync(join(fake, 'world.json'), JSON.stringify(w));
    },
    state: () => (existsSync(statePath) ? readFileSync(statePath, 'utf8') : ''),
    setState(key: string, value: string) {
      const lines = this.state()
        .split('\n')
        .filter((l) => l && !l.startsWith(`${key}=`));
      mkdirSync(dirname(statePath), { recursive: true });
      writeFileSync(statePath, [...lines, `${key}=${value}`].join('\n') + '\n');
    },
    run: (
      opts: {
        env?: Record<string, string>;
        typed?: (bucket: string) => string;
        no?: RegExp;
      } = {},
    ) => drive(root, bin, fake, statePath, opts),
  };
}

/** 마법사를 돌리고 물음마다 답한다 — 「[y/N]」은 `no` 에 걸리지 않으면 y, 「[Enter]」 류는 빈 줄 */
function drive(
  root: string,
  bin: string,
  fake: string,
  statePath: string,
  opts: {
    env?: Record<string, string>;
    typed?: (bucket: string) => string;
    no?: RegExp;
  },
): Promise<{ code: number | null; out: string }> {
  return new Promise((done) => {
    const child: ChildProcessWithoutNullStreams = spawn(BASH, [WIZARD], {
      env: {
        PATH: `${bin}:/usr/bin:/bin`,
        HOME: join(root, 'home'),
        FAKE_DIR: fake,
        AWS_WIZARD_STATE: statePath,
        LANG: 'C.UTF-8',
        NODE_ENV: 'test',
        ...opts.env,
      },
    });
    let out = '';
    let pending = '';
    const prompts: [RegExp, (seen: string) => string][] = [
      [/Ready to start\? $/, () => ''],
      [/\[Enter keeps current\] $/, () => ''],
      [/\[Enter\][^\n]*$/, () => ''],
      [/\? ([^\n]*) \[y\/N\] $/, (seen) => (opts.no?.test(seen) ? 'n' : 'y')],
      [
        /버킷 이름을 그대로 친다:\S* $/,
        () => {
          const bucket = /AUDIT_EXPORT_BUCKET=(.*)/.exec(readFileSync(statePath, 'utf8'))?.[1] ?? '';
          return opts.typed ? opts.typed(bucket) : bucket;
        },
      ],
    ];
    const onData = (chunk: Buffer) => {
      out += chunk;
      pending += chunk;
      for (const [pattern, answer] of prompts) {
        const m = pattern.exec(pending);
        if (m) {
          pending = '';
          child.stdin.write(`${answer(m[0])}\n`);
          return;
        }
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', (chunk) => (out += chunk));
    const timer = setTimeout(() => child.kill('SIGKILL'), 20_000);
    child.on('exit', (code) => {
      clearTimeout(timer);
      done({ code, out });
    });
  });
}

const count = (calls: string[], pattern: RegExp) => calls.filter((c) => pattern.test(c)).length;

describe('AWS 마법사 — 처음 도는 날', () => {
  it('버킷 · 제공자 · 역할 둘을 하나씩 만들고, Governance 1일을 걸고, 같은 날에는 Compliance 로 가지 않는다', async () => {
    const t = setUp();
    const { code, out } = await t.run();
    expect(code, out).toBe(0);
    const calls = t.calls();
    const world = t.world();

    expect(count(calls, /^aws login --profile saju-admin/)).toBe(1);
    expect(count(calls, /s3api create-bucket/)).toBe(1);
    const [bucket] = Object.keys(world.buckets);
    expect(bucket).toMatch(/^saju-audit-[0-9a-f]{8}$/);
    expect(world.buckets[bucket]).toMatchObject({
      lock: true,
      versioning: 'Enabled',
      mode: 'GOVERNANCE',
      days: 1,
    });
    expect(calls.find((c) => c.includes('create-bucket'))).toContain('LocationConstraint=ap-northeast-2');
    expect(calls.find((c) => c.includes('put-public-access-block'))).toContain(
      'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true',
    );

    // 제공자 — Team 발급자 하나, audience 는 팀 주소
    expect(world.providers).toEqual({
      [`arn:aws:iam::${ACCOUNT}:oidc-provider/oidc.vercel.com/sungheeyoons-projects`]: [
        'https://vercel.com/sungheeyoons-projects',
      ],
    });

    // 반출 역할 — 이 프로젝트의 Production 만 믿고, 그 prefix 에 넣기 하나뿐
    const exportRole = world.roles['saju-audit-export'];
    expect(exportRole.trust).toEqual({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            Federated: `arn:aws:iam::${ACCOUNT}:oidc-provider/oidc.vercel.com/sungheeyoons-projects`,
          },
          Action: 'sts:AssumeRoleWithWebIdentity',
          Condition: {
            StringEquals: {
              'oidc.vercel.com/sungheeyoons-projects:aud': 'https://vercel.com/sungheeyoons-projects',
              'oidc.vercel.com/sungheeyoons-projects:sub':
                'owner:sungheeyoons-projects:project:saju:environment:production',
            },
          },
        },
      ],
    });
    expect(exportRole.policies).toEqual({
      'saju-audit-export-put': {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: 's3:PutObject',
            Resource: `arn:aws:s3:::${bucket}/operator-access/*`,
          },
        ],
      },
    });

    // 검증 역할 — 관리자 사용자만 맡고, 읽기 둘만. 프로필은 관리자를 거친다
    const verifyRole = world.roles['saju-audit-verify'];
    expect(verifyRole.trust).toMatchObject({
      Statement: [{ Principal: { AWS: ADMIN_ARN }, Action: 'sts:AssumeRole' }],
    });
    expect(JSON.stringify(verifyRole.policies)).not.toMatch(/PutObject|DeleteObject|Retention/);
    expect(world.profiles['saju-audit-verify']).toEqual({
      role_arn: `arn:aws:iam::${ACCOUNT}:role/saju-audit-verify`,
      source_profile: 'saju-admin',
      region: 'ap-northeast-2',
    });

    // Vercel — 코드가 읽는 이름 셋(`configOf`), 접근 키는 없다
    expect(world.vercelEnv).toEqual({
      AUDIT_EXPORT_BUCKET: bucket,
      AUDIT_EXPORT_REGION: 'ap-northeast-2',
      AUDIT_EXPORT_ROLE_ARN: `arn:aws:iam::${ACCOUNT}:role/saju-audit-export`,
    });
    expect(
      calls
        .filter((c) => c.startsWith('vercel env add'))
        .every((c) => c.includes('--project saju --scope sungheeyoons-projects')),
    ).toBe(true);

    // 검증은 읽기 프로필로, 지우기는 막혔고, 같은 날이라 Compliance 는 아직
    expect(t.npmEnv()).toContain(`saju-audit-verify ${bucket}`);
    expect(world.buckets[bucket].objects.map((o) => o.key.split('/')[0]).sort()).toEqual(['operator-access', 'wizard-probe']);
    expect(count(calls, /"Mode":"COMPLIANCE"/)).toBe(0);
    expect(out).toContain('Stage 13 — Compliance 400일 전환');
  }, 30_000);

  it('상태 파일에는 비밀이 없다 — 이름이 정해진 칸뿐이다', async () => {
    const t = setUp();
    await t.run();
    const keys = t
      .state()
      .split('\n')
      .filter(Boolean)
      .map((l) => l.split('=')[0]);
    expect(new Set(keys)).toEqual(
      new Set([
        'VERCEL_TEAM',
        'VERCEL_PROJECT',
        'ACCOUNT_READY',
        'AWS_ACCOUNT_ID',
        'AWS_ADMIN_ARN',
        'AUDIT_EXPORT_BUCKET',
        'GOVERNANCE_SET_EPOCH',
        'VERCEL_OIDC_READY',
        'AUDIT_EXPORT_ROLE_ARN',
        'AUDIT_VERIFY_ROLE_ARN',
        'REDEPLOY_PENDING',
        'GOVERNANCE_VERIFIED_EPOCH',
        'GOVERNANCE_VERIFIED_FP',
        'GOVERNANCE_VERIFIED_LOCK',
      ]),
    );
    expect(t.state()).not.toMatch(/SECRET|ACCESS_KEY|AKIA/);
  }, 30_000);
});

describe('AWS 마법사 — 다시 돌리면', () => {
  it('두 번째는 아무것도 새로 만들지 않고, 다음 날 검증이 초록이면 이름을 친 뒤에만 Compliance 400일로 옮긴다', async () => {
    const t = setUp();
    expect((await t.run()).code).toBe(0);
    const first = t.calls().length;

    // 다음 날 — Governance 를 건 날을 어제로
    t.setState('GOVERNANCE_SET_EPOCH', '0');
    t.setState('GOVERNANCE_VERIFIED_EPOCH', '0');
    const second = await t.run();
    expect(second.code, second.out).toBe(0);
    const again = t.calls().slice(first);
    expect(count(again, /create-bucket|create-open-id-connect-provider|create-role|vercel env add|aws login/)).toBe(0);
    expect(count(again, /update-assume-role-policy/)).toBe(2);
    expect(second.out).toContain('바뀐 변수가 없다');
    const [bucket] = Object.keys(t.world().buckets);
    expect(t.world().buckets[bucket]).toMatchObject({
      mode: 'COMPLIANCE',
      days: 400,
    });
    // Governance 를 건 뒤에야 Compliance 를 건다 — 순서
    const locks = t.calls().filter((c) => c.includes('put-object-lock-configuration'));
    expect(locks.map((c) => /"Mode":"(\w+)","Days":(\d+)/.exec(c)?.slice(1).join(' '))).toEqual([
      'GOVERNANCE 1',
      'COMPLIANCE 400',
    ]);

    // 셋째 — 이미 Compliance 라 보존을 건드리지 않는다
    const before = t.calls().length;
    const third = await t.run();
    expect(third.code, third.out).toBe(0);
    expect(
      count(t.calls().slice(before), /put-object-lock-configuration|create-|env add|crons run|delete-object/),
    ).toBe(0);
    expect(third.out).toContain('반출이 Compliance 400일로 돈다');
    // 전환은 그 뒤 객체의 기본값일 뿐 — 시험 기간의 객체를 400일이라 말하지 않는다
    expect(third.out).toContain('Governance 시험 기간의 객체는 Governance 1일 그대로다');
  }, 60_000);

  it('버킷 이름을 틀리게 치면 Compliance 로 가지 않는다', async () => {
    const t = setUp();
    await t.run();
    t.setState('GOVERNANCE_SET_EPOCH', '0');
    t.setState('GOVERNANCE_VERIFIED_EPOCH', '0');
    const { code, out } = await t.run({ typed: (b) => `${b}x` });
    expect(code).toBe(0);
    expect(count(t.calls(), /"Mode":"COMPLIANCE"/)).toBe(0);
    expect(out).toContain('이름이 달라 옮기지 않았다');
  }, 60_000);

  it('검증이 붉으면 다음 날이어도 Compliance 로 가지 않는다', async () => {
    const t = setUp();
    await t.run({ env: { FAKE_VERIFY_EXIT: '1' } });
    t.setState('GOVERNANCE_SET_EPOCH', '0');
    const { code, out } = await t.run({ env: { FAKE_VERIFY_EXIT: '1' } });
    expect(code).toBe(0);
    expect(count(t.calls(), /"Mode":"COMPLIANCE"/)).toBe(0);
    expect(out).toContain('audit:verify 가 붉다');
  }, 60_000);

  it('보존이 안 걸려 지우기가 되면 멈추고 Compliance 로 가지 않는다', async () => {
    const t = setUp();
    const { code, out } = await t.run({ env: { FAKE_DELETE_ALLOWED: '1' } });
    expect(code).toBe(1);
    expect(out).toContain('지워졌다 — 보존이 안 걸렸다');
    expect(count(t.calls(), /"Mode":"COMPLIANCE"/)).toBe(0);
  }, 30_000);

  it('지우기 시험은 감사 객체를 건드리지 않는다 — 시험 객체만 올려 지워 본다', async () => {
    const t = setUp();
    await t.run();
    t.setState('GOVERNANCE_SET_EPOCH', '0');
    t.setState('GOVERNANCE_VERIFIED_EPOCH', '0');
    await t.run();
    const deletes = t.calls().filter((c) => c.includes('delete-object'));
    expect(deletes.length).toBe(2);
    for (const d of deletes) expect(d).toMatch(/--key wizard-probe\//);
    const [bucket] = Object.keys(t.world().buckets);
    expect(t.world().buckets[bucket].objects.filter((o) => o.key.startsWith('operator-access/'))).toHaveLength(2);
  }, 60_000);

  it('지우기가 보존이 아닌 까닭(일시 장애)으로 실패하면 막혔다고 보지 않는다', async () => {
    const t = setUp();
    const { code, out } = await t.run({ env: { FAKE_DELETE_ERROR: '1' } });
    expect(code).toBe(1);
    expect(out).toContain('보존이 아닌 까닭으로 실패했다');
    expect(t.state()).not.toContain('GOVERNANCE_VERIFIED_EPOCH');
  }, 30_000);

  it('Governance 를 거절하면 반출을 켜지 않는다 — Vercel 변수를 넣지 않는다', async () => {
    const t = setUp();
    const { code, out } = await t.run({ no: /Governance 1일로 걸까/ });
    expect(code).toBe(1);
    expect(out).toContain('기본 보존이 없다 — 반출을 켜지 않는다');
    expect(count(t.calls(), /vercel env add/)).toBe(0);
  }, 30_000);
});

describe('AWS 마법사 — 중간에 멈추면', () => {
  for (const op of [
    'iam create-role',
    's3api put-public-access-block',
    'iam create-open-id-connect-provider',
    's3api get-object-lock-configuration',
  ]) {
    it(`${op} 가 한 번 실패하면 멈추고, 다시 돌리면 이어서 끝낸다 — 겹쳐 만든 것이 없다`, async () => {
      const t = setUp();
      const first = await t.run({ env: { FAKE_AWS_FAIL: op } });
      expect(first.code).not.toBe(0);
      expect(first.out).toMatch(/Stage \d+\/13 에서 멈췄다/);
      expect(first.out).toContain('「마법사가 멈췄을 때」');

      const second = await t.run({ env: { FAKE_AWS_FAIL: op } });
      expect(second.code, second.out).toBe(0);
      const calls = t.calls();
      expect(Object.keys(t.world().buckets)).toHaveLength(1);
      expect(
        count(
          calls.filter((c) => !c.includes('injected')),
          /s3api create-bucket/,
        ),
      ).toBe(1);
      expect(Object.keys(t.world().providers)).toHaveLength(1);
      expect(Object.keys(t.world().roles).sort()).toEqual(['saju-audit-export', 'saju-audit-verify']);
      expect(Object.keys(t.world().vercelEnv)).toHaveLength(3);
    }, 60_000);
  }

  it('Vercel 변수를 넣고 다시 배포 전에 멈추면, 다음 실행이 다시 배포를 묻는다', async () => {
    const t = setUp();
    const first = await t.run({ no: /Redeploy 가 Ready/ });
    expect(first.code).toBe(0);
    expect(first.out).toContain('Stage 11 — Production Redeploy 뒤 Ready');
    expect(count(t.calls(), /crons run/)).toBe(0);

    const second = await t.run();
    expect(second.code, second.out).toBe(0);
    expect(second.out).not.toContain('바뀐 변수가 없다');
    expect(count(t.calls(), /vercel env add/)).toBe(3);
    expect(count(t.calls(), /crons run/)).toBe(1);
  }, 60_000);
});

describe('AWS 마법사 — 이미 있는 것을 다시 쓴다', () => {
  it('상태 파일이 없어도 계정에 있는 버킷 · 제공자 · 역할을 찾아 쓰고 새로 만들지 않는다', async () => {
    const provider = `arn:aws:iam::${ACCOUNT}:oidc-provider/oidc.vercel.com/sungheeyoons-projects`;
    const t = setUp({
      loggedIn: true,
      buckets: {
        'saju-audit-abcd1234': {
          lock: true,
          versioning: 'Enabled',
          mode: 'GOVERNANCE',
          days: 1,
          objects: [],
        },
      },
      providers: { [provider]: ['sts.amazonaws.com'] },
      roles: {
        'saju-audit-export': {
          arn: `arn:aws:iam::${ACCOUNT}:role/saju-audit-export`,
          trust: {},
          policies: {},
        },
        'saju-audit-verify': {
          arn: `arn:aws:iam::${ACCOUNT}:role/saju-audit-verify`,
          trust: {},
          policies: {},
        },
      },
    });
    const { code, out } = await t.run();
    expect(code, out).toBe(0);
    const calls = t.calls();
    expect(count(calls, /create-bucket|create-open-id-connect-provider|create-role|aws login/)).toBe(0);
    expect(count(calls, /put-object-lock-configuration/)).toBe(0);
    expect(t.world().providers[provider]).toEqual(['sts.amazonaws.com', 'https://vercel.com/sungheeyoons-projects']);
    expect(t.world().vercelEnv.AUDIT_EXPORT_BUCKET).toBe('saju-audit-abcd1234');
    expect(t.world().roles['saju-audit-export'].policies).toHaveProperty('saju-audit-export-put');
  }, 30_000);

  it('Vercel 에 다른 값이 있으면 묻고, 아니라 하면 덮어쓰지 않는다', async () => {
    const t = setUp({ vercelEnv: { AUDIT_EXPORT_REGION: 'us-east-1' } });
    const { code, out } = await t.run({
      no: /AUDIT_EXPORT_REGION 이 Production 에 이미 있다/,
    });
    expect(code).toBe(0);
    expect(t.world().vercelEnv.AUDIT_EXPORT_REGION).toBe('us-east-1');
    expect(out).toContain('AUDIT_EXPORT_REGION 를 덮어쓰지 않았다');
  }, 30_000);

  it('Vercel 에 접근 키가 남아 있으면 오설정이라 알리고 지우지는 않는다', async () => {
    const t = setUp({
      vercelEnv: {
        AUDIT_EXPORT_ACCESS_KEY_ID: 'x',
        AUDIT_EXPORT_SECRET_ACCESS_KEY: 'y',
      },
    });
    const { out } = await t.run();
    expect(out).toContain('접근 키 두 변수를 대시보드에서 지운다');
    expect(t.world().vercelEnv).toHaveProperty('AUDIT_EXPORT_ACCESS_KEY_ID');
    expect(count(t.calls(), /env rm/)).toBe(0);
  }, 30_000);

  it('남의 버킷 이름이면 만들지 않고 멈춘다', async () => {
    const t = setUp({ foreign: ['saju-audit-taken000'] });
    t.setState('AUDIT_EXPORT_BUCKET', 'saju-audit-taken000');
    const { code, out } = await t.run();
    expect(code).toBe(1);
    expect(out).toContain('이 계정이 못 쓴다');
    expect(count(t.calls(), /create-bucket/)).toBe(0);
  }, 30_000);
});

describe('AWS 마법사 — 멈추는 자리', () => {
  it('IAM 사용자가 아닌 역할 세션이면 검증 역할을 좁힐 수 없어 멈춘다', async () => {
    const t = setUp({ loggedIn: true, callerArn: `arn:aws:sts::${ACCOUNT}:assumed-role/Admin/someone` });
    const { code, out } = await t.run();
    expect(code).toBe(1);
    expect(out).toContain('IAM 사용자가 아닌 신원');
    expect(count(t.calls(), /create-|put-/)).toBe(0);
  }, 30_000);

  it('루트로 로그인했으면 아무것도 만들지 않고 멈춘다', async () => {
    const t = setUp({
      loggedIn: true,
      callerArn: `arn:aws:iam::${ACCOUNT}:root`,
    });
    const { code, out } = await t.run();
    expect(code).toBe(1);
    expect(out).toContain('루트로 로그인됐다');
    expect(count(t.calls(), /create-|put-/)).toBe(0);
  }, 30_000);

  it('AWS CLI 가 2.32 보다 낮으면(aws login 없음) 준비물에서 멈춘다', async () => {
    const t = setUp({ awsVersion: 'aws-cli/2.31.9 Python/3.13 Linux' });
    const { code, out } = await t.run();
    expect(code).toBe(1);
    expect(out).toContain('2.32 보다 낮다');
    expect(count(t.calls(), /^aws (login|s3api|iam)/)).toBe(0);
  }, 30_000);
});

/** 지난 실행이 「Governance 를 걸고 24시간 뒤에 검증했다」고 적어 둔 상태 — 옛 마법사는 이것만 보고 Stage 12 를 건너뛰었다 */
function verifiedYesterday(t: ReturnType<typeof setUp>) {
  t.setState('GOVERNANCE_SET_EPOCH', '0');
  t.setState('GOVERNANCE_VERIFIED_EPOCH', String(86_400));
}

const compliance = (calls: string[]) => count(calls, /"Mode":"COMPLIANCE"/);

describe('AWS 마법사 — 끝났다고 말하는 문', () => {
  it('버킷이 이미 Compliance 여도 400일보다 짧으면 끝냈다고 하지 않고, 400일이라 말하지 않는다', async () => {
    const t = setUp({
      loggedIn: true,
      buckets: {
        'saju-audit-abcd1234': { lock: true, versioning: 'Enabled', mode: 'COMPLIANCE', days: 30, objects: [] },
      },
    });
    const { code, out } = await t.run();
    expect(code, out).toBe(0);
    expect(out).toContain('Compliance 30일 — 400일보다 짧다');
    expect(out).toContain('Stage 13 — 기본 보존이 Compliance 30일이다');
    expect(out).not.toContain('Compliance 400일로 돈다');
    expect(out).not.toContain('반출이 Compliance');
    // 늘리기는 사람이 runbook 으로 — 마법사는 보존을 건드리지 않는다
    expect(count(t.calls(), /put-object-lock-configuration/)).toBe(0);
  }, 30_000);

  it('Stage 12 — 검증 기록이 있어도 Compliance 가 400일보다 짧으면 건너뛰지 않고 다시 잰다', async () => {
    const t = setUp();
    expect((await t.run()).code).toBe(0);
    t.setWorld((w) => {
      const [b] = Object.keys(w.buckets);
      w.buckets[b].mode = 'COMPLIANCE';
      w.buckets[b].days = 30;
    });
    const before = t.calls().length;
    const { code, out } = await t.run();
    expect(code, out).toBe(0);
    expect(out).not.toContain('이미 Compliance 다 — 건너뛴다');
    expect(count(t.calls().slice(before), /crons run/)).toBe(1);
    expect(out).not.toContain('반출이 Compliance');
  }, 60_000);

  it('지난 검증 뒤 설정(Vercel 프로젝트)이 바뀌면 Stage 12 를 다시 재고서야 Compliance 로 간다', async () => {
    const t = setUp();
    expect((await t.run()).code).toBe(0);
    verifiedYesterday(t);
    t.setState('VERCEL_PROJECT', 'saju-next');
    const before = t.calls().length;
    const { code, out } = await t.run();
    expect(code, out).toBe(0);
    const again = t.calls().slice(before);
    const measured = again.findIndex((c) => c.startsWith('vercel crons run'));
    const locked = again.findIndex((c) => c.includes('"Mode":"COMPLIANCE"'));
    expect(measured, out).toBeGreaterThanOrEqual(0);
    expect(locked).toBeGreaterThan(measured);
    expect(out).toContain('지난 검증은 지금 설정과 다르다');
  }, 60_000);

  it('Redeploy 가 남았으면 지난 검증이 있어도 Compliance 로 가지 않는다', async () => {
    const t = setUp();
    expect((await t.run()).code).toBe(0);
    verifiedYesterday(t);
    t.setState('REDEPLOY_PENDING', 'yes');
    const { code, out } = await t.run({ no: /Redeploy 가 Ready/ });
    expect(code, out).toBe(0);
    expect(compliance(t.calls())).toBe(0);
    expect(out).toContain('Stage 13 — Compliance 400일 전환');
    expect(out).not.toContain('반출이 Compliance');
  }, 60_000);
});

describe('AWS 마법사 — Vercel 의 실제 값을 견준다', () => {
  it('Production 값이 바뀌었으면 상태 파일이 같아도 묻고, 아니라 하면 덮어쓰지도 Compliance 로 가지도 않는다', async () => {
    const t = setUp();
    expect((await t.run()).code).toBe(0);
    t.setWorld((w) => {
      w.vercelEnv.AUDIT_EXPORT_REGION = 'us-east-1';
    });
    verifiedYesterday(t);
    const { code, out } = await t.run({ no: /AUDIT_EXPORT_REGION 이 Production 에 이미 있다/ });
    expect(code, out).toBe(0);
    expect(out).not.toContain('AUDIT_EXPORT_REGION — 이 마법사가 넣은 값 그대로다');
    expect(out).toContain('AUDIT_EXPORT_REGION 를 덮어쓰지 않았다');
    expect(t.world().vercelEnv.AUDIT_EXPORT_REGION).toBe('us-east-1');
    expect(compliance(t.calls())).toBe(0);
  }, 60_000);

  it('Production 값을 못 읽으면 같다고 하지 않고 「확인 못 함」으로 남긴다 — Compliance 로 가지 않는다', async () => {
    const t = setUp();
    expect((await t.run()).code).toBe(0);
    verifiedYesterday(t);
    const { code, out } = await t.run({ env: { FAKE_VERCEL_PULL_FAIL: '1' } });
    expect(code, out).toBe(0);
    expect(out).not.toMatch(/AUDIT_EXPORT_\w+ — (이 마법사가 넣은 값 그대로다|Production 값이 이 마법사 값과 같다)/);
    expect(out).toContain('Stage 10 — Production 의 AUDIT_EXPORT_BUCKET 값을 확인 못 함');
    expect(compliance(t.calls())).toBe(0);
  }, 60_000);

  it('값을 읽은 파일은 저장소 밖에 두고 곧 지우며, 다른 변수(비밀)의 값은 화면 · 상태 파일에 남기지 않는다', async () => {
    const secret = 'sk-live-SECRET-0123456789';
    const t = setUp({ vercelEnv: { OPENAI_API_KEY: secret } });
    const first = await t.run();
    expect(first.code, first.out).toBe(0);
    const second = await t.run();
    expect(second.code, second.out).toBe(0);
    expect(second.out).toContain('AUDIT_EXPORT_BUCKET — Production 값이 이 마법사 값과 같다');
    const pulled = t.pulled();
    expect(pulled.length).toBeGreaterThan(0);
    for (const file of pulled) {
      expect(existsSync(file)).toBe(false);
      expect(resolve(file).startsWith(resolve(__dirname, '..'))).toBe(false);
    }
    expect(first.out + second.out).not.toContain(secret);
    expect(t.state()).not.toContain(secret);
  }, 60_000);
});
