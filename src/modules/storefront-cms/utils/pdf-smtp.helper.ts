import * as net from 'net';
import * as tls from 'tls';

export interface PdfLineItem {
  label: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface DocumentPdfOptions {
  docTitle: string;
  reference: string;
  orderReference: string;
  issueDate: string;
  companyName: string;
  companyAddress: string;
  companyTaxId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  shippingAddress?: string;
  city?: string;
  paymentMethod?: string;
  items: PdfLineItem[];
  subtotalTnd: number;
  shippingTnd: number;
  discountTnd: number;
  taxTnd: number;
  fiscalStampTnd: number;
  totalTnd: number;
  isDeliverySlip?: boolean;
  statusLabel?: string;
}

function escapePdfText(input: string, fallback = ''): string {
  // Normalize French/Latin accents safely into clean ASCII-compatible WinAnsi or strip non-Latin glyphs safely
  const clean = String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
  return clean || fallback;
}

/**
 * Generates a compact, standards-compliant single-page A4 %PDF-1.4 document using built-in Helvetica.
 */
export function buildDocumentPdfBuffer(opts: DocumentPdfOptions): Buffer {
  const ops: string[] = [];
  const text = (x: number, y: number, font: 'F1' | 'F2', size: number, value: string, maxLen = 78) => {
    const truncated = escapePdfText(value).slice(0, maxLen);
    ops.push(`BT /${font} ${size} Tf ${x} ${y} Td (${truncated}) Tj ET`);
  };
  const line = (x1: number, y1: number, x2: number, y2: number, w = 0.6) => {
    ops.push(`${w} w ${x1} ${y1} m ${x2} ${y2} l S`);
  };

  // Gold accent bar
  ops.push('0.773 0.608 0.153 rg 40 795 515 4 re f');
  ops.push('0.114 0.137 0.180 rg');

  // Header
  text(40, 772, 'F2', 16, opts.companyName || 'ROYAL LUXURY LIVING', 48);
  text(40, 756, 'F1', 9, opts.companyAddress || 'Mahdia 5100, Tunisie', 60);
  if (opts.companyTaxId) {
    text(40, 744, 'F1', 9, `Matricule Fiscal : ${opts.companyTaxId}`, 55);
  }

  text(340, 772, 'F2', 14, opts.docTitle, 38);
  text(340, 756, 'F2', 10, `Ref : ${opts.reference}`, 38);
  text(340, 743, 'F1', 9, `Commande : ${opts.orderReference}`, 38);
  text(340, 731, 'F1', 9, `Date : ${opts.issueDate}`, 38);

  ops.push('0.85 0.85 0.85 RG');
  line(40, 718, 555, 718, 0.8);

  // Customer Info Box
  text(40, 698, 'F2', 10, 'DESTINATAIRE', 30);
  text(40, 684, 'F1', 10, `Client : ${opts.customerName}`, 52);
  text(40, 671, 'F1', 9, `Tel : ${opts.customerPhone || '-'} | Email : ${opts.customerEmail || '-'}`, 65);
  text(40, 658, 'F1', 9, `Adresse : ${opts.shippingAddress || '-'} (${opts.city || 'Tunisie'})`, 78);
  if (opts.paymentMethod) {
    text(40, 645, 'F1', 9, `Reglement : ${opts.paymentMethod}`, 55);
  }

  // Items table header
  ops.push('0.96 0.96 0.96 rg 40 612 515 20 re f');
  ops.push('0.114 0.137 0.180 rg');
  text(46, 619, 'F2', 9, 'DESIGNATION ARTICLE', 40);
  text(335, 619, 'F2', 9, 'QTE', 6);
  if (!opts.isDeliverySlip) {
    text(390, 619, 'F2', 9, 'PU TTC', 12);
    text(480, 619, 'F2', 9, 'TOTAL TTC', 12);
  } else {
    text(390, 619, 'F2', 9, 'SKU / REF', 20);
  }

  let y = 594;
  const visibleItems = (opts.items || []).slice(0, 18);
  for (const item of visibleItems) {
    text(46, y, 'F1', 9, escapePdfText(item.label, item.sku || 'Article'), 46);
    text(338, y, 'F1', 9, String(item.quantity || 1), 6);
    if (!opts.isDeliverySlip) {
      text(390, y, 'F1', 9, `${Number(item.unitPrice || 0).toFixed(3)} TND`, 16);
      text(480, y, 'F2', 9, `${Number(item.totalPrice || 0).toFixed(3)} TND`, 16);
    } else {
      text(390, y, 'F1', 9, item.sku || '-', 22);
    }
    ops.push('0.92 0.92 0.92 RG');
    line(40, y - 6, 555, y - 6, 0.4);
    ops.push('0.114 0.137 0.180 rg');
    y -= 20;
    if (y < 210) break;
  }

  if (opts.items.length > visibleItems.length) {
    text(46, y, 'F1', 8, `... +${opts.items.length - visibleItems.length} autre(s) article(s)`, 50);
    y -= 18;
  }

  // Totals block
  const summaryY = Math.min(y - 16, 200);
  ops.push('0.85 0.85 0.85 RG');
  line(320, summaryY + 12, 555, summaryY + 12, 0.8);
  ops.push('0.114 0.137 0.180 rg');

  if (!opts.isDeliverySlip) {
    text(330, summaryY - 4, 'F1', 9, 'Sous-total articles :', 28);
    text(465, summaryY - 4, 'F1', 9, `${opts.subtotalTnd.toFixed(3)} TND`, 18);
    text(330, summaryY - 18, 'F1', 9, 'Livraison :', 28);
    text(465, summaryY - 18, 'F1', 9, opts.shippingTnd === 0 ? 'OFFERT' : `${opts.shippingTnd.toFixed(3)} TND`, 18);
    if (opts.discountTnd > 0) {
      text(330, summaryY - 32, 'F1', 9, 'Remise promo :', 28);
      text(465, summaryY - 32, 'F1', 9, `-${opts.discountTnd.toFixed(3)} TND`, 18);
    }
    text(330, summaryY - 46, 'F1', 9, 'Dont TVA (19%) + Timbre :', 30);
    text(465, summaryY - 46, 'F1', 9, `${opts.taxTnd.toFixed(3)} + ${opts.fiscalStampTnd.toFixed(3)} TND`, 24);
    text(330, summaryY - 66, 'F2', 11, 'NET A PAYER :', 20);
    text(465, summaryY - 66, 'F2', 11, `${opts.totalTnd.toFixed(3)} TND`, 18);
  } else {
    const qtyTotal = opts.items.reduce((s, it) => s + Number(it.quantity || 1), 0);
    text(330, summaryY - 4, 'F2', 10, `Total Colis / Articles : ${qtyTotal}`, 34);
    text(330, summaryY - 22, 'F1', 9, `Statut : ${escapePdfText(opts.statusLabel || 'EN COURS', 'EN COURS')}`, 34);
  }

  // Footer
  text(40, 48, 'F1', 8, 'Document genere par Royal ERP - Merci pour votre confiance.', 80);

  const streamContent = ops.join('\n');
  const objs: string[] = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >> endobj\n',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n',
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj\n',
    `6 0 obj << /Length ${Buffer.byteLength(streamContent, 'utf8')} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objs) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
}

export interface SmtpConfigPayload {
  host: string;
  port: number;
  user: string;
  password: string;
  secure?: boolean;
  fromEmail?: string;
  fromName?: string;
}

export interface SmtpAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
  cid?: string;
  disposition?: 'attachment' | 'inline';
}

function cleanHeaderToken(input: string): string {
  return String(input || '').replace(/[\r\n\0"<>]+/g, ' ').trim();
}

function encodeRfc2047(text: string): string {
  return `=?UTF-8?B?${Buffer.from(String(text || '').replace(/[\r\n\0]+/g, ' '), 'utf8').toString('base64')}?=`;
}

function chunkBase64(buf: Buffer): string {
  const b64 = buf.toString('base64');
  return b64.replace(/(.{76})/g, '$1\r\n');
}

function buildHtmlPartLines(htmlBody: string): string[] {
  return [
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    chunkBase64(Buffer.from(htmlBody, 'utf8')),
    '',
  ];
}

function buildInlinePartLines(att: SmtpAttachment): string[] {
  const cleanCid = cleanHeaderToken(att.cid || att.filename).replace(/^<|>$/g, '');
  const safeName = cleanHeaderToken(att.filename) || 'inline.bin';
  const safeType = cleanHeaderToken(att.contentType) || 'application/octet-stream';
  return [
    `Content-Type: ${safeType}; name="${safeName}"`,
    'Content-Transfer-Encoding: base64',
    `Content-ID: <${cleanCid}>`,
    `Content-Disposition: inline; filename="${safeName}"`,
    '',
    chunkBase64(att.content),
    '',
  ];
}

/**
 * Pure-Node zero-dependency SMTP client supporting implicit TLS (465), STARTTLS (587), AUTH LOGIN,
 * RFC 2387 multipart/related inline CID images, and multipart/mixed document attachments.
 */
export async function sendSmtpMailWithAttachments(
  cfg: SmtpConfigPayload,
  mail: {
    to: string;
    subject: string;
    htmlBody: string;
    attachments?: SmtpAttachment[];
    inlineAttachments?: SmtpAttachment[];
  },
): Promise<{ accepted: boolean; message: string }> {
  const host = String(cfg.host || '').trim();
  const port = Number(cfg.port || 587);
  const user = String(cfg.user || '').trim();
  const password = String(cfg.password || '');
  const fromEmail = cleanHeaderToken(cfg.fromEmail || user || 'noreply@royal.com.tn');
  const fromName = String(cfg.fromName || 'Royal Electro de Maison').trim();
  const toEmail = cleanHeaderToken(mail.to);

  if (!host || !user || !password) {
    throw new Error('Paramètres SMTP incomplets (hôte, utilisateur ou mot de passe manquant dans /dashboard/root/smtp).');
  }

  const allAtts = mail.attachments || [];
  const explicitInlines = mail.inlineAttachments || [];
  const inlineList = [
    ...explicitInlines,
    ...allAtts.filter((a) => Boolean(a.cid) || a.disposition === 'inline'),
  ];
  const fileAtts = allAtts.filter((a) => !a.cid && a.disposition !== 'inline');

  const uniqSuffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const mixedBoundary = `royal_mix_${uniqSuffix}`;
  const relBoundary = `royal_rel_${uniqSuffix}`;

  const lines: string[] = [
    `From: ${encodeRfc2047(fromName)} <${fromEmail}>`,
    `To: <${toEmail}>`,
    `Subject: ${encodeRfc2047(mail.subject)}`,
    'MIME-Version: 1.0',
  ];

  if (fileAtts.length > 0 && inlineList.length > 0) {
    lines.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`, '');
    lines.push(`--${mixedBoundary}`);
    lines.push(`Content-Type: multipart/related; boundary="${relBoundary}"; type="text/html"`, '');
    lines.push(`--${relBoundary}`);
    lines.push(...buildHtmlPartLines(mail.htmlBody));
    for (const att of inlineList) {
      lines.push(`--${relBoundary}`);
      lines.push(...buildInlinePartLines(att));
    }
    lines.push(`--${relBoundary}--`, '');
  } else if (inlineList.length > 0) {
    lines.push(`Content-Type: multipart/related; boundary="${relBoundary}"; type="text/html"`, '');
    lines.push(`--${relBoundary}`);
    lines.push(...buildHtmlPartLines(mail.htmlBody));
    for (const att of inlineList) {
      lines.push(`--${relBoundary}`);
      lines.push(...buildInlinePartLines(att));
    }
    lines.push(`--${relBoundary}--`, '');
  } else {
    lines.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`, '');
    lines.push(`--${mixedBoundary}`);
    lines.push(...buildHtmlPartLines(mail.htmlBody));
  }

  if (fileAtts.length > 0) {
    for (const att of fileAtts) {
      const safeName = cleanHeaderToken(att.filename) || 'document.pdf';
      const safeType = cleanHeaderToken(att.contentType) || 'application/octet-stream';
      lines.push(`--${mixedBoundary}`);
      lines.push(`Content-Type: ${safeType}; name="${safeName}"`);
      lines.push('Content-Transfer-Encoding: base64');
      lines.push(`Content-Disposition: attachment; filename="${safeName}"`);
      lines.push('');
      lines.push(chunkBase64(att.content));
      lines.push('');
    }
    lines.push(`--${mixedBoundary}--`, '');
  } else if (inlineList.length === 0) {
    lines.push(`--${mixedBoundary}--`, '');
  }

  // Escape any leading dots per RFC 5321 Section 4.5.2
  const rawMime = lines.join('\r\n').replace(/^\./gm, '..') + '\r\n.\r\n';
  const allowSelfSigned = process.env.SMTP_ALLOW_SELF_SIGNED === 'true';

  return new Promise((resolve, reject) => {
    const useImplicitTls = port === 465 || cfg.secure === true;
    let socket: net.Socket | tls.TLSSocket = useImplicitTls
      ? tls.connect({ host, port, rejectUnauthorized: !allowSelfSigned })
      : net.createConnection({ host, port });

    let buffer = '';
    let settled = false;
    let step = 'GREETING';

    const finishErr = (err: Error) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      reject(err);
    };

    const writeCmd = (cmd: string) => {
      socket.write(`${cmd}\r\n`);
    };

    socket.setTimeout(12000);
    socket.on('timeout', () => finishErr(new Error(`Délai expiré (12s) sur ${host}:${port}.`)));
    socket.on('error', (err) => finishErr(new Error(`Erreur connexion SMTP ${host}:${port}: ${err.message}`)));

    const attachDataHandler = (sock: net.Socket | tls.TLSSocket) => {
      sock.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        while (true) {
          const idx = buffer.indexOf('\r\n');
          if (idx === -1) break;
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          // Multi-line SMTP reply ends only when 4th char is space
          if (line.length >= 4 && line[3] === '-') continue;

          const code = Number(line.slice(0, 3));
          if (!code || code >= 400) {
            finishErr(new Error(`Serveur SMTP ${host}:${port} a répondu : ${line}`));
            return;
          }

          if (step === 'GREETING' && code === 220) {
            step = 'EHLO_1';
            writeCmd(`EHLO royal.com.tn`);
          } else if (step === 'EHLO_1' && code === 250) {
            if (!useImplicitTls && port === 587) {
              step = 'STARTTLS';
              writeCmd('STARTTLS');
            } else {
              step = 'AUTH';
              writeCmd('AUTH LOGIN');
            }
          } else if (step === 'STARTTLS' && code === 220) {
            buffer = '';
            const upgraded = tls.connect({ socket: sock, servername: host, rejectUnauthorized: !allowSelfSigned });
            upgraded.on('error', (err) => finishErr(new Error(`Erreur STARTTLS : ${err.message}`)));
            upgraded.on('timeout', () => finishErr(new Error('Délai STARTTLS expiré.')));
            upgraded.on('secureConnect', () => {
              socket = upgraded;
              step = 'EHLO_2';
              writeCmd('EHLO royal.com.tn');
            });
            attachDataHandler(upgraded);
            return;
          } else if (step === 'EHLO_2' && code === 250) {
            step = 'AUTH';
            writeCmd('AUTH LOGIN');
          } else if (step === 'AUTH' && code === 334) {
            step = 'AUTH_USER';
            writeCmd(Buffer.from(user, 'utf8').toString('base64'));
          } else if (step === 'AUTH_USER' && code === 334) {
            step = 'AUTH_PASS';
            writeCmd(Buffer.from(password, 'utf8').toString('base64'));
          } else if (step === 'AUTH_PASS' && code === 235) {
            step = 'MAIL_FROM';
            writeCmd(`MAIL FROM:<${fromEmail}>`);
          } else if (step === 'MAIL_FROM' && code === 250) {
            step = 'RCPT_TO';
            writeCmd(`RCPT TO:<${mail.to}>`);
          } else if (step === 'RCPT_TO' && (code === 250 || code === 251)) {
            step = 'DATA_CMD';
            writeCmd('DATA');
          } else if (step === 'DATA_CMD' && code === 354) {
            step = 'DATA_BODY';
            socket.write(rawMime);
          } else if (step === 'DATA_BODY' && code === 250) {
            step = 'QUIT';
            writeCmd('QUIT');
            settled = true;
            setTimeout(() => {
              try {
                socket.end();
              } catch {
                // ignore
              }
            }, 100);
            resolve({ accepted: true, message: `Email transmis avec succès à ${mail.to}.` });
            return;
          }
        }
      });
    };

    attachDataHandler(socket);
  });
}
