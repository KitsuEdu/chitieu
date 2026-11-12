export type TransactionType = 'EXPENSE' | 'INCOME' | 'TRANSFER';

export interface Transaction {
  id: string;
  date: string; // ISO date string (YYYY-MM-DDTHH:mm:ss.sssZ)
  amount: number;
  type: TransactionType;
  category: string;
  wallet: string;
  note?: string;
  synced: boolean;
  createdAt: number;
}

export type WalletType = 'CASH' | 'BANK_EWALLET' | 'CREDIT_CARD' | 'PAYLATER';

export interface Wallet {
  id: string;
  name: string; // VD: Tiền mặt, TPBank, Momo, Shopee SPayLater, Visa Signature
  type: WalletType;
  icon: string; // Tên icon hoặc brand identifier
  logoId?: string; // ID logo ngân hàng / ví điện tử (vd: 'bank_tpbank', 'ewallet_momo')
  colorGradient: [string, string]; // 2 mã hex làm nền gradient cho card ví
  
  // Dành cho CASH, BANK_EWALLET và Ví điện tử số dư:
  balance?: number; // Số dư khả dụng thực tế
  
  // Dành cho CREDIT_CARD và PAYLATER (Ví điện tử trả sau):
  creditLimit?: number;      // Hạn mức tối đa được cấp
  currentBalance?: number;   // Dư nợ hiện tại (số tiền đang nợ)
  statementDate?: number;    // Ngày chốt sao kê hàng tháng (VD: ngày 25)
  dueDate?: number;          // Ngày đến hạn thanh toán (VD: ngày 10)
  feeWarningNote?: string;   // Ghi chú phí duy trì (VD: 'Phí dịch vụ 30k/tháng nếu có GD')
  
  createdAt: number;
}

// Alias tương thích ngược
export type WalletItem = Wallet;

export interface AppSettings {
  googleScriptUrl: string;
  apiToken?: string;
  userName?: string;
}

export interface SyncResult {
  success: boolean;
  count: number;
  error?: string;
}

export const CATEGORIES = [
  'Ăn uống',
  'Gym/Sức khỏe',
  'Công nghệ/Tools',
  'Di chuyển',
  'Mua sắm',
  'Tiện ích',
  'Khác',
] as const;

export const WALLETS = [
  'Tiền mặt',
  'Ngân hàng',
  'Tiết kiệm',
] as const;

export const DEFAULT_WALLETS: Wallet[] = [
  {
    id: 'wallet_cash',
    name: 'Tiền mặt',
    type: 'CASH',
    icon: 'Wallet',
    colorGradient: ['#34D399', '#059669'],
    balance: 3000000,
    createdAt: Date.now() - 30 * 86400000,
  },
  {
    id: 'wallet_bank',
    name: 'Tài khoản TPBank',
    type: 'BANK_EWALLET',
    icon: 'bank_tpbank',
    logoId: 'bank_tpbank',
    colorGradient: ['#8B5CF6', '#6366F1'],
    balance: 28500000,
    createdAt: Date.now() - 25 * 86400000,
  },
  {
    id: 'wallet_credit',
    name: 'Visa Techcombank',
    type: 'CREDIT_CARD',
    icon: 'bank_techcombank',
    logoId: 'bank_techcombank',
    colorGradient: ['#F43F5E', '#BE123C'],
    creditLimit: 50000000,
    currentBalance: 7500000,
    statementDate: 25,
    dueDate: 10,
    feeWarningNote: 'Miễn lãi đến 45 ngày',
    createdAt: Date.now() - 20 * 86400000,
  },
  {
    id: 'wallet_spaylater',
    name: 'Shopee SPayLater',
    type: 'PAYLATER',
    icon: 'ewallet_shopeepay',
    logoId: 'ewallet_shopeepay',
    colorGradient: ['#F59E0B', '#D97706'],
    creditLimit: 10000000,
    currentBalance: 1250000,
    statementDate: 1,
    dueDate: 15,
    feeWarningNote: 'Phí dịch vụ 30k/tháng nếu có GD',
    createdAt: Date.now() - 15 * 86400000,
  },
  {
    id: 'wallet_momo',
    name: 'Ví MoMo',
    type: 'PAYLATER',
    icon: 'ewallet_momo',
    logoId: 'ewallet_momo',
    colorGradient: ['#EC4899', '#DB2777'],
    balance: 2150000,
    createdAt: Date.now() - 10 * 86400000,
  },
];
