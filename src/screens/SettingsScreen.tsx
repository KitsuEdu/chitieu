import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  Save,
  Code2,
  Send,
  HelpCircle,
  ArrowLeft,
  RefreshCw,
  CloudDownload,
  CheckCircle2,
  AlertTriangle,
  ClipboardPaste,
  Copy,
  Check,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { storageService } from '../services/storage';
import { syncService, SyncEvent } from '../services/sync';
import { colors } from '../theme/colors';
import { usePopup } from '../context/PopupContext';
import { formatDateTime } from '../utils/format';

interface SettingsScreenProps {
  onSettingsSaved?: () => void;
  onBack?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onSettingsSaved, onBack }) => {
  const { showPopup, showConfirm } = usePopup();

  // Form states
  const [googleScriptUrl, setGoogleScriptUrl] = useState<string>('');
  const [apiToken, setApiToken] = useState<string>('');

  // Status & Counts
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [hasPendingSync, setHasPendingSync] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [transactionCount, setTransactionCount] = useState<number>(0);
  const [walletCount, setWalletCount] = useState<number>(0);
  const [debtCount, setDebtCount] = useState<number>(0);

  const loadData = useCallback(async () => {
    try {
      const [settings, lastTime, pending, transactions, wallets, debts] = await Promise.all([
        storageService.getSettings(),
        storageService.getLastSyncTime(),
        storageService.getPendingSync(),
        storageService.getTransactions(false),
        storageService.getWallets(false),
        storageService.getDebts(false),
      ]);

      setGoogleScriptUrl(settings.googleScriptUrl || '');
      setApiToken(settings.apiToken || '');
      setLastSyncTime(lastTime);
      setHasPendingSync(pending);
      setTransactionCount(transactions.length);
      setWalletCount(wallets.length);
      setDebtCount(debts.length);
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu cài đặt:', error);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Lắng nghe các sự kiện đồng bộ từ syncService
    const unsubscribe = syncService.addListener((event: SyncEvent) => {
      if (
        event.type === 'SYNC_SUCCESS' ||
        event.type === 'RESTORE_SUCCESS' ||
        event.type === 'STATUS_CHANGE'
      ) {
        loadData();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [loadData]);

  // Nút Dán nhanh từ Clipboard
  const handlePasteUrl = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const text = await Clipboard.getStringAsync();
      if (text && text.trim().length > 0) {
        setGoogleScriptUrl(text.trim());
      } else {
        showPopup({
          type: 'INFO',
          title: 'Khay nhớ tạm trống',
          message: 'Không tìm thấy nội dung văn bản trong khay nhớ tạm để dán.',
        });
      }
    } catch (err) {
      console.warn('Lỗi khi đọc khay nhớ tạm:', err);
    }
  };

  // Lưu cài đặt
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await storageService.saveSettings({
        googleScriptUrl: googleScriptUrl.trim(),
        apiToken: apiToken.trim(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showPopup({
        type: 'SUCCESS',
        title: 'Thành công',
        message: 'Đã lưu cấu hình Google Apps Script an toàn vào bộ nhớ máy!',
        confirmText: 'Tuyệt vời',
      });
      onSettingsSaved?.();
    } catch {
      showPopup({
        type: 'ERROR',
        title: 'Lỗi',
        message: 'Không thể lưu cài đặt. Vui lòng thử lại.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Kiểm tra kết nối (PING)
  const handleTestConnection = async () => {
    if (!googleScriptUrl.trim()) {
      showPopup({
        type: 'WARNING',
        title: 'Thiếu thông tin',
        message: 'Vui lòng nhập Google Apps Script URL trước khi kiểm tra kết nối',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const result = await syncService.pingUrl(googleScriptUrl);
    setTestResult(result);
    setIsTesting(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // Đồng bộ 2 chiều ngay lập tức (SYNC)
  const handleSyncNow = async () => {
    if (!googleScriptUrl.trim()) {
      showPopup({
        type: 'WARNING',
        title: 'Chưa cấu hình URL',
        message: 'Vui lòng nhập và lưu Google Apps Script Web App URL trước khi đồng bộ.',
      });
      return;
    }

    setIsSyncing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const res = await syncService.syncNow(false);
      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showPopup({
          type: 'SUCCESS',
          title: 'Đồng bộ hoàn tất',
          message: 'Dữ liệu 2 chiều giữa thiết bị và Google Sheets đã được hợp nhất thành công!',
          confirmText: 'Tuyệt vời',
        });
        await loadData();
        onSettingsSaved?.();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showPopup({
          type: 'ERROR',
          title: 'Đồng bộ không thành công',
          message: res.error || 'Có lỗi xảy ra trong quá trình đồng bộ.',
        });
      }
    } catch (err: any) {
      showPopup({
        type: 'ERROR',
        title: 'Lỗi hệ thống',
        message: err?.message || 'Không thể thực hiện đồng bộ.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Khôi phục từ Google Sheets (RESTORE)
  const handleRestoreFromCloud = () => {
    if (!googleScriptUrl.trim()) {
      showPopup({
        type: 'WARNING',
        title: 'Chưa cấu hình URL',
        message: 'Vui lòng nhập và lưu Google Apps Script Web App URL trước khi khôi phục.',
      });
      return;
    }

    showConfirm({
      type: 'WARNING',
      title: 'Khôi phục từ Google Sheets?',
      message:
        'Cảnh báo: Toàn bộ dữ liệu chưa đồng bộ trên máy này sẽ được thay thế bằng dữ liệu đang có trên Google Sheets. Bạn có chắc chắn muốn tiếp tục?',
      confirmText: 'Khôi phục ngay',
      cancelText: 'Hủy',
      onConfirm: async () => {
        setIsRestoring(true);
        try {
          const res = await syncService.restoreFromCloud();
          if (res.success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showPopup({
              type: 'SUCCESS',
              title: 'Khôi phục thành công',
              message: `Đã khôi phục thành công ${res.walletsCount} ví, ${res.transactionsCount} giao dịch, ${res.debtsCount} khoản nợ từ Google Sheets!`,
              confirmText: 'Xong',
            });
            await loadData();
            onSettingsSaved?.();
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            showPopup({
              type: 'ERROR',
              title: 'Khôi phục thất bại',
              message: res.error || 'Có lỗi xảy ra khi khôi phục dữ liệu.',
            });
          }
        } catch (err: any) {
          showPopup({
            type: 'ERROR',
            title: 'Lỗi hệ thống',
            message: err?.message || 'Không thể khôi phục dữ liệu.',
          });
        } finally {
          setIsRestoring(false);
        }
      },
    });
  };

  // Sao chép toàn bộ mã nguồn Google Apps Script
  const handleCopyAppsScriptCode = async () => {
    try {
      await Clipboard.setStringAsync(sampleAppsScriptCode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
      showPopup({
        type: 'SUCCESS',
        title: 'Đã sao chép mã nguồn',
        message: 'Đã sao chép trọn vẹn mã nguồn Google Apps Script vào khay nhớ tạm!',
        confirmText: 'Đã hiểu',
      });
    } catch (err) {
      console.warn('Lỗi copy mã nguồn:', err);
    }
  };

  const sampleAppsScriptCode = `/**
 * ============================================================================
 * GOOGLE APPS SCRIPT: HỆ THỐNG ĐỒNG BỘ 2 CHIỀU (OFFLINE-FIRST TWO-WAY SYNC)
 * File: docs/google-apps-script.js
 * ============================================================================
 */
var SCHEMAS = {
  Wallets: ['id', 'name', 'type', 'icon', 'logoId', 'colorGradient', 'balance', 'creditLimit', 'currentBalance', 'statementDate', 'dueDate', 'feeWarningNote', 'createdAt', 'updatedAt', 'isDeleted'],
  Transactions: ['id', 'date', 'amount', 'type', 'category', 'wallet', 'toWallet', 'note', 'synced', 'createdAt', 'updatedAt', 'isDeleted'],
  Debts: ['id', 'type', 'personName', 'totalAmount', 'paidAmount', 'walletId', 'syncWithWallet', 'createdDate', 'dueDate', 'note', 'status', 'payments', 'createdAt', 'updatedAt', 'isDeleted']
};

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return createJsonResponse({ status: 'success', message: 'Script running', sheetName: ss ? ss.getName() : '', serverTime: new Date().toISOString() });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var hasLock = false;
  try {
    hasLock = lock.tryLock(30000);
    if (!hasLock) return createJsonResponse({ status: 'error', message: 'Server busy' });
    var data = {};
    if (e && e.postData && e.postData.contents) data = JSON.parse(e.postData.contents);
    var action = (data.action || '').toUpperCase();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureAllSheetsExist(ss);

    if (action === 'PING') {
      return createJsonResponse({ status: 'success', sheetName: ss.getName(), serverTime: new Date().toISOString() });
    }
    if (action === 'SYNC') {
      var w = syncSheetEntity(ss, 'Wallets', SCHEMAS.Wallets, data.wallets || []);
      var t = syncSheetEntity(ss, 'Transactions', SCHEMAS.Transactions, data.transactions || []);
      var d = syncSheetEntity(ss, 'Debts', SCHEMAS.Debts, data.debts || []);
      return createJsonResponse({ status: 'success', wallets: w, transactions: t, debts: d, serverTime: new Date().toISOString() });
    }
    if (action === 'RESTORE') {
      var w = readAllFromSheet(ss, 'Wallets', SCHEMAS.Wallets);
      var t = readAllFromSheet(ss, 'Transactions', SCHEMAS.Transactions);
      var d = readAllFromSheet(ss, 'Debts', SCHEMAS.Debts);
      return createJsonResponse({ status: 'success', wallets: w, transactions: t, debts: d, serverTime: new Date().toISOString() });
    }
    return createJsonResponse({ status: 'error', message: 'Action not supported: ' + action });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  } finally {
    if (hasLock) lock.releaseLock();
  }
}

function syncSheetEntity(ss, sheetName, headers, clientItems) {
  var sheet = ss.getSheetByName(sheetName);
  var existing = readAllFromSheet(ss, sheetName, headers);
  var itemMap = {};
  for (var i = 0; i < existing.length; i++) if (existing[i].id) itemMap[existing[i].id] = existing[i];
  for (var j = 0; j < clientItems.length; j++) {
    var c = clientItems[j];
    if (!c || !c.id) continue;
    var s = itemMap[c.id];
    if (!s) { itemMap[c.id] = c; }
    else {
      var cTime = parseTimestamp(c.updatedAt || c.createdAt);
      var sTime = parseTimestamp(s.updatedAt || s.createdAt);
      itemMap[c.id] = cTime >= sTime ? c : s;
    }
  }
  var list = [];
  for (var k in itemMap) if (itemMap.hasOwnProperty(k)) list.push(itemMap[k]);
  writeAllToSheet(sheet, headers, list);
  return list;
}

function readAllFromSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  var vals = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var res = [];
  for (var i = 0; i < vals.length; i++) {
    var row = vals[i], obj = {}, hasId = false;
    for (var h = 0; h < headers.length; h++) {
      var f = headers[h], v = row[h];
      if (f === 'id' && v) hasId = true;
      if (f === 'colorGradient' || f === 'payments') {
        try { obj[f] = JSON.parse(v); } catch(e) { obj[f] = f === 'colorGradient' ? ['#8B5CF6','#6366F1'] : []; }
      } else if (f === 'isDeleted' || f === 'synced' || f === 'syncWithWallet') {
        obj[f] = (v === true || v === 'true' || v === 'TRUE');
      } else if (typeof v === 'number' || !isNaN(Number(v))) {
        obj[f] = f.indexOf('Date') !== -1 && isNaN(Number(v)) ? String(v) : (v === '' ? '' : (isNaN(Number(v)) ? v : Number(v)));
      } else {
        obj[f] = v !== null && v !== undefined ? String(v) : '';
      }
    }
    if (hasId) res.push(obj);
  }
  return res;
}

function writeAllToSheet(sheet, headers, items) {
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  if (!items || items.length === 0) return;
  var rows = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i], r = [];
    for (var h = 0; h < headers.length; h++) {
      var f = headers[h], v = it[f];
      if (f === 'colorGradient' || f === 'payments') r.push(v ? JSON.stringify(v) : '');
      else if (f === 'isDeleted' || f === 'synced' || f === 'syncWithWallet') r.push(Boolean(v));
      else r.push(v !== undefined && v !== null ? v : '');
    }
    rows.push(r);
  }
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function ensureAllSheetsExist(ss) {
  var names = ['Wallets', 'Transactions', 'Debts'];
  for (var i = 0; i < names.length; i++) {
    var n = names[i], s = ss.getSheetByName(n);
    if (!s) s = ss.insertSheet(n);
    if (s.getLastRow() === 0) {
      s.appendRow(SCHEMAS[n]);
      s.getRange(1, 1, 1, SCHEMAS[n].length).setFontWeight('bold').setBackground('#E2E8F0').setHorizontalAlignment('center');
      s.setFrozenRows(1);
    }
  }
}

function parseTimestamp(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  var t = new Date(val).getTime();
  return isNaN(t) ? 0 : t;
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* 1. Header Cài đặt */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={18} color={colors.primaryLight} strokeWidth={2.4} />
            <Text style={styles.backButtonText}>Cài đặt</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Đồng bộ Google Sheets</Text>
        <Text style={styles.subtitle}>
          Sao lưu và đồng bộ 2 chiều (Offline-First) bảo vệ toàn vẹn dữ liệu
        </Text>
      </View>

      {/* 2. Thẻ Trạng thái Đồng bộ Chi tiết */}
      <View style={styles.syncCard}>
        <View style={styles.syncCardHeader}>
          <View>
            <Text style={styles.syncCardTitle}>Trạng thái đồng bộ</Text>
            <Text style={styles.syncCardSubtitle}>
              {googleScriptUrl.trim() ? 'Đã liên kết Web App' : 'Chưa cấu hình URL'}
            </Text>
          </View>
          <View
            style={[
              styles.statusPill,
              hasPendingSync ? styles.statusPillWarning : styles.statusPillSuccess,
            ]}
          >
            {hasPendingSync ? (
              <>
                <AlertTriangle size={13} color={colors.warning} />
                <Text style={styles.statusPillTextWarning}>Chờ đồng bộ</Text>
              </>
            ) : (
              <>
                <CheckCircle2 size={13} color={colors.income} />
                <Text style={styles.statusPillTextSuccess}>Đã cập nhật</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.syncTimeBox}>
          <Text style={styles.syncTimeLabel}>Đồng bộ lần cuối:</Text>
          <Text style={styles.syncTimeValue}>
            {lastSyncTime ? formatDateTime(lastSyncTime) : 'Chưa từng đồng bộ'}
          </Text>
        </View>

        {/* Thống kê dữ liệu */}
        <View style={styles.miniStatsRow}>
          <View style={styles.miniStatItem}>
            <Text style={styles.miniStatNum}>{walletCount}</Text>
            <Text style={styles.miniStatLabel}>Ví tiền</Text>
          </View>
          <View style={styles.miniStatDivider} />
          <View style={styles.miniStatItem}>
            <Text style={styles.miniStatNum}>{transactionCount}</Text>
            <Text style={styles.miniStatLabel}>Giao dịch</Text>
          </View>
          <View style={styles.miniStatDivider} />
          <View style={styles.miniStatItem}>
            <Text style={styles.miniStatNum}>{debtCount}</Text>
            <Text style={styles.miniStatLabel}>Khoản nợ</Text>
          </View>
        </View>

        {/* 2 Nút hành động chính: SYNC & RESTORE */}
        <View style={styles.syncButtonsRow}>
          <TouchableOpacity
            style={[styles.syncActionButton, styles.syncNowButton, isSyncing && { opacity: 0.7 }]}
            onPress={handleSyncNow}
            disabled={isSyncing || isRestoring}
            activeOpacity={0.8}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <RefreshCw size={16} color="#FFFFFF" strokeWidth={2.4} />
            )}
            <Text style={styles.syncNowButtonText}>
              {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.syncActionButton,
              styles.restoreButton,
              isRestoring && { opacity: 0.7 },
            ]}
            onPress={handleRestoreFromCloud}
            disabled={isSyncing || isRestoring}
            activeOpacity={0.8}
          >
            {isRestoring ? (
              <ActivityIndicator size="small" color={colors.warning} />
            ) : (
              <CloudDownload size={16} color={colors.warning} strokeWidth={2.4} />
            )}
            <Text style={styles.restoreButtonText}>
              {isRestoring ? 'Đang tải...' : 'Khôi phục từ Sheet'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. Cấu hình Form Web App URL */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cấu hình Google Apps Script</Text>

        <Text style={styles.inputLabel}>Web App URL *</Text>
        <View style={styles.inputContainerWithPaste}>
          <TextInput
            style={styles.inputWithPaste}
            placeholder="https://script.google.com/macros/s/.../exec"
            placeholderTextColor={colors.textMuted}
            value={googleScriptUrl}
            onChangeText={setGoogleScriptUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.pasteButton}
            onPress={handlePasteUrl}
            activeOpacity={0.7}
          >
            <ClipboardPaste size={16} color={colors.primaryLight} />
            <Text style={styles.pasteButtonText}>Dán</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.inputLabel}>Mã bảo mật API Token (Tùy chọn)</Text>
        <TextInput
          style={styles.input}
          placeholder="Nhập secret token nếu bạn có cài đặt bảo mật"
          placeholderTextColor={colors.textMuted}
          value={apiToken}
          onChangeText={setApiToken}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* Kết quả Test PING */}
        {testResult && (
          <View
            style={[
              styles.testResultBox,
              testResult.success ? styles.testSuccess : styles.testFailed,
            ]}
          >
            <Text
              style={[
                styles.testResultText,
                testResult.success ? { color: colors.income } : { color: colors.expense },
              ]}
            >
              {testResult.success ? '✓ ' : '✕ '}
              {testResult.message}
            </Text>
          </View>
        )}

        {/* Nút Kiểm tra kết nối & Lưu */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.testButton, isTesting && { opacity: 0.7 }]}
            onPress={handleTestConnection}
            disabled={isTesting}
            activeOpacity={0.7}
          >
            {isTesting ? (
              <ActivityIndicator size="small" color={colors.primaryBright} />
            ) : (
              <Send size={15} color={colors.primaryBright} style={{ marginRight: 6 }} />
            )}
            <Text style={styles.testButtonText}>
              {isTesting ? 'Đang test...' : 'Kiểm tra kết nối'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, isSaving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Save size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
            )}
            <Text style={styles.saveButtonText}>Lưu cài đặt</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 4. Hướng dẫn Triển khai 4 bước chuẩn */}
      <View style={styles.card}>
        <View style={styles.guideHeader}>
          <HelpCircle size={18} color={colors.primaryBright} />
          <Text style={styles.cardTitle}>Hướng dẫn Triển khai Apps Script (4 bước)</Text>
        </View>

        <View style={styles.stepsList}>
          <Text style={styles.stepItem}>
            <Text style={styles.stepBold}>Bước 1:</Text> Mở{' '}
            <Text style={styles.linkText}>Google Sheets (sheets.google.com)</Text> và tạo một Bảng
            tính mới.
          </Text>
          <Text style={styles.stepItem}>
            <Text style={styles.stepBold}>Bước 2:</Text> Trên thanh menu Bảng tính, chọn{' '}
            <Text style={styles.stepBold}>Tiện ích mở rộng (Extensions)</Text> →{' '}
            <Text style={styles.stepBold}>Apps Script</Text>.
          </Text>
          <Text style={styles.stepItem}>
            <Text style={styles.stepBold}>Bước 3:</Text> Dán toàn bộ mã nguồn bên dưới vào file{' '}
            <Text style={styles.stepBold}>Code.gs</Text> rồi nhấn biểu tượng Save (Lưu).
          </Text>
          <Text style={styles.stepItem}>
            <Text style={styles.stepBold}>Bước 4:</Text> Nhấn nút{' '}
            <Text style={styles.stepBold}>Triển khai (Deploy)</Text> →{' '}
            <Text style={styles.stepBold}>Triển khai mới (New deployment)</Text>:
            {'\n'}• Chọn loại:{' '}
            <Text style={styles.stepBold}>Ứng dụng web (Web app)</Text>
            {'\n'}• Thực thi dưới dạng (Execute as):{' '}
            <Text style={styles.stepBold}>Tôi (Me)</Text>
            {'\n'}• Ai có quyền truy cập (Who has access):{' '}
            <Text style={styles.stepBoldHighlight}>Bất kỳ ai (Anyone)</Text>
            {'\n'}→ Nhấn <Text style={styles.stepBold}>Triển khai</Text>, cấp quyền và sao chép{' '}
            <Text style={styles.stepBold}>Web app URL</Text> (kết thúc bằng{' '}
            <Text style={styles.codeText}>/exec</Text>) dán vào ô bên trên.
          </Text>
        </View>

        {/* Nút Sao chép mã nguồn */}
        <TouchableOpacity
          style={styles.copyCodeButton}
          onPress={handleCopyAppsScriptCode}
          activeOpacity={0.7}
        >
          {copiedCode ? (
            <Check size={16} color={colors.income} />
          ) : (
            <Copy size={16} color={colors.primaryLight} />
          )}
          <Text
            style={[
              styles.copyCodeButtonText,
              copiedCode && { color: colors.income },
            ]}
          >
            {copiedCode ? 'Đã sao chép mã nguồn!' : 'Sao chép toàn bộ mã nguồn Apps Script'}
          </Text>
        </TouchableOpacity>

        <View style={styles.codeBlockHeader}>
          <Code2 size={15} color={colors.textSecondary} />
          <Text style={styles.codeBlockTitle}>Mã nguồn Google Apps Script (Code.gs)</Text>
        </View>
        <View style={styles.codeContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text style={styles.codeSnippet}>{sampleAppsScriptCode}</Text>
          </ScrollView>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 96,
    gap: 16,
  },
  header: {
    paddingVertical: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryLight,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  syncCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  syncCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  syncCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  syncCardSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusPillSuccess: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  statusPillWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  statusPillTextSuccess: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.income,
  },
  statusPillTextWarning: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning,
  },
  syncTimeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  syncTimeLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  syncTimeValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  miniStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 6,
  },
  miniStatItem: {
    alignItems: 'center',
  },
  miniStatNum: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  miniStatLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  miniStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  syncButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  syncActionButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  syncNowButton: {
    backgroundColor: colors.primary,
    elevation: 3,
  },
  syncNowButtonText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  restoreButton: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  restoreButtonText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.warning,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  inputContainerWithPaste: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingRight: 6,
  },
  inputWithPaste: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.textPrimary,
  },
  pasteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  pasteButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryLight,
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.textPrimary,
  },
  testResultBox: {
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
  },
  testSuccess: {
    backgroundColor: colors.incomeSoft,
    borderColor: colors.income,
  },
  testFailed: {
    backgroundColor: colors.expenseSoft,
    borderColor: colors.expense,
  },
  testResultText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  testButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    borderRadius: 14,
    height: 46,
  },
  testButtonText: {
    color: colors.primaryLight,
    fontSize: 14,
    fontWeight: '700',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 46,
    elevation: 3,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepsList: {
    gap: 10,
    marginVertical: 10,
  },
  stepItem: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 20,
  },
  stepBold: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  stepBoldHighlight: {
    fontWeight: '800',
    color: colors.warning,
  },
  linkText: {
    color: colors.primaryLight,
    textDecorationLine: 'underline',
  },
  codeText: {
    color: colors.warning,
    fontFamily: 'monospace',
  },
  copyCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 12,
    paddingVertical: 11,
    marginTop: 6,
    marginBottom: 12,
  },
  copyCodeButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryLight,
  },
  codeBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    marginBottom: 6,
  },
  codeBlockTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  codeContainer: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeSnippet: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#E2E8F0',
    lineHeight: 17,
  },
});
