import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings, DEFAULT_WALLETS, Transaction, Wallet } from '../types';

const TRANSACTIONS_KEY = '@finance_app_transactions_v1';
const SETTINGS_KEY = '@finance_app_settings_v1';
const WALLETS_KEY = '@finance_app_wallets_v2'; // Nâng cấp key sang v2 cho multi-source wallet

export const storageService = {
  /**
   * Lấy danh sách toàn bộ giao dịch, sắp xếp theo thời gian tạo mới nhất
   */
  async getTransactions(): Promise<Transaction[]> {
    try {
      const rawData = await AsyncStorage.getItem(TRANSACTIONS_KEY);
      if (!rawData) {
        return [];
      }
      const transactions: Transaction[] = JSON.parse(rawData);
      return transactions.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('[Storage] Error loading transactions:', error);
      return [];
    }
  },

  /**
   * Thêm giao dịch mới vào AsyncStorage với trạng thái synced = false
   */
  async addTransaction(
    data: Omit<Transaction, 'id' | 'synced' | 'createdAt'>
  ): Promise<Transaction> {
    try {
      const currentList = await this.getTransactions();
      const newTransaction: Transaction = {
        ...data,
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        synced: false,
        createdAt: Date.now(),
      };

      const updatedList = [newTransaction, ...currentList];
      await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(updatedList));
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
      const currentList = await this.getTransactions();
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
   * Xóa một giao dịch theo id
   */
  async deleteTransaction(id: string): Promise<void> {
    try {
      const currentList = await this.getTransactions();
      const updatedList = currentList.filter((item) => item.id !== id);
      await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(updatedList));
    } catch (error) {
      console.error('[Storage] Error deleting transaction:', error);
      throw error;
    }
  },

  /**
   * Lấy danh sách ví đa nguồn (Hỗ trợ migrate tự động nếu có dữ liệu cũ)
   */
  async getWallets(): Promise<Wallet[]> {
    try {
      const raw = await AsyncStorage.getItem(WALLETS_KEY);
      if (!raw) {
        // Kiểm tra xem có dữ liệu v1 cũ không
        const rawV1 = await AsyncStorage.getItem('@finance_app_wallets_v1');
        if (rawV1) {
          const oldList = JSON.parse(rawV1);
          const migratedList: Wallet[] = oldList.map((old: any, idx: number) => ({
            id: old.id || `wallet_${Date.now()}_${idx}`,
            name: old.name || 'Ví',
            type: old.name.includes('mặt') ? 'CASH' : 'BANK_EWALLET',
            icon: old.icon || 'Wallet',
            colorGradient: old.color ? [old.color, '#6366F1'] : ['#8B5CF6', '#6366F1'],
            balance: old.initialBalance || 0,
            createdAt: Date.now(),
          }));
          await this.saveWallets(migratedList);
          return migratedList;
        }

        // Mặc định tạo mới từ DEFAULT_WALLETS
        await AsyncStorage.setItem(WALLETS_KEY, JSON.stringify(DEFAULT_WALLETS));
        return DEFAULT_WALLETS;
      }

      const list: Wallet[] = JSON.parse(raw);
      return list;
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
  async addWallet(wallet: Omit<Wallet, 'id' | 'createdAt'>): Promise<Wallet> {
    try {
      const currentWallets = await this.getWallets();
      const newWallet: Wallet = {
        ...wallet,
        id: `wallet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: Date.now(),
      };
      const updated = [...currentWallets, newWallet];
      await this.saveWallets(updated);
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
      const currentWallets = await this.getWallets();
      const updated = currentWallets.map((w) =>
        w.id === updatedWallet.id ? updatedWallet : w
      );
      await this.saveWallets(updated);
    } catch (error) {
      console.error('[Storage] Error updating wallet:', error);
      throw error;
    }
  },

  /**
   * Xóa ví
   */
  async deleteWallet(id: string): Promise<void> {
    try {
      const currentWallets = await this.getWallets();
      const updated = currentWallets.filter((w) => w.id !== id);
      await this.saveWallets(updated);
    } catch (error) {
      console.error('[Storage] Error deleting wallet:', error);
      throw error;
    }
  },

  /**
   * Lấy cài đặt ứng dụng
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

  /**
   * Lưu cài đặt ứng dụng
   */
  async saveSettings(settings: AppSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('[Storage] Error saving settings:', error);
      throw error;
    }
  },
};
