import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  Save,
  Code2,
  Send,
  HelpCircle,
  ArrowLeft,
} from 'lucide-react-native';
import { storageService } from '../services/storage';
import { syncService } from '../services/sync';
import { colors } from '../theme/colors';
import { usePopup } from '../context/PopupContext';

interface SettingsScreenProps {
  onSettingsSaved?: () => void;
  onBack?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onSettingsSaved, onBack }) => {
  const { showPopup } = usePopup();
  const [googleScriptUrl, setGoogleScriptUrl] = useState<string>('');
  const [apiToken, setApiToken] = useState<string>('');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [totalCount, setTotalCount] = useState<number>(0);
  const [syncedCount, setSyncedCount] = useState<number>(0);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [settings, transactions] = await Promise.all([
        storageService.getSettings(),
        storageService.getTransactions(),
      ]);
      setGoogleScriptUrl(settings.googleScriptUrl || '');
      setApiToken(settings.apiToken || '');
      setTotalCount(transactions.length);
      setSyncedCount(transactions.filter((t) => t.synced).length);
    } catch (error) {
      console.error('Lỗi khi tải cấu hình:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await storageService.saveSettings({
        googleScriptUrl: googleScriptUrl.trim(),
        apiToken: apiToken.trim(),
      });
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

    const result = await syncService.testConnection(googleScriptUrl, apiToken);
    setTestResult(result);
    setIsTesting(false);
  };

  const sampleAppsScriptCode = `function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Tự động tạo tiêu đề cột nếu sheet còn trống
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["ID", "Thời gian", "Loại", "Danh mục", "Số tiền (VND)", "Ví", "Ghi chú", "Ngày tạo"]);
      sheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#E2E8F0");
    }
    
    // Lệnh test kết nối từ ứng dụng
    if (data.action === "test") {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        message: "Kết nối Google Apps Script thành công!" 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Đồng bộ danh sách giao dịch
    var items = data.transactions || [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      sheet.appendRow([
        item.id,
        item.date,
        item.type === "EXPENSE" ? "Chi tiêu" : "Thu nhập",
        item.category,
        item.amount,
        item.wallet,
        item.note || "",
        new Date(item.createdAt).toLocaleString("vi-VN")
      ]);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      count: items.length 
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      message: err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
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
        <Text style={styles.title}>Cài đặt đồng bộ</Text>
        <Text style={styles.subtitle}>
          Kết nối ứng dụng với Google Sheets thông qua Google Apps Script Web App
        </Text>
      </View>

      {/* Thống kê dữ liệu offline */}
      <View style={styles.statsCard}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{totalCount}</Text>
          <Text style={styles.statLabel}>Tổng giao dịch</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: colors.income }]}>{syncedCount}</Text>
          <Text style={styles.statLabel}>Đã lên Sheet</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: colors.warning }]}>
            {totalCount - syncedCount}
          </Text>
          <Text style={styles.statLabel}>Chờ đồng bộ</Text>
        </View>
      </View>

      {/* 2. Cấu hình Form */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cấu hình Web App URL</Text>

        <Text style={styles.inputLabel}>Google Apps Script Web App URL *</Text>
        <TextInput
          style={styles.input}
          placeholder="https://script.google.com/macros/s/.../exec"
          placeholderTextColor={colors.textMuted}
          value={googleScriptUrl}
          onChangeText={setGoogleScriptUrl}
          autoCapitalize="none"
          autoCorrect={false}
          multiline={false}
        />

        <Text style={styles.inputLabel}>Khóa bí mật API Token (Tùy chọn)</Text>
        <TextInput
          style={styles.input}
          placeholder="Nhập secret token nếu bạn có cài đặt bảo mật"
          placeholderTextColor={colors.textMuted}
          value={apiToken}
          onChangeText={setApiToken}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* Kết quả Test */}
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

        {/* Nút hành động */}
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

      {/* 3. Hướng dẫn từng bước */}
      <View style={styles.card}>
        <View style={styles.guideHeader}>
          <HelpCircle size={18} color={colors.primaryBright} />
          <Text style={styles.cardTitle}>Hướng dẫn tạo Google Apps Script</Text>
        </View>

        <View style={styles.stepsList}>
          <Text style={styles.stepItem}>
            <Text style={styles.stepBold}>Bước 1:</Text> Truy cập{' '}
            <Text style={styles.linkText}>sheets.google.com</Text> và tạo một Bảng tính mới (Google Sheets).
          </Text>
          <Text style={styles.stepItem}>
            <Text style={styles.stepBold}>Bước 2:</Text> Trên thanh menu, chọn{' '}
            <Text style={styles.stepBold}>Tiện ích mở rộng (Extensions)</Text> →{' '}
            <Text style={styles.stepBold}>Apps Script</Text>.
          </Text>
          <Text style={styles.stepItem}>
            <Text style={styles.stepBold}>Bước 3:</Text> Dán toàn bộ mã nguồn bên dưới vào file{' '}
            <Text style={styles.stepBold}>Code.gs</Text> rồi nhấn biểu tượng Save.
          </Text>
          <Text style={styles.stepItem}>
            <Text style={styles.stepBold}>Bước 4:</Text> Nhấn nút{' '}
            <Text style={styles.stepBold}>Triển khai (Deploy)</Text> →{' '}
            <Text style={styles.stepBold}>Triển khai mới (New deployment)</Text>:
            {'\n'}• Loại: <Text style={styles.stepBold}>Ứng dụng web (Web app)</Text>
            {'\n'}• Thực thi dưới dạng (Execute as): <Text style={styles.stepBold}>Tôi (Me)</Text>
            {'\n'}• Ai có quyền truy cập (Who has access):{' '}
            <Text style={styles.stepBold}>Bất kỳ ai (Anyone)</Text>
          </Text>
          <Text style={styles.stepItem}>
            <Text style={styles.stepBold}>Bước 5:</Text> Nhấn <Text style={styles.stepBold}>Triển khai</Text>, cấp quyền và sao chép{' '}
            <Text style={styles.stepBold}>Web app URL</Text> (kết thúc bằng <Text style={styles.codeText}>/exec</Text>) dán vào ô trên.
          </Text>
        </View>

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
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
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
    gap: 8,
    marginVertical: 8,
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
  linkText: {
    color: colors.primaryLight,
    textDecorationLine: 'underline',
  },
  codeText: {
    color: colors.warning,
    fontFamily: 'monospace',
  },
  codeBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
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
