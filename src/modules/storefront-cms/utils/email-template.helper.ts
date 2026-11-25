import { PrismaService } from '../../../database/prisma.service';
import { sendSmtpMailWithAttachments, SmtpAttachment } from './pdf-smtp.helper';

export type EmailLocale = 'FR' | 'AR';

export interface LuxuryEmailTemplateSeed {
  key: string;
  name: string;
  subject: string;
  subjectAr: string;
  bodyHtml: string;
  bodyHtmlAr: string;
  variables: string[];
}

export interface EmailIdentityInfo {
  appName: string;
  companyName: string;
  logoUrl: string;
  email: string;
  phone: string;
  address: string;
  websiteUrl: string;
  smtpCfg: Record<string, any>;
}

const DEFAULT_WEBSITE_URL = 'https://royal.com.tn';

export const DEFAULT_LUXURY_EMAIL_TEMPLATES: LuxuryEmailTemplateSeed[] = [
  {
    key: 'auth:welcome',
    name: 'Bienvenue Nouveau Client',
    subject: 'Bienvenue chez {{appName}}, {{firstName}} !',
    subjectAr: 'مرحباً بك في {{appName}}، {{firstName}}!',
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:15px;color:#1D232E;">Bonjour <strong>{{firstName}} {{lastName}}</strong>,</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#475569;">
        Nous sommes ravis de vous accueillir dans l'univers <strong>{{appName}}</strong>. Votre espace client est désormais actif et vous donne accès au suivi de vos commandes, à votre liste d'envies ainsi qu'à nos privilèges VIP.
      </p>
      <div style="margin:20px 0;padding:18px;border-radius:14px;background:#FBF9F4;border:1px solid #E6D6A6;">
        <div style="font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#9A7414;margin-bottom:6px;">Identifiant Client</div>
        <div style="font-size:14px;font-weight:700;color:#1D232E;">{{email}}</div>
      </div>
      <div style="margin:24px 0 8px;">
        <a href="{{storeUrl}}" style="display:inline-block;background:#C59B27;color:#FFFFFF;text-decoration:none;padding:12px 26px;border-radius:999px;font-size:13px;font-weight:700;">Découvrir la Boutique Royal</a>
      </div>
    `.trim(),
    bodyHtmlAr: `
      <p style="margin:0 0 12px;font-size:15px;color:#1D232E;">مرحباً <strong>{{firstName}} {{lastName}}</strong>،</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.8;color:#475569;">
        يسعدنا انضمامك إلى عائلة <strong>{{appName}}</strong>. تم تفعيل حسابك الشخصي بنجاح لمتابعة طلباتك والاستفادة من عروضنا الحصرية.
      </p>
      <div style="margin:20px 0;padding:18px;border-radius:14px;background:#FBF9F4;border:1px solid #E6D6A6;">
        <div style="font-size:11px;font-weight:800;color:#9A7414;margin-bottom:6px;">البريد الإلكتروني المسجل</div>
        <div style="font-size:14px;font-weight:700;color:#1D232E;direction:ltr;unicode-bidi:embed;">{{email}}</div>
      </div>
      <div style="margin:24px 0 8px;">
        <a href="{{storeUrl}}" style="display:inline-block;background:#C59B27;color:#FFFFFF;text-decoration:none;padding:12px 26px;border-radius:999px;font-size:13px;font-weight:700;">تصفح المتجر الآن</a>
      </div>
    `.trim(),
    variables: ['{{appName}}', '{{firstName}}', '{{lastName}}', '{{email}}', '{{storeUrl}}'],
  },
  {
    key: 'auth:verify_email',
    name: 'Confirmation d’Adresse Email (OTP)',
    subject: '{{appName}} — Votre code de vérification : {{otpCode}}',
    subjectAr: '{{appName}} — رمز التحقق الخاص بك : {{otpCode}}',
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:15px;color:#1D232E;">Bonjour <strong>{{firstName}}</strong>,</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#475569;">
        Utilisez le code de vérification sécurisé ci-dessous (valable <strong>{{expireTime}}</strong>) pour confirmer votre adresse e-mail sur <strong>{{appName}}</strong> :
      </p>
      <div style="margin:22px 0;padding:20px;border-radius:16px;background:#FBF6E8;border:1px solid #E6D6A6;text-align:center;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.6px;color:#9A7414;font-weight:800;margin-bottom:8px;">Code de Vérification</div>
        <span style="font-family:'Courier New',monospace;font-size:30px;font-weight:900;letter-spacing:8px;color:#1D232E;">{{otpCode}}</span>
      </div>
      <p style="margin:0;font-size:12px;color:#64748B;line-height:1.6;">
        Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.
      </p>
    `.trim(),
    bodyHtmlAr: `
      <p style="margin:0 0 12px;font-size:15px;color:#1D232E;">مرحباً <strong>{{firstName}}</strong>،</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.8;color:#475569;">
        يرجى استخدام رمز التحقق التالي (صالح لمدة <strong>{{expireTime}}</strong>) لتأكيد بريدك الإلكتروني على منصة <strong>{{appName}}</strong>:
      </p>
      <div style="margin:22px 0;padding:20px;border-radius:16px;background:#FBF6E8;border:1px solid #E6D6A6;text-align:center;">
        <div style="font-size:11px;color:#9A7414;font-weight:800;margin-bottom:8px;">رمز التحقق السري</div>
        <span style="font-family:'Courier New',monospace;font-size:30px;font-weight:900;letter-spacing:6px;color:#1D232E;direction:ltr;unicode-bidi:embed;">{{otpCode}}</span>
      </div>
      <p style="margin:0;font-size:12px;color:#64748B;line-height:1.7;">
        إذا لم تطلب هذا الرمز، يمكنك تجاهل هذه الرسالة بأمان.
      </p>
    `.trim(),
    variables: ['{{appName}}', '{{firstName}}', '{{otpCode}}', '{{verifyLink}}', '{{expireTime}}'],
  },
  {
    key: 'auth:forgot_password',
    name: 'Mot de Passe Oublié / Réinitialisation',
    subject: 'Réinitialisation de votre mot de passe — {{appName}}',
    subjectAr: 'إعادة تعيين كلمة المرور — {{appName}}',
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:15px;color:#1D232E;">Bonjour <strong>{{firstName}}</strong>,</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#475569;">
        Nous avons reçu une demande d'assistance concernant la connexion à votre compte <strong>{{email}}</strong>. Pour des raisons de sécurité, la réinitialisation est validée par notre équipe ou via votre lien sécurisé ({{expireTime}}).
      </p>
      <div style="margin:22px 0;padding:16px 20px;border-radius:14px;background:#FBF9F4;border-left:4px solid #C59B27;">
        <p style="margin:0;font-size:13px;color:#1D232E;line-height:1.6;">
          Vous pouvez accéder directement à la page de connexion ou contacter notre support client au <strong>{{companyPhone}}</strong>.
        </p>
      </div>
      <div style="margin:20px 0 8px;">
        <a href="{{resetLink}}" style="display:inline-block;background:#1D232E;color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:13px;font-weight:700;">Accéder à Mon Espace</a>
      </div>
    `.trim(),
    bodyHtmlAr: `
      <p style="margin:0 0 12px;font-size:15px;color:#1D232E;">مرحباً <strong>{{firstName}}</strong>،</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.8;color:#475569;">
        تلقينا طلباً للمساعدة في استرجاع كلمة المرور الخاصة بحسابك <strong>{{email}}</strong>. لدواعي الأمان، يمكنك إتمام العملية عبر الرابط الآمن ({{expireTime}}) أو التواصل مع فريق الدعم.
      </p>
      <div style="margin:22px 0;padding:16px 20px;border-radius:14px;background:#FBF9F4;border-right:4px solid #C59B27;">
        <p style="margin:0;font-size:13px;color:#1D232E;line-height:1.7;">
          للمساعدة الفورية يمكنكم الاتصال بخدمة الحرفاء على الرقم <strong>{{companyPhone}}</strong>.
        </p>
      </div>
      <div style="margin:20px 0 8px;">
        <a href="{{resetLink}}" style="display:inline-block;background:#1D232E;color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:13px;font-weight:700;">تسجيل الدخول إلى الحساب</a>
      </div>
    `.trim(),
    variables: ['{{appName}}', '{{firstName}}', '{{email}}', '{{resetLink}}', '{{expireTime}}', '{{companyPhone}}'],
  },
  {
    key: 'auth:password_reset_admin',
    name: 'Nouveau Mot de Passe Temporaire (Admin)',
    subject: '{{appName}} — Nouveau mot de passe temporaire',
    subjectAr: '{{appName}} — كلمة المرور المؤقتة الجديدة',
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:15px;color:#1D232E;">Bonjour <strong>{{firstName}} {{lastName}}</strong>,</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#475569;">
        Votre mot de passe d'accès à la plateforme <strong>{{appName}}</strong> vient d'être réinitialisé par l'administration. Voici vos identifiants temporaires :
      </p>
      <div style="margin:20px 0;padding:18px;border-radius:14px;background:#FBF6E8;border:1px solid #E6D6A6;text-align:center;">
        <div style="font-size:11px;text-transform:uppercase;color:#9A7414;font-weight:800;margin-bottom:6px;">Identifiant : {{email}}</div>
        <span style="font-family:'Courier New',monospace;font-size:22px;font-weight:900;letter-spacing:1.5px;color:#1D232E;">{{generatedPassword}}</span>
      </div>
      <p style="margin:0 0 16px;font-size:12px;color:#64748B;line-height:1.6;">
        Toutes vos sessions actives ont été révoquées par sécurité. Veuillez modifier ce mot de passe dès votre prochaine connexion.
      </p>
      <div>
        <a href="{{loginUrl}}" style="display:inline-block;background:#C59B27;color:#FFFFFF;text-decoration:none;padding:11px 24px;border-radius:999px;font-size:13px;font-weight:700;">Se Connecter</a>
      </div>
    `.trim(),
    bodyHtmlAr: `
      <p style="margin:0 0 12px;font-size:15px;color:#1D232E;">مرحباً <strong>{{firstName}} {{lastName}}</strong>،</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.8;color:#475569;">
        تمت إعادة تعيين كلمة المرور الخاصة بحسابك على منصة <strong>{{appName}}</strong> من طرف الإدارة. إليك بيانات الدخول المؤقتة:
      </p>
      <div style="margin:20px 0;padding:18px;border-radius:14px;background:#FBF6E8;border:1px solid #E6D6A6;text-align:center;">
        <div style="font-size:11px;color:#9A7414;font-weight:800;margin-bottom:6px;">البريد الإلكتروني: {{email}}</div>
        <span style="font-family:'Courier New',monospace;font-size:22px;font-weight:900;letter-spacing:1.5px;color:#1D232E;direction:ltr;unicode-bidi:embed;">{{generatedPassword}}</span>
      </div>
      <p style="margin:0 0 16px;font-size:12px;color:#64748B;line-height:1.7;">
        تم إنهاء جميع الجلسات السابقة تلقائياً لحماية حسابك. ننصح بتغيير كلمة المرور فور تسجيل الدخول.
      </p>
      <div>
        <a href="{{loginUrl}}" style="display:inline-block;background:#C59B27;color:#FFFFFF;text-decoration:none;padding:11px 24px;border-radius:999px;font-size:13px;font-weight:700;">تسجيل الدخول</a>
      </div>
    `.trim(),
    variables: ['{{appName}}', '{{firstName}}', '{{lastName}}', '{{email}}', '{{generatedPassword}}', '{{loginUrl}}'],
  },
  {
    key: 'campaign:promo_general',
    name: 'Campagne Promotion & Vente Privée',
    subject: 'Offres Exclusives {{appName}} : Jusqu’à -{{discountPercent}}% !',
    subjectAr: 'عروض حصرية من {{appName}} : خصم يصل إلى {{discountPercent}}%!',
    bodyHtml: `
      <div style="margin:0 0 14px;display:inline-block;padding:5px 12px;border-radius:999px;background:#FBF6E8;border:1px solid #E6D6A6;color:#9A7414;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">Sélection Privilège</div>
      <p style="margin:0 0 12px;font-size:15px;color:#1D232E;">Bonjour <strong>{{firstName}}</strong>,</p>
      <div style="margin:0 0 18px;font-size:14px;line-height:1.75;color:#334155;">{{messageBody}}</div>
      <div style="margin:20px 0;padding:18px;border-radius:16px;background:#FBF9F4;border:1px dashed #C59B27;text-align:center;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#9A7414;margin-bottom:6px;">Code Avantage Exclusif (-{{discountPercent}}%)</div>
        <div style="font-family:'Courier New',monospace;font-size:24px;font-weight:900;letter-spacing:3px;color:#1D232E;">{{promoCode}}</div>
      </div>
      <div style="margin:22px 0 8px;text-align:center;">
        <a href="{{campaignUrl}}" style="display:inline-block;background:#C59B27;color:#FFFFFF;text-decoration:none;padding:13px 28px;border-radius:999px;font-size:13px;font-weight:800;">Profiter des Offres Maintenant</a>
      </div>
    `.trim(),
    bodyHtmlAr: `
      <div style="margin:0 0 14px;display:inline-block;padding:5px 12px;border-radius:999px;background:#FBF6E8;border:1px solid #E6D6A6;color:#9A7414;font-size:11px;font-weight:800;">عروض حصرية</div>
      <p style="margin:0 0 12px;font-size:15px;color:#1D232E;">مرحباً <strong>{{firstName}}</strong>،</p>
      <div style="margin:0 0 18px;font-size:14px;line-height:1.85;color:#334155;">{{messageBody}}</div>
      <div style="margin:20px 0;padding:18px;border-radius:16px;background:#FBF9F4;border:1px dashed #C59B27;text-align:center;">
        <div style="font-size:12px;font-weight:700;color:#9A7414;margin-bottom:6px;">رمز التخفيض الخاص ({{discountPercent}}%)</div>
        <div style="font-family:'Courier New',monospace;font-size:24px;font-weight:900;letter-spacing:3px;color:#1D232E;direction:ltr;unicode-bidi:embed;">{{promoCode}}</div>
      </div>
      <div style="margin:22px 0 8px;text-align:center;">
        <a href="{{campaignUrl}}" style="display:inline-block;background:#C59B27;color:#FFFFFF;text-decoration:none;padding:13px 28px;border-radius:999px;font-size:13px;font-weight:800;">اكتشف العروض الآن</a>
      </div>
    `.trim(),
    variables: ['{{appName}}', '{{firstName}}', '{{messageBody}}', '{{discountPercent}}', '{{promoCode}}', '{{campaignUrl}}'],
  },
  {
    key: 'campaign:vip_launch',
    name: 'Nouvelle Collection & Invitation VIP',
    subject: 'Nouvelle Collection {{appName}} — Avant-Première VIP',
    subjectAr: 'تشكيلة {{appName}} الجديدة — دعوة خاصة لكبار الشخصيات',
    bodyHtml: `
      <div style="margin:0 0 14px;display:inline-block;padding:5px 12px;border-radius:999px;background:#FBF6E8;border:1px solid #E6D6A6;color:#9A7414;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">Avant-Première VIP</div>
      <p style="margin:0 0 12px;font-size:15px;color:#1D232E;">Bonjour <strong>{{firstName}}</strong>,</p>
      <div style="margin:0 0 18px;font-size:14px;line-height:1.75;color:#334155;">{{messageBody}}</div>
      <div style="margin:20px 0;padding:16px 20px;border-radius:14px;background:#FBF9F4;border-left:4px solid #C59B27;">
        <p style="margin:0;font-size:13px;color:#1D232E;">Livraison express sur toute la Tunisie • Garantie constructeur officielle • Paiement à la livraison</p>
      </div>
      <div style="margin:22px 0 8px;">
        <a href="{{campaignUrl}}" style="display:inline-block;background:#1D232E;color:#FFFFFF;text-decoration:none;padding:12px 26px;border-radius:999px;font-size:13px;font-weight:700;">Découvrir les Nouveautés</a>
      </div>
    `.trim(),
    bodyHtmlAr: `
      <div style="margin:0 0 14px;display:inline-block;padding:5px 12px;border-radius:999px;background:#FBF6E8;border:1px solid #E6D6A6;color:#9A7414;font-size:11px;font-weight:800;">عرض حصري أولي</div>
      <p style="margin:0 0 12px;font-size:15px;color:#1D232E;">مرحباً <strong>{{firstName}}</strong>،</p>
      <div style="margin:0 0 18px;font-size:14px;line-height:1.85;color:#334155;">{{messageBody}}</div>
      <div style="margin:20px 0;padding:16px 20px;border-radius:14px;background:#FBF9F4;border-right:4px solid #C59B27;">
        <p style="margin:0;font-size:13px;color:#1D232E;">توصيل سريع إلى كافة ولايات الجمهورية • ضمان رسمي • الدفع عند الاستلام</p>
      </div>
      <div style="margin:22px 0 8px;">
        <a href="{{campaignUrl}}" style="display:inline-block;background:#1D232E;color:#FFFFFF;text-decoration:none;padding:12px 26px;border-radius:999px;font-size:13px;font-weight:700;">تصفح التشكيلة الجديدة</a>
      </div>
    `.trim(),
    variables: ['{{appName}}', '{{firstName}}', '{{messageBody}}', '{{campaignUrl}}'],
  },
  {
    key: 'messages:support_reply',
    name: 'Réponse Support & Formulaire Contact',
    subject: 'Re: {{subject}} — Service Client {{appName}}',
    subjectAr: 'رد بخصوص: {{subject}} — خدمة حرفاء {{appName}}',
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:15px;color:#1D232E;">Bonjour <strong>{{customerName}}</strong>,</p>
      <div style="margin:14px 0 18px;padding:18px;border-radius:14px;background:#FBF9F4;border:1px solid #E6E1D6;border-left:4px solid #C59B27;font-size:14px;line-height:1.75;color:#1D232E;">
        {{replyBody}}
      </div>
      <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">
        Notre équipe reste à votre écoute au <strong>{{companyPhone}}</strong> ou par retour d'e-mail.<br/>
        Bien cordialement,<br/>
        <strong style="color:#9A7414;">Service Clientèle — {{appName}}</strong>
      </p>
    `.trim(),
    bodyHtmlAr: `
      <p style="margin:0 0 12px;font-size:15px;color:#1D232E;">مرحباً <strong>{{customerName}}</strong>،</p>
      <div style="margin:14px 0 18px;padding:18px;border-radius:14px;background:#FBF9F4;border:1px solid #E6E1D6;border-right:4px solid #C59B27;font-size:14px;line-height:1.85;color:#1D232E;">
        {{replyBody}}
      </div>
      <p style="margin:0;font-size:13px;color:#475569;line-height:1.8;">
        يبقى فريقنا على ذمتكم عبر الهاتف <strong>{{companyPhone}}</strong> أو عبر البريد الإلكتروني.<br/>
        مع فائق التقدير،<br/>
        <strong style="color:#9A7414;">خدمة الحرفاء — {{appName}}</strong>
      </p>
    `.trim(),
    variables: ['{{appName}}', '{{customerName}}', '{{subject}}', '{{replyBody}}', '{{companyPhone}}'],
  },
  {
    key: 'orders:status_update',
    name: 'Confirmation Livraison & Documents Commande (FAC/BL)',
    subject: '{{appName}} — Commande #{{orderNumber}} : {{statusLabel}}',
    subjectAr: '{{appName}} — طلبكم رقم #{{orderNumber}} : {{statusLabel}}',
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:15px;color:#1D232E;">Bonjour <strong>{{customerName}}</strong>,</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#475569;">
        Nous vous confirmons le suivi de votre commande <strong>#{{orderNumber}}</strong>.
      </p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:16px 0;background:#FBF9F4;border:1px solid #E6E1D6;border-radius:12px;">
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #E6E1D6;font-size:12px;font-weight:700;color:#64748B;">Référence</td>
          <td style="padding:10px 14px;border-bottom:1px solid #E6E1D6;font-size:13px;font-weight:800;color:#1D232E;text-align:right;">#{{orderNumber}}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #E6E1D6;font-size:12px;font-weight:700;color:#64748B;">Statut</td>
          <td style="padding:10px 14px;border-bottom:1px solid #E6E1D6;font-size:13px;font-weight:800;color:#9A7414;text-align:right;">{{statusLabel}}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #E6E1D6;font-size:12px;font-weight:700;color:#64748B;">Montant Total</td>
          <td style="padding:10px 14px;border-bottom:1px solid #E6E1D6;font-size:13px;font-weight:800;color:#1D232E;text-align:right;">{{totalAmount}}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-size:12px;font-weight:700;color:#64748B;">Documents Joints</td>
          <td style="padding:10px 14px;font-size:12px;font-weight:700;color:#1D232E;text-align:right;">{{documentsList}}</td>
        </tr>
      </table>
      {{customNoteBlock}}
      <div style="margin:20px 0 8px;">
        <a href="{{trackingUrl}}" style="display:inline-block;background:#C59B27;color:#FFFFFF;text-decoration:none;padding:11px 24px;border-radius:999px;font-size:13px;font-weight:700;">Suivre Ma Commande</a>
      </div>
    `.trim(),
    bodyHtmlAr: `
      <p style="margin:0 0 12px;font-size:15px;color:#1D232E;">مرحباً <strong>{{customerName}}</strong>،</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.8;color:#475569;">
        نعلمكم بتحديث حالة طلبكم رقم <strong>#{{orderNumber}}</strong> وتفاصيل المستندات المرفقة.
      </p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:16px 0;background:#FBF9F4;border:1px solid #E6E1D6;border-radius:12px;">
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #E6E1D6;font-size:12px;font-weight:700;color:#64748B;">رقم الطلب</td>
          <td style="padding:10px 14px;border-bottom:1px solid #E6E1D6;font-size:13px;font-weight:800;color:#1D232E;text-align:left;direction:ltr;">#{{orderNumber}}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #E6E1D6;font-size:12px;font-weight:700;color:#64748B;">الحالة</td>
          <td style="padding:10px 14px;border-bottom:1px solid #E6E1D6;font-size:13px;font-weight:800;color:#9A7414;text-align:left;">{{statusLabel}}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #E6E1D6;font-size:12px;font-weight:700;color:#64748B;">المبلغ الجملي</td>
          <td style="padding:10px 14px;border-bottom:1px solid #E6E1D6;font-size:13px;font-weight:800;color:#1D232E;text-align:left;direction:ltr;">{{totalAmount}}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-size:12px;font-weight:700;color:#64748B;">المرفقات</td>
          <td style="padding:10px 14px;font-size:12px;font-weight:700;color:#1D232E;text-align:left;">{{documentsList}}</td>
        </tr>
      </table>
      {{customNoteBlock}}
      <div style="margin:20px 0 8px;">
        <a href="{{trackingUrl}}" style="display:inline-block;background:#C59B27;color:#FFFFFF;text-decoration:none;padding:11px 24px;border-radius:999px;font-size:13px;font-weight:700;">متابعة الطلبية</a>
      </div>
    `.trim(),
    variables: ['{{appName}}', '{{customerName}}', '{{orderNumber}}', '{{statusLabel}}', '{{totalAmount}}', '{{documentsList}}', '{{customNote}}', '{{trackingUrl}}'],
  },
];

