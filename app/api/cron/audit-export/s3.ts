import 'server-only';

import { createHash } from 'node:crypto';

import { PutObjectCommand, S3Client, type PutObjectCommandInput } from '@aws-sdk/client-s3';
import { fromWebToken } from '@aws-sdk/credential-provider-web-identity';
import { getVercelOidcToken } from '@vercel/oidc';

import type { Bundle } from './bundle';
import type { ExportConfig, Upload } from './export';

/**
 * 묶음 하나를 S3 에 **한 객체로** 올린다 (G-23 ⑩, ADR 0105).
 *
 * 보존은 **버킷이 정한다** — 버킷의 Object Lock 기본 보존(처음엔 Governance 로 재고, 운영은 Compliance 400일,
 * runbook 「운영자 접속기록 — 반출」). 여기서 객체마다 보존을 적지 않는 것은, 적으면 Governance → Compliance
 * 로 옮기는 것이 코드 배포가 되고 반출 키에 `s3:PutObjectRetention` 까지 줘야 하기 때문이다. 반출 키는
 * `s3:PutObject` 하나면 된다.
 *
 * **자격은 둘 중 하나다** — 기본안은 **단기 역할**: Vercel 이 함수마다 주는 OIDC 토큰으로 AWS 역할을
 * `AssumeRoleWithWebIdentity` 로 받는다(열쇠가 저장소 · Vercel 어디에도 오래 살지 않는다). 역할을 못 세운 날을
 * 위해 오래 사는 접근 키 둘도 받는다. 어느 쪽인지는 `configOf` 가 정한다(둘 다 있으면 오설정).
 *
 * Object Lock 버킷은 올릴 때 무결성 검사값을 요구한다 — 본문의 SHA-256 을 `ChecksumSHA256` 으로 싣는다. S3 가
 * 받은 본문과 대어 보고 다르면 거절한다.
 */

export function putInputOf(config: ExportConfig, bundle: Bundle): PutObjectCommandInput {
  return {
    Bucket: config.bucket,
    Key: bundle.key,
    Body: bundle.body,
    ContentType: 'application/x-ndjson; charset=utf-8',
    ChecksumSHA256: createHash('sha256').update(bundle.body, 'utf8').digest('base64'),
    Metadata: {
      rows: String(bundle.head.rows),
      'first-id': String(bundle.head.first_id),
      'last-id': String(bundle.head.last_id),
      'after-id': String(bundle.head.after_id),
      'rows-sha256': bundle.head.sha256,
    },
  };
}

/** 역할의 세션 이름 — CloudTrail 에서 이 반출이 받은 자격을 가려 본다 */
const ROLE_SESSION_NAME = 'saju-audit-export';

export function credentialsOf(config: ExportConfig) {
  const credentials = config.credentials;
  if (credentials.kind === 'keys') {
    return { accessKeyId: credentials.accessKeyId, secretAccessKey: credentials.secretAccessKey };
  }
  // 부를 때마다 새 토큰으로 — Vercel 의 OIDC 토큰은 요청마다 온다
  return async () =>
    fromWebToken({
      roleArn: credentials.roleArn,
      roleSessionName: ROLE_SESSION_NAME,
      webIdentityToken: await getVercelOidcToken(),
      clientConfig: { region: config.region },
    })();
}

export function s3Upload(config: ExportConfig): Upload {
  const client = new S3Client({ region: config.region, credentials: credentialsOf(config) });
  return async (bundle) => {
    await client.send(new PutObjectCommand(putInputOf(config, bundle)));
  };
}
