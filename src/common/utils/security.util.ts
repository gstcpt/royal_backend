import * as crypto from 'node:crypto';
import * as net from 'node:net';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SENSITIVE_KEY_RE =
  /password|passphrase|secret|token|apikey|privatekey|credential|webhooksecret|accesskey|appsecret|app_token|secretkey|authorization|jwt/i;

/**
 * Recursively clones an audit payload while masking sensitive keys (passwords, tokens, API secrets).
 */
export function redactAuditSecrets(value: any, depth = 0): any {
  if (value === null || value === undefined) return value ?? null;
  if (depth > 8) return '[TRUNCATED]';
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (Buffer.isBuffer(value)) return `[BUFFER:${value.length}]`;
  if (Array.isArray(value)) {
    return value.map((item) => redactAuditSecrets(item, depth + 1));
  }
  const out: Record<string, any> = {};
  for (const [key, val] of Object.entries(value)) {
    if (SENSITIVE_KEY_RE.test(key)) {
      out[key] = '[PROTECTED]';
    } else {
      out[key] = redactAuditSecrets(val, depth + 1);
    }
  }
  return out;
}

const DEV_FALLBACK_JWT_SECRET = 'royal_jwt_super_access_secret_key_dev_2026!';

/**
 * Resolves the JWT signing secret cleanly; refuses weak fallback secrets in production.
 */
export function getJwtAccessSecret(configService?: ConfigService): string {
  const secret = String(configService?.get<string>('JWT_ACCESS_SECRET') ?? process.env.JWT_ACCESS_SECRET ?? '').trim();
  if (secret.length >= 16) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_ACCESS_SECRET must be configured with at least 16 characters in production.');
  }
  return secret || DEV_FALLBACK_JWT_SECRET;
}

/**
 * Generates an HMAC proof token bound to an order ID and reference so guest confirmation links
 * cannot be enumerated without authorization.
 */
export function generateOrderProofToken(orderId: string, reference: string): string {
  const secret = getJwtAccessSecret();
  return crypto
    .createHmac('sha256', `${secret}:order-proof`)
    .update(`${orderId}:${reference}`)
    .digest('hex')
    .slice(0, 32);
}

export function verifyOrderProofToken(orderId: string, reference: string, token?: string): boolean {
  const candidate = String(token || '').trim();
  if (!candidate) return false;
  const expected = generateOrderProofToken(orderId, reference);
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Guards outbound TCP/SMTP diagnostic probes against SSRF into loopback, link-local, or private metadata hosts.
 */
export function assertSafeExternalHost(rawHost: string): string {
  const host = String(rawHost || '').trim().toLowerCase();
  if (!host || /[\s/\\@#]/.test(host)) {
    throw new BadRequestException('Nom d’hôte invalide.');
  }
  if (process.env.ALLOW_LOCAL_SMTP === 'true') {
    return rawHost.trim();
  }
  if (
    host === 'localhost' ||
    host === '::1' ||
    host === '[::1]' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    throw new BadRequestException('Hôte interne ou local non autorisé pour le test réseau.');
  }
  const ipVer = net.isIP(host.replace(/^\[|\]$/g, ''));
  if (ipVer === 4) {
    const [a, b] = host.split('.').map(Number);
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    ) {
      throw new BadRequestException('Adresse IP privée ou de métadonnées non autorisée.');
    }
  } else if (ipVer === 6) {
    const clean = host.replace(/^\[|\]$/g, '');
    if (clean === '::1' || clean.startsWith('fc') || clean.startsWith('fd') || clean.startsWith('fe80')) {
      throw new BadRequestException('Adresse IPv6 privée ou locale non autorisée.');
    }
  }
  return rawHost.trim();
}

/**
 * Shared normalizer for snake_case system/attribute/variant codes.
 */
export function normalizeSystemCode(input: string): string {
  return String(input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)+/g, '');
}