function safeJsonParse(raw: string | null | undefined): Record<string, any> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function escapeHtml(input: string): string {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatPlainTextToHtml(text: string): string {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed;
  return escapeHtml(trimmed).replace(/\r?\n/g, '<br/>');
}

export function normalizeEmailLocale(locale?: string | null): EmailLocale {
  return String(locale || '').trim().toUpperCase() === 'AR' ? 'AR' : 'FR';
}

export function buildCustomNoteBlock(note?: string, locale: EmailLocale = 'FR'): string {
  const clean = String(note || '').trim();
  if (!clean) return '';
  const borderRule = locale === 'AR' ? 'border-right:4px solid #C59B27;' : 'border-left:4px solid #C59B27;';
  return `<div style="margin:16px 0;padding:14px 16px;background:#FBF9F4;${borderRule}border-radius:10px;font-size:13px;line-height:1.7;color:#1D232E;">${formatPlainTextToHtml(clean)}</div>`;
}

export function interpolateTemplateString(
  templateText: string,
  variables: Record<string, any>,
  options: { rawHtmlKeys?: Set<string> } = {},
): string {
  const rawHtmlKeys = options.rawHtmlKeys || new Set(['customNoteBlock', 'messageBody', 'replyBody']);
  return String(templateText || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, rawKey) => {
    const val = variables[rawKey];
    if (val === undefined || val === null) return '';
    const str = String(val);
    if (rawHtmlKeys.has(rawKey)) {
      return formatPlainTextToHtml(str);
    }
    if (/Url$|Link$/i.test(rawKey)) {
      return escapeHtml(str);
    }
    return escapeHtml(str);
  });
}

