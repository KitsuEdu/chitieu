import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import {
  CloudCheck,
  CloudUpload,
  CloudOff,
  Banknote,
  Landmark,
  PiggyBank,
  Check,
  RotateCcw,
} from 'lucide-react-native';
import { CATEGORIES, WALLETS, TransactionType } from '../types';
import { storageService } from '../services/storage';
import { syncService } from '../services/sync';
import { formatVND } from '../utils/format';
import { CategoryIcon, getCategoryConfig } from '../components/CategoryIcon';
import { Numpad } from '../components/Numpad';

interface QuickEntryScreenProps {
  onTransactionAdded?: () => void;
  onNavigateToSettings?: () => void;
}

export const QuickEntryScreen: React.FC<QuickEntryScreenProps> = ({
  onTransactionAdded,
  onNavigateToSettings,
}) => {
  // Trạng thái nhập liệu
  const [amountStr, setAmountStr] = useState<string>('0');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [wallet, setWallet] = useState<string>(WALLETS[0]);
  const [note, setNote] = useState<string>('');

  // Trạng thái thống kê & sync
  const [todayExpense, setTodayExpense] = useState<number>(0);
  const [monthExpense, setMonthExpense] = useState<number>(0);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [hasConfiguredUrl, setHasConfiguredUrl] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Tính toán số liệu tổng hợp trong ngày và trong tháng
  const refreshStats = useCallback(async () => {
    try {
      const [transactions, settings] = await Promise.all([
        storageService.getTransactions(),
        storageService.getSettings(),
      ]);

      setHasConfiguredUrl(!!settings.googleScriptUrl?.trim());

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const currentDay = now.getDate();

      let dayTotal = 0;
      let monthTotal = 0;
      let pendingCount = 0;

      for (const t of transactions) {
        if (!t.synced) {
          pendingCount++;
        }

        if (t.type === 'EXPENSE') {
          const tDate = new Date(t.date);
          if (
            tDate.getFullYear() === currentYear &&
            tDate.getMonth() === currentMonth
          ) {
            monthTotal += t.amount;
            if (tDate.getDate() === currentDay) {
              dayTotal += t.amount;
            }
          }
        }
      }

      setTodayExpense(dayTotal);
      setMonthExpense(monthTotal);
      setPendingSyncCount(pendingCount);
    } catch (error) {
      console.error('Lỗi khi tải thống kê:', error);
    }
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  // Xử lý phím Numpad
  const handleDigit = (digit: string) => {
    setAmountStr((prev) => {
      if (prev === '0') {
        return digit === '000' ? '0' : digit;
      }
      if (prev.length >= 12) return prev; // Giới hạn độ dài số tiền
      return prev + digit;
    });
  };

  const handleBackspace = () => {
    setAmountStr((prev) => {
      if (prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
  };

  const handleClear = () => {
    setAmountStr('0');
  };

  // Lưu giao dịch
  const handleSaveTransaction = async () => {
    const amountNum = parseInt(amountStr, 10);
    if (!amountNum || amountNum <= 0) {
      Alert.alert('Số tiền chưa hợp lệ', 'Vui lòng nhập số tiền lớn hơn 0 đ');
      return;
    }

    try {
      const now = new Date();
      await storageService.addTransaction({
        date: now.toISOString(),
        amount: amountNum,
        type,
        category,
        wallet,
        note: note.trim() || undefined,
      });

      // Reset form
      setAmountStr('0');
      setNote('');

      // Thông báo phản hồi UI ngay lập tức
      setSaveSuccessMessage(`Đã ghi: ${formatVND(amountNum)} (${category})`);
      setTimeout(() => setSaveSuccessMessage(null), 3000);

      // Cập nhật lại số liệu
      await refreshStats();
      onTransactionAdded?.();

      // Kích hoạt đồng bộ ngầm lên Google Sheet nếu có mạng và cấu hình
      syncService.syncPendingTransactions().then((res) => {
        if (res.success && res.count > 0) {
          refreshStats();
        }
      });
    } catch (error) {
      Alert.alert('Lỗi lưu giao dịch', 'Không thể lưu vào bộ nhớ máy.');
    }
  };

  const currentAmount = parseInt(amountStr, 10) || 0;
  const isExpense = type === 'EXPENSE';
  const themeAccentColor = isExpense ? '#F43F5E' : '#10B981';

  const getWalletIcon = (w: string) => {
    switch (w) {
      case 'Tiền mặt':
        return Banknote;
      case 'Ngân hàng':
        return Landmark;
      case 'Tiết kiệm':
      default:
        return PiggyBank;
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Header: Thống kê chi tiêu & Trạng thái Sync */}
      <View style={styles.header}>
        <View style={styles.headerStatsContainer}>
          <Text style={styles.headerSubTitle}>Hôm nay / Tháng này</Text>
          <View style={styles.statsRow}>
            <Text style={styles.statDayText}>{formatVND(todayExpense)}</Text>
            <Text style={styles.statSeparator}>•</Text>
            <Text style={styles.statMonthText}>{formatVND(monthExpense)}</Text>
          </View>
        </View>

        {/* Sync Status Badge */}
        <TouchableOpacity
          style={[
            styles.syncBadge,
            !hasConfiguredUrl
              ? styles.syncBadgeDisabled
              : pendingSyncCount > 0
              ? styles.syncBadgePending
              : styles.syncBadgeSynced,
          ]}
          onPress={onNavigateToSettings}
          activeOpacity={0.7}
        >
          {!hasConfiguredUrl ? (
            <>
              <CloudOff size={15} color="#94A3B8" />
              <Text style={styles.syncTextDisabled}>Chưa cấu hình</Text>
            </>
          ) : pendingSyncCount > 0 ? (
            <>
              <CloudUpload size={15} color="#F59E0B" />
              <Text style={styles.syncTextPending}>{pendingSyncCount} chờ sync</Text>
            </>
          ) : (
            <>
              <CloudCheck size={15} color="#10B981" />
              <Text style={styles.syncTextSynced}>Đã đồng bộ</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Thông báo lưu thành công */}
      {saveSuccessMessage && (
        <View style={styles.toastBanner}>
          <Check size={16} color="#10B981" />
          <Text style={styles.toastText}>{saveSuccessMessage}</Text>
        </View>
      )}

      {/* 2. Display: Số tiền to & Bộ chọn Thu/Chi */}
      <View style={styles.displayCard}>
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[
              styles.typeTab,
              isExpense && { backgroundColor: 'rgba(244, 63, 94, 0.2)', borderColor: '#F43F5E' },
            ]}
            onPress={() => setType('EXPENSE')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.typeTabText,
                isExpense ? { color: '#F43F5E', fontWeight: '700' } : { color: '#94A3B8' },
              ]}
            >
              Chi tiêu
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeTab,
              !isExpense && { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10B981' },
            ]}
            onPress={() => setType('INCOME')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.typeTabText,
                !isExpense ? { color: '#10B981', fontWeight: '700' } : { color: '#94A3B8' },
              ]}
            >
              Thu nhập
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.amountRow}>
          <Text
            style={[
              styles.amountText,
              { color: isExpense ? '#F43F5E' : '#10B981' },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatVND(currentAmount)}
          </Text>

          {currentAmount > 0 && (
            <TouchableOpacity
              style={styles.clearMiniBtn}
              onPress={handleClear}
              activeOpacity={0.7}
            >
              <RotateCcw size={16} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 3. Horizontal Chips: Danh mục & Ví */}
      <View style={styles.chipsSection}>
        {/* Danh mục */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = category === cat;
            const config = getCategoryConfig(cat);
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryChip,
                  isSelected && {
                    backgroundColor: config.bg,
                    borderColor: config.color,
                  },
                ]}
                onPress={() => setCategory(cat)}
                activeOpacity={0.7}
              >
                <CategoryIcon
                  category={cat}
                  size={14}
                  containerSize={24}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.chipText,
                    isSelected && { color: config.color, fontWeight: '700' },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Ví / Nguồn tiền */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.chipsScroll, { marginTop: 6 }]}
        >
          {WALLETS.map((w) => {
            const isSelected = wallet === w;
            const WalletIconComponent = getWalletIcon(w);
            return (
              <TouchableOpacity
                key={w}
                style={[
                  styles.walletChip,
                  isSelected && styles.walletChipSelected,
                ]}
                onPress={() => setWallet(w)}
                activeOpacity={0.7}
              >
                <WalletIconComponent
                  size={15}
                  color={isSelected ? '#38BDF8' : '#64748B'}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.chipText,
                    isSelected && { color: '#38BDF8', fontWeight: '700' },
                  ]}
                >
                  {w}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Ghi chú ngắn gọn */}
      <View style={styles.noteContainer}>
        <TextInput
          style={styles.noteInput}
          placeholder="Thêm ghi chú (Cơm trưa, đổ xăng, cafe...)"
          placeholderTextColor="#64748B"
          value={note}
          onChangeText={setNote}
          maxLength={60}
          returnKeyType="done"
        />
      </View>

      {/* 4. Virtual Numpad */}
      <View style={styles.numpadWrapper}>
        <Numpad
          onPressDigit={handleDigit}
          onPressBackspace={handleBackspace}
          onPressClear={handleClear}
        />
      </View>

      {/* 5. Nút Lưu giao dịch To Bản tối ưu ngón cái */}
      <View style={styles.saveActionWrapper}>
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: themeAccentColor },
            currentAmount === 0 && styles.saveButtonDisabled,
          ]}
          onPress={handleSaveTransaction}
          disabled={currentAmount === 0}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>
            LƯU {isExpense ? 'CHI TIÊU' : 'THU NHẬP'} {currentAmount > 0 ? `• ${formatVND(currentAmount)}` : ''}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingTop: 8,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  headerStatsContainer: {
    flex: 1,
  },
  headerSubTitle: {
    fontSize: 11,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statDayText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F43F5E',
  },
  statSeparator: {
    marginHorizontal: 8,
    color: '#475569',
    fontSize: 14,
  },
  statMonthText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  syncBadgeSynced: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  syncBadgePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  syncBadgeDisabled: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  syncTextSynced: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  syncTextPending: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
  },
  syncTextDisabled: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  toastText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '500',
  },
  displayCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  typeTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 4,
    position: 'relative',
  },
  amountText: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  clearMiniBtn: {
    position: 'absolute',
    right: 4,
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#334155',
  },
  chipsSection: {
    paddingVertical: 4,
  },
  chipsScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  walletChipSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: '#38BDF8',
  },
  chipText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  noteContainer: {
    marginVertical: 4,
  },
  noteInput: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 13,
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#334155',
  },
  numpadWrapper: {
    marginVertical: 4,
  },
  saveActionWrapper: {
    paddingBottom: 8,
  },
  saveButton: {
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
