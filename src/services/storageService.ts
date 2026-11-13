import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppSettings,
  DEFAULT_WALLETS,
  Transaction,
  Wallet,
  DebtRecord,
  DebtPayment,
} from '../types';

const TRANSACTIONS_KEY = '@finance_app_transactions_v1';
const SETTINGS_KEY = '@finance_app_settings_v1';
const WALLETS_KEY = '@finance_app_wallets_v2';
const DEBTS_KEY = '@finance_app_debts_v1';
const PENDING_SYNC_KEY = '@finance_app_pending_sync_v1';
const LAST_SYNC_KEY = '@finance_app_last_sync_time_v1';

type SyncTriggerFn = () => void;
let syncTrigger: SyncTriggerFn | null = null;

export const registerSyncTrigger = (fn: SyncTriggerFn) => {
  syncTrigger = fn;
};

const notifyDataChanged = async () => {
  try {
    await storageService.setPendingSync(true);
    if (syncTrigger) {
      syncTrigger();
    }
  } catch (e) {
    console.warn('[Storage] Error triggering auto sync:', e);
  }
};

export const storageService = {
  /**
   * ==========================================
   * TRẠNG THÁI ĐỒNG BỘ (SYNC METADATA)
   * ==========================================
   */
  async getPendingSync(): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(PENDING_SYNC_KEY);
      return raw === 'true';
    } catch {
      return false;
    }
  },

  async setPendingSync(status: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(PENDING_SYNC_KEY, status ? 'true' : 'false');
    } catch (error) {
      console.error('[Storage] Error setting pending sync:', error);
    }
  },

  async getLastSyncTime(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(LAST_SYNC_KEY);
    } catch {
      return null;
    }
  },

  async setLastSyncTime(iso: string): Promise<void> {
    try {
      await AsyncStorage.setItem(LAST_SYNC_KEY, iso);
    } catch (error) {
      console.error('[Storage] Error setting last sync time:', error);
    }
  },

  /**
   * ==========================================
   * GIAO DỊCH (TRANSACTIONS)
   * ==========================================
   */

  /**
   * Lấy danh sách giao dịch. Mặc định lọc bỏ soft-deleted (isDeleted === true).
   * Truyền includeDeleted = true khi dùng cho syncService.
   */
  async getTransactions(includeDeleted: boolean = false): Promise<Transaction[]> {
    try {
      const rawData = await AsyncStorage.getItem(TRANSACTIONS_KEY);
      if (!rawData) {
        return [];
      }
      const transactions: Transaction[] = JSON.parse(rawData);
      const normalized = transactions.map((t) => ({
        ...t,
        updatedAt: t.updatedAt || new Date(t.createdAt || Date.now()).toISOString(),
        isDeleted: Boolean(t.isDeleted),
      }));

      const filtered = includeDeleted ? normalized : normalized.filter((t) => !t.isDeleted);
      return filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch (error) {
      console.error('[Storage] Error loading transactions:', error);
      return [];
    }
  },

  /**
   * Thêm giao dịch mới vào AsyncStorage với updatedAt và isDeleted = false
   */
  async addTransaction(
    data: Omit<Transaction, 'id' | 'synced' | 'createdAt' | 'updatedAt' | 'isDeleted'>
  ): Promise<Transaction> {
    try {
      const currentList = await this.getTransactions(true);
      const nowIso = new Date().toISOString();
      const newTransaction: Transaction = {
        ...data,
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        synced: false,
        createdAt: Date.now(),
        updatedAt: nowIso,
        isDeleted: false,
      };

      const updatedList = [newTransaction, ...currentList];
      await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(updatedList));
      await notifyDataChanged();
      return newTransaction;
    } catch (error) {
      console.error('[Storage] Error adding transaction:', error);
      throw error;
    }
  },

  /**
   * Đánh dấu các giao dịch trong danh sách IDs là đã đồng bộ (synced = true)
   */
  async markAsSynced(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    try {
      const idSet = new Set(ids);
      const currentList = await this.getTransactions(true);
      const updatedList = currentList.map((item) =>
        idSet.has(item.id) ? { ...item, synced: true } : item
      );
      await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(updatedList));
    } catch (error) {
      console.error('[Storage] Error marking transactions as synced:', error);
      throw error;
    }
  },

  /**
   * Xóa một giao dịch (Soft Delete)
   */
  async deleteTransaction(id: string): Promise<void> {
    try {
      const currentList = await this.getTransactions(true);
      const nowIso = new Date().toISOString();
      const updatedList = currentList.map((item) =>
        item.id === id
          ? { ...item, isDeleted: true, updatedAt: nowIso, synced: false }
          : item
      );
      await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(updatedList));
      await notifyDataChanged();
    } catch (error) {
      console.error('[Storage] Error deleting transaction:', error);
      throw error;
    }
  },

  /**
   * Ghi đè toàn bộ danh sách giao dịch (dùng khi SYNC / RESTORE)
   */
  async replaceTransactions(transactions: Transaction[]): Promise<void> {
    try {
      await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
    } catch (error) {
      console.error('[Storage] Error replacing transactions:', error);
      throw error;
    }
  },

  /**
   * ==========================================
   * VÍ TIỀN (WALLETS)
   * ==========================================
   */

  /**
   * Lấy danh sách ví. Mặc định lọc bỏ soft-deleted (isDeleted === true).
   */
  async getWallets(includeDeleted: boolean = false): Promise<Wallet[]> {
    try {
      const raw = await AsyncStorage.getItem(WALLETS_KEY);
      if (!raw) {
        // Kiểm tra xem có dữ liệu v1 cũ không
        const rawV1 = await AsyncStorage.getItem('@finance_app_wallets_v1');
        if (rawV1) {
          const oldList = JSON.parse(rawV1);
          const nowIso = new Date().toISOString();
          const migratedList: Wallet[] = oldList.map((old: any, idx: number) => ({
            id: old.id || `wallet_${Date.now()}_${idx}`,
            name: old.name || 'Ví',
            type: old.name.includes('mặt') ? 'CASH' : 'BANK_EWALLET',
            icon: old.icon || 'Wallet',
            colorGradient: old.color ? [old.color, '#6366F1'] : ['#8B5CF6', '#6366F1'],
            balance: old.initialBalance || 0,
            createdAt: Date.now(),
            updatedAt: nowIso,
            isDeleted: false,
          }));
          await this.saveWallets(migratedList);
          return migratedList;
        }

        // Mặc định tạo mới từ DEFAULT_WALLETS
        const nowIso = new Date().toISOString();
        const defaultList: Wallet[] = DEFAULT_WALLETS.map((w) => ({
          ...w,
          updatedAt: w.updatedAt || nowIso,
          isDeleted: false,
        }));
        await AsyncStorage.setItem(WALLETS_KEY, JSON.stringify(defaultList));
        return defaultList;
      }

      const list: Wallet[] = JSON.parse(raw);
      const normalized = list.map((w) => ({
        ...w,
        updatedAt: w.updatedAt || new Date(w.createdAt || Date.now()).toISOString(),
        isDeleted: Boolean(w.isDeleted),
      }));

      return includeDeleted ? normalized : normalized.filter((w) => !w.isDeleted);
    } catch (error) {
      console.error('[Storage] Error loading wallets:', error);
      return DEFAULT_WALLETS;
    }
  },

  /**
   * Lưu toàn bộ danh sách ví
   */
  async saveWallets(wallets: Wallet[]): Promise<void> {
    try {
      await AsyncStorage.setItem(WALLETS_KEY, JSON.stringify(wallets));
    } catch (error) {
      console.error('[Storage] Error saving wallets:', error);
      throw error;
    }
  },

  /**
   * Thêm ví mới
   */
  async addWallet(
    wallet: Omit<Wallet, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>
  ): Promise<Wallet> {
    try {
      const currentWallets = await this.getWallets(true);
      const nowIso = new Date().toISOString();
      const newWallet: Wallet = {
        ...wallet,
        id: `wallet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: Date.now(),
        updatedAt: nowIso,
        isDeleted: false,
      };
      const updated = [...currentWallets, newWallet];
      await this.saveWallets(updated);
      await notifyDataChanged();
      return newWallet;
    } catch (error) {
      console.error('[Storage] Error adding wallet:', error);
      throw error;
    }
  },

  /**
   * Cập nhật thông tin ví
   */
  async updateWallet(updatedWallet: Wallet): Promise<void> {
    try {
      const currentWallets = await this.getWallets(true);
      const nowIso = new Date().toISOString();
      const updated = currentWallets.map((w) =>
        w.id === updatedWallet.id
          ? { ...updatedWallet, updatedAt: nowIso, isDeleted: false }
          : w
      );
      await this.saveWallets(updated);
      await notifyDataChanged();
    } catch (error) {
      console.error('[Storage] Error updating wallet:', error);
      throw error;
    }
  },

  /**
   * Xóa ví (Soft Delete)
   */
  async deleteWallet(id: string): Promise<void> {
    try {
      const currentWallets = await this.getWallets(true);
      const nowIso = new Date().toISOString();
      const updated = currentWallets.map((w) =>
        w.id === id ? { ...w, isDeleted: true, updatedAt: nowIso } : w
      );
      await this.saveWallets(updated);
      await notifyDataChanged();
    } catch (error) {
      console.error('[Storage] Error deleting wallet:', error);
      throw error;
    }
  },

  /**
   * Ghi đè toàn bộ danh sách ví (dùng khi SYNC / RESTORE)
   */
  async replaceWallets(wallets: Wallet[]): Promise<void> {
    try {
      await AsyncStorage.setItem(WALLETS_KEY, JSON.stringify(wallets));
    } catch (error) {
      console.error('[Storage] Error replacing wallets:', error);
      throw error;
    }
  },

  /**
   * ==========================================
   * CÀI ĐẶT ỨNG DỤNG (SETTINGS)
   * ==========================================
   */
  async getSettings(): Promise<AppSettings> {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (!raw) {
        return { googleScriptUrl: '', apiToken: '' };
      }
      return JSON.parse(raw);
    } catch (error) {
      console.error('[Storage] Error loading settings:', error);
      return { googleScriptUrl: '', apiToken: '' };
    }
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('[Storage] Error saving settings:', error);
      throw error;
    }
  },

  /**
   * ==========================================
   * SỔ NỢ & CHO VAY (DEBT & LOAN LEDGER)
   * ==========================================
   */

  /**
   * Lấy danh sách toàn bộ các khoản nợ / cho vay.
   * Mặc định lọc bỏ soft-deleted (isDeleted === true).
   */
  async getDebts(includeDeleted: boolean = false): Promise<DebtRecord[]> {
    try {
      const rawData = await AsyncStorage.getItem(DEBTS_KEY);
      if (!rawData) {
        return [];
      }
      const debts: DebtRecord[] = JSON.parse(rawData);
      const normalized = debts.map((d) => ({
        ...d,
        updatedAt: d.updatedAt || new Date(d.createdAt || Date.now()).toISOString(),
        isDeleted: Boolean(d.isDeleted),
      }));

      const filtered = includeDeleted ? normalized : normalized.filter((d) => !d.isDeleted);
      return filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch (error) {
      console.error('[Storage] Error loading debts:', error);
      return [];
    }
  },

  /**
   * Lưu danh sách nợ vào AsyncStorage
   */
  async saveDebts(debts: DebtRecord[]): Promise<void> {
    try {
      await AsyncStorage.setItem(DEBTS_KEY, JSON.stringify(debts));
    } catch (error) {
      console.error('[Storage] Error saving debts:', error);
      throw error;
    }
  },

  /**
   * Thêm một khoản nợ / cho vay mới
   */
  async addDebt(
    data: Omit<
      DebtRecord,
      'id' | 'paidAmount' | 'status' | 'payments' | 'createdAt' | 'synced' | 'updatedAt' | 'isDeleted'
    > &
      Partial<Pick<DebtRecord, 'paidAmount' | 'status' | 'payments'>>
  ): Promise<DebtRecord> {
    try {
      const currentDebts = await this.getDebts(true);
      const nowIso = new Date().toISOString();
      const newDebt: DebtRecord = {
        ...data,
        id: `debt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        paidAmount: data.paidAmount || 0,
        status: data.status || 'ACTIVE',
        payments: data.payments || [],
        createdAt: Date.now(),
        updatedAt: nowIso,
        isDeleted: false,
        synced: false,
      };

      // Tự động đồng bộ với ví và tạo giao dịch nếu người dùng bật tùy chọn
      if (data.syncWithWallet && data.walletId) {
        const wallets = await this.getWallets();
        const targetWallet = wallets.find(
          (w) => w.id === data.walletId || w.name === data.walletId
        );

        if (targetWallet) {
          if (data.type === 'LEND') {
            await this.addTransaction({
              date: data.createdDate || new Date().toISOString(),
              amount: data.totalAmount,
              type: 'EXPENSE',
              category: 'Cho vay',
              wallet: targetWallet.name,
              note: `Cho ${data.personName} vay${data.note ? ': ' + data.note : ''}`,
            });

            const updatedBal = (targetWallet.balance || 0) - data.totalAmount;
            await this.updateWallet({
              ...targetWallet,
              balance: updatedBal,
            });
          } else {
            await this.addTransaction({
              date: data.createdDate || new Date().toISOString(),
              amount: data.totalAmount,
              type: 'INCOME',
              category: 'Đi vay',
              wallet: targetWallet.name,
              note: `Vay từ ${data.personName}${data.note ? ': ' + data.note : ''}`,
            });

            const updatedBal = (targetWallet.balance || 0) + data.totalAmount;
            await this.updateWallet({
              ...targetWallet,
              balance: updatedBal,
            });
          }
        }
      }

      const updatedList = [newDebt, ...currentDebts];
      await this.saveDebts(updatedList);
      await notifyDataChanged();
      return newDebt;
    } catch (error) {
      console.error('[Storage] Error adding debt:', error);
      throw error;
    }
  },

  /**
   * Ghi nhận một lần thanh toán nợ / thu nợ (trả góp hoặc trả hết)
   */
  async addDebtPayment(
    debtId: string,
    paymentData: Omit<DebtPayment, 'id'>,
    syncWithWallet: boolean = false
  ): Promise<DebtRecord> {
    try {
      const currentDebts = await this.getDebts(true);
      const debtIndex = currentDebts.findIndex((d) => d.id === debtId);
      if (debtIndex === -1) {
        throw new Error('Khoản nợ không tồn tại');
      }

      const targetDebt = currentDebts[debtIndex];
      const newPayment: DebtPayment = {
        id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        amount: paymentData.amount,
        date: paymentData.date,
        walletId: paymentData.walletId,
        note: paymentData.note,
      };

      const newPaidAmount = (targetDebt.paidAmount || 0) + paymentData.amount;
      const isSettled = newPaidAmount >= targetDebt.totalAmount;
      const nowIso = new Date().toISOString();

      const updatedDebt: DebtRecord = {
        ...targetDebt,
        paidAmount: newPaidAmount,
        status: isSettled ? 'SETTLED' : targetDebt.status,
        payments: [newPayment, ...(targetDebt.payments || [])],
        updatedAt: nowIso,
        isDeleted: false,
        synced: false,
      };

      // Tự động đồng bộ với ví và tạo giao dịch thu/trả nợ
      if (syncWithWallet && paymentData.walletId) {
        const wallets = await this.getWallets();
        const targetWallet = wallets.find(
          (w) => w.id === paymentData.walletId || w.name === paymentData.walletId
        );

        if (targetWallet) {
          if (targetDebt.type === 'LEND') {
            await this.addTransaction({
              date: paymentData.date,
              amount: paymentData.amount,
              type: 'INCOME',
              category: 'Thu nợ',
              wallet: targetWallet.name,
              note: `Thu nợ từ ${targetDebt.personName}${paymentData.note ? ': ' + paymentData.note : ''}`,
            });

            const updatedBal = (targetWallet.balance || 0) + paymentData.amount;
            await this.updateWallet({
              ...targetWallet,
              balance: updatedBal,
            });
          } else {
            await this.addTransaction({
              date: paymentData.date,
              amount: paymentData.amount,
              type: 'EXPENSE',
              category: 'Trả nợ',
              wallet: targetWallet.name,
              note: `Trả nợ cho ${targetDebt.personName}${paymentData.note ? ': ' + paymentData.note : ''}`,
            });

            const updatedBal = (targetWallet.balance || 0) - paymentData.amount;
            await this.updateWallet({
              ...targetWallet,
              balance: updatedBal,
            });
          }
        }
      }

      currentDebts[debtIndex] = updatedDebt;
      await this.saveDebts(currentDebts);
      await notifyDataChanged();
      return updatedDebt;
    } catch (error) {
      console.error('[Storage] Error adding debt payment:', error);
      throw error;
    }
  },

  /**
   * Cập nhật thông tin khoản nợ
   */
  async updateDebt(updatedDebt: DebtRecord): Promise<void> {
    try {
      const currentDebts = await this.getDebts(true);
      const nowIso = new Date().toISOString();
      const updated = currentDebts.map((d) =>
        d.id === updatedDebt.id
          ? { ...updatedDebt, updatedAt: nowIso, isDeleted: false, synced: false }
          : d
      );
      await this.saveDebts(updated);
      await notifyDataChanged();
    } catch (error) {
      console.error('[Storage] Error updating debt:', error);
      throw error;
    }
  },

  /**
   * Xóa một khoản nợ (Soft Delete)
   */
  async deleteDebt(id: string): Promise<void> {
    try {
      const currentDebts = await this.getDebts(true);
      const nowIso = new Date().toISOString();
      const updated = currentDebts.map((d) =>
        d.id === id ? { ...d, isDeleted: true, updatedAt: nowIso, synced: false } : d
      );
      await this.saveDebts(updated);
      await notifyDataChanged();
    } catch (error) {
      console.error('[Storage] Error deleting debt:', error);
      throw error;
    }
  },

  /**
   * Đánh dấu các khoản nợ đã được sync lên Google Sheets
   */
  async markDebtsAsSynced(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    try {
      const idSet = new Set(ids);
      const currentList = await this.getDebts(true);
      const updatedList = currentList.map((item) =>
        idSet.has(item.id) ? { ...item, synced: true } : item
      );
      await this.saveDebts(updatedList);
    } catch (error) {
      console.error('[Storage] Error marking debts as synced:', error);
      throw error;
    }
  },

  /**
   * Ghi đè toàn bộ danh sách nợ (dùng khi SYNC / RESTORE)
   */
  async replaceDebts(debts: DebtRecord[]): Promise<void> {
    try {
      await AsyncStorage.setItem(DEBTS_KEY, JSON.stringify(debts));
    } catch (error) {
      console.error('[Storage] Error replacing debts:', error);
      throw error;
    }
  },

  /**
   * Dọn dẹp vĩnh viễn các item đã soft-delete sau khi Cloud xác nhận đã đồng bộ
   */
  async purgeDeletedItems(): Promise<void> {
    try {
      const [wallets, transactions, debts] = await Promise.all([
        this.getWallets(true),
        this.getTransactions(true),
        this.getDebts(true),
      ]);

      const cleanWallets = wallets.filter((w) => !w.isDeleted);
      const cleanTransactions = transactions.filter((t) => !t.isDeleted);
      const cleanDebts = debts.filter((d) => !d.isDeleted);

      await Promise.all([
        AsyncStorage.setItem(WALLETS_KEY, JSON.stringify(cleanWallets)),
        AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(cleanTransactions)),
        AsyncStorage.setItem(DEBTS_KEY, JSON.stringify(cleanDebts)),
      ]);
    } catch (error) {
      console.error('[Storage] Error purging deleted items:', error);
    }
  },
};