export function wrapWithLuxuryEmailShell(opts: {
  appName: string;
  logoUrl?: string;
  badgeText?: string;
  innerHtml: string;
  locale: EmailLocale;
  phone?: string;
  email?: string;
  address?: string;
  websiteUrl?: string;
}): string {
  const trimmed = String(opts.innerHtml || '').trim();
  if (/data-royal-email-shell|<!DOCTYPE\s+html|<html[\s>]/i.test(trimmed)) {
    return trimmed;
  }

  const isAr = opts.locale === 'AR';
  const dir = isAr ? 'rtl' : 'ltr';
  const align = isAr ? 'right' : 'left';
  const fontFamily = isAr
    ? `'Tahoma','Arial','Segoe UI',sans-serif`
    : `'Poppins','Segoe UI','Helvetica Neue',Arial,sans-serif`;

  const resolvedWebsite = (opts.websiteUrl || DEFAULT_WEBSITE_URL).replace(/\/+$/, '');
  const resolvedLogo =
    opts.logoUrl && opts.logoUrl.startsWith('http')
      ? opts.logoUrl
      : `${resolvedWebsite}${opts.logoUrl?.startsWith('/') ? opts.logoUrl : '/images/royal-logo.jpg'}`;
  const badge = opts.badgeText || (isAr ? 'رسالة رسمية • رويال' : 'Maison Royal Officiel');
  const subtitle = isAr ? 'الأجهزة الكهرومنزلية الفاخرة' : 'Électroménager & Maison Haut de Gamme';
  const footerHint = isAr
    ? 'شكراً لثقتكم في رويال — هذه الرسالة مرسلة تلقائياً أو عبر خدمة الحرفاء.'
    : 'Merci pour votre confiance — Courriel émis via la plateforme officielle Royal.';

  return `
<div data-royal-email-shell="1" dir="${dir}" style="background:#F7F5EE;padding:28px 14px;font-family:${fontFamily};color:#1D232E;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#FFFFFF;border:1px solid #E6E1D6;border-radius:20px;overflow:hidden;">
    <tr>
      <td style="height:5px;background:linear-gradient(90deg,#9A7414 0%,#C59B27 50%,#E6D6A6 100%);font-size:0;line-height:0;">&nbsp;</td>
    </tr>
    <tr>
      <td style="padding:22px 28px 18px;border-bottom:1px solid #EFECE6;background:#FFFFFF;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="text-align:${align};vertical-align:middle;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="display:inline-table;">
                <tr>
                  <td style="vertical-align:middle;padding-${isAr ? 'left' : 'right'}:12px;">
                    <img src="${escapeHtml(resolvedLogo)}" alt="${escapeHtml(opts.appName)}" width="42" height="42" style="display:block;width:42px;height:42px;object-fit:cover;border-radius:12px;border:1px solid #E6D6A6;" />
                  </td>
                  <td style="vertical-align:middle;text-align:${align};">
                    <div style="font-size:17px;font-weight:900;color:#1D232E;letter-spacing:-0.2px;">${escapeHtml(opts.appName)}</div>
                    <div style="font-size:11px;color:#9A7414;font-weight:700;margin-top:2px;">${escapeHtml(subtitle)}</div>
                  </td>
                </tr>
              </table>
            </td>
            <td style="text-align:${isAr ? 'left' : 'right'};vertical-align:middle;">
              <span style="display:inline-block;padding:5px 11px;border-radius:999px;background:#FBF6E8;border:1px solid #E6D6A6;color:#9A7414;font-size:10px;font-weight:800;white-space:nowrap;">${escapeHtml(badge)}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:26px 28px;text-align:${align};background:#FFFFFF;">
        ${trimmed}
      </td>
    </tr>
    <tr>
      <td style="padding:18px 28px;background:#FBF9F4;border-top:1px solid #EFECE6;text-align:${align};">
        <div style="font-size:11px;font-weight:700;color:#1D232E;margin-bottom:4px;">
          ${escapeHtml(opts.appName)}${opts.address ? ` — ${escapeHtml(opts.address)}` : ''}
        </div>
        <div style="font-size:11px;color:#64748B;">
          ${opts.phone ? `${escapeHtml(opts.phone)} • ` : ''}${escapeHtml(opts.email || '')}
        </div>
        <div style="font-size:10px;color:#94A3B8;margin-top:8px;">
          ${escapeHtml(footerHint)}
        </div>
      </td>
    </tr>
  </table>
</div>
  `.trim();
}

