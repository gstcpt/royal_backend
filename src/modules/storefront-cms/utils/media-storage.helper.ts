import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface MediaStorageConfig {
  provider: 'AUTO_VPS_OR_VERCEL' | 'LOCAL_DISK' | 'CLOUDFLARE_R2' | 'CLOUDINARY' | 'VERCEL_DATA_URI';
  webpEnabled: boolean;
  webpQuality: number;
  maxWidthPx: number;
  r2AccountId?: string;
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
  r2BucketName?: string;
  r2PublicBaseUrl?: string;
  cloudinaryCloudName?: string;
  cloudinaryUploadPreset?: string;
  cloudinaryApiKey?: string;
  cloudinaryApiSecret?: string;
  localBasePath?: string;
}

export interface StoredMediaResult {
  filename: string;
  size: number;
  mimeType: string;
  url: string;
  relativePath: string;
  providerUsed: string;
}

function hmacSha256(key: string | Buffer, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function uploadToCloudflareR2(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  cfg: MediaStorageConfig,
): Promise<StoredMediaResult> {
  const accountId = String(cfg.r2AccountId || '').trim();
  const accessKeyId = String(cfg.r2AccessKeyId || '').trim();
  const secretAccessKey = String(cfg.r2SecretAccessKey || '').trim();
  const bucket = String(cfg.r2BucketName || 'royal-media').trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('Configuration Cloudflare R2 incomplète (Account ID, Access Key, Secret Key ou Bucket manquant).');
  }

  const host = `${accountId}.r2.cloudflarestorage.com`;
  const objectKey = `branding/${filename}`;
  const canonicalUri = `/${encodeURIComponent(bucket)}/${objectKey}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const region = 'auto';
  const service = 's3';
  const payloadHash = sha256Hex(buffer);

  const canonicalHeaders =
    `content-type:${mimeType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = hmacSha256(kSigning, stringToSign).toString('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const endpointUrl = `https://${host}${canonicalUri}`;
  const res = await fetch(endpointUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: authorization,
    },
    body: new Uint8Array(buffer),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Échec upload Cloudflare R2 (HTTP ${res.status}): ${errText.slice(0, 180)}`);
  }

  const publicBase = String(cfg.r2PublicBaseUrl || '').trim().replace(/\/+$/, '');
  const finalUrl = publicBase
    ? `${publicBase}/${objectKey}`
    : `/api/v1/storefront-cms/media/${filename}`;

  return {
    filename,
    size: buffer.length,
    mimeType,
    url: finalUrl,
    relativePath: finalUrl,
    providerUsed: 'CLOUDFLARE_R2',
  };
}

async function uploadToCloudinary(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  cfg: MediaStorageConfig,
): Promise<StoredMediaResult> {
  const cloudName = String(cfg.cloudinaryCloudName || '').trim();
  const uploadPreset = String(cfg.cloudinaryUploadPreset || '').trim();
  const apiKey = String(cfg.cloudinaryApiKey || '').trim();
  const apiSecret = String(cfg.cloudinaryApiSecret || '').trim();

  if (!cloudName || (!uploadPreset && (!apiKey || !apiSecret))) {
    throw new Error('Configuration Cloudinary incomplète (Cloud Name + Upload Preset ou API Key/Secret requis).');
  }

  const form = new FormData();
  const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;
  form.append('file', dataUri);
  form.append('folder', 'royal_branding');
  form.append('public_id', path.basename(filename, path.extname(filename)));

  if (uploadPreset) {
    form.append('upload_preset', uploadPreset);
  } else {
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = path.basename(filename, path.extname(filename));
    const toSign = `folder=royal_branding&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(toSign).digest('hex');
    form.append('api_key', apiKey);
    form.append('timestamp', String(timestamp));
    form.append('signature', signature);
  }

  const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
    method: 'POST',
    body: form,
  });

  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json?.secure_url) {
    throw new Error(json?.error?.message || `Échec upload Cloudinary (HTTP ${res.status}).`);
  }

  return {
    filename,
    size: buffer.length,
    mimeType,
    url: json.secure_url,
    relativePath: json.secure_url,
    providerUsed: 'CLOUDINARY',
  };
}

export async function storeMediaAsset(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  cfg: Partial<MediaStorageConfig> | undefined,
  uploadDir: string,
): Promise<StoredMediaResult> {
  const provider = cfg?.provider || 'AUTO_VPS_OR_VERCEL';
  const mergedCfg: MediaStorageConfig = {
    provider,
    webpEnabled: cfg?.webpEnabled ?? true,
    webpQuality: cfg?.webpQuality ?? 0.85,
    maxWidthPx: cfg?.maxWidthPx ?? 1920,
    ...cfg,
  };

  if (provider === 'CLOUDFLARE_R2') {
    return uploadToCloudflareR2(buffer, filename, mimeType, mergedCfg);
  }

  if (provider === 'CLOUDINARY') {
    return uploadToCloudinary(buffer, filename, mimeType, mergedCfg);
  }

  if (provider === 'VERCEL_DATA_URI' || (provider === 'AUTO_VPS_OR_VERCEL' && process.env.VERCEL)) {
    const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
    return {
      filename,
      size: buffer.length,
      mimeType,
      url: dataUrl,
      relativePath: dataUrl,
      providerUsed: 'VERCEL_DATA_URI',
    };
  }

  // LOCAL_DISK or AUTO on VPS/Docker
  const fullPath = path.join(uploadDir, filename);
  fs.writeFileSync(fullPath, buffer);
  return {
    filename,
    size: buffer.length,
    mimeType,
    url: `/api/v1/storefront-cms/media/${filename}`,
    relativePath: `/api/v1/storefront-cms/media/${filename}`,
    providerUsed: 'LOCAL_DISK',
  };
}
