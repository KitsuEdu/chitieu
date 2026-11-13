import { storageService, registerSyncTrigger } from './storageService';
import { SyncResult, Wallet, Transaction, DebtRecord } from '../types';

export type SyncEventType =
  | 'SYNC_START'
  | 'SYNC_SUCCESS'
  | 'SYNC_ERROR'
  | 'RESTORE_START'
  | 'RESTORE_SUCCESS'
  | 'RESTORE_ERROR'
  | 'STATUS_CHANGE';

export interface SyncEvent {
  type: SyncEventType;
  message?: string;
  timestamp?: string;
  error?: string;
}

export type SyncListener = (event: SyncEvent) => void;

class SyncManager {
  private isSyncing: boolean = false;
  private autoSyncTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<SyncListener> = new Set();
  private lastError: string | null = null;

  constructor() {
    // Đăng ký callback với storageService để tự động kích hoạt debounce sync khi có thay đổi dữ liệu
    registerSyncTrigger(() => {
      this.scheduleAutoSync();
    });
  }

  /**
   * Đăng ký lắng nghe sự kiện đồng bộ
   */
  public addListener(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Phát sự kiện tới tất cả subscriber
   */
  private emit(event: SyncEvent) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.warn('[SyncService] Listener error:', err);
      }
    });
  }

  /**
   * Trạng thái đồng bộ hiện tại
   */
  public async getSyncStatus() {
    const [hasPendingSync, lastSyncTime, settings] = await Promise.all([
      storageService.getPendingSync(),
      storageService.getLastSyncTime(),
      storageService.getSettings(),
    ]);

    return {
      isSyncing: this.isSyncing,
      hasPendingSync,
      lastSyncTime,
      lastError: this.lastError,
      isConfigured: Boolean(settings?.googleScriptUrl?.trim()),
    };
  }

  /**
   * 1. Kiểm tra kết nối tới Google Apps Script URL (PING)
   * Timeout 10 giây qua AbortController
   */
  public async pingUrl(
    url: string
  ): Promise<{ success: boolean; message: string; sheetName?: string; serverTime?: string }> {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      return { success: false, message: 'URL không được để trống' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const payload = {
        action: 'PING',
        timestamp: new Date().toISOString(),
      };

      const response = await fetch(trimmedUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        redirect: 'follow',
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          message: `Lỗi kết nối HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const responseText = await response.text();
      let resData: any = {};
      try {
        resData = JSON.parse(responseText);
      } catch {
        resData = {
          status: responseText.includes('success') ? 'success' : 'error',
          message: responseText,
        };
      }

      if (resData.status === 'success') {
        return {
          success: true,
          message: `Kết nối thành công tới Bảng tính "${resData.sheetName || 'Google Sheets'}"!`,
          sheetName: resData.sheetName,
          serverTime: resData.serverTime,
        };
      }

      return {
        success: false,
        message: resData.message || 'Script phản hồi lỗi khi kiểm tra',
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        return {
          success: false,
          message: 'Quá thời gian kết nối (Timeout 10 giây). Vui lòng kiểm tra lại URL hoặc mạng.',
        };
      }
      return {
        success: false,
        message: `Không thể kết nối: ${err?.message || 'Lỗi mạng hoặc sai URL'}`,
      };
    }
  }

  /**
   * 2. Đồng bộ 2 chiều ngay lập tức (SYNC)
   * - Lấy toàn bộ dữ liệu (kể cả isDeleted: true) từ AsyncStorage
   * - Gửi action: 'SYNC' lên Apps Script để merge
   * - Lưu lại dữ liệu hợp nhất, dọn dẹp soft-deleted, lưu lastSyncTime, set hasPendingSync = false
   * - Phát event để UI cập nhật số liệu mới nhất
   */
  public async syncNow(
    isSilent: boolean = false
  ): Promise<{ success: boolean; count?: number; error?: string }> {
    if (this.isSyncing) {
      return { success: false, error: 'Đang trong quá trình đồng bộ' };
    }

    try {
      const settings = await storageService.getSettings();
      const targetUrl = settings.googleScriptUrl?.trim();

      if (!targetUrl) {
        if (!isSilent) {
          return { success: false, error: 'Chưa cấu hình URL Google Apps Script' };
        }
        return { success: false, error: 'Chưa cấu hình URL' };
      }

      this.isSyncing = true;
      this.lastError = null;
      this.emit({ type: 'SYNC_START' });

      // Lấy toàn bộ dữ liệu bao gồm cả các item đã soft-delete
      const [wallets, transactions, debts] = await Promise.all([
        storageService.getWallets(true),
        storageService.getTransactions(true),
        storageService.getDebts(true),
      ]);

      const payload = {
        action: 'SYNC',
        wallets,
        transactions,
        debts,
        timestamp: new Date().toISOString(),
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout cho sync

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        redirect: 'follow',
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();
      let resData: any = {};
      try {
        resData = JSON.parse(responseText);
      } catch {
        throw new Error('Dữ liệu phản hồi từ Google Script không hợp lệ');
      }

      if (resData.status !== 'success') {
        throw new Error(resData.message || 'Lỗi xử lý từ Google Apps Script');
      }

      // Nhận bộ dữ liệu đã hợp nhất từ Server
      const serverWallets: Wallet[] = resData.wallets || [];
      const serverTransactions: Transaction[] = resData.transactions || [];
      const serverDebts: DebtRecord[] = resData.debts || [];

      // Dọn dẹp vĩnh viễn các item đã xóa (isDeleted === true) vì server đã xác nhận
      const cleanWallets = serverWallets.filter((w) => !w.isDeleted);
      const cleanTransactions = serverTransactions.filter((t) => !t.isDeleted);
      const cleanDebts = serverDebts.filter((d) => !d.isDeleted);

      // Lưu lại vào AsyncStorage
      await Promise.all([
        storageService.replaceWallets(cleanWallets),
        storageService.replaceTransactions(cleanTransactions),
        storageService.replaceDebts(cleanDebts),
      ]);

      const syncTimestamp = resData.serverTime || new Date().toISOString();
      await Promise.all([
        storageService.setLastSyncTime(syncTimestamp),
        storageService.setPendingSync(false),
      ]);

      const totalItems = cleanWallets.length + cleanTransactions.length + cleanDebts.length;

      this.emit({
        type: 'SYNC_SUCCESS',
        message: 'Đồng bộ 2 chiều thành công',
        timestamp: syncTimestamp,
      });

      return {
        success: true,
        count: totalItems,
      };
    } catch (error: any) {
      const errorMsg =
        error.name === 'AbortError'
          ? 'Quá thời gian đồng bộ (Timeout)'
          : error?.message || 'Lỗi mạng hoặc kết nối Google Apps Script';

      this.lastError = errorMsg;
      console.warn('[SyncService] Sync failed:', errorMsg);

      this.emit({
        type: 'SYNC_ERROR',
        error: errorMsg,
      });

      return {
        success: false,
        error: errorMsg,
      };
    } finally {
      this.isSyncing = false;
      this.emit({ type: 'STATUS_CHANGE' });
    }
  }

  /**
   * 3. Khôi phục từ Google Sheets (RESTORE)
   * Đọc toàn bộ dữ liệu sạch từ 3 sheet Wallets, Transactions, Debts ghi đè vào AsyncStorage
   */
  public async restoreFromCloud(): Promise<{
    success: boolean;
    walletsCount?: number;
    transactionsCount?: number;
    debtsCount?: number;
    error?: string;
  }> {
    if (this.isSyncing) {
      return { success: false, error: 'Hệ thống đang bận đồng bộ' };
    }

    try {
      const settings = await storageService.getSettings();
      const targetUrl = settings.googleScriptUrl?.trim();

      if (!targetUrl) {
        return { success: false, error: 'Chưa cấu hình URL Google Apps Script' };
      }

      this.isSyncing = true;
      this.lastError = null;
      this.emit({ type: 'RESTORE_START' });

      const payload = {
        action: 'RESTORE',
        timestamp: new Date().toISOString(),
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        redirect: 'follow',
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();
      let resData: any = {};
      try {
        resData = JSON.parse(responseText);
      } catch {
        throw new Error('Dữ liệu JSON từ Google Sheets không hợp lệ');
      }

      if (resData.status !== 'success') {
        throw new Error(resData.message || 'Lỗi phản hồi từ Google Script');
      }

      const wallets: Wallet[] = (resData.wallets || []).filter((w: Wallet) => !w.isDeleted);
      const transactions: Transaction[] = (resData.transactions || []).filter(
        (t: Transaction) => !t.isDeleted
      );
      const debts: DebtRecord[] = (resData.debts || []).filter((d: DebtRecord) => !d.isDeleted);

      // Ghi đè vào AsyncStorage
      await Promise.all([
        storageService.replaceWallets(wallets),
        storageService.replaceTransactions(transactions),
        storageService.replaceDebts(debts),
      ]);

      const syncTimestamp = resData.serverTime || new Date().toISOString();
      await Promise.all([
        storageService.setLastSyncTime(syncTimestamp),
        storageService.setPendingSync(false),
      ]);

      this.emit({
        type: 'RESTORE_SUCCESS',
        message: 'Khôi phục dữ liệu từ Google Sheets thành công',
        timestamp: syncTimestamp,
      });

      return {
        success: true,
        walletsCount: wallets.length,
        transactionsCount: transactions.length,
        debtsCount: debts.length,
      };
    } catch (error: any) {
      const errorMsg =
        error.name === 'AbortError'
          ? 'Quá thời gian kết nối (Timeout)'
          : error?.message || 'Lỗi khôi phục từ Cloud';

      this.lastError = errorMsg;
      console.warn('[SyncService] Restore failed:', errorMsg);

      this.emit({
        type: 'RESTORE_ERROR',
        error: errorMsg,
      });

      return {
        success: false,
        error: errorMsg,
      };
    } finally {
      this.isSyncing = false;
      this.emit({ type: 'STATUS_CHANGE' });
    }
  }

  /**
   * 4. Kích hoạt Auto-Sync ngầm (Debounced 2500ms)
   */
  public scheduleAutoSync() {
    if (this.autoSyncTimer) {
      clearTimeout(this.autoSyncTimer);
    }

    this.autoSyncTimer = setTimeout(async () => {
      this.autoSyncTimer = null;
      try {
        const settings = await storageService.getSettings();
        if (settings?.googleScriptUrl?.trim()) {
          await this.syncNow(true); // Silent sync
        }
      } catch (err) {
        console.warn('[SyncService] Auto sync error:', err);
      }
    }, 2500);
  }

  /**
   * Các hàm tương thích ngược (Legacy Aliases)
   */
  public async testConnection(
    url: string,
    token?: string
  ): Promise<{ success: boolean; message: string }> {
    return this.pingUrl(url);
  }

  public async syncPendingTransactions(): Promise<SyncResult> {
    const res = await this.syncNow(true);
    return {
      success: res.success,
      count: res.count || 0,
      error: res.error,
    };
  }

  public async syncPendingDebts(): Promise<SyncResult> {
    const res = await this.syncNow(true);
    return {
      success: res.success,
      count: res.count || 0,
      error: res.error,
    };
  }

  public async syncAll(): Promise<{ transactions: SyncResult; debts: SyncResult }> {
    const res = await this.syncNow(true);
    const result: SyncResult = {
      success: res.success,
      count: res.count || 0,
      error: res.error,
    };
    return { transactions: result, debts: result };
  }
}

export const syncService = new SyncManager();
