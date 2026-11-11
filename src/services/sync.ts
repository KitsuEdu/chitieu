import { SyncResult } from '../types';
import { storageService } from './storage';

export const syncService = {
  /**
   * Đồng bộ toàn bộ giao dịch chưa sync (synced: false) lên Google Sheets
   * Không ném lỗi ra ngoài khi mất mạng để đảm bảo ứng dụng offline-first mượt mà.
   */
  async syncPendingTransactions(): Promise<SyncResult> {
    try {
      const settings = await storageService.getSettings();
      const targetUrl = settings.googleScriptUrl?.trim();

      if (!targetUrl) {
        return {
          success: false,
          count: 0,
          error: 'Chưa cấu hình URL Google Apps Script',
        };
      }

      const allTransactions = await storageService.getTransactions();
      const pendingList = allTransactions.filter((item) => !item.synced);

      if (pendingList.length === 0) {
        return {
          success: true,
          count: 0,
        };
      }

      const payload = {
        action: 'sync_transactions',
        token: settings.apiToken || '',
        transactions: pendingList,
        timestamp: new Date().toISOString(),
      };

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return {
          success: false,
          count: 0,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const resultText = await response.text();
      let responseData: any = {};
      try {
        responseData = JSON.parse(resultText);
      } catch {
        responseData = { status: resultText.includes('success') ? 'success' : 'error' };
      }

      if (responseData.status === 'success' || responseData.result === 'success') {
        const syncedIds = pendingList.map((item) => item.id);
        await storageService.markAsSynced(syncedIds);
        return {
          success: true,
          count: pendingList.length,
        };
      } else {
        return {
          success: false,
          count: 0,
          error: responseData.message || 'Phản hồi từ Google Script không thành công',
        };
      }
    } catch (error: any) {
      // Offline hoặc lỗi mạng: Ghi log nhẹ và trả về kết quả an toàn
      console.warn('[Sync] Offline or network error during sync:', error?.message || error);
      return {
        success: false,
        count: 0,
        error: error?.message || 'Mất kết nối mạng hoặc URL không hợp lệ',
      };
    }
  },

  /**
   * Kiểm tra kết nối tới Google Apps Script URL
   */
  async testConnection(
    url: string,
    token?: string
  ): Promise<{ success: boolean; message: string }> {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      return { success: false, message: 'URL không được để trống' };
    }

    try {
      const payload = {
        action: 'test',
        token: token || '',
        timestamp: new Date().toISOString(),
      };

      const response = await fetch(trimmedUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

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
        resData = { status: responseText.includes('success') ? 'success' : 'unknown' };
      }

      if (resData.status === 'success' || resData.result === 'success') {
        return {
          success: true,
          message: resData.message || 'Kết nối Google Apps Script thành công!',
        };
      }

      return {
        success: false,
        message: resData.message || 'Script phản hồi lỗi',
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Không thể kết nối: ${err?.message || 'Lỗi mạng hoặc sai URL'}`,
      };
    }
  },
};
