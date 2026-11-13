export type DebtType = 'LEND' | 'BORROW'; // LEND: Cho vay (Thu về) | BORROW: Đi vay (Trả đi)
export type DebtStatus = 'ACTIVE' | 'SETTLED';

export interface DebtPayment {
  id: string;
  amount: number;
  date: string; // ISO string
  walletId?: string;
  note?: string;
}

export interface DebtRecord {
  id: string;
  type: DebtType;
  personName: string; // Tên người vay / chủ nợ
  totalAmount: number; // Tổng số tiền gốc
  paidAmount: number; // Số tiền đã trả / đã thu
  walletId?: string; // Ví liên quan lúc tạo (nếu có)
  syncWithWallet: boolean; // Có cộng/trừ vào số dư ví và tạo transaction không
  createdDate: string; // Ngày vay/cho vay (ISO)
  dueDate?: string; // Ngày hẹn trả (ISO - tùy chọn)
  note?: string;
  status: DebtStatus;
  payments: DebtPayment[]; // Lịch sử các lần trả góp / thu nợ
  createdAt: number;
  synced: boolean;
  updatedAt?: string;
  isDeleted?: boolean;
}
