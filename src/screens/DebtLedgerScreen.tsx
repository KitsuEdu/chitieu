import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Plus,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  X,
  BookOpen,
} from 'lucide-react-native';
import { DebtRecord, DebtType, DebtStatus, Wallet } from '../types';
import { storageService } from '../services/storage';
import { syncService } from '../services/sync';
import { colors } from '../theme/colors';
import { formatVND } from '../utils/format';
import { WalletLogo } from '../components/WalletLogo';
import { SegmentedTabs, SegmentedTabItem } from '../components/SegmentedTabs';
import { DebtFormModal } from '../components/DebtFormModal';
import { DebtDetailModal } from '../components/DebtDetailModal';
import { DebtPaymentModal } from '../components/DebtPaymentModal';

interface DebtLedgerScreenProps {
  onBack: () => void;
  onDataChanged?: () => void;
}

type DebtFilterTab = 'LEND' | 'BORROW' | 'SETTLED';

const DEBT_FILTER_TABS: readonly SegmentedTabItem<DebtFilterTab>[] = [
  {
    key: 'LEND',
    label: 'Cho vay',
    activeColor: colors.income,
    activeBgColor: 'rgba(52, 211, 153, 0.15)',
    activeBorderColor: 'rgba(52, 211, 153, 0.35)',
  },
  {
    key: 'BORROW',
    label: 'Đi vay',
    activeColor: colors.expense,
    activeBgColor: 'rgba(244, 63, 94, 0.15)',
    activeBorderColor: 'rgba(244, 63, 94, 0.35)',
  },
  {
    key: 'SETTLED',
    label: 'Đã xong',
    activeColor: colors.primaryLight,
    activeBgColor: 'rgba(139, 92, 246, 0.18)',
    activeBorderColor: 'rgba(168, 85, 247, 0.4)',
  },
];

