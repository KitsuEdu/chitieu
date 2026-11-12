import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  CloudCheck,
  CloudUpload,
  RefreshCw,
  Trash,
  Banknote,
  ReceiptText,
  Calendar as CalendarIcon,
  ChevronDown,
  X,
} from 'lucide-react-native';
import { Transaction } from '../types';
import { storageService } from '../services/storage';
import { syncService } from '../services/sync';
import { formatVND, formatDateTime } from '../utils/format';
import { CategoryIcon } from '../components/CategoryIcon';
import { colors } from '../theme/colors';
import { SegmentedTabs, SegmentedTabItem } from '../components/SegmentedTabs';
import { CustomDatePicker, MonthYearValue } from '../components/CustomDatePicker';
import { usePopup } from '../context/PopupContext';

interface HistoryScreenProps {
  onRefreshTriggered?: () => void;
}

type HistoryFilterMode = 'ALL' | 'EXPENSE' | 'INCOME';

const HISTORY_FILTER_TABS: readonly SegmentedTabItem<HistoryFilterMode>[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'EXPENSE', label: 'Chi tiêu' },
  { key: 'INCOME', label: 'Thu nhập' },
];

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ onRefreshTriggered }) => {
  const { showPopup, showConfirm } = usePopup();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filterType, setFilterType] = useState<HistoryFilterMode>('ALL');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusText, setSyncStatusText] = useState<string | null>(null);

  // Time filter states
  const now = useMemo(() => new Date(), []);
  const [filterMonth, setFilterMonth] = useState<MonthYearValue>({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [filterDate, setFilterDate] = useState<Date | null>(null);

  const [isMonthPickerVisible, setIsMonthPickerVisible] = useState<boolean>(false);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState<boolean>(false);

  const markedDates = useMemo(() => {
    return Array.from(new Set(transactions.map((t) => t.date.split('T')[0])));
  }, [transactions]);

  const loadData = useCallback(async () => {
    try {
      const data = await storageService.getTransactions();
      setTransactions(data);
    } catch (error) {
      console.error('Lỗi khi tải lịch sử:', error);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onPullRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    const result = await syncService.syncPendingTransactions();
    if (result.success && result.count > 0) {
      await loadData();
      setSyncStatusText(`Đã đồng bộ ${result.count} giao dịch mới`);
      setTimeout(() => setSyncStatusText(null), 3500);
    }
    setIsRefreshing(false);
    onRefreshTriggered?.();
  };

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatusText('Đang kết nối Google Sheets...');

    const result = await syncService.syncPendingTransactions();
    await loadData();
    setIsSyncing(false);
    onRefreshTriggered?.();

    if (result.success) {
      if (result.count > 0) {
        setSyncStatusText(`Thành công! Đã đồng bộ ${result.count} mục.`);
      } else {
        setSyncStatusText('Dữ liệu đã được đồng bộ toàn bộ.');
      }
    } else {
      setSyncStatusText(`Chưa đồng bộ: ${result.error || 'Kiểm tra lại mạng/URL'}`);
    }

    setTimeout(() => setSyncStatusText(null), 4000);
  };

  const handleDeleteTransaction = (item: Transaction) => {
    showConfirm({
      type: 'DANGER',
      title: 'Xóa giao dịch',
      message: `Bạn có chắc chắn muốn xóa "${item.category} - ${formatVND(item.amount)}"? Hành động này không thể hoàn tác.`,
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      onConfirm: async () => {
        try {
          await storageService.deleteTransaction(item.id);
          await loadData();
          onRefreshTriggered?.();
        } catch {
          showPopup({
            type: 'ERROR',
            title: 'Lỗi',
            message: 'Không thể xóa giao dịch. Vui lòng thử lại.',
          });
        }
      },
    });
  };

  const filteredList = transactions.filter((t) => {
    if (filterType === 'EXPENSE' && t.type !== 'EXPENSE') return false;
    if (filterType === 'INCOME' && t.type !== 'INCOME') return false;

    const tDate = new Date(t.date);
    if (filterDate) {
      return (
        tDate.getFullYear() === filterDate.getFullYear() &&
        tDate.getMonth() === filterDate.getMonth() &&
        tDate.getDate() === filterDate.getDate()
      );
    }

    if (filterMonth) {
      return (
        tDate.getFullYear() === filterMonth.year &&
        tDate.getMonth() === filterMonth.month
      );
    }

    return true;
  });

  const pendingCount = transactions.filter((t) => !t.synced).length;

  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    const isExpense = item.type === 'EXPENSE';
    const amountPrefix = isExpense ? '-' : '+';
    const amountColor = isExpense ? colors.expense : colors.income;

    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <CategoryIcon category={item.category} size={18} containerSize={42} />
          <View style={styles.cardInfo}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.categoryTitle}>{item.category}</Text>
              <View style={styles.walletBadge}>
                <Banknote size={11} color={colors.textSecondary} style={{ marginRight: 3 }} />
                <Text style={styles.walletText}>{item.wallet}</Text>
              </View>
            </View>

            <Text style={styles.dateText}>{formatDateTime(item.date)}</Text>

            {item.note ? (
              <Text style={styles.noteText} numberOfLines={1}>
                {item.note}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.cardRight}>
          <Text style={[styles.amountText, { color: amountColor }]}>
            {amountPrefix}
            {formatVND(item.amount)}
          </Text>

          <View style={styles.cardActionRow}>
            {item.synced ? (
              <View style={styles.syncStatusBadgeSynced}>
                <CloudCheck size={12} color={colors.income} />
                <Text style={styles.syncStatusTextSynced}>Synced</Text>
              </View>
            ) : (
              <View style={styles.syncStatusBadgePending}>
                <CloudUpload size={12} color={colors.warning} />
                <Text style={styles.syncStatusTextPending}>Chờ sync</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteTransaction(item)}
              activeOpacity={0.6}
            >
              <Trash size={14} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Actions & Sync Now Button */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.pageTitle}>Lịch sử thu chi</Text>
          <Text style={styles.pageSubTitle}>
            {transactions.length} giao dịch ({pendingCount} chưa đồng bộ)
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.syncButton, isSyncing && styles.syncButtonActive]}
          onPress={handleManualSync}
          disabled={isSyncing}
          activeOpacity={0.7}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
          ) : (
            <RefreshCw size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
          )}
          <Text style={styles.syncButtonText}>
            {isSyncing ? 'Đang sync...' : 'Đồng bộ ngay'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Thông báo kết quả sync */}
      {syncStatusText && (
        <View style={styles.syncNotification}>
          <Text style={styles.syncNotificationText}>{syncStatusText}</Text>
        </View>
      )}

      {/* Time Filter Bar (Tháng/Năm & Ngày cụ thể) */}
      <View style={styles.timeFilterBar}>
        <TouchableOpacity
          style={styles.timeFilterMonthBtn}
          onPress={() => setIsMonthPickerVisible(true)}
          activeOpacity={0.7}
        >
          <CalendarIcon size={14} color="#A855F7" style={{ marginRight: 6 }} />
          <Text style={styles.timeFilterMonthText}>
            Tháng {filterMonth.month + 1}/{filterMonth.year}
          </Text>
          <ChevronDown size={14} color="#94A3B8" style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        <View style={styles.timeFilterRightRow}>
          {filterDate ? (
            <View style={styles.activeDateChip}>
              <Text style={styles.activeDateText}>
                Ngày {filterDate.getDate()}/{filterDate.getMonth() + 1}
              </Text>
              <TouchableOpacity
                onPress={() => setFilterDate(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <X size={12} color="#CBD5E1" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.datePickerIconBtn}
              onPress={() => setIsDatePickerVisible(true)}
              activeOpacity={0.7}
            >
              <CalendarIcon size={13} color="#CBD5E1" style={{ marginRight: 5 }} />
              <Text style={styles.datePickerBtnText}>Chọn ngày</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Segmented Filter: Squeeze-Through Bottleneck */}
      <SegmentedTabs
        tabs={HISTORY_FILTER_TABS}
        activeKey={filterType}
        onChange={setFilterType}
        containerStyle={{ marginVertical: 6 }}
      />

      {/* Transaction List */}
      <FlatList
        data={filteredList}
        keyExtractor={(item) => item.id}
        renderItem={renderTransactionItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onPullRefresh}
            tintColor={colors.primaryBright}
            colors={[colors.primaryBright]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <ReceiptText size={44} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Chưa có giao dịch nào</Text>
            <Text style={styles.emptySubText}>
              Hãy chạm nút (+) ở giữa màn hình để bắt đầu ghi lại các khoản thu chi.
            </Text>
          </View>
        }
      />
      {/* Modal Lọc Tháng */}
      <CustomDatePicker
        visible={isMonthPickerVisible}
        onClose={() => setIsMonthPickerVisible(false)}
        mode="MONTH"
        value={filterMonth}
        onConfirm={(res: MonthYearValue) => {
          setFilterMonth(res);
          setFilterDate(null);
        }}
      />

      {/* Modal Lọc Ngày cụ thể */}
      <CustomDatePicker
        visible={isDatePickerVisible}
        onClose={() => setIsDatePickerVisible(false)}
        mode="DATE"
        value={filterDate || new Date(filterMonth.year, filterMonth.month, 1)}
        markedDates={markedDates}
        onConfirm={(d: Date) => {
          setFilterDate(d);
          setFilterMonth({ year: d.getFullYear(), month: d.getMonth() });
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  timeFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#12141F',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 6,
  },
  timeFilterMonthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  timeFilterMonthText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  timeFilterRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  datePickerIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#1A1D2B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  datePickerBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  activeDateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.45)',
  },
  activeDateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C084FC',
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  pageSubTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    elevation: 2,
  },
  syncButtonActive: {
    opacity: 0.8,
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  syncNotification: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 4,
  },
  syncNotificationText: {
    color: colors.primaryLight,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 96,
    gap: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  walletText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 3,
  },
  noteText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
    gap: 6,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '800',
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncStatusBadgeSynced: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.incomeSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  syncStatusTextSynced: {
    fontSize: 10,
    color: colors.income,
    fontWeight: '600',
  },
  syncStatusBadgePending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.warningSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  syncStatusTextPending: {
    fontSize: 10,
    color: colors.warning,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: colors.bg,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  emptySubText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
