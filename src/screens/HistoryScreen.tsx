import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react-native';
import { Transaction } from '../types';
import { storageService } from '../services/storage';
import { syncService } from '../services/sync';
import { formatVND, formatDateTime } from '../utils/format';
import { CategoryIcon } from '../components/CategoryIcon';
import { colors } from '../theme/colors';

interface HistoryScreenProps {
  onRefreshTriggered?: () => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ onRefreshTriggered }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'EXPENSE' | 'INCOME'>('ALL');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusText, setSyncStatusText] = useState<string | null>(null);

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
    Alert.alert(
      'Xóa giao dịch',
      `Bạn có chắc chắn muốn xóa "${item.category} - ${formatVND(item.amount)}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await storageService.deleteTransaction(item.id);
              await loadData();
              onRefreshTriggered?.();
            } catch {
              Alert.alert('Lỗi', 'Không thể xóa giao dịch');
            }
          },
        },
      ]
    );
  };

  const filteredList = transactions.filter((t) => {
    if (filterType === 'EXPENSE') return t.type === 'EXPENSE';
    if (filterType === 'INCOME') return t.type === 'INCOME';
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

      {/* Segmented Filter */}
      <View style={styles.filterBar}>
        {(['ALL', 'EXPENSE', 'INCOME'] as const).map((mode) => {
          const isSelected = filterType === mode;
          const label =
            mode === 'ALL' ? 'Tất cả' : mode === 'EXPENSE' ? 'Chi tiêu' : 'Thu nhập';
          return (
            <TouchableOpacity
              key={mode}
              style={[styles.filterChip, isSelected && styles.filterChipActive]}
              onPress={() => setFilterType(mode)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  isSelected && styles.filterChipTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

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
  filterBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 3,
    marginVertical: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 9,
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: colors.primarySoft,
  },
  filterChipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: colors.primaryBright,
    fontWeight: '700',
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
