import { DeliveryCalculationMethod, PrismaClient } from '@prisma/client';

export interface PricingBracket {
  min: number;
  max: number | null;
  price: number;
  label?: string;
}

export interface CustomDistanceOverride {
  id?: string;
  fromCountry: string;
  fromState: string;
  toCountry: string;
  toState: string;
  distanceKm: number;
  bidirectional?: boolean;
}

export interface SystemDeliverySettings {
  defaultItemWeightKg: number;
  applyFreeShippingThreshold: boolean;
  freeShippingMigrationApplied?: boolean;
  outOfRangeBehavior: 'FALLBACK_FIXED' | 'UNAVAILABLE';
  autoCreateShowroomTransfer: boolean;
  defaultTransferAcceptanceMode: 'CHOICE' | 'IMMEDIATE' | 'STEP_BY_STEP';
  customDistances: CustomDistanceOverride[];
}

export interface StateCoord {
  name: string;
  lat: number;
  lng: number;
}

export interface CountryGeoDef {
  code: string;
  nameFr: string;
  states: StateCoord[];
}

export const COUNTRY_STATE_CATALOG: CountryGeoDef[] = [
  {
    code: 'TN',
    nameFr: 'Tunisie',
    states: [
      { name: 'Tunis', lat: 36.8065, lng: 10.1815 },
      { name: 'Ariana', lat: 36.8665, lng: 10.1647 },
      { name: 'Ben Arous', lat: 36.7531, lng: 10.2189 },
      { name: 'Manouba', lat: 36.8101, lng: 10.0956 },
      { name: 'Nabeul', lat: 36.4561, lng: 10.7376 },
      { name: 'Zaghouan', lat: 36.4029, lng: 10.1429 },
      { name: 'Bizerte', lat: 37.2746, lng: 9.8739 },
      { name: 'Béja', lat: 36.7256, lng: 9.1817 },
      { name: 'Jendouba', lat: 36.5011, lng: 8.7802 },
      { name: 'Le Kef', lat: 36.1742, lng: 8.7049 },
      { name: 'Siliana', lat: 36.0849, lng: 9.3708 },
      { name: 'Sousse', lat: 35.8256, lng: 10.6369 },
      { name: 'Monastir', lat: 35.7643, lng: 10.8113 },
      { name: 'Mahdia', lat: 35.5047, lng: 11.0622 },
      { name: 'Sfax', lat: 34.7406, lng: 10.7603 },
      { name: 'Kairouan', lat: 35.6781, lng: 10.0963 },
      { name: 'Kasserine', lat: 35.1676, lng: 8.8365 },
      { name: 'Sidi Bouzid', lat: 35.0382, lng: 9.4849 },
      { name: 'Gabès', lat: 33.8815, lng: 10.0982 },
      { name: 'Médenine', lat: 33.3549, lng: 10.5055 },
      { name: 'Tataouine', lat: 32.9297, lng: 10.4518 },
      { name: 'Gafsa', lat: 34.425, lng: 8.7842 },
      { name: 'Tozeur', lat: 33.9197, lng: 8.1335 },
      { name: 'Kébili', lat: 33.7044, lng: 8.969 },
    ],
  },
  {
    code: 'DZ',
    nameFr: 'Algérie',
    states: [
      { name: 'Alger', lat: 36.7538, lng: 3.0588 },
      { name: 'Annaba', lat: 36.9, lng: 7.7667 },
      { name: 'Constantine', lat: 36.365, lng: 6.6147 },
      { name: 'Oran', lat: 35.6971, lng: -0.6308 },
      { name: 'Sétif', lat: 36.1911, lng: 5.4137 },
      { name: 'Tébessa', lat: 35.4042, lng: 8.1242 },
    ],
  },
  {
    code: 'LY',
    nameFr: 'Libye',
    states: [
      { name: 'Tripoli', lat: 32.8872, lng: 13.1913 },
      { name: 'Benghazi', lat: 32.1194, lng: 20.0868 },
      { name: 'Misrata', lat: 32.3754, lng: 15.0925 },
      { name: 'Zaouïa', lat: 32.7571, lng: 12.7276 },
    ],
  },
  {
    code: 'MA',
    nameFr: 'Maroc',
    states: [
      { name: 'Casablanca', lat: 33.5731, lng: -7.5898 },
      { name: 'Rabat', lat: 34.0209, lng: -6.8416 },
      { name: 'Marrakech', lat: 31.6295, lng: -7.9811 },
      { name: 'Tanger', lat: 35.7595, lng: -5.834 },
    ],
  },
  {
    code: 'FR',
    nameFr: 'France',
    states: [
      { name: 'Île-de-France', lat: 48.8566, lng: 2.3522 },
      { name: "Provence-Alpes-Côte d'Azur", lat: 43.2965, lng: 5.3698 },
      { name: 'Auvergne-Rhône-Alpes', lat: 45.764, lng: 4.8357 },
      { name: 'Occitanie', lat: 43.6047, lng: 1.4442 },
    ],
  },
];