export async function loadEmailIdentityAndSmtp(prisma: PrismaService): Promise<EmailIdentityInfo> {
  const rows = await prisma.settings.findMany({
    where: { key: { in: ['sys.smtp', 'sys.generalSettings', 'cms.identity'] } },
  });
  const map = new Map(rows.map((r) => [r.key, safeJsonParse(r.value)]));
  const smtpCfg = map.get('sys.smtp') || {};
  const gen = map.get('sys.generalSettings') || {};
  const identity = map.get('cms.identity') || {};

  const appName = identity.appName || gen.appName || 'Royal — Électro de Maison';
  const companyName = identity.companyName || gen.companyName || appName;
  const logoUrl = identity.logoUrl || '/images/royal-logo.jpg';
  const email = identity.email || gen.email || smtpCfg.fromEmail || 'royaltn24@gmail.com';
  const phone = identity.phone || gen.phone || '48 091 914';
  const address = identity.address || gen.address || 'Mahdia 5100, Tunisie';
  const websiteUrl =
    (gen.canonicalBaseUrl && String(gen.canonicalBaseUrl).trim()) ||
    process.env.FRONTEND_URL ||
    DEFAULT_WEBSITE_URL;

  return { appName, companyName, logoUrl, email, phone, address, websiteUrl, smtpCfg };
}

