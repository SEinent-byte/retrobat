/** R2 presigned download URLs via SigV4 (aws4fetch), SPEC §7. */
import { AwsClient } from "aws4fetch";
import type { Env } from "../env.js";

/** Default presigned-URL lifetime (seconds). */
export const DOWNLOAD_URL_TTL_SEC = 300;

/**
 * Build a short-lived presigned GET URL for an R2 object key. Credentials are
 * the R2 S3 access keys (Worker secrets); the ROM is never public.
 */
export async function presignDownload(
  env: Env,
  r2Key: string,
  now = Date.now(),
  ttlSec = DOWNLOAD_URL_TTL_SEC,
): Promise<{ url: string; expiresAt: number }> {
  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });

  const endpoint = env.R2_ENDPOINT.replace(/\/+$/, "");
  const objectUrl = `${endpoint}/${env.R2_BUCKET}/${encodeKey(r2Key)}`;

  // aws4fetch reads X-Amz-Expires from the query when signing with signQuery.
  const toSign = `${objectUrl}?X-Amz-Expires=${ttlSec}`;
  const signed = await client.sign(toSign, {
    method: "GET",
    aws: { signQuery: true },
  });

  return { url: signed.url, expiresAt: now + ttlSec * 1000 };
}

/** Encode each path segment, keeping the slashes between them. */
function encodeKey(key: string): string {
  return key
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}