export const DebtLedgerScreen: React.FC<DebtLedgerScreenProps> = ({
  onBack,
  onDataChanged,
}) => {
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Filters & Search
  const [activeTab, setActiveTab] = useState<DebtFilterTab>('LEND');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isFormModalVisible, setIsFormModalVisible] = useState<boolean>(false);
  const [editingDebt, setEditingDebt] = useState<DebtRecord | null>(null);

  const [selectedDebtDetail, setSelectedDebtDetail] = useState<DebtRecord | null>(null);
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState<boolean>(false);
  const [payingDebt, setPayingDebt] = useState<DebtRecord | null>(null);

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    try {
      Haptics.impactAsync(style);
    } catch {
      // Ignore on unsupported devices
    }
  };

  const loadData = useCallback(async () => {
    try {
      const [debtList, walletList] = await Promise.all([
        storageService.getDebts(),
        storageService.getWallets(),
      ]);
      setDebts(debtList);
      setWallets(walletList);

      // Keep selected debt detail updated if modal is open
      if (selectedDebtDetail) {
        const updated = debtList.find((d) => d.id === selectedDebtDetail.id);
        if (updated) setSelectedDebtDetail(updated);
      }
    } catch (error) {
      console.error('Error loading debt ledger data:', error);
    }
  }, [selectedDebtDetail]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      loadData(),
      syncService.syncPendingDebts(),
    ]);
    setIsRefreshing(false);
  };

  // Metrics Calculation
  const metrics = useMemo(() => {
    let totalLendReceivable = 0; // Cần thu về (LEND & ACTIVE)
    let totalBorrowPayable = 0;  // Cần trả đi (BORROW & ACTIVE)

    for (const d of debts) {
      if (d.status === 'ACTIVE') {
        const remaining = Math.max(d.totalAmount - (d.paidAmount || 0), 0);
        if (d.type === 'LEND') {
          totalLendReceivable += remaining;
        } else {
          totalBorrowPayable += remaining;
        }
      }
    }

    const netBalance = totalLendReceivable - totalBorrowPayable;

    return {
      totalLendReceivable,
      totalBorrowPayable,
      netBalance,
    };
  }, [debts]);

  // Filtered List (1 tab filter + search query)
  const filteredDebts = useMemo(() => {
    return debts.filter((item) => {
      // 1. Tab filter
      if (activeTab === 'LEND') {
        if (item.type !== 'LEND' || item.status !== 'ACTIVE') return false;
      } else if (activeTab === 'BORROW') {
        if (item.type !== 'BORROW' || item.status !== 'ACTIVE') return false;
      } else if (activeTab === 'SETTLED') {
        if (item.status !== 'SETTLED') return false;
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = item.personName.toLowerCase().includes(query);
        const matchNote = item.note ? item.note.toLowerCase().includes(query) : false;
        if (!matchName && !matchNote) return false;
      }

      return true;
    });
  }, [debts, activeTab, searchQuery]);

  // Handle Form Submit (Create or Update)
  const handleSaveDebt = async (debtData: {
    type: DebtType;
    personName: string;
    totalAmount: number;
    createdDate: string;
    dueDate?: string;
    walletId?: string;
    syncWithWallet: boolean;
    note?: string;
  }) => {
    if (editingDebt) {
      const updated: DebtRecord = {
        ...editingDebt,
        ...debtData,
      };
      await storageService.updateDebt(updated);
      setSelectedDebtDetail(updated);
    } else {
      await storageService.addDebt(debtData);
    }

    await loadData();
    onDataChanged?.();
    syncService.syncPendingDebts();
  };

  // Handle Recording Payment
  const handleRecordPayment = async (paymentData: {
    amount: number;
    date: string;
    walletId?: string;
    note?: string;
    syncWithWallet: boolean;
  }) => {
    if (!payingDebt) return;
    const updatedDebt = await storageService.addDebtPayment(
      payingDebt.id,
      {
        amount: paymentData.amount,
        date: paymentData.date,
        walletId: paymentData.walletId,
        note: paymentData.note,
      },
      paymentData.syncWithWallet
    );

    await loadData();
    setSelectedDebtDetail(updatedDebt);
    onDataChanged?.();
    syncService.syncPendingDebts();
  };

  // Toggle Settled / Reopen
  const handleToggleSettled = async (debt: DebtRecord) => {
    const newStatus: DebtStatus = debt.status === 'SETTLED' ? 'ACTIVE' : 'SETTLED';
    const updated: DebtRecord = {
      ...debt,
      status: newStatus,
      paidAmount: newStatus === 'SETTLED' ? debt.totalAmount : debt.paidAmount,
    };
    await storageService.updateDebt(updated);
    setSelectedDebtDetail(updated);
    await loadData();
    onDataChanged?.();
    syncService.syncPendingDebts();
  };

  // Delete Debt
  const handleDeleteDebt = async (debtId: string) => {
    await storageService.deleteDebt(debtId);
    setSelectedDebtDetail(null);
    await loadData();
    onDataChanged?.();
  };

  const formatDateDisplay = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '';
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return '';
    }
  };

  const getDueBadgeInfo = (item: DebtRecord) => {
    if (item.status === 'SETTLED') return null;
    if (!item.dueDate) return null;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const targetDate = new Date(item.dueDate);
    const dueDay = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate()
    ).getTime();

    const diffDays = Math.round((dueDay - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        isOverdue: true,
        text: `Quá hạn ${Math.abs(diffDays)} ngày`,
      };
    }
    if (diffDays === 0) {
      return {
        isDueToday: true,
        text: 'Hôm nay',
      };
    }
    return {
      isUpcoming: true,
      text: `Hạn: ${formatDateDisplay(item.dueDate)}`,
    };
  };

  const renderDebtItem = ({ item }: { item: DebtRecord }) => {
    const isLend = item.type === 'LEND';
    const isSettled = item.status === 'SETTLED';
    const remaining = Math.max(item.totalAmount - (item.paidAmount || 0), 0);
    const progressRatio = Math.min(
      Math.max((item.paidAmount || 0) / (item.totalAmount || 1), 0),
      1
    );
    const progressPercent = Math.round(progressRatio * 100);
    const dueBadge = getDueBadgeInfo(item);
    const wallet = wallets.find((w) => w.id === item.walletId || w.name === item.walletId);

    return (
      <TouchableOpacity
        style={styles.debtCard}
        onPress={() => {
          triggerHaptic();
          setSelectedDebtDetail(item);
        }}
        activeOpacity={0.75}
      >
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View
              style={[
                styles.itemTypeBadge,
                isLend ? styles.itemTypeBadgeLend : styles.itemTypeBadgeBorrow,
              ]}
            >
              {isLend ? (
                <ArrowDownLeft size={13} color={colors.income} strokeWidth={2.5} />
              ) : (
                <ArrowUpRight size={13} color={colors.expense} strokeWidth={2.5} />
              )}
              <Text
                style={[
                  styles.itemTypeBadgeText,
                  isLend ? styles.itemTypeBadgeTextLend : styles.itemTypeBadgeTextBorrow,
                ]}
              >
                {isLend ? 'Cho vay' : 'Đi vay'}
              </Text>
            </View>

            <Text style={styles.cardPersonName} numberOfLines={1}>
              {item.personName}
            </Text>
          </View>

          {isSettled ? (
            <View style={styles.itemSettledBadge}>
              <CheckCircle2 size={12} color={colors.income} strokeWidth={2.5} />
              <Text style={styles.itemSettledBadgeText}>Đã tất toán</Text>
            </View>
          ) : dueBadge ? (
            <View
              style={[
                styles.itemDueBadge,
                dueBadge.isOverdue
                  ? styles.itemDueBadgeOverdue
                  : dueBadge.isDueToday
                  ? styles.itemDueBadgeToday
                  : styles.itemDueBadgeNormal,
              ]}
            >
              {dueBadge.isOverdue && (
                <AlertTriangle size={11} color={colors.expense} strokeWidth={2.5} />
              )}
              <Text
                style={[
                  styles.itemDueBadgeText,
                  dueBadge.isOverdue
                    ? styles.itemDueBadgeTextOverdue
                    : dueBadge.isDueToday
                    ? styles.itemDueBadgeTextToday
                    : styles.itemDueBadgeTextNormal,
                ]}
              >
                {dueBadge.text}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Card Body: Remaining Amount & Quick Pay Button */}
        <View style={styles.cardBody}>
          <View style={styles.cardAmountCol}>
            <Text style={styles.cardAmountLabel}>
              {isSettled ? 'Tổng số tiền' : isLend ? 'Cần thu về' : 'Cần trả đi'}
            </Text>
            <Text style={styles.cardAmountValue}>
              {isSettled ? formatVND(item.totalAmount) : formatVND(remaining)}
            </Text>
          </View>

          {!isSettled && (
            <TouchableOpacity
              style={styles.cardQuickPayBtn}
              onPress={(e) => {
                e.stopPropagation();
                triggerHaptic();
                setPayingDebt(item);
                setIsPaymentModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.cardQuickPayBtnText}>
                {isLend ? 'Thu nợ' : 'Trả nợ'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Progress Bar */}
        <View style={styles.cardProgressTrack}>
          <View
            style={[
              styles.cardProgressFill,
              { width: `${progressPercent}%` },
              isSettled && { backgroundColor: colors.income },
            ]}
          />
        </View>

        {/* Card Footer */}
        <View style={styles.cardFooter}>
          <Text style={styles.cardProgressText}>
            Đã trả: <Text style={{ color: colors.textPrimary }}>{formatVND(item.paidAmount || 0)}</Text> ({progressPercent}%)
          </Text>

          {wallet && (
            <View style={styles.cardWalletBadge}>
              {wallet.logoId && <WalletLogo logoId={wallet.logoId} size={14} />}
              <Text style={styles.cardWalletName} numberOfLines={1}>
                {wallet.name}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* 1. Header Bar: Tinh gọn 1 hàng */}
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              triggerHaptic();
              onBack();
            }}
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sổ nợ & Cho vay</Text>
        </View>

        <View style={styles.headerRight}>
          {/* Nút tìm kiếm tròn tối giản */}
          <TouchableOpacity
            style={[styles.searchToggleBtn, isSearchOpen && styles.searchToggleBtnActive]}
            onPress={() => {
              triggerHaptic();
              setIsSearchOpen((prev) => {
                if (prev) setSearchQuery('');
                return !prev;
              });
            }}
            activeOpacity={0.7}
          >
            <Search
              size={17}
              color={isSearchOpen ? colors.primaryBright : colors.textSecondary}
            />
          </TouchableOpacity>

          {/* Nút + Thêm */}
          <TouchableOpacity
            style={styles.addDebtBtn}
            onPress={() => {
              triggerHaptic();
              setEditingDebt(null);
              setIsFormModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.addDebtBtnText}>Thêm</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Thanh tìm kiếm mở rộng thông minh (Collapsible Search) */}
      {isSearchOpen && (
        <View style={styles.searchCollapsibleBar}>
          <Search size={15} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Tìm theo tên người hoặc ghi chú..."
            placeholderTextColor={colors.textMuted}
            autoFocus
          />
          <TouchableOpacity
            onPress={() => {
              if (searchQuery) {
                setSearchQuery('');
              } else {
                setIsSearchOpen(false);
              }
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={15} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* FlatList Danh sách khoản nợ */}
      <FlatList
        data={filteredDebts}
        keyExtractor={(item) => item.id}
        renderItem={renderDebtItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeaderWrapper}>
            {/* 2. Unified Summary Card duy nhất (Nền #12141F, bo góc 18px, viền 1px) */}
            <View style={styles.unifiedSummaryCard}>
              {/* Phần trên: 2 cột ngang có vạch chia dọc mờ */}
              <View style={styles.summaryTopRow}>
                <View style={styles.summaryColLeft}>
                  <Text style={styles.summaryColLabel}>CẦN THU VỀ</Text>
                  <Text style={styles.summaryAmountLend}>
                    {formatVND(metrics.totalLendReceivable)}
                  </Text>
                </View>

                <View style={styles.summaryDividerVertical} />

                <View style={styles.summaryColRight}>
                  <Text style={styles.summaryColLabel}>CẦN TRẢ ĐI</Text>
                  <Text style={styles.summaryAmountBorrow}>
                    {formatVND(metrics.totalBorrowPayable)}
                  </Text>
                </View>
              </View>

              {/* Đường kẻ ngang mỏng ngăn cách */}
              <View style={styles.summaryDividerHorizontal} />

              {/* Phần đáy: Dòng footer chênh lệch ròng */}
              <View style={styles.summaryFooterRow}>
                <Text style={styles.summaryFooterLabel}>Chênh lệch ròng:</Text>
                <Text
                  style={[
                    styles.summaryFooterValue,
                    metrics.netBalance >= 0
                      ? styles.summaryFooterPositive
                      : styles.summaryFooterNegative,
                  ]}
                >
                  {metrics.netBalance >= 0 ? '+' : ''}{formatVND(metrics.netBalance)}
                </Text>
              </View>
            </View>

            {/* 3. Một thanh Segmented Tabs duy nhất (Cho vay | Đi vay | Đã xong) */}
            <SegmentedTabs<DebtFilterTab>
              tabs={DEBT_FILTER_TABS}
              activeKey={activeTab}
              onChange={(key) => {
                triggerHaptic();
                setActiveTab(key);
              }}
              tabHeight={38}
            />
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <BookOpen size={30} color={colors.primaryLight} strokeWidth={1.8} />
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery
                ? 'Không tìm thấy kết quả'
                : activeTab === 'LEND'
                ? 'Không có khoản cho vay nào'
                : activeTab === 'BORROW'
                ? 'Không có khoản đi vay nào'
                : 'Chưa có khoản nợ đã xong'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Hãy thử tìm kiếm với tên hoặc từ khóa khác.'
                : activeTab === 'LEND'
                ? 'Bạn hiện không có khoản cho vay nào đang chờ thu hồi.'
                : activeTab === 'BORROW'
                ? 'Bạn không có khoản nợ nào cần phải trả.'
                : 'Các khoản nợ sau khi tất toán đủ sẽ xuất hiện tại đây.'}
            </Text>

            {!searchQuery && activeTab !== 'SETTLED' && (
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={() => {
                  triggerHaptic();
                  setEditingDebt(null);
                  setIsFormModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <Plus size={15} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
                <Text style={styles.emptyAddBtnText}>
                  {activeTab === 'LEND' ? 'Tạo khoản cho vay' : 'Tạo khoản đi vay'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Modals */}
      <DebtFormModal
        visible={isFormModalVisible}
        initialDebt={editingDebt}
        wallets={wallets}
        onClose={() => {
          setIsFormModalVisible(false);
          setEditingDebt(null);
        }}
        onSubmit={handleSaveDebt}
      />

      <DebtDetailModal
        visible={Boolean(selectedDebtDetail)}
        debt={selectedDebtDetail}
        wallets={wallets}
        onClose={() => setSelectedDebtDetail(null)}
        onOpenPaymentModal={() => {
          setPayingDebt(selectedDebtDetail);
          setIsPaymentModalVisible(true);
        }}
        onOpenEditModal={() => {
          if (selectedDebtDetail) {
            setEditingDebt(selectedDebtDetail);
            setIsFormModalVisible(true);
          }
        }}
        onToggleSettled={() => {
          if (selectedDebtDetail) {
            handleToggleSettled(selectedDebtDetail);
          }
        }}
        onDeleteDebt={() => {
          if (selectedDebtDetail) {
            handleDeleteDebt(selectedDebtDetail.id);
          }
        }}
      />

      <DebtPaymentModal
        visible={isPaymentModalVisible}
        debt={payingDebt}
        wallets={wallets}
        onClose={() => {
          setIsPaymentModalVisible(false);
          setPayingDebt(null);
        }}
        onSubmit={handleRecordPayment}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchToggleBtnActive: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.primarySoft,
  },
  addDebtBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    gap: 4,
  },
  addDebtBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchCollapsibleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32, // Tối ưu không gian, không còn bị vướng Navbar
  },
  listHeaderWrapper: {
    paddingTop: 14,
    gap: 12,
    marginBottom: 10,
  },
  unifiedSummaryCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  summaryColLeft: {
    flex: 1,
  },
  summaryColRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  summaryColLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryAmountLend: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.income,
  },
  summaryAmountBorrow: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.expense,
  },
  summaryDividerVertical: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
    marginHorizontal: 10,
  },
  summaryDividerHorizontal: {
    height: 1,
    backgroundColor: colors.border,
    width: '100%',
  },
  summaryFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  summaryFooterLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  summaryFooterValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryFooterPositive: {
    color: colors.income,
  },
  summaryFooterNegative: {
    color: colors.expense,
  },
  debtCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  itemTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  itemTypeBadgeLend: {
    backgroundColor: colors.incomeSoft,
  },
  itemTypeBadgeBorrow: {
    backgroundColor: colors.expenseSoft,
  },
  itemTypeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  itemTypeBadgeTextLend: {
    color: colors.income,
  },
  itemTypeBadgeTextBorrow: {
    color: colors.expense,
  },
  cardPersonName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  itemSettledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  itemSettledBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.income,
  },
  itemDueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  itemDueBadgeOverdue: {
    backgroundColor: colors.expenseSoft,
  },
  itemDueBadgeToday: {
    backgroundColor: colors.warningSoft,
  },
  itemDueBadgeNormal: {
    backgroundColor: colors.surfaceElevated,
  },
  itemDueBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemDueBadgeTextOverdue: {
    color: colors.expense,
  },
  itemDueBadgeTextToday: {
    color: colors.warning,
  },
  itemDueBadgeTextNormal: {
    color: colors.textSecondary,
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  cardAmountCol: {
    gap: 3,
  },
  cardAmountLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  cardAmountValue: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  cardQuickPayBtn: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  cardQuickPayBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryBright,
  },
  cardProgressTrack: {
    height: 5,
    backgroundColor: colors.track,
    borderRadius: 3,
    overflow: 'hidden',
  },
  cardProgressFill: {
    height: '100%',
    backgroundColor: colors.primaryBright,
    borderRadius: 3,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  cardProgressText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  cardWalletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardWalletName: {
    fontSize: 11,
    color: colors.textSecondary,
    maxWidth: 120,
  },
  emptyContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyAddBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