export async function ensureLuxuryEmailTemplateDefaults(prisma: PrismaService) {
  const existing = await prisma.emailTemplate.findMany();
  const byKey = new Map(existing.map((item) => [item.key, item]));

  for (const seed of DEFAULT_LUXURY_EMAIL_TEMPLATES) {
    const found = byKey.get(seed.key);
    if (!found) {
      await prisma.emailTemplate.create({
        data: {
          key: seed.key,
          name: seed.name,
          subject: seed.subject,
          subjectAr: seed.subjectAr,
          bodyHtml: seed.bodyHtml,
          bodyHtmlAr: seed.bodyHtmlAr,
          variables: seed.variables as any,
          isActive: true,
        },
      });
      continue;
    }

    const needsArPopulate = !found.subjectAr || !found.bodyHtmlAr;
    const isPlainOldSeed =
      !found.bodyHtmlAr &&
      found.bodyHtml.length < 280 &&
      !/style=|data-royal-email-shell|<table/i.test(found.bodyHtml);

    if (needsArPopulate || isPlainOldSeed) {
      await prisma.emailTemplate.update({
        where: { id: found.id },
        data: {
          ...(!found.subjectAr ? { subjectAr: seed.subjectAr } : {}),
          ...(!found.bodyHtmlAr ? { bodyHtmlAr: seed.bodyHtmlAr } : {}),
          ...(isPlainOldSeed ? { subject: seed.subject, bodyHtml: seed.bodyHtml, variables: seed.variables as any } : {}),
        },
      });
    }
  }
}