export const DEFAULT_DISTANCE_BRACKETS: PricingBracket[] = [
  { min: 0, max: 9.99, price: 6, label: 'Moins de 10 km (< 10 km)' },
  { min: 10, max: 99.99, price: 10, label: 'De 10 km à 100 km' },
  { min: 100, max: 599.99, price: 18, label: 'De 100 km à 600 km' },
  { min: 600, max: null, price: 30, label: 'Plus de 600 km (600 km et +)' },
];

export const DEFAULT_WEIGHT_BRACKETS: PricingBracket[] = [
  { min: 0, max: 9.99, price: 7, label: 'Moins de 10 kg (< 10 kg)' },
  { min: 10, max: 499.99, price: 18, label: 'De 10 kg à 500 kg' },
  { min: 500, max: null, price: 45, label: 'Plus de 500 kg (500 kg et +)' },
];

export const DEFAULT_DELIVERY_SETTINGS: SystemDeliverySettings = {
  defaultItemWeightKg: 1,
  applyFreeShippingThreshold: true,
  freeShippingMigrationApplied: true,
  outOfRangeBehavior: 'FALLBACK_FIXED',
  autoCreateShowroomTransfer: true,
  defaultTransferAcceptanceMode: 'CHOICE',
  customDistances: [],
};

export function normalizeGeoToken(input?: string | null): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^la\s+/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function findStateCoordinates(countryCode: string, stateName: string): StateCoord | null {
  const cNorm = String(countryCode || 'TN').trim().toUpperCase();
  const sNorm = normalizeGeoToken(stateName);
  if (!sNorm) return null;

  const country =
    COUNTRY_STATE_CATALOG.find(
      (c) => c.code === cNorm || normalizeGeoToken(c.nameFr) === normalizeGeoToken(countryCode),
    ) || COUNTRY_STATE_CATALOG[0];

  const matchInCountry = country.states.find((s) => {
    const n = normalizeGeoToken(s.name);
    return n === sNorm || n.includes(sNorm) || sNorm.includes(n);
  });
  if (matchInCountry) return matchInCountry;

  // Cross-catalog search fallback
  for (const c of COUNTRY_STATE_CATALOG) {
    const hit = c.states.find((s) => normalizeGeoToken(s.name) === sNorm);
    if (hit) return hit;
  }
  return null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function computePointAToPointBDistanceKm(
  originCountry: string,
  originState: string,
  destCountry: string,
  destState: string,
  customDistances: CustomDistanceOverride[] = [],
): number {
  const oCountry = String(originCountry || 'TN').trim().toUpperCase();
  const dCountry = String(destCountry || 'TN').trim().toUpperCase();
  const oStateNorm = normalizeGeoToken(originState);
  const dStateNorm = normalizeGeoToken(destState);

  // 1. Check merchant explicit custom pair overrides
  for (const item of customDistances) {
    const fc = String(item.fromCountry || 'TN').trim().toUpperCase();
    const tc = String(item.toCountry || 'TN').trim().toUpperCase();
    const fs = normalizeGeoToken(item.fromState);
    const ts = normalizeGeoToken(item.toState);
    const directMatch = fc === oCountry && fs === oStateNorm && tc === dCountry && ts === dStateNorm;
    const reverseMatch =
      item.bidirectional !== false &&
      fc === dCountry &&
      fs === dStateNorm &&
      tc === oCountry &&
      ts === oStateNorm;
    if ((directMatch || reverseMatch) && Number.isFinite(Number(item.distanceKm))) {
      return Number(Number(item.distanceKm).toFixed(2));
    }
  }

  // 2. Intra-state (same country & same governorate)
  if (oCountry === dCountry && oStateNorm && oStateNorm === dStateNorm) {
    return 5;
  }

  // 3. Coordinate Haversine with 1.18 road factor
  const oCoord = findStateCoordinates(oCountry, originState);
  const dCoord = findStateCoordinates(dCountry, destState);
  if (oCoord && dCoord) {
    const rawKm = haversineKm(oCoord.lat, oCoord.lng, dCoord.lat, dCoord.lng);
    return Number((rawKm * 1.18).toFixed(2));
  }

  // 4. Country centroid fallback for unmapped cross-country states
  const oFallback = COUNTRY_STATE_CATALOG.find((c) => c.code === oCountry)?.states[0];
  const dFallback = COUNTRY_STATE_CATALOG.find((c) => c.code === dCountry)?.states[0];
  if (oFallback && dFallback) {
    const rawKm = haversineKm(oFallback.lat, oFallback.lng, dFallback.lat, dFallback.lng);
    return Number((Math.max(15, rawKm * 1.18)).toFixed(2));
  }

  return 50;
}

export function sanitizeBrackets(raw: any): PricingBracket[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b: any) => {
      const min = Number(b?.min ?? 0);
      const maxVal = b?.max === null || b?.max === undefined || b?.max === '' ? null : Number(b.max);
      const price = Number(b?.price ?? 0);
      if (!Number.isFinite(min) || !Number.isFinite(price)) return null;
      return {
        min: Math.max(0, min),
        max: maxVal !== null && Number.isFinite(maxVal) ? maxVal : null,
        price: Math.max(0, price),
        ...(b?.label ? { label: String(b.label) } : {}),
      } as PricingBracket;
    })
    .filter((b): b is PricingBracket => b !== null)
    .sort((a, b) => a.min - b.min);
}

