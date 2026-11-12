const fs = require('fs');
const path = require('path');

const bankDir = path.resolve(__dirname, '../assets/ngan_hang');
const ewalletDir = path.resolve(__dirname, '../assets/vi_dien_tu');
const outputDir = path.resolve(__dirname, '../src/constants');
const outputFile = path.join(outputDir, 'logosData.json');

function cleanSvg(xml, id) {
  let cleaned = xml
    .replace(/<\?xml.*?\?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Namespace clipPath and linearGradient / radialGradient / filter IDs to avoid collisions
  const idMap = new Map();
  cleaned = cleaned.replace(/\bid="([^"]+)"/g, (match, origId) => {
    const newId = `${id}_${origId}`;
    idMap.set(origId, newId);
    return `id="${newId}"`;
  });

  for (const [origId, newId] of idMap.entries()) {
    const urlRegex = new RegExp(`url\\(#${origId}\\)`, 'g');
    cleaned = cleaned.replace(urlRegex, `url(#${newId})`);
    const hrefRegex = new RegExp(`href="#${origId}"`, 'g');
    cleaned = cleaned.replace(hrefRegex, `href="#${newId}"`);
  }

  return cleaned;
}

const POPULAR_BANKS = [
  'vietcombank', 'mb_bank', 'techcombank', 'tpbank', 'vpbank',
  'acb', 'bidv', 'vietinbank', 'argibank', 'cake_by_vpbank',
  'timo', 'vib', 'msb', 'hdbank', 'scb', 'shinhan_bank', 'ocb'
];

const POPULAR_EWALLETS = [
  'momo', 'zalopay', 'shopeepay', 'viettel_money', 'vnpay',
  'grabpay_by_moca', 'vnpay_money', 'payoo', 'vinid', 'viettel_pay'
];

function normalizeBankName(raw) {
  const lower = raw.toLowerCase().trim();
  if (lower === 'argibank') return 'Agribank';
  if (lower === 'bidv') return 'BIDV';
  if (lower === 'acb') return 'ACB';
  if (lower === 'ocb') return 'OCB';
  if (lower === 'scb') return 'SCB';
  if (lower === 'shb') return 'SHB';
  if (lower === 'vib') return 'VIB';
  if (lower === 'msb') return 'MSB';
  if (lower === 'ncb') return 'NCB';
  if (lower === 'ivb') return 'IVB';
  if (lower === 'hdbank') return 'HDBank';
  if (lower === 'tpbank') return 'TPBank';
  if (lower === 'vpbank') return 'VPBank';
  if (lower === 'vietcombank') return 'Vietcombank';
  if (lower === 'vietinbank') return 'VietinBank';
  if (lower === 'techcombank') return 'Techcombank';
  if (lower === 'donga bank') return 'Đông Á Bank';
  if (lower === 'bac a bank') return 'Bắc Á Bank';
  if (lower === 'nam a bank') return 'Nam Á Bank';
  if (lower === 'viet a bank') return 'Việt Á Bank';
  if (lower === 'kienlong bank') return 'Kienlongbank';
  if (lower === 'lienviet postbank') return 'LPBank';
  if (lower === 'pvcom bank') return 'PVcomBank';
  if (lower === 'cake by vpbank') return 'Cake by VPBank';
  return raw;
}

function normalizeEwalletName(raw) {
  const lower = raw.toLowerCase().trim();
  if (lower === 'momo') return 'MoMo';
  if (lower === 'zalopay') return 'ZaloPay';
  if (lower === 'shopeepay') return 'ShopeePay';
  if (lower === 'viettel money') return 'Viettel Money';
  if (lower === 'viettel pay') return 'Viettel Pay';
  if (lower === 'vnpay') return 'VNPay';
  if (lower === 'vnpay money') return 'VNPay Money';
  if (lower === 'grabpay by moca') return 'GrabPay / Moca';
  if (lower === 'payoo') return 'Payoo';
  if (lower === 'vtcpay') return 'VTC Pay';
  if (lower === 'vinid') return 'VinID';
  if (lower === 'baokim') return 'Bảo Kim';
  if (lower === 'ngan luong') return 'Ngân Lượng';
  return raw;
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const banks = fs.readdirSync(bankDir).filter(f => f.endsWith('.svg')).map(f => {
  const match = f.match(/name=(.+?),\s*style=(.+?)\.svg/);
  const rawName = match ? match[1].trim() : f.replace('.svg', '').trim();
  const slug = rawName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
  const id = `bank_${slug}`;
  const name = normalizeBankName(rawName);
  const xml = cleanSvg(fs.readFileSync(path.join(bankDir, f), 'utf8'), id);
  const isPopular = POPULAR_BANKS.includes(slug);
  return { id, key: slug, name, rawName, category: 'bank', isPopular, xml };
});

banks.sort((a, b) => {
  const aPopIdx = POPULAR_BANKS.indexOf(a.key);
  const bPopIdx = POPULAR_BANKS.indexOf(b.key);
  if (aPopIdx !== -1 && bPopIdx !== -1) return aPopIdx - bPopIdx;
  if (aPopIdx !== -1) return -1;
  if (bPopIdx !== -1) return 1;
  return a.name.localeCompare(b.name, 'vi');
});

const ewallets = fs.readdirSync(ewalletDir).filter(f => f.endsWith('.svg')).map(f => {
  const match = f.match(/name=(.+?),\s*style=(.+?)\.svg/);
  const rawName = match ? match[1].trim() : f.replace('.svg', '').trim();
  const slug = rawName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
  const id = `ewallet_${slug}`;
  const name = normalizeEwalletName(rawName);
  const xml = cleanSvg(fs.readFileSync(path.join(ewalletDir, f), 'utf8'), id);
  const isPopular = POPULAR_EWALLETS.includes(slug);
  return { id, key: slug, name, rawName, category: 'ewallet', isPopular, xml };
});

ewallets.sort((a, b) => {
  const aPopIdx = POPULAR_EWALLETS.indexOf(a.key);
  const bPopIdx = POPULAR_EWALLETS.indexOf(b.key);
  if (aPopIdx !== -1 && bPopIdx !== -1) return aPopIdx - bPopIdx;
  if (aPopIdx !== -1) return -1;
  if (bPopIdx !== -1) return 1;
  return a.name.localeCompare(b.name, 'vi');
});

fs.writeFileSync(outputFile, JSON.stringify({ banks, ewallets }));
console.log(`Successfully written ${banks.length} banks and ${ewallets.length} ewallets to ${outputFile}`);