export async function renderLocalizedEmail(
  prisma: PrismaService,
  params: {
    templateId?: string;
    templateKey?: string;
    locale?: EmailLocale | string;
    customSubject?: string;
    customBodyHtml?: string;
    badgeText?: string;
    variables?: Record<string, any>;
    wrapInShell?: boolean;
  },
) {
  await ensureLuxuryEmailTemplateDefaults(prisma);
  const identity = await loadEmailIdentityAndSmtp(prisma);
  const requestedLocale = normalizeEmailLocale(params.locale);

  let tpl: any = null;
  if (params.templateId) {
    tpl = await prisma.emailTemplate.findUnique({ where: { id: params.templateId } });
  }
  if (!tpl && params.templateKey) {
    tpl = await prisma.emailTemplate.findUnique({ where: { key: params.templateKey } });
  }
  const fallbackSeed =
    DEFAULT_LUXURY_EMAIL_TEMPLATES.find((d) => d.key === params.templateKey) ||
    DEFAULT_LUXURY_EMAIL_TEMPLATES[0];

  const useAr = requestedLocale === 'AR';
  const rawSubject =
    (params.customSubject && params.customSubject.trim()) ||
    (useAr ? tpl?.subjectAr || fallbackSeed.subjectAr : tpl?.subject || fallbackSeed.subject);

  const rawBody =
    (params.customBodyHtml && params.customBodyHtml.trim()) ||
    (useAr ? tpl?.bodyHtmlAr || fallbackSeed.bodyHtmlAr : tpl?.bodyHtml || fallbackSeed.bodyHtml);

  const mergedVars: Record<string, any> = {
    appName: identity.appName,
    companyName: identity.companyName,
    companyPhone: identity.phone,
    companyEmail: identity.email,
    storeUrl: identity.websiteUrl,
    campaignUrl: `${identity.websiteUrl.replace(/\/+$/, '')}/articles`,
    loginUrl: `${identity.websiteUrl.replace(/\/+$/, '')}/login`,
    resetLink: `${identity.websiteUrl.replace(/\/+$/, '')}/login`,
    verifyLink: `${identity.websiteUrl.replace(/\/+$/, '')}/register`,
    trackingUrl: `${identity.websiteUrl.replace(/\/+$/, '')}/track-order`,
    expireTime: requestedLocale === 'AR' ? '15 دقيقة' : '15 minutes',
    ...(params.variables || {}),
  };

  const compiledSubject = interpolateTemplateString(rawSubject, mergedVars);
  const compiledInnerHtml = interpolateTemplateString(rawBody, mergedVars);
  const htmlBody =
    params.wrapInShell === false
      ? compiledInnerHtml
      : wrapWithLuxuryEmailShell({
          appName: identity.appName,
          logoUrl: identity.logoUrl,
          badgeText: params.badgeText || tpl?.name,
          innerHtml: compiledInnerHtml,
          locale: requestedLocale,
          phone: identity.phone,
          email: identity.email,
          address: identity.address,
          websiteUrl: identity.websiteUrl,
        });

  return {
    identity,
    templateId: tpl?.id || null,
    templateKey: tpl?.key || params.templateKey || null,
    templateName: tpl?.name || fallbackSeed.name,
    locale: requestedLocale,
    subject: compiledSubject,
    innerHtml: compiledInnerHtml,
    htmlBody,
  };
}