export function evaluateBracketPrice(
  value: number,
  rawBrackets: any,
): { matched: PricingBracket | null; price: number | null } {
  const brackets = sanitizeBrackets(rawBrackets);
  if (brackets.length === 0) return { matched: null, price: null };
  const val = Math.max(0, Number(value || 0));

  for (let i = 0; i < brackets.length; i++) {
    const b = brackets[i];
    const next = brackets[i + 1];
    const upperBound = b.max === null ? Infinity : b.max;
    // Bridge floating-point edge gaps (e.g. 9.99 vs 10) cleanly
    const effectiveUpper = next ? Math.max(upperBound, next.min - 0.0001) : upperBound;
    if (val >= b.min && val <= effectiveUpper) {
      return { matched: b, price: b.price };
    }
  }
  return { matched: null, price: null };
}

export async function loadDeliverySettings(prisma: PrismaClient | any): Promise<SystemDeliverySettings> {
  const row = await prisma.settings.findUnique({ where: { key: 'sys.deliverySettings' } });
  if (!row?.value) return { ...DEFAULT_DELIVERY_SETTINGS };
  try {
    const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    return {
      ...DEFAULT_DELIVERY_SETTINGS,
      ...(parsed && typeof parsed === 'object' ? parsed : {}),
      customDistances: Array.isArray(parsed?.customDistances) ? parsed.customDistances : [],
    };
  } catch {
    return { ...DEFAULT_DELIVERY_SETTINGS };
  }
}

export function formatPrefixFromRule(prefixRow: any, docCode: string, seqNum: number): string {
  const code = String(prefixRow?.code || docCode).toUpperCase();
  const fmt = String(prefixRow?.format || '{PREFIX}-{YYYY}-{SEQ4}');
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const yy = yyyy.slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const seq = Math.max(1, Number(seqNum || 1));

  return fmt
    .replace('{PREFIX}', code)
    .replace('{YYYY}', yyyy)
    .replace('{YY}', yy)
    .replace('{MM}', mm)
    .replace('{DD}', dd)
    .replace('{YYYYMMDD}', `${yyyy}${mm}${dd}`)
    .replace('{SEQ5}', String(seq).padStart(5, '0'))
    .replace('{SEQ4}', String(seq).padStart(4, '0'));
}

