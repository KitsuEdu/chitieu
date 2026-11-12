import logosData from './logosData.json';

export interface WalletLogoItem {
  id: string;
  key: string;
  name: string;
  rawName: string;
  category: 'bank' | 'ewallet';
  isPopular: boolean;
  xml: string;
}

export const BANK_LOGOS: WalletLogoItem[] = (logosData.banks || []) as WalletLogoItem[];
export const EWALLET_LOGOS: WalletLogoItem[] = (logosData.ewallets || []) as WalletLogoItem[];
export const ALL_LOGOS: WalletLogoItem[] = [...BANK_LOGOS, ...EWALLET_LOGOS];

// Index by ID for O(1) lookup
const LOGO_BY_ID = new Map<string, WalletLogoItem>();
for (const item of ALL_LOGOS) {
  LOGO_BY_ID.set(item.id, item);
  LOGO_BY_ID.set(item.key, item);
}

/**
 * Tìm logo theo ID hoặc key (vd: "bank_vietcombank", "bank_tpbank", "ewallet_momo")
 */
export function getLogoById(id?: string): WalletLogoItem | undefined {
  if (!id) return undefined;
  return LOGO_BY_ID.get(id);
}

/**
 * Tìm kiếm logo theo từ khóa (hỗ trợ tiếng Việt không dấu)
 */
export function searchLogos(
  query: string,
  category?: 'bank' | 'ewallet' | 'all'
): WalletLogoItem[] {
  const list =
    category === 'bank'
      ? BANK_LOGOS
      : category === 'ewallet'
      ? EWALLET_LOGOS
      : ALL_LOGOS;

  const q = query.trim().toLowerCase();
  if (!q) return list;

  return list.filter((item) => {
    const n = item.name.toLowerCase();
    const r = item.rawName.toLowerCase();
    const k = item.key.toLowerCase();
    return n.includes(q) || r.includes(q) || k.includes(q);
  });
}

/**
 * Tự động tìm logo phù hợp nhất dựa trên icon/logoId hoặc tên ví
 */
export function matchLogoForWallet(wallet: {
  icon?: string;
  logoId?: string;
  name?: string;
  type?: string;
}): WalletLogoItem | undefined {
  // 1. Kiểm tra trực tiếp theo logoId
  if (wallet.logoId) {
    const found = getLogoById(wallet.logoId);
    if (found) return found;
  }

  // 2. Kiểm tra theo icon nếu icon chứa ID logo (bắt đầu bằng 'bank_' hoặc 'ewallet_')
  if (wallet.icon && (wallet.icon.startsWith('bank_') || wallet.icon.startsWith('ewallet_'))) {
    const found = getLogoById(wallet.icon);
    if (found) return found;
  }

  // 3. Đoán theo tên ví nếu có từ khóa nhận diện phổ biến
  const name = (wallet.name || '').toLowerCase();
  if (!name) return undefined;

  // E-wallets
  if (name.includes('momo')) return getLogoById('ewallet_momo');
  if (name.includes('zalo') || name.includes('zalopay')) return getLogoById('ewallet_zalopay');
  if (name.includes('shopee') || name.includes('spaylater')) return getLogoById('ewallet_shopeepay');
  if (name.includes('viettel money')) return getLogoById('ewallet_viettel_money');
  if (name.includes('viettel pay')) return getLogoById('ewallet_viettel_pay');
  if (name.includes('vnpay')) return getLogoById('ewallet_vnpay');
  if (name.includes('grab') || name.includes('moca')) return getLogoById('ewallet_grabpay_by_moca');
  if (name.includes('payoo')) return getLogoById('ewallet_payoo');
  if (name.includes('vinid')) return getLogoById('ewallet_vinid');

  // Banks
  if (name.includes('vietcombank') || name.includes('vcb')) return getLogoById('bank_vietcombank');
  if (name.includes('techcombank') || name.includes('tcb')) return getLogoById('bank_techcombank');
  if (name.includes('tpbank') || name.includes('tpb')) return getLogoById('bank_tpbank');
  if (name.includes('mb') || name.includes('mbbank') || name.includes('quân đội')) return getLogoById('bank_mb_bank');
  if (name.includes('vpbank') || name.includes('vpb')) return getLogoById('bank_vpbank');
  if (name.includes('cake')) return getLogoById('bank_cake_by_vpbank');
  if (name.includes('timo')) return getLogoById('bank_timo');
  if (name.includes('acb')) return getLogoById('bank_acb');
  if (name.includes('bidv')) return getLogoById('bank_bidv');
  if (name.includes('vietinbank') || name.includes('viettinbank')) return getLogoById('bank_vietinbank');
  if (name.includes('agribank') || name.includes('argibank')) return getLogoById('bank_argibank');
  if (name.includes('vib')) return getLogoById('bank_vib');
  if (name.includes('msb')) return getLogoById('bank_msb');
  if (name.includes('hdbank') || name.includes('hd bank')) return getLogoById('bank_hdbank');
  if (name.includes('scb')) return getLogoById('bank_scb');
  if (name.includes('shb')) return getLogoById('bank_shb');
  if (name.includes('ocb')) return getLogoById('bank_ocb');
  if (name.includes('shinhan')) return getLogoById('bank_shinhan_bank');
  if (name.includes('dong a') || name.includes('đông á')) return getLogoById('bank_donga_bank');
  if (name.includes('bac a') || name.includes('bắc á')) return getLogoById('bank_bac_a_bank');
  if (name.includes('nam a') || name.includes('nam á')) return getLogoById('bank_nam_a_bank');
  if (name.includes('lienviet') || name.includes('lpbank')) return getLogoById('bank_lienviet_postbank');

  return undefined;
}