export async function sendLoggedSmtpEmail(
  prisma: PrismaService,
  opts: {
    to: string;
    subject: string;
    htmlBody: string;
    templateId?: string | null;
    smtpCfg?: Record<string, any>;
    attachments?: SmtpAttachment[];
  },
) {
  let smtp = opts.smtpCfg;
  if (!smtp || !smtp.host) {
    const row = await prisma.settings.findUnique({ where: { key: 'sys.smtp' } });
    smtp = safeJsonParse(row?.value);
  }
  const hasCreds = Boolean(smtp?.host && smtp?.user && smtp?.password);
  if (!hasCreds) {
    await prisma.emailLog.create({
      data: {
        templateId: opts.templateId || null,
        to: opts.to,
        subject: opts.subject,
        status: 'FAILED',
        error: 'Configuration SMTP manquante dans /dashboard/root/smtp',
        attempts: 1,
      },
    });
    throw new Error(
      'Configuration SMTP manquante dans Système > Paramètres > SMTP (/dashboard/root/smtp).',
    );
  }

  try {
    const res = await sendSmtpMailWithAttachments(smtp as any, {
      to: opts.to,
      subject: opts.subject,
      htmlBody: opts.htmlBody,
      attachments: opts.attachments,
    });
    await prisma.emailLog.create({
      data: {
        templateId: opts.templateId || null,
        to: opts.to,
        subject: opts.subject,
        status: 'SENT',
        sentAt: new Date(),
        attempts: 1,
      },
    });
    return res;
  } catch (err: any) {
    await prisma.emailLog.create({
      data: {
        templateId: opts.templateId || null,
        to: opts.to,
        subject: opts.subject,
        status: 'FAILED',
        error: String(err?.message || err).slice(0, 500),
        attempts: 1,
      },
    });
    throw err;
  }
}
