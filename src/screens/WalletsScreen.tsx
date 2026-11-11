import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Wallet as WalletIcon,
  Landmark,
  PiggyBank,
  CreditCard,
  Zap,
  Plus,
  Pencil,
  Trash,
  X,
  TrendingDown,
  Calendar,
  AlertTriangle,
  Info,
  CircleDollarSign,
} from 'lucide-react-native';
import { Transaction, Wallet, WalletType } from '../types';
import { storageService } from '../services/storage';
import { formatVND } from '../utils/format';
import { colors } from '../theme/colors';

interface WalletsScreenProps {
  onWalletsUpdated?: () => void;
}

const WALLET_DOT_COLORS = [
  '#8B5CF6', // Violet
  '#34D399', // Mint Green
  '#38BDF8', // Sky
  '#F43F5E', // Rose
  '#F59E0B', // Amber
  '#EC4899', // Pink
];

export const WalletsScreen: React.FC<WalletsScreenProps> = ({ onWalletsUpdated }) => {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filterMode, setFilterMode] = useState<'ALL' | 'ASSETS' | 'LIABILITIES'>('ALL');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Modal State
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);

  // Form Fields
  const [walletName, setWalletName] = useState<string>('');
  const [walletType, setWalletType] = useState<WalletType>('CASH');
  const [selectedColor, setSelectedColor] = useState<string>(WALLET_DOT_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState<string>('Wallet');

  // Fields for CASH & BANK_EWALLET
  const [balanceStr, setBalanceStr] = useState<string>('0');

  // Fields for CREDIT_CARD & PAYLATER
  const [creditLimitStr, setCreditLimitStr] = useState<string>('');
  const [currentBalanceStr, setCurrentBalanceStr] = useState<string>('0');
  const [statementDateStr, setStatementDateStr] = useState<string>('');
  const [dueDateStr, setDueDateStr] = useState<string>('');
  const [feeWarningNote, setFeeWarningNote] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      const [wList, tList] = await Promise.all([
        storageService.getWallets(),
        storageService.getTransactions(),
      ]);
      setWallets(wList);
      setTransactions(tList);
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu ví:', error);
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

  const getWalletFinancials = (w: Wallet) => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    let income = 0;
    let expense = 0;
    let monthExp = 0;

    for (const t of transactions) {
      if (t.wallet === w.name) {
        if (t.type === 'INCOME') {
          income += t.amount;
        } else {
          expense += t.amount;
          const tDate = new Date(t.date);
          if (
            tDate.getFullYear() === curYear &&
            tDate.getMonth() === curMonth
          ) {
            monthExp += t.amount;
          }
        }
      }
    }

    const isCreditOrPayLater = w.type === 'CREDIT_CARD' || w.type === 'PAYLATER';

    if (isCreditOrPayLater) {
      const initialDebt = w.currentBalance || 0;
      const effectiveDebt = Math.max(initialDebt + expense - income, 0);
      const limit = w.creditLimit || 0;
      const availableLimit = Math.max(limit - effectiveDebt, 0);
      const utilization = limit > 0 ? (effectiveDebt / limit) * 100 : 0;

      return {
        isCreditOrPayLater: true,
        effectiveDebt,
        availableLimit,
        limit,
        utilization,
        monthExp,
      };
    } else {
      const initialBal = w.balance || 0;
      const effectiveBalance = initialBal + income - expense;

      return {
        isCreditOrPayLater: false,
        effectiveBalance,
        monthExp,
      };
    }
  };

  let totalAvailableCash = 0;
  let totalDebt = 0;

  for (const w of wallets) {
    const fin = getWalletFinancials(w);
    if (fin.isCreditOrPayLater) {
      totalDebt += fin.effectiveDebt || 0;
    } else {
      totalAvailableCash += fin.effectiveBalance || 0;
    }
  }

  const handleOpenAddModal = (presetType: WalletType = 'CASH') => {
    setEditingWallet(null);
    setWalletName('');
    setWalletType(presetType);
    setSelectedColor(
      presetType === 'CREDIT_CARD'
        ? WALLET_DOT_COLORS[3]
        : presetType === 'PAYLATER'
        ? WALLET_DOT_COLORS[4]
        : presetType === 'BANK_EWALLET'
        ? WALLET_DOT_COLORS[0]
        : WALLET_DOT_COLORS[1]
    );
    setSelectedIcon(
      presetType === 'CREDIT_CARD'
        ? 'CreditCard'
        : presetType === 'PAYLATER'
        ? 'Zap'
        : presetType === 'BANK_EWALLET'
        ? 'Landmark'
        : 'Wallet'
    );
    setBalanceStr('0');
    setCreditLimitStr('');
    setCurrentBalanceStr('0');
    setStatementDateStr('');
    setDueDateStr('');
    setFeeWarningNote('');
    setModalVisible(true);
  };

  const handleOpenEditModal = (w: Wallet) => {
    setEditingWallet(w);
    setWalletName(w.name);
    setWalletType(w.type);
    setSelectedColor(w.colorGradient ? w.colorGradient[0] : WALLET_DOT_COLORS[0]);
    setSelectedIcon(w.icon || 'Wallet');
    setBalanceStr((w.balance || 0).toString());
    setCreditLimitStr(w.creditLimit ? w.creditLimit.toString() : '');
    setCurrentBalanceStr((w.currentBalance || 0).toString());
    setStatementDateStr(w.statementDate ? w.statementDate.toString() : '');
    setDueDateStr(w.dueDate ? w.dueDate.toString() : '');
    setFeeWarningNote(w.feeWarningNote || '');
    setModalVisible(true);
  };

  const handleSaveWallet = async () => {
    const trimmedName = walletName.trim();
    if (!trimmedName) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên ví / tài khoản');
      return;
    }

    const isCredit = walletType === 'CREDIT_CARD' || walletType === 'PAYLATER';

    try {
      if (editingWallet) {
        await storageService.updateWallet({
          ...editingWallet,
          name: trimmedName,
          type: walletType,
          icon: selectedIcon,
          colorGradient: [selectedColor, selectedColor],
          balance: !isCredit ? parseInt(balanceStr, 10) || 0 : undefined,
          creditLimit: isCredit ? parseInt(creditLimitStr, 10) || 0 : undefined,
          currentBalance: isCredit ? parseInt(currentBalanceStr, 10) || 0 : undefined,
          statementDate: isCredit ? parseInt(statementDateStr, 10) || undefined : undefined,
          dueDate: isCredit ? parseInt(dueDateStr, 10) || undefined : undefined,
          feeWarningNote: isCredit ? feeWarningNote.trim() || undefined : undefined,
        });
      } else {
        await storageService.addWallet({
          name: trimmedName,
          type: walletType,
          icon: selectedIcon,
          colorGradient: [selectedColor, selectedColor],
          balance: !isCredit ? parseInt(balanceStr, 10) || 0 : undefined,
          creditLimit: isCredit ? parseInt(creditLimitStr, 10) || 0 : undefined,
          currentBalance: isCredit ? parseInt(currentBalanceStr, 10) || 0 : undefined,
          statementDate: isCredit ? parseInt(statementDateStr, 10) || undefined : undefined,
          dueDate: isCredit ? parseInt(dueDateStr, 10) || undefined : undefined,
          feeWarningNote: isCredit ? feeWarningNote.trim() || undefined : undefined,
        });
      }

      setModalVisible(false);
      await loadData();
      onWalletsUpdated?.();
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu thông tin ví');
    }
  };

  const handleDeleteWallet = (w: Wallet) => {
    if (wallets.length <= 1) {
      Alert.alert('Không thể xóa', 'Bạn cần giữ lại ít nhất một ví');
      return;
    }

    Alert.alert(
      'Xóa ví / tài khoản',
      `Bạn có chắc chắn muốn xóa ví "${w.name}"? Dữ liệu lịch sử giao dịch liên quan vẫn được bảo lưu an toàn.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await storageService.deleteWallet(w.id);
              await loadData();
              onWalletsUpdated?.();
            } catch {
              Alert.alert('Lỗi', 'Không thể xóa ví');
            }
          },
        },
      ]
    );
  };

  const renderIcon = (iconName?: string, color: string = colors.textSecondary, size: number = 20) => {
    switch (iconName) {
      case 'Landmark':
        return <Landmark size={size} color={color} />;
      case 'PiggyBank':
        return <PiggyBank size={size} color={color} />;
      case 'CreditCard':
        return <CreditCard size={size} color={color} />;
      case 'Zap':
        return <Zap size={size} color={color} />;
      case 'Wallet':
      default:
        return <WalletIcon size={size} color={color} />;
    }
  };

  const getWalletTypeBadge = (type: WalletType) => {
    switch (type) {
      case 'CASH':
        return { label: 'Tiền mặt', color: colors.income };
      case 'BANK_EWALLET':
        return { label: 'Ngân hàng / Ví', color: colors.primaryLight };
      case 'CREDIT_CARD':
        return { label: 'Thẻ tín dụng', color: colors.expense };
      case 'PAYLATER':
        return { label: 'Mua trước trả sau', color: colors.warning };
    }
  };

  const filteredWallets = wallets.filter((w) => {
    const isCredit = w.type === 'CREDIT_CARD' || w.type === 'PAYLATER';
    if (filterMode === 'ASSETS') return !isCredit;
    if (filterMode === 'LIABILITIES') return isCredit;
    return true;
  });

  return (
    <View style={styles.container}>
      <ScrollView
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
        {/* Header màn hình */}
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.pageTitle}>Quản lý ví đa nguồn</Text>
            <Text style={styles.pageSubTitle}>
              Tiền mặt • Ngân hàng • Thẻ tín dụng • Trả sau
            </Text>
          </View>

          <TouchableOpacity
            style={styles.addWalletBtn}
            onPress={() => handleOpenAddModal('CASH')}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.addWalletBtnText}>Thêm ví</Text>
          </TouchableOpacity>
        </View>

        {/* Dashboard tóm tắt: Flat Matte Dark Solid Color */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryItem}>
            <View style={styles.summaryIconCash}>
              <CircleDollarSign size={16} color={colors.income} />
            </View>
            <View>
              <Text style={styles.summaryLabel}>TIỀN KHẢ DỤNG</Text>
              <Text style={styles.summaryValCash}>{formatVND(totalAvailableCash)}</Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <View style={styles.summaryIconDebt}>
              <AlertTriangle size={16} color={colors.expense} />
            </View>
            <View>
              <Text style={styles.summaryLabel}>TỔNG DƯ NỢ</Text>
              <Text style={styles.summaryValDebt}>{formatVND(totalDebt)}</Text>
            </View>
          </View>
        </View>

        {/* Segmented Filter */}
        <View style={styles.filterBar}>
          {(['ALL', 'ASSETS', 'LIABILITIES'] as const).map((mode) => {
            const isSelected = filterMode === mode;
            const label =
              mode === 'ALL'
                ? 'Tất cả nguồn'
                : mode === 'ASSETS'
                ? 'Khả dụng (Cash/Bank)'
                : 'Tín dụng & Trả sau';
            return (
              <TouchableOpacity
                key={mode}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => setFilterMode(mode)}
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

        {/* Danh sách thẻ ví: Flat Matte Dark Solid Color (Không Gradient) */}
        <View style={styles.cardsList}>
          {filteredWallets.map((w, index) => {
            const fin = getWalletFinancials(w);
            const badge = getWalletTypeBadge(w.type);
            const dotColor = w.colorGradient ? w.colorGradient[0] : colors.primary;

            return (
              <Animated.View
                key={w.id}
                entering={FadeInDown.delay(index * 60).duration(350)}
                style={styles.cardWrapper}
              >
                <View style={styles.cardInner}>
                  {/* Top: Icon + Tên + Chấm màu nhận diện (Badge Indicator) */}
                  <View style={styles.cardTopRow}>
                    <View style={styles.cardIconAndName}>
                      <View style={styles.iconBadge}>
                        {renderIcon(w.icon, colors.textPrimary, 18)}
                      </View>
                      <View>
                        <View style={styles.nameRow}>
                          <View style={[styles.dotIndicator, { backgroundColor: dotColor }]} />
                          <Text style={styles.cardWalletName}>{w.name}</Text>
                        </View>
                        <Text style={[styles.typeBadgeText, { color: badge.color }]}>
                          {badge.label}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={styles.cardActionIconBtn}
                        onPress={() => handleOpenEditModal(w)}
                        activeOpacity={0.7}
                      >
                        <Pencil size={14} color={colors.textSecondary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.cardActionIconBtn}
                        onPress={() => handleDeleteWallet(w)}
                        activeOpacity={0.7}
                      >
                        <Trash size={14} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Body tùy theo loại ví */}
                  {fin.isCreditOrPayLater ? (
                    <View style={styles.creditBody}>
                      <View style={styles.creditMainStats}>
                        <View>
                          <Text style={styles.statSubLabel}>DƯ NỢ HIỆN TẠI</Text>
                          <Text style={styles.debtAmountValue}>
                            {formatVND(fin.effectiveDebt || 0)}
                          </Text>
                        </View>

                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.statSubLabel}>HẠN MỨC CÒN LẠI</Text>
                          <Text style={styles.availableLimitValue}>
                            {formatVND(fin.availableLimit || 0)}
                          </Text>
                        </View>
                      </View>

                      {/* Progress bar mức độ sử dụng hạn mức */}
                      <View style={styles.limitProgressSection}>
                        <View style={styles.limitTrack}>
                          <View
                            style={[
                              styles.limitFill,
                              {
                                width: `${Math.min(fin.utilization || 0, 100)}%`,
                                backgroundColor:
                                  (fin.utilization || 0) > 80
                                    ? colors.expense
                                    : (fin.utilization || 0) > 50
                                    ? colors.warning
                                    : colors.primary,
                              },
                            ]}
                          />
                        </View>
                        <View style={styles.limitLabelsRow}>
                          <Text style={styles.limitLabelLeft}>
                            Đã dùng {(fin.utilization || 0).toFixed(0)}%
                          </Text>
                          <Text style={styles.limitLabelRight}>
                            Hạn mức: {formatVND(fin.limit || 0)}
                          </Text>
                        </View>
                      </View>

                      {/* Thông tin chu kỳ sao kê & thanh toán */}
                      <View style={styles.cycleInfoRow}>
                        {w.statementDate ? (
                          <View style={styles.cycleBadge}>
                            <Calendar size={11} color={colors.textSecondary} style={{ marginRight: 4 }} />
                            <Text style={styles.cycleBadgeText}>
                              Sao kê: ngày {w.statementDate}
                            </Text>
                          </View>
                        ) : null}

                        {w.dueDate ? (
                          <View style={styles.cycleBadge}>
                            <Calendar size={11} color={colors.warning} style={{ marginRight: 4 }} />
                            <Text style={[styles.cycleBadgeText, { color: colors.warning }]}>
                              Hạn TT: ngày {w.dueDate}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Ghi chú cảnh báo phí duy trì */}
                      {w.feeWarningNote ? (
                        <View style={styles.feeWarningBox}>
                          <Info size={12} color={colors.warning} style={{ marginRight: 5 }} />
                          <Text style={styles.feeWarningText} numberOfLines={2}>
                            {w.feeWarningNote}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <View style={styles.cashBody}>
                      <Text style={styles.statSubLabel}>SỐ DƯ KHẢ DỤNG</Text>
                      <Text
                        style={[
                          styles.cashAmountValue,
                          (fin.effectiveBalance || 0) < 0 && { color: colors.expense },
                        ]}
                      >
                        {formatVND(fin.effectiveBalance || 0)}
                      </Text>

                      <View style={styles.cashFooterRow}>
                        <View style={styles.cashFooterItem}>
                          <TrendingDown size={12} color={colors.expense} style={{ marginRight: 4 }} />
                          <Text style={styles.cashFooterLabel}>Chi tháng này:</Text>
                          <Text style={styles.cashFooterVal}>{formatVND(fin.monthExp)}</Text>
                        </View>
                        <Text style={styles.cashGocLabel}>
                          Gốc: {formatVND(w.balance || 0)}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>

      {/* Modal Thêm / Chỉnh Sửa Ví */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalBox}>
              <View style={styles.modalBoxHeader}>
                <Text style={styles.modalBoxTitle}>
                  {editingWallet ? 'Chỉnh sửa ví' : 'Thêm ví mới'}
                </Text>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Bộ chọn loại ví 4 danh mục */}
              <Text style={styles.fieldLabel}>Phân loại nguồn tiền *</Text>
              <View style={styles.typeSelectorGrid}>
                {[
                  { key: 'CASH', label: 'Tiền mặt', icon: WalletIcon },
                  { key: 'BANK_EWALLET', label: 'Ngân hàng / Ví', icon: Landmark },
                  { key: 'CREDIT_CARD', label: 'Thẻ tín dụng', icon: CreditCard },
                  { key: 'PAYLATER', label: 'Mua trước trả sau', icon: Zap },
                ].map((item) => {
                  const isSelected = walletType === item.key;
                  const IconComp = item.icon;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[
                        styles.typeGridBtn,
                        isSelected && styles.typeGridBtnSelected,
                      ]}
                      onPress={() => setWalletType(item.key as WalletType)}
                      activeOpacity={0.7}
                    >
                      <IconComp
                        size={16}
                        color={isSelected ? colors.primaryBright : colors.textMuted}
                        style={{ marginBottom: 4 }}
                      />
                      <Text
                        style={[
                          styles.typeGridLabel,
                          isSelected && styles.typeGridLabelSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Tên ví */}
              <Text style={styles.fieldLabel}>Tên ví / Tài khoản *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="VD: Techcombank, Shopee SPayLater, Visa Signature..."
                placeholderTextColor={colors.textMuted}
                value={walletName}
                onChangeText={setWalletName}
              />

              {/* Form tùy biến theo Loại ví */}
              {walletType === 'CREDIT_CARD' || walletType === 'PAYLATER' ? (
                <View style={styles.conditionalSection}>
                  <Text style={styles.fieldLabel}>Hạn mức tối đa được cấp (VNĐ) *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="VD: 10.000.000"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={creditLimitStr}
                    onChangeText={setCreditLimitStr}
                  />

                  <Text style={styles.fieldLabel}>Dư nợ ban đầu (Số tiền đang nợ) *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={currentBalanceStr}
                    onChangeText={setCurrentBalanceStr}
                  />

                  <View style={styles.dualFieldRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Ngày chốt sao kê (1-31)</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="VD: 25"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        maxLength={2}
                        value={statementDateStr}
                        onChangeText={setStatementDateStr}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Ngày đến hạn thanh toán</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="VD: 10"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        maxLength={2}
                        value={dueDateStr}
                        onChangeText={setDueDateStr}
                      />
                    </View>
                  </View>

                  <Text style={styles.fieldLabel}>Ghi chú phí duy trì / Lưu ý</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="VD: Phí 30k/tháng nếu có giao dịch, miễn lãi 45 ngày..."
                    placeholderTextColor={colors.textMuted}
                    value={feeWarningNote}
                    onChangeText={setFeeWarningNote}
                  />
                </View>
              ) : (
                <View style={styles.conditionalSection}>
                  <Text style={styles.fieldLabel}>Số dư khả dụng ban đầu (VNĐ) *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="VD: 5.000.000"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={balanceStr}
                    onChangeText={setBalanceStr}
                  />
                </View>
              )}

              {/* Chấm màu nhận diện */}
              <Text style={styles.fieldLabel}>Chấm màu nhận diện</Text>
              <View style={styles.colorDotRow}>
                {WALLET_DOT_COLORS.map((color) => {
                  const isSelected = selectedColor === color;
                  return (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorDot,
                        { backgroundColor: color },
                        isSelected && styles.colorDotSelected,
                      ]}
                      onPress={() => setSelectedColor(color)}
                      activeOpacity={0.7}
                    />
                  );
                })}
              </View>

              {/* Nút hành động */}
              <View style={styles.modalActionButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>Hủy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={handleSaveWallet}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmBtnText}>Lưu ví</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
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
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
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
  addWalletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    elevation: 2,
  },
  addWalletBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  summaryBox: {
    flexDirection: 'row',
    backgroundColor: colors.surface, // Solid Flat Matte Dark
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryIconCash: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.incomeSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryIconDebt: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.expenseSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
  summaryValCash: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.income,
    marginTop: 2,
  },
  summaryValDebt: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.expense,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
    marginHorizontal: 10,
  },
  filterBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
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
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: colors.primaryBright,
    fontWeight: '700',
  },
  cardsList: {
    gap: 12,
  },
  cardWrapper: {
    backgroundColor: colors.surface, // Solid Flat Matte Dark #161926
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardInner: {
    padding: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardIconAndName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardWalletName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  cardActionIconBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statSubLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  cashBody: {
    marginTop: 12,
  },
  cashAmountValue: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: 2,
    letterSpacing: -0.5,
  },
  cashFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: colors.surfaceGlass,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cashFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cashFooterLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginRight: 4,
  },
  cashFooterVal: {
    fontSize: 11,
    color: colors.expense,
    fontWeight: '700',
  },
  cashGocLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  creditBody: {
    marginTop: 12,
  },
  creditMainStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  debtAmountValue: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.expense,
    marginTop: 2,
  },
  availableLimitValue: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  limitProgressSection: {
    marginTop: 10,
  },
  limitTrack: {
    height: 6,
    backgroundColor: colors.track,
    borderRadius: 3,
    overflow: 'hidden',
  },
  limitFill: {
    height: '100%',
    borderRadius: 3,
  },
  limitLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  limitLabelLeft: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  limitLabelRight: {
    fontSize: 10,
    color: colors.textMuted,
  },
  cycleInfoRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  cycleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cycleBadgeText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  feeWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginTop: 8,
  },
  feeWarningText: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: '500',
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 16,
  },
  modalScroll: {
    paddingVertical: 20,
  },
  modalBox: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalBoxTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 10,
    marginBottom: 6,
  },
  typeSelectorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  typeGridBtn: {
    width: '48.5%',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  typeGridBtnSelected: {
    borderColor: colors.primaryBright,
    backgroundColor: colors.primarySoft,
  },
  typeGridLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    textAlign: 'center',
  },
  typeGridLabelSelected: {
    color: colors.primaryBright,
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: colors.textPrimary,
  },
  conditionalSection: {
    gap: 4,
  },
  dualFieldRow: {
    flexDirection: 'row',
    gap: 10,
  },
  colorDotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.track,
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