export async function allocateSystemDocumentReference(
  prismaOrTx: any,
  docCode: string,
  fallbackFormat = '{PREFIX}-{YYYY}-{SEQ4}',
): Promise<string> {
  const upperCode = docCode.toUpperCase();
  try {
    const row = await prismaOrTx.settings.findUnique({ where: { key: 'sys.prefixes' } });
    if (row?.value) {
      const list = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      if (Array.isArray(list)) {
        const idx = list.findIndex((p: any) => String(p?.code || '').toUpperCase() === upperCode);
        if (idx !== -1) {
          const current = list[idx];
          const seq = Math.max(1, Number(current.nextSeq || 1));
          const generated = formatPrefixFromRule(current, upperCode, seq);
          const nextList = list.map((p: any, i: number) =>
            i === idx ? { ...p, nextSeq: seq + 1, preview: formatPrefixFromRule(p, upperCode, seq + 1) } : p,
          );
          await prismaOrTx.settings.update({
            where: { key: 'sys.prefixes' },
            data: { value: JSON.stringify(nextList) },
          });
          return generated;
        }
      }
    }
  } catch {
    // Fallback to deterministic reference if settings lock/missing
  }
  const rand = Math.floor(1000 + Math.random() * 9000);
  return formatPrefixFromRule({ code: upperCode, format: fallbackFormat }, upperCode, rand);
}

export async function ensureDefaultDeliveryCompanies(prisma: PrismaClient) {
  const count = await prisma.deliveryCompany.count();
  if (count > 0) return { seeded: 0 };

  const defaults: Array<{
    name: string;
    code: string;
    phone: string;
    email: string;
    originCountry: string;
    originState: string;
    originCity: string;
    estimatedDays: string;
    defaultMethod: DeliveryCalculationMethod;
    fixedPrice: number;
    distanceBrackets: PricingBracket[];
    weightBrackets: PricingBracket[];
  }> = [
    {
      name: 'Royal Express Logistique',
      code: 'ROYAL-EXPRESS',
      phone: '+216 48 091 914',
      email: 'logistique@royal.com.tn',
      originCountry: 'TN',
      originState: 'Mahdia',
      originCity: 'Mahdia',
      estimatedDays: '24h - 48h',
      defaultMethod: DeliveryCalculationMethod.DISTANCE,
      fixedPrice: 9,
      distanceBrackets: DEFAULT_DISTANCE_BRACKETS,
      weightBrackets: DEFAULT_WEIGHT_BRACKETS,
    },
    {
      name: 'Aramex Tunisie',
      code: 'ARAMEX-TN',
      phone: '+216 70 100 200',
      email: 'support@aramex.tn',
      originCountry: 'TN',
      originState: 'Ben Arous',
      originCity: 'Charguia / Ben Arous',
      estimatedDays: '24h - 72h',
      defaultMethod: DeliveryCalculationMethod.WEIGHT,
      fixedPrice: 12,
      distanceBrackets: DEFAULT_DISTANCE_BRACKETS,
      weightBrackets: DEFAULT_WEIGHT_BRACKETS,
    },
    {
      name: 'First Delivery Group',
      code: 'FIRST-DELIVERY',
      phone: '+216 73 200 300',
      email: 'contact@firstdeliverygroup.com',
      originCountry: 'TN',
      originState: 'Sousse',
      originCity: 'Sousse',
      estimatedDays: '24h - 48h',
      defaultMethod: DeliveryCalculationMethod.FIXED,
      fixedPrice: 8,
      distanceBrackets: DEFAULT_DISTANCE_BRACKETS,
      weightBrackets: DEFAULT_WEIGHT_BRACKETS,
    },
  ];

  for (const item of defaults) {
    await prisma.deliveryCompany.upsert({
      where: { code: item.code },
      update: {},
      create: {
        name: item.name,
        code: item.code,
        phone: item.phone,
        email: item.email,
        originCountry: item.originCountry,
        originState: item.originState,
        originCity: item.originCity,
        estimatedDays: item.estimatedDays,
        defaultMethod: item.defaultMethod,
        fixedPrice: item.fixedPrice,
        isActive: true,
        pricingMethods: {
          create: [
            {
              method: DeliveryCalculationMethod.DISTANCE,
              isEnabled: true,
              isDefault: item.defaultMethod === DeliveryCalculationMethod.DISTANCE,
              bracketsJson: item.distanceBrackets as any,
            },
            {
              method: DeliveryCalculationMethod.WEIGHT,
              isEnabled: true,
              isDefault: item.defaultMethod === DeliveryCalculationMethod.WEIGHT,
              bracketsJson: item.weightBrackets as any,
            },
            {
              method: DeliveryCalculationMethod.FIXED,
              isEnabled: true,
              isDefault: item.defaultMethod === DeliveryCalculationMethod.FIXED,
              fixedPrice: item.fixedPrice,
              bracketsJson: [] as any,
            },
          ],
        },
      },
    });
  }

  return { seeded: defaults.length };
}

