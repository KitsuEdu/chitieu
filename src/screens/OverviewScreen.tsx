import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import {
  CloudCheck,
  CloudUpload,
  CloudOff,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Sparkles,
  ChartColumn,
  Eye,
  EyeOff,
  Wallet as WalletIcon,
} from 'lucide-react-native';
import { Transaction, Wallet, TransactionType } from '../types';
import { storageService } from '../services/storage';
import { syncService } from '../services/sync';
import { formatVND, formatDateTime } from '../utils/format';
import { CategoryIcon, getCategoryConfig } from '../components/CategoryIcon';
import { colors } from '../theme/colors';

export interface QuickPreset {
  category: string;
  note: string;
  type?: TransactionType;
}

interface OverviewScreenProps {
  onNavigateToHistory: () => void;
  onNavigateToWallets: () => void;
  onNavigateToSettings: () => void;
  onOpenQuickEntry: (preset?: QuickPreset) => void;
}

function splitFormattedAmount(amount: number): { numberPart: string; symbol: string } {
  if (isNaN(amount)) return { numberPart: '0', symbol: 'đ' };
  const formatted = Math.abs(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return { numberPart: formatted, symbol: 'đ' };
}

export const OverviewScreen: React.FC<OverviewScreenProps> = ({
  onNavigateToHistory,
  onNavigateToWallets,
  onNavigateToSettings,
  onOpenQuickEntry,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [netWorth, setNetWorth] = useState<number>(0);
  const [monthExpense, setMonthExpense] = useState<number>(0);
  const [monthIncome, setMonthIncome] = useState<number>(0);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [hasConfiguredUrl, setHasConfiguredUrl] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Ẩn / hiện số dư
  const [isBalanceHidden, setIsBalanceHidden] = useState<boolean>(false);

  // Chọn cột trên Bar Chart (mặc định chọn Hôm nay)
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(5);

  // Sync icon rotation animation
  const spinValue = useSharedValue(0);

  const startSpinAnimation = () => {
    spinValue.value = withRepeat(
      withTiming(360, { duration: 1000, easing: Easing.linear }),
      -1,
      false
    );
  };

  const stopSpinAnimation = () => {
    cancelAnimation(spinValue);
    spinValue.value = 0;
  };

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinValue.value}deg` }],
  }));

  const loadData = useCallback(async () => {
    try {
      const [transList, walletList, settings] = await Promise.all([
        storageService.getTransactions(),
        storageService.getWallets(),
        storageService.getSettings(),
      ]);

      setTransactions(transList);
      setWallets(walletList);
      setHasConfiguredUrl(!!settings.googleScriptUrl?.trim());

      const walletIncome = new Map<string, number>();
      const walletExpense = new Map<string, number>();

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      let mExp = 0;
      let mInc = 0;
      let pending = 0;

      for (const t of transList) {
        if (!t.synced) pending++;

        if (t.type === 'INCOME') {
          walletIncome.set(t.wallet, (walletIncome.get(t.wallet) || 0) + t.amount);
        } else {
          walletExpense.set(t.wallet, (walletExpense.get(t.wallet) || 0) + t.amount);
        }

        const tDate = new Date(t.date);
        if (
          tDate.getFullYear() === currentYear &&
          tDate.getMonth() === currentMonth
        ) {
          if (t.type === 'EXPENSE') {
            mExp += t.amount;
          } else {
            mInc += t.amount;
          }
        }
      }

      // Net Worth = (Tiền mặt + Ngân hàng khả dụng) - (Dư nợ Thẻ tín dụng + Trả sau)
      let totalCashAndBank = 0;
      let totalDebts = 0;

      for (const w of walletList) {
        const inc = walletIncome.get(w.name) || 0;
        const exp = walletExpense.get(w.name) || 0;

        if (w.type === 'CREDIT_CARD' || w.type === 'PAYLATER') {
          const debt = Math.max((w.currentBalance || 0) + exp - inc, 0);
          totalDebts += debt;
        } else {
          const bal = (w.balance || 0) + inc - exp;
          totalCashAndBank += bal;
        }
      }

      const totalNetWorth = totalCashAndBank - totalDebts;

      setNetWorth(totalNetWorth);
      setMonthExpense(mExp);
      setMonthIncome(mInc);
      setPendingSyncCount(pending);
    } catch (error) {
      console.error('Lỗi tải dữ liệu tổng quan:', error);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleQuickSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    startSpinAnimation();
    try {
      await syncService.syncPendingTransactions();
      await loadData();
    } finally {
      setIsSyncing(false);
      stopSpinAnimation();
    }
  };

  // Tính toán dữ liệu 6 ngày gần nhất
  const recentDays = Array.from({ length: 6 }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (5 - idx));
    const dayStr = `${d.getDate()}/${d.getMonth() + 1}`;
    const isToday = idx === 5;

    let dayExpense = 0;
    for (const t of transactions) {
      if (t.type === 'EXPENSE') {
        const td = new Date(t.date);
        if (
          td.getFullYear() === d.getFullYear() &&
          td.getMonth() === d.getMonth() &&
          td.getDate() === d.getDate()
        ) {
          dayExpense += t.amount;
        }
      }
    }

    return {
      index: idx,
      label: isToday ? 'H.nay' : dayStr,
      fullDate: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
      amount: dayExpense,
      isToday,
    };
  });

  const maxDayExpense = Math.max(...recentDays.map((d) => d.amount), 50000);

  // Tỷ trọng danh mục chi tiêu tháng này
  const categoryTotals: { [cat: string]: number } = {};
  for (const t of transactions) {
    if (t.type === 'EXPENSE') {
      const tDate = new Date(t.date);
      const now = new Date();
      if (
        tDate.getFullYear() === now.getFullYear() &&
        tDate.getMonth() === now.getMonth()
      ) {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
      }
    }
  }

  const sortedCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const recentTransactions = transactions.slice(0, 4);

  const expenseRatio =
    monthIncome > 0 ? Math.min((monthExpense / monthIncome) * 100, 100) : 100;

  const { numberPart: netWorthNum, symbol: currencySym } =
    splitFormattedAmount(netWorth);

  const selectedDayData =
    selectedBarIndex !== null ? recentDays[selectedBarIndex] : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {/* 1. Header Lời chào & Trạng thái Sync */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.topHeader}>
        <View>
          <View style={styles.greetingRow}>
            <Sparkles size={14} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.greetingText}>Matte Minimalist</Text>
          </View>
          <Text style={styles.appTitle}>Tổng quan tài sản</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.syncBadge,
            !hasConfiguredUrl
              ? styles.syncBadgeDisabled
              : pendingSyncCount > 0
              ? styles.syncBadgePending
              : styles.syncBadgeSynced,
          ]}
          onPress={hasConfiguredUrl ? handleQuickSync : onNavigateToSettings}
          activeOpacity={0.7}
        >
          {isSyncing ? (
            <Animated.View style={spinStyle}>
              <RefreshCw size={13} color={colors.primary} />
            </Animated.View>
          ) : !hasConfiguredUrl ? (
            <CloudOff size={13} color={colors.textSecondary} />
          ) : pendingSyncCount > 0 ? (
            <CloudUpload size={13} color={colors.warning} />
          ) : (
            <CloudCheck size={13} color={colors.income} />
          )}

          <Text
            style={[
              styles.syncBadgeText,
              !hasConfiguredUrl
                ? styles.syncTextDisabled
                : pendingSyncCount > 0
                ? styles.syncTextPending
                : styles.syncTextSynced,
            ]}
          >
            {isSyncing
              ? 'Sync...'
              : !hasConfiguredUrl
              ? 'Chưa kết nối'
              : pendingSyncCount > 0
              ? `${pendingSyncCount} chờ sync`
              : 'Đã đồng bộ'}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* 2. Hero Card: Flat Matte Dark Solid Color, Viền siêu mỏng, Tối giản sang trọng */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(450)}
        style={styles.heroCard}
      >
        <View style={styles.heroHeaderRow}>
          <Text style={styles.heroLabel}>TỔNG TÀI SẢN RÒNG (NET WORTH)</Text>
          <TouchableOpacity
            style={styles.eyeToggleBtn}
            onPress={() => setIsBalanceHidden(!isBalanceHidden)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {isBalanceHidden ? (
              <EyeOff size={16} color={colors.textSecondary} />
            ) : (
              <Eye size={16} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Số tiền lớn: Pure Solid White #F8FAFC, ký hiệu 'đ' nhỏ hơn 40% */}
        <View style={styles.balanceDisplayContainer}>
          {isBalanceHidden ? (
            <View style={styles.amountDisplayRow}>
              <Text style={styles.hiddenAmountText}>••••••••••</Text>
              <Text style={styles.currencySymbolText}>{currencySym}</Text>
            </View>
          ) : (
            <View style={styles.amountDisplayRow}>
              <Text style={styles.amountNumberText}>{netWorthNum}</Text>
              <Text style={styles.currencySymbolText}>{currencySym}</Text>
            </View>
          )}
        </View>

        {/* Lối tắt xem ví */}
        <TouchableOpacity
          style={styles.walletsShortcut}
          onPress={onNavigateToWallets}
          activeOpacity={0.7}
        >
          <Text style={styles.walletsShortcutText}>
            Phân bổ qua {wallets.length} nguồn tiền
          </Text>
          <ChevronRight size={13} color={colors.primaryLight} />
        </TouchableOpacity>

        {/* Box Thu/Chi tháng này: Nền đen nhám mờ, viền mỏng tách lớp */}
        <View style={styles.monthStatsRow}>
          <View style={styles.monthStatItem}>
            <View style={styles.statIconBadgeIncome}>
              <ArrowDownLeft size={13} color={colors.income} />
            </View>
            <View>
              <Text style={styles.monthStatLabel}>Thu tháng này</Text>
              <Text style={styles.monthIncomeValue}>
                {isBalanceHidden ? '•••••• đ' : formatVND(monthIncome)}
              </Text>
            </View>
          </View>

          <View style={styles.monthStatDivider} />

          <View style={styles.monthStatItem}>
            <View style={styles.statIconBadgeExpense}>
              <ArrowUpRight size={13} color={colors.expense} />
            </View>
            <View>
              <Text style={styles.monthStatLabel}>Chi tháng này</Text>
              <Text style={styles.monthExpenseValue}>
                {isBalanceHidden ? '•••••• đ' : formatVND(monthExpense)}
              </Text>
            </View>
          </View>
        </View>

        {/* Thanh tiến độ: Nền rãnh xám tối #1E2030, dải tiến độ solid #8B5CF6 */}
        <View style={styles.progressSection}>
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.max(expenseRatio, 2)}%`,
                  backgroundColor: expenseRatio > 90 ? colors.expense : colors.primary,
                },
              ]}
            />
          </View>

          <View style={styles.progressLabels}>
            <Text style={styles.progressInfoText}>
              Chi tiêu {monthIncome > 0 ? `${expenseRatio.toFixed(0)}% thu nhập` : 'chưa có thu nhập'}
            </Text>
            <Text style={styles.progressRemainderText}>
              {isBalanceHidden
                ? 'Còn lại: ••••••'
                : `Dư: ${formatVND(monthIncome - monthExpense)}`}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* 3. Biểu đồ cột 6 ngày: Rãnh #1E2030, Cột Solid #8B5CF6, Cột Hôm nay viền #A855F7 */}
      <Animated.View
        entering={FadeInDown.delay(200).duration(450)}
        style={styles.card}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <ChartColumn size={16} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.cardTitle}>Chi tiêu 6 ngày gần nhất</Text>
          </View>
          <Text style={styles.cardSubText}>Chạm cột để xem chi tiết</Text>
        </View>

        {/* Tooltip khi chạm cột */}
        {selectedDayData && (
          <View style={styles.tooltipBubble}>
            <Text style={styles.tooltipDateText}>
              {selectedDayData.isToday ? 'Hôm nay' : selectedDayData.fullDate}:
            </Text>
            <Text style={styles.tooltipAmountText}>
              {formatVND(selectedDayData.amount)}
            </Text>
          </View>
        )}

        {/* Khung Bar Chart */}
        <View style={styles.chartContainer}>
          {recentDays.map((item, idx) => {
            const isSelected = selectedBarIndex === idx;
            const heightRatio =
              maxDayExpense > 0 ? Math.min(item.amount / maxDayExpense, 1) : 0;
            const barHeight = Math.max(heightRatio * 84, 6);

            return (
              <TouchableOpacity
                key={idx}
                style={styles.barTouchableColumn}
                activeOpacity={0.7}
                onPress={() => setSelectedBarIndex(idx)}
              >
                {/* Rãnh track #1E2030 */}
                <View
                  style={[
                    styles.barTrackV2,
                    item.isToday && styles.barTrackToday,
                    isSelected && styles.barTrackSelected,
                  ]}
                >
                  <View
                    style={[
                      styles.barFillSolid,
                      {
                        height: barHeight,
                        backgroundColor: item.isToday ? colors.primaryBright : colors.trackFill,
                      },
                    ]}
                  />
                </View>

                {/* Nhãn ngày */}
                <Text
                  style={[
                    styles.barLabelTextV2,
                    item.isToday && styles.barLabelTodayV2,
                    isSelected && styles.barLabelActiveV2,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>

      {/* 4. Tỷ trọng chi tiêu theo danh mục lớn */}
      {sortedCategories.length > 0 && (
        <Animated.View
          entering={FadeInDown.delay(300).duration(450)}
          style={styles.card}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Top danh mục chi tiêu tháng này</Text>
            <Text style={styles.cardSubText}>Theo tỷ trọng</Text>
          </View>

          <View style={styles.categoriesList}>
            {sortedCategories.map(([cat, amount]) => {
              const config = getCategoryConfig(cat);
              const percent =
                monthExpense > 0 ? (amount / monthExpense) * 100 : 0;

              return (
                <View key={cat} style={styles.categoryItem}>
                  <CategoryIcon category={cat} size={15} containerSize={32} />
                  <View style={styles.categoryContent}>
                    <View style={styles.categoryNameRow}>
                      <Text style={styles.categoryNameText}>{cat}</Text>
                      <Text style={styles.categoryAmountText}>
                        {isBalanceHidden ? '••••••' : formatVND(amount)}
                      </Text>
                    </View>
                    <View style={styles.categoryBarTrack}>
                      <View
                        style={[
                          styles.categoryBarFill,
                          {
                            width: `${Math.max(percent, 4)}%`,
                            backgroundColor: config.color,
                          },
                        ]}
                      />
                    </View>
                  </View>
                  <Text style={styles.categoryPercentText}>
                    {percent.toFixed(0)}%
                  </Text>
                </View>
              );
            })}
          </View>
        </Animated.View>
      )}

      {/* 5. Giao dịch gần đây & Empty State */}
      <Animated.View
        entering={FadeInDown.delay(400).duration(450)}
        style={styles.card}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Giao dịch gần đây</Text>
          <TouchableOpacity
            onPress={onNavigateToHistory}
            style={styles.viewAllBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllText}>Xem tất cả</Text>
            <ChevronRight size={13} color={colors.primaryLight} />
          </TouchableOpacity>
        </View>

        {recentTransactions.length === 0 ? (
          <View style={styles.emptyDashedBox}>
            <View style={styles.fadedIconCircle}>
              <WalletIcon size={22} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyPromptTitle}>Chưa có giao dịch gần đây</Text>
            <Text style={styles.emptyPromptSub}>
              Bắt đầu ghi chép chi tiêu bằng các gợi ý nhanh bên dưới:
            </Text>

            {/* 3 Quick Chips */}
            <View style={styles.quickChipsRow}>
              <TouchableOpacity
                style={styles.quickChip}
                onPress={() =>
                  onOpenQuickEntry({
                    category: 'Ăn uống',
                    note: 'Cà phê',
                    type: 'EXPENSE',
                  })
                }
                activeOpacity={0.7}
              >
                <Text style={styles.quickChipText}>☕ Cà phê</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickChip}
                onPress={() =>
                  onOpenQuickEntry({
                    category: 'Ăn uống',
                    note: 'Cơm trưa',
                    type: 'EXPENSE',
                  })
                }
                activeOpacity={0.7}
              >
                <Text style={styles.quickChipText}>🍜 Cơm trưa</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickChip}
                onPress={() =>
                  onOpenQuickEntry({
                    category: 'Di chuyển',
                    note: 'Đổ xăng',
                    type: 'EXPENSE',
                  })
                }
                activeOpacity={0.7}
              >
                <Text style={styles.quickChipText}>⛽ Đổ xăng</Text>
              </TouchableOpacity>
            </View>

            {/* Nút nhập giao dịch ngay */}
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => onOpenQuickEntry()}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyActionBtnText}>+ Nhập giao dịch ngay</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.recentList}>
            {recentTransactions.map((item) => {
              const isExpense = item.type === 'EXPENSE';
              return (
                <View key={item.id} style={styles.recentItem}>
                  <CategoryIcon category={item.category} size={18} containerSize={38} />
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentTitle}>{item.category}</Text>
                    <Text style={styles.recentSub}>
                      {item.wallet} • {formatDateTime(item.date)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.recentAmount,
                      { color: isExpense ? colors.expense : colors.income },
                    ]}
                  >
                    {isExpense ? '-' : '+'}
                    {isBalanceHidden ? '••••••' : formatVND(item.amount)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </Animated.View>
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
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greetingText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
    letterSpacing: -0.3,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  syncBadgeSynced: {
    backgroundColor: colors.incomeSoft,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
  },
  syncBadgePending: {
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  syncBadgeDisabled: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  syncBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  syncTextSynced: {
    color: colors.income,
  },
  syncTextPending: {
    color: colors.warning,
  },
  syncTextDisabled: {
    color: colors.textSecondary,
  },
  heroCard: {
    backgroundColor: colors.surface, // Solid Flat Matte Dark #161926
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border, // 1px solid rgba(255, 255, 255, 0.07)
    padding: 20,
    elevation: 2,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.9,
  },
  eyeToggleBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  balanceDisplayContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  amountDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountNumberText: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.textPrimary, // Pure solid white
    letterSpacing: -0.6,
  },
  hiddenAmountText: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  currencySymbolText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textSecondary,
    marginLeft: 6,
    marginTop: 3,
  },
  walletsShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  walletsShortcutText: {
    fontSize: 12,
    color: colors.primaryLight,
    fontWeight: '600',
  },
  monthStatsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceGlass,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthStatItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  statIconBadgeIncome: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.incomeSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statIconBadgeExpense: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.expenseSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthStatLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '500',
  },
  monthIncomeValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.income,
    marginTop: 1,
  },
  monthExpenseValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.expense,
    marginTop: 1,
  },
  monthStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
    marginHorizontal: 8,
  },
  progressSection: {
    marginTop: 16,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: colors.track,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressInfoText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  progressRemainderText: {
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.surface, // Solid Flat Matte Dark #161926
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardSubText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  tooltipBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
    marginBottom: 10,
  },
  tooltipDateText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  tooltipAmountText: {
    fontSize: 12,
    color: colors.primaryLight,
    fontWeight: '800',
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 115,
    paddingTop: 6,
    paddingHorizontal: 4,
  },
  barTouchableColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barTrackV2: {
    width: 20,
    height: 86,
    backgroundColor: colors.track,
    borderRadius: 10,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  barTrackToday: {
    borderColor: colors.primaryBright,
  },
  barTrackSelected: {
    borderColor: colors.primaryLight,
  },
  barFillSolid: {
    width: '100%',
    borderRadius: 10,
  },
  barLabelTextV2: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 6,
    fontWeight: '500',
  },
  barLabelTodayV2: {
    color: colors.primaryBright,
    fontWeight: '700',
  },
  barLabelActiveV2: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  categoriesList: {
    gap: 12,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryContent: {
    flex: 1,
  },
  categoryNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  categoryNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  categoryAmountText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  categoryBarTrack: {
    height: 5,
    backgroundColor: colors.track,
    borderRadius: 3,
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  categoryPercentText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    width: 32,
    textAlign: 'right',
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    fontSize: 12,
    color: colors.primaryLight,
    fontWeight: '600',
  },
  emptyDashedBox: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
  },
  fadedIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyPromptTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyPromptSub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 3,
    marginBottom: 12,
  },
  quickChipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  quickChip: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  quickChipText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  emptyActionBtn: {
    marginTop: 12,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  emptyActionBtnText: {
    color: colors.primaryLight,
    fontSize: 13,
    fontWeight: '600',
  },
  recentList: {
    gap: 10,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  recentInfo: {
    flex: 1,
    marginLeft: 10,
  },
  recentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  recentSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  recentAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
});
