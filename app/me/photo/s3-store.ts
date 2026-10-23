import 'server-only';

import { createHash } from 'node:crypto';

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { fromWebToken } from '@aws-sdk/credential-provider-web-identity';
import { getVercelOidcToken } from '@vercel/oidc';

import type { PhotoStore, StoreConfig } from './store';
import { photoStoreState } from './store-env';

/**
 * 사진 저장소의 진짜 — AWS S3 서울(G-120). 버킷 · 권한은 `docs/ops/runbook/photo-store.md` 「마법사가 쓸 값」.
 *
 * **자격은 반출과 같은 두 갈래다** — 기본안은 Vercel OIDC 로 받는 단기 역할, 대안은 접근 키 둘(`store.ts` 의 켜는 값). 역할의
 * 세션 이름이 반출과 달라 CloudTrail 에서 사진의 쓰기 · 지우기를 가려 본다.
 *
 * 쓸 때 본문의 SHA-256 을 싣는다 — S3 가 받은 본문과 대어 보고 다르면 거절한다. 반쯤 올라간 사진이 서지 않는다.
 */

const ROLE_SESSION_NAME = 'saju-photo-store';

/** 한 번의 `DeleteObjects` 가 받는 키 수의 상한(S3) */
const DELETE_BATCH = 1000;

function credentialsOf(config: StoreConfig) {
  const credentials = config.credentials;
  if (credentials.kind === 'keys') {
    return { accessKeyId: credentials.accessKeyId, secretAccessKey: credentials.secretAccessKey };
  }
  return async () =>
    fromWebToken({
      roleArn: credentials.roleArn,
      roleSessionName: ROLE_SESSION_NAME,
      webIdentityToken: await getVercelOidcToken(),
      clientConfig: { region: config.region },
    })();
}

export function s3PhotoStore(config: StoreConfig): PhotoStore {
  const client = new S3Client({ region: config.region, credentials: credentialsOf(config) });
  return {
    put: async (key, body, contentType) => {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ChecksumSHA256: createHash('sha256').update(body).digest('base64'),
        }),
      );
    },
    get: async (key) => {
      try {
        const answer = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
        if (answer.Body === undefined) return null;
        return { body: await answer.Body.transformToByteArray(), contentType: answer.ContentType ?? 'application/octet-stream' };
      } catch (error) {
        if (error instanceof NoSuchKey) return null;
        throw error;
      }
    },
    remove: async (keys) => {
      const failed: string[] = [];
      for (let start = 0; start < keys.length; start += DELETE_BATCH) {
        const part = keys.slice(start, start + DELETE_BATCH);
        try {
          const answer = await client.send(
            new DeleteObjectsCommand({
              Bucket: config.bucket,
              Delete: { Objects: part.map((Key) => ({ Key })), Quiet: true },
            }),
          );
          for (const error of answer.Errors ?? []) if (error.Key) failed.push(error.Key);
        } catch {
          failed.push(...part);
        }
      }
      return { failed };
    },
  };
}

/** 켜져 있으면 저장소, 아니면 `null` — 오설정도 `null` 이다(올리기는 DB 길로 간다, `store.ts` 머리말) */
export function photoStoreIfReady(): PhotoStore | null {
  const state = photoStoreState();
  return state.state === 'ready' ? s3PhotoStore(state.config) : null;
}