export async function ensureDeliverySystemDocumentDefaults(prisma: PrismaClient) {
  // 1. Ensure sys.prefixes includes DTR (Demande de Transfert Interne) alongside TRF, BS, BE, BL
  const prefSetting = await prisma.settings.findUnique({ where: { key: 'sys.prefixes' } });
  if (prefSetting?.value) {
    try {
      const arr = typeof prefSetting.value === 'string' ? JSON.parse(prefSetting.value) : prefSetting.value;
      if (Array.isArray(arr) && !arr.some((p: any) => String(p?.code || '').toUpperCase() === 'DTR')) {
        arr.push({
          id: 'pref-dtr',
          code: 'DTR',
          docType: 'Demande de Transfert Inter-Dépôts (Showroom)',
          format: '{PREFIX}-{YYYY}-{SEQ4}',
          nextSeq: 1,
          preview: `DTR-${new Date().getFullYear()}-0001`,
          printTemplateCode: 'TPL-DEMANDE-TRF',
          isActive: true,
          createdAt: new Date().toISOString(),
        });
        await prisma.settings.update({
          where: { key: 'sys.prefixes' },
          data: { value: JSON.stringify(arr) },
        });
      }
    } catch {
      // ignore invalid JSON
    }
  }

  // 2. Ensure sys.printTemplates includes TPL-DEMANDE-TRF
  const tplSetting = await prisma.settings.findUnique({ where: { key: 'sys.printTemplates' } });
  if (tplSetting?.value) {
    try {
      const arr = typeof tplSetting.value === 'string' ? JSON.parse(tplSetting.value) : tplSetting.value;
      if (Array.isArray(arr) && !arr.some((t: any) => String(t?.code || '').toUpperCase() === 'TPL-DEMANDE-TRF')) {
        arr.push({
          id: 'tpl-dtr',
          code: 'TPL-DEMANDE-TRF',
          name: 'Demande de Transfert Inter-Dépôts (DTR)',
          paperFormat: 'A4',
          prefixCode: 'DTR',
          headerText: 'Validation Logistique Showroom ➔ Direction / Super Admin',
          footerText: 'Document soumis à approbation (Exécution immédiate ou Suivi par étapes).',
          htmlBody:
            '<div class="royal-doc"><h2>DEMANDE DE TRANSFERT INTERNE {{reference}}</h2><p>De : {{fromWarehouse}} ➔ Vers : {{toWarehouse}}</p></div>',
          cssStyles:
            '.royal-doc { font-family: Poppins, sans-serif; border-top: 4px solid #C59B27; padding: 20px; }',
          showLogo: true,
          showTaxBreakdown: false,
          showQr: true,
          isActive: true,
          createdAt: new Date().toISOString(),
        });
        await prisma.settings.update({
          where: { key: 'sys.printTemplates' },
          data: { value: JSON.stringify(arr) },
        });
      }
    } catch {
      // ignore invalid JSON
    }
  }

  // 3. Ensure sys.deliverySettings exists (and apply one-time free-shipping threshold default migration)
  const delSettingsRow = await prisma.settings.findUnique({ where: { key: 'sys.deliverySettings' } });
  if (!delSettingsRow) {
    await prisma.settings.create({
      data: {
        key: 'sys.deliverySettings',
        value: JSON.stringify(DEFAULT_DELIVERY_SETTINGS),
        group: 'system',
      },
    });
  } else if (delSettingsRow.value) {
    try {
      const parsed =
        typeof delSettingsRow.value === 'string'
          ? JSON.parse(delSettingsRow.value)
          : delSettingsRow.value;
      if (parsed && typeof parsed === 'object' && parsed.freeShippingMigrationApplied !== true) {
        const migrated = {
          ...DEFAULT_DELIVERY_SETTINGS,
          ...parsed,
          applyFreeShippingThreshold: true,
          freeShippingMigrationApplied: true,
        };
        await prisma.settings.update({
          where: { key: 'sys.deliverySettings' },
          data: { value: JSON.stringify(migrated) },
        });
      }
    } catch {
      // ignore invalid JSON
    }
  }

  // 4. Keep sys.visibility clean (remove delivery-managers/agents & users/admins; add delivery-companies & root/delivery-settings as PRIVATE)
  const visRow = await prisma.settings.findUnique({ where: { key: 'sys.visibility' } });
  if (visRow?.value) {
    try {
      const visArr = typeof visRow.value === 'string' ? JSON.parse(visRow.value) : visRow.value;
      if (Array.isArray(visArr)) {
        const obsoleteKeys = new Set([
          '/dashboard/users/delivery-managers',
          '/dashboard/users/delivery-agents',
          '/dashboard/users/admins',
        ]);
        const filtered = visArr.filter((v: any) => !obsoleteKeys.has(v?.key));
        let changed = filtered.length !== visArr.length;
        const requiredNew = [
          {
            key: '/dashboard/delivery-companies',
            label: 'Sociétés & Tarifs de Livraison',
            section: 'Ventes & Distribution',
            visibility: 'PRIVATE',
          },
          {
            key: '/dashboard/root/delivery-settings',
            label: 'Règles Livraison, Distances & Transferts',
            section: 'Système & CMS',
            visibility: 'PRIVATE',
          },
        ];
        for (const reqItem of requiredNew) {
          if (!filtered.some((v: any) => v?.key === reqItem.key)) {
            filtered.push(reqItem);
            changed = true;
          }
        }
        if (changed) {
          await prisma.settings.update({
            where: { key: 'sys.visibility' },
            data: { value: JSON.stringify(filtered) },
          });
        }
      }
    } catch {
      // ignore
    }
  }

  // 5. Clean up obsolete roles from sys.roleViews
  const rvRow = await prisma.settings.findUnique({ where: { key: 'sys.roleViews' } });
  if (rvRow?.value) {
    try {
      const rvObj = typeof rvRow.value === 'string' ? JSON.parse(rvRow.value) : rvRow.value;
      if (rvObj && typeof rvObj === 'object' && !Array.isArray(rvObj)) {
        let changed = false;
        if ('DELIVERY_MANAGER' in rvObj) {
          delete rvObj.DELIVERY_MANAGER;
          changed = true;
        }
        if ('DELIVERY_AGENT' in rvObj) {
          delete rvObj.DELIVERY_AGENT;
          changed = true;
        }
        if ('ADMIN' in rvObj) {
          delete rvObj.ADMIN;
          changed = true;
        }
        for (const [k, arr] of Object.entries(rvObj)) {
          if (Array.isArray(arr)) {
            const next = arr.filter(
              (p) =>
                p !== '/dashboard/users/delivery-managers' &&
                p !== '/dashboard/users/delivery-agents' &&
                p !== '/dashboard/users/admins',
            );
            if (next.length !== arr.length) {
              rvObj[k] = next;
              changed = true;
            }
          }
        }
        if (changed) {
          await prisma.settings.update({
            where: { key: 'sys.roleViews' },
            data: { value: JSON.stringify(rvObj) },
          });
        }
      }
    } catch {
      // ignore
    }
  }

  // 6. Ensure delivery_companies CRUD permissions exist & grant to ROOT / SUPER_ADMIN / WEBSITE_MANAGER
  const dcActions = ['read', 'read_list', 'read_detail', 'create', 'update', 'delete', 'manage'];
  const createdIds: string[] = [];
  for (const act of dcActions) {
    const p = await prisma.permission.upsert({
      where: {
        module_resource_action_scope: {
          module: 'delivery_companies',
          resource: 'delivery_companies',
          action: act,
          scope: 'all',
        },
      },
      update: {},
      create: {
        module: 'delivery_companies',
        resource: 'delivery_companies',
        action: act,
        scope: 'all',
        description: `Permission ${act} sur Sociétés de livraison`,
      },
    });
    createdIds.push(p.id);
  }
  const privilegedRoles = await prisma.role.findMany({
    where: { name: { in: ['ROOT', 'SUPER_ADMIN', 'WEBSITE_MANAGER'] } },
  });
  for (const role of privilegedRoles) {
    for (const permissionId of createdIds) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }
}
