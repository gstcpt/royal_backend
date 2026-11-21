
-- Update category imageUrl from real product images in that category or direct subcategories
WITH cat_direct_img AS (
  SELECT DISTINCT ON (p."categoryId")
    p."categoryId" AS cid,
    pi.url AS img_url
  FROM products p
  JOIN product_images pi ON pi."productId" = p.id
  WHERE p."deletedAt" IS NULL AND p.status = 'ACTIVE'
  ORDER BY p."categoryId", pi."isPrimary" DESC, pi."sortOrder" ASC
),
cat_child_img AS (
  SELECT DISTINCT ON (c."parentId")
    c."parentId" AS cid,
    cdi.img_url
  FROM categories c
  JOIN cat_direct_img cdi ON cdi.cid = c.id
  WHERE c."parentId" IS NOT NULL
  ORDER BY c."parentId", c."sortOrder" ASC
),
cat_grandchild_img AS (
  SELECT DISTINCT ON (c."parentId")
    c."parentId" AS cid,
    cci.img_url
  FROM categories c
  JOIN cat_child_img cci ON cci.cid = c.id
  WHERE c."parentId" IS NOT NULL
  ORDER BY c."parentId", c."sortOrder" ASC
)
UPDATE categories c
SET "imageUrl" = COALESCE(
  (SELECT img_url FROM cat_direct_img d WHERE d.cid = c.id LIMIT 1),
  (SELECT img_url FROM cat_child_img ch WHERE ch.cid = c.id LIMIT 1),
  (SELECT img_url FROM cat_grandchild_img gc WHERE gc.cid = c.id LIMIT 1),
  c."imageUrl"
),
"updatedAt" = NOW();

-- Ensure shipping & branding settings
INSERT INTO settings (id, key, value, "group", "isSecret", "updatedAt", "updatedBy") VALUES
  ('set_ship_free', 'shipping.free_threshold', '150', 'shipping', false, NOW(), 'SYSTEM'),
  ('set_ship_fee', 'shipping.standard_fee', '7', 'shipping', false, NOW(), 'SYSTEM'),
  ('set_brand_logo', 'branding.app_logo_url', '/images/royal-logo.jpg', 'branding', false, NOW(), 'SYSTEM')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = NOW();

-- Seed FAQ items cleanly if empty
DELETE FROM faq_items;
INSERT INTO faq_items (id, category, question, answer, "sortOrder", "isActive", "createdAt", "updatedAt") VALUES
  ('faq_01', 'Livraison & Délais', 'Quels sont les délais et tarifs de livraison en Tunisie ?', 'Nous livrons partout en Tunisie (24 gouvernorats) sous 24h à 48h ouvrables. Les frais de livraison standards sont de 7.000 TND et deviennent automatiquement GRATUITS dès que votre commande atteint le seuil de livraison offerte configuré dans notre boutique.', 1, true, NOW(), NOW()),
  ('faq_02', 'Paiement', 'Quels modes de paiement acceptez-vous actuellement ?', 'Actuellement, vous réglez votre commande directement en espèces à la livraison (Cash on Delivery) au moment de la réception et vérification de votre colis auprès du livreur.', 2, true, NOW(), NOW()),
  ('faq_03', 'Garantie & SAV', 'Comment fonctionne la garantie des appareils Florence et DSP ?', 'Chaque article dispose d’une garantie constructeur officielle précisée directement sur sa fiche technique (1 an ou 2 ans selon l’appareil). Conservez votre facture ou référence de commande pour bénéficier d’une prise en charge rapide par notre service après-vente à Mahdia et dans toute la Tunisie.', 3, true, NOW(), NOW()),
  ('faq_04', 'Commandes & Suivi', 'Comment passer commande sans créer de compte ?', 'Ajoutez vos articles au panier, cliquez sur Commander puis renseignez simplement votre prénom, nom, téléphone et votre gouvernorat / ville de livraison. L’adresse e-mail et le code postal sont facultatifs.', 4, true, NOW(), NOW()),
  ('faq_05', 'Promotions', 'Comment utiliser un code promo PROMO-<SKU> ?', 'Les codes promotionnels actifs sont utilisables directement dans votre panier ou lors de la validation de commande dans le champ "Code promo". La réduction en TND s’applique instantanément avant confirmation.', 5, true, NOW(), NOW()),
  ('faq_06', 'Contact', 'Comment joindre le service client Royal ?', 'Notre équipe basée à Mahdia 5100 est joignable par téléphone et WhatsApp au 48091914 ou par e-mail à royaltn24@gmail.com, ainsi que via nos pages officielles TikTok, Instagram et Facebook.', 6, true, NOW(), NOW());

-- Seed Terms & Privacy CMS pages
INSERT INTO cms_pages (id, slug, title, subtitle, content, "updatedAt", "updatedBy") VALUES
  ('cms_terms', 'terms', 'Conditions Générales de Vente (CGV)', 'Modalités de commande, livraison, garantie et paiement chez Royal — Electro de Maison.',
   E'## 1. Objet et Champ d’Application
Les présentes Conditions Générales de Vente régissent l’ensemble des commandes passées sur la boutique officielle **Royal — Electro de Maison** (Mahdia 5100, Tunisie) pour des livraisons sur tout le territoire tunisien.

## 2. Articles, Prix et Promotions
Tous les prix sont affichés en **Dinars Tunisiens (TND)** TTC (TVA 19% incluse le cas échéant). Les promotions affichées ainsi que les codes promo (`PROMO-...`) sont valables dans la limite des stocks disponibles.

## 3. Commande & Validation
Lors de la commande, le client fournit ses coordonnées exactes (Prénom, Nom, Téléphone, Gouvernorat et Ville/Délégation). Une confirmation avec référence unique (`CMD-...`) est générée immédiatement.

## 4. Livraison Partout en Tunisie
La livraison à domicile s’effectue sous 24h à 48h ouvrables partout en Tunisie. La livraison est offerte à partir du montant minimum affiché dans le panier.

## 5. Règlement
Le paiement s’effectue à la livraison en espèces au moment de la remise du colis.

## 6. Garantie & Service Après-Vente
Chaque appareil bénéficie de la garantie constructeur indiquée sur sa fiche technique. Pour toute assistance, contactez-nous au **48091914** ou à **royaltn24@gmail.com**.', NOW(), 'SYSTEM'),
  ('cms_privacy', 'privacy', 'Politique de Confidentialité', 'Protection de vos données personnelles conformément à la réglementation tunisienne.',
   E'## 1. Collecte des Données Personnelles
**Royal — Electro de Maison** (Mahdia 5100, Tunisie) collecte uniquement les informations strictement nécessaires au traitement et à l’acheminement de vos commandes (prénom, nom, numéro de téléphone, ville/gouvernorat, et optionnellement adresse e-mail).

## 2. Finalité du Traitement
Vos données servent exclusivement à :
- Préparer et livrer vos commandes dans les meilleurs délais ;
- Assurer le suivi SAV et la garantie constructeur de vos appareils ;
- Répondre à vos demandes envoyées via notre formulaire de contact.

## 3. Confidentialité & Non-Cession
Nous ne vendons, ne louons et ne cédons jamais vos données personnelles à des tiers à des fins publicitaires. Seuls nos partenaires logistiques accèdent aux informations nécessaires à la livraison.

## 4. Vos Droits
Vous disposez d’un droit d’accès, de rectification et de suppression de vos données personnelles à tout moment en écrivant à **royaltn24@gmail.com** ou en appelant le **48091914**.', NOW(), 'SYSTEM')
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, subtitle = EXCLUDED.subtitle, content = EXCLUDED.content, "updatedAt" = NOW();
