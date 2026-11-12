import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import {
  Wallet as WalletIcon,
  Landmark,
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
  ChevronRight,
  Smartphone,
  Check,
  Building2,
} from 'lucide-react-native';
import { Transaction, Wallet, WalletType } from '../types';
import { storageService } from '../services/storage';
import { formatVND } from '../utils/format';
import { colors } from '../theme/colors';
import { WalletLogo } from '../components/WalletLogo';
import { LogoPickerModal } from '../components/LogoPickerModal';
import { CurrencyInput } from '../components/CurrencyInput';
import { WalletFilterTabs, WalletFilterMode } from '../components/WalletFilterTabs';
import { CustomDatePicker } from '../components/CustomDatePicker';
import {
  BANK_LOGOS,
  EWALLET_LOGOS,
  getLogoById,
  WalletLogoItem,
} from '../constants/logos';
import { usePopup } from '../context/PopupContext';

interface WalletsScreenProps {
  onWalletsUpdated?: () => void;
}

export const WalletsScreen: React.FC<WalletsScreenProps> = ({ onWalletsUpdated }) => {
  const { showPopup, showConfirm } = usePopup();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filterMode, setFilterMode] = useState<WalletFilterMode>('ALL');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Modal State
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [logoPickerVisible, setLogoPickerVisible] = useState<boolean>(false);

  // Form Fields
  const [walletName, setWalletName] = useState<string>('');
  const [walletType, setWalletType] = useState<WalletType>('CASH');
  const [selectedLogoId, setSelectedLogoId] = useState<string | undefined>(undefined);
  const [ewalletSubtype, setEwalletSubtype] = useState<'BALANCE' | 'PAYLATER'>('BALANCE');
  const [selectedIcon, setSelectedIcon] = useState<string>('Wallet');

  // Fields for CASH & BANK_EWALLET & BALANCE e-wallet
  const [balance, setBalance] = useState<number | undefined>(undefined);

  // Fields for CREDIT_CARD & PAYLATER
  const [creditLimit, setCreditLimit] = useState<number | undefined>(undefined);
  const [currentBalance, setCurrentBalance] = useState<number | undefined>(undefined);
  const [statementDateStr, setStatementDateStr] = useState<string>('');
  const [dueDateStr, setDueDateStr] = useState<string>('');
  const [feeWarningNote, setFeeWarningNote] = useState<string>('');
  const [dayPickerTarget, setDayPickerTarget] = useState<'STATEMENT' | 'DUE' | null>(null);

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

    const isCreditOrPayLater =
      w.type === 'CREDIT_CARD' ||
      (w.type === 'PAYLATER' && ((w.creditLimit || 0) > 0 || (w.currentBalance || 0) > 0));

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
    setSelectedLogoId(undefined);
    setEwalletSubtype('BALANCE');
    setSelectedIcon(
      presetType === 'CREDIT_CARD'
        ? 'CreditCard'
        : presetType === 'PAYLATER'
        ? 'Smartphone'
        : presetType === 'BANK_EWALLET'
        ? 'Landmark'
        : 'Wallet'
    );
    setBalance(undefined);
    setCreditLimit(undefined);
    setCurrentBalance(undefined);
    setStatementDateStr('');
    setDueDateStr('');
    setFeeWarningNote('');
    setModalVisible(true);
  };

  const handleOpenEditModal = (w: Wallet) => {
    setEditingWallet(w);
    setWalletName(w.name);
    setWalletType(w.type);
    const matched = getLogoById(w.logoId || w.icon);
    setSelectedLogoId(matched ? matched.id : undefined);
    setSelectedIcon(w.icon || 'Wallet');
    setEwalletSubtype(
      (w.creditLimit || 0) > 0 || (w.currentBalance || 0) > 0 ? 'PAYLATER' : 'BALANCE'
    );
    setBalance(w.balance);
    setCreditLimit(w.creditLimit);
    setCurrentBalance(w.currentBalance);
    setStatementDateStr(w.statementDate ? w.statementDate.toString() : '');
    setDueDateStr(w.dueDate ? w.dueDate.toString() : '');
    setFeeWarningNote(w.feeWarningNote || '');
    setModalVisible(true);
  };

  const handleSelectLogo = (logo: WalletLogoItem | null) => {
    if (logo) {
      setSelectedLogoId(logo.id);
      setSelectedIcon(logo.id);
      if (
        !walletName.trim() ||
        walletName === 'Ngân hàng' ||
        walletName === 'Ví mới' ||
        walletName === 'Ví điện tử'
      ) {
        setWalletName(logo.name);
      }
    } else {
      setSelectedLogoId(undefined);
      setSelectedIcon(
        walletType === 'CREDIT_CARD'
          ? 'CreditCard'
          : walletType === 'PAYLATER'
          ? 'Smartphone'
          : walletType === 'BANK_EWALLET'
          ? 'Landmark'
          : 'Wallet'
      );
    }
  };

  const handleSaveWallet = async () => {
    const trimmedName = walletName.trim();
    if (!trimmedName) {
      showPopup({
        type: 'WARNING',
        title: 'Thiếu thông tin',
        message: 'Vui lòng nhập tên ví / tài khoản',
      });
      return;
    }

    const isCredit =
      walletType === 'CREDIT_CARD' ||
      (walletType === 'PAYLATER' && ewalletSubtype === 'PAYLATER');

    const defaultAccent =
      walletType === 'CREDIT_CARD'
        ? '#F43F5E'
        : walletType === 'PAYLATER'
        ? '#F59E0B'
        : walletType === 'BANK_EWALLET'
        ? '#8B5CF6'
        : '#34D399';

    const chosenColor = editingWallet?.colorGradient?.[0] || defaultAccent;

    try {
      const walletPayload = {
        name: trimmedName,
        type: walletType,
        icon: selectedLogoId || selectedIcon,
        logoId: selectedLogoId,
        colorGradient: [chosenColor, chosenColor] as [string, string],
        balance: !isCredit ? (balance ?? 0) : undefined,
        creditLimit: isCredit ? (creditLimit ?? 0) : undefined,
        currentBalance: isCredit ? (currentBalance ?? 0) : undefined,
        statementDate: isCredit ? parseInt(statementDateStr, 10) || undefined : undefined,
        dueDate: isCredit ? parseInt(dueDateStr, 10) || undefined : undefined,
        feeWarningNote: isCredit ? feeWarningNote.trim() || undefined : undefined,
      };

      if (editingWallet) {
        await storageService.updateWallet({
          ...editingWallet,
          ...walletPayload,
        });
      } else {
        await storageService.addWallet(walletPayload);
      }

      setModalVisible(false);
      await loadData();
      onWalletsUpdated?.();
    } catch {
      showPopup({
        type: 'ERROR',
        title: 'Lỗi',
        message: 'Không thể lưu thông tin ví. Vui lòng thử lại.',
      });
    }
  };

  const handleDeleteWallet = (w: Wallet) => {
    if (wallets.length <= 1) {
      showPopup({
        type: 'WARNING',
        title: 'Không thể xóa',
        message: 'Bạn cần giữ lại ít nhất một ví để ghi nhận các giao dịch.',
      });
      return;
    }

    showConfirm({
      type: 'DANGER',
      title: 'Xóa ví / tài khoản',
      message: `Bạn có chắc chắn muốn xóa ví "${w.name}"? Dữ liệu lịch sử giao dịch liên quan vẫn được bảo lưu an toàn.`,
      confirmText: 'Xóa ví',
      cancelText: 'Hủy',
      onConfirm: async () => {
        try {
          await storageService.deleteWallet(w.id);
          await loadData();
          onWalletsUpdated?.();
        } catch {
          showPopup({
            type: 'ERROR',
            title: 'Lỗi',
            message: 'Không thể xóa ví. Vui lòng thử lại.',
          });
        }
      },
    });
  };

  const getWalletTypeBadge = (type: WalletType) => {
    switch (type) {
      case 'CASH':
        return { label: 'Tiền mặt', color: colors.income };
      case 'BANK_EWALLET':
        return { label: 'Ngân hàng', color: colors.primaryLight };
      case 'CREDIT_CARD':
        return { label: 'Thẻ tín dụng', color: colors.expense };
      case 'PAYLATER':
        return { label: 'Ví điện tử', color: colors.warning };
    }
  };

  const filteredWallets = wallets.filter((w) => {
    const fin = getWalletFinancials(w);
    if (filterMode === 'ASSETS') return !fin.isCreditOrPayLater;
    if (filterMode === 'LIABILITIES') return fin.isCreditOrPayLater;
    return true;
  });

  const popularLogos = useMemo(() => {
    if (walletType === 'PAYLATER') {
      return EWALLET_LOGOS.slice(0, 10);
    }
    return BANK_LOGOS.slice(0, 10);
  }, [walletType]);

  const selectedLogoObject = useMemo(() => {
    return getLogoById(selectedLogoId);
  }, [selectedLogoId]);

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
          <View style={styles.topHeaderTitleCol}>
            <Text style={styles.pageTitle} numberOfLines={1}>
              Quản lý ví
            </Text>
            <Text style={styles.pageSubTitle} numberOfLines={1}>
              Tiền mặt • Ngân hàng • Thẻ • Ví điện tử
            </Text>
          </View>

          <TouchableOpacity
            style={styles.addWalletBtn}
            onPress={() => handleOpenAddModal('CASH')}
            activeOpacity={0.8}
          >
            <Plus size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.addWalletBtnText}>Thêm ví</Text>
          </TouchableOpacity>
        </View>

        {/* Dashboard tóm tắt: An toàn tuyệt đối không vỡ dòng */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryItem}>
            <View style={styles.summaryIconCash}>
              <CircleDollarSign size={16} color={colors.income} />
            </View>
            <View style={styles.summaryTextCol}>
              <Text style={styles.summaryLabel} numberOfLines={1}>
                TIỀN KHẢ DỤNG
              </Text>
              <Text
                style={styles.summaryValCash}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {formatVND(totalAvailableCash)}
              </Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <View style={styles.summaryIconDebt}>
              <AlertTriangle size={16} color={colors.expense} />
            </View>
            <View style={styles.summaryTextCol}>
              <Text style={styles.summaryLabel} numberOfLines={1}>
                TỔNG DƯ NỢ
              </Text>
              <Text
                style={styles.summaryValDebt}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {formatVND(totalDebt)}
              </Text>
            </View>
          </View>
        </View>

        {/* Segmented Filter: Gooey Liquid Stretch & Slide */}
        <WalletFilterTabs
          filterMode={filterMode}
          onChangeFilterMode={setFilterMode}
        />

        {/* Danh sách thẻ ví: Flat Matte Dark Solid Color */}
        <View style={styles.cardsList}>
          {filteredWallets.map((w, index) => {
            const fin = getWalletFinancials(w);
            const badge = getWalletTypeBadge(w.type);
            const dotColor = w.colorGradient ? w.colorGradient[0] : colors.primary;

            return (
              <Animated.View
                key={`${filterMode}-${w.id}`}
                entering={FadeInDown.delay(Math.min(index * 40, 160)).duration(260)}
                layout={LinearTransition.springify().damping(18).stiffness(140)}
                style={styles.cardWrapper}
              >
                <View style={styles.cardInner}>
                  {/* Top: Logo SVG thương hiệu + Tên + Action Buttons */}
                  <View style={styles.cardTopRow}>
                    <View style={styles.cardIconAndName}>
                      <WalletLogo
                        logoId={w.logoId || w.icon}
                        icon={w.icon}
                        name={w.name}
                        type={w.type}
                        size={24}
                        containerSize={40}
                        containerBg="#0F111A"
                        borderColor="rgba(255, 255, 255, 0.08)"
                      />
                      <View style={styles.cardTitleCol}>
                        <View style={styles.nameRow}>
                          <View style={[styles.dotIndicator, { backgroundColor: dotColor }]} />
                          <Text style={styles.cardWalletName} numberOfLines={1}>
                            {w.name}
                          </Text>
                        </View>
                        <Text style={[styles.typeBadgeText, { color: badge.color }]} numberOfLines={1}>
                          {badge.label}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={styles.cardActionIconBtn}
                        onPress={() => handleOpenEditModal(w)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Pencil size={13} color={colors.textSecondary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.cardActionIconBtn}
                        onPress={() => handleDeleteWallet(w)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Trash size={13} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Body tùy theo loại ví */}
                  {fin.isCreditOrPayLater ? (
                    <View style={styles.creditBody}>
                      <View style={styles.creditMainStats}>
                        <View style={styles.creditStatColLeft}>
                          <Text style={styles.statSubLabel} numberOfLines={1}>
                            DƯ NỢ HIỆN TẠI
                          </Text>
                          <Text
                            style={styles.debtAmountValue}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.75}
                          >
                            {formatVND(fin.effectiveDebt || 0)}
                          </Text>
                        </View>

                        <View style={styles.creditStatColRight}>
                          <Text style={styles.statSubLabel} numberOfLines={1}>
                            HẠN MỨC CÒN LẠI
                          </Text>
                          <Text
                            style={styles.availableLimitValue}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.75}
                          >
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
                          <Text style={styles.limitLabelLeft} numberOfLines={1}>
                            Đã dùng {(fin.utilization || 0).toFixed(0)}%
                          </Text>
                          <Text style={styles.limitLabelRight} numberOfLines={1}>
                            Hạn mức: {formatVND(fin.limit || 0)}
                          </Text>
                        </View>
                      </View>

                      {/* Thông tin chu kỳ sao kê & thanh toán */}
                      <View style={styles.cycleInfoRow}>
                        {w.statementDate ? (
                          <View style={styles.cycleBadge}>
                            <Calendar size={10} color={colors.textSecondary} style={{ marginRight: 3 }} />
                            <Text style={styles.cycleBadgeText}>
                              Sao kê: ngày {w.statementDate}
                            </Text>
                          </View>
                        ) : null}

                        {w.dueDate ? (
                          <View style={styles.cycleBadge}>
                            <Calendar size={10} color={colors.warning} style={{ marginRight: 3 }} />
                            <Text style={[styles.cycleBadgeText, { color: colors.warning }]}>
                              Hạn trả: ngày {w.dueDate}
                            </Text>
                          </View>
                        ) : null}

                        <View style={styles.cycleBadge}>
                          <TrendingDown size={10} color={colors.expense} style={{ marginRight: 3 }} />
                          <Text style={styles.cycleBadgeText}>
                            Chi tháng: {formatVND(fin.monthExp)}
                          </Text>
                        </View>
                      </View>

                      {/* Ghi chú cảnh báo phí nếu có */}
                      {w.feeWarningNote ? (
                        <View style={styles.feeWarningBox}>
                          <Info size={11} color={colors.warning} style={{ marginRight: 5 }} />
                          <Text style={styles.feeWarningText} numberOfLines={2}>
                            {w.feeWarningNote}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <View style={styles.cashBody}>
                      <Text style={styles.statSubLabel}>SỐ DƯ HIỆN TẠI</Text>
                      <Text
                        style={styles.cashAmountValue}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                      >
                        {formatVND(fin.effectiveBalance || 0)}
                      </Text>

                      <View style={styles.cashFooterRow}>
                        <View style={styles.cashFooterItem}>
                          <TrendingDown size={11} color={colors.expense} style={{ marginRight: 3 }} />
                          <Text style={styles.cashFooterLabel}>Chi tháng:</Text>
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
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalBox}>
              <View style={styles.modalBoxHeader}>
                <Text style={styles.modalBoxTitle}>
                  {editingWallet ? 'Chỉnh sửa ví' : 'Thêm ví mới'}
                </Text>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Bộ chọn loại ví: Dạng 2 hàng x 2 cột ổn định tuyệt đối */}
              <Text style={styles.fieldLabel}>Phân loại nguồn tiền *</Text>
              <View style={styles.typeSelectorRow}>
                {[
                  { key: 'CASH', label: 'Tiền mặt', icon: WalletIcon },
                  { key: 'BANK_EWALLET', label: 'Ngân hàng', icon: Landmark },
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
                      onPress={() => {
                        const newType = item.key as WalletType;
                        setWalletType(newType);
                        if (newType === 'CASH') {
                          setSelectedLogoId(undefined);
                          setSelectedIcon('Wallet');
                        }
                      }}
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
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={[styles.typeSelectorRow, { marginTop: 6 }]}>
                {[
                  { key: 'CREDIT_CARD', label: 'Thẻ tín dụng', icon: CreditCard },
                  { key: 'PAYLATER', label: 'Ví điện tử', icon: Smartphone },
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
                      onPress={() => {
                        const newType = item.key as WalletType;
                        setWalletType(newType);
                      }}
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
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Tùy chọn Logo thương hiệu (Không đóng khung lồng khung) */}
              {walletType !== 'CASH' && (
                <View style={styles.logoRowContainer}>
                  <Text style={styles.fieldLabel}>Logo thương hiệu</Text>

                  {/* Thanh chọn logo dạng dropdown đơn nhất (không lồng viền) */}
                  <TouchableOpacity
                    style={styles.logoPickerRow}
                    onPress={() => setLogoPickerVisible(true)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.logoPickerLeft}>
                      {selectedLogoId ? (
                        <WalletLogo
                          logoId={selectedLogoId}
                          name={walletName}
                          type={walletType}
                          size={24}
                        />
                      ) : (
                        <View style={styles.logoPlaceholderCircle}>
                          <Building2 size={15} color={colors.textMuted} />
                        </View>
                      )}
                      <Text
                        style={[
                          styles.logoPickerName,
                          !selectedLogoObject && styles.logoPickerPlaceholder,
                        ]}
                        numberOfLines={1}
                      >
                        {selectedLogoObject
                          ? selectedLogoObject.name
                          : 'Chọn logo thương hiệu (84 logo)'}
                      </Text>
                    </View>

                    <View style={styles.logoPickerRight}>
                      <Text style={styles.logoPickerActionText}>
                        {selectedLogoId ? 'Đổi logo' : 'Duyệt'}
                      </Text>
                      <ChevronRight size={14} color={colors.primaryBright} />
                    </View>
                  </TouchableOpacity>

                  {/* Danh sách logo phổ biến gợi ý nhanh */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.quickLogoScroll}
                  >
                    {popularLogos.map((logo) => {
                      const isSel = selectedLogoId === logo.id;
                      return (
                        <TouchableOpacity
                          key={logo.id}
                          style={[
                            styles.quickLogoChip,
                            isSel && styles.quickLogoChipSelected,
                          ]}
                          onPress={() => handleSelectLogo(logo)}
                          activeOpacity={0.7}
                        >
                          <SvgXml xml={logo.xml} width={18} height={18} />
                          <Text
                            style={[
                              styles.quickLogoChipText,
                              isSel && styles.quickLogoChipTextSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {logo.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Tên ví */}
              <Text style={styles.fieldLabel}>Tên ví / Tài khoản *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="VD: Techcombank, MoMo, Visa Signature..."
                placeholderTextColor={colors.textMuted}
                value={walletName}
                onChangeText={setWalletName}
              />

              {/* Tùy biến hình thức cho Ví điện tử (Số dư vs Trả sau) */}
              {walletType === 'PAYLATER' && (
                <View style={{ marginTop: 6 }}>
                  <Text style={styles.fieldLabel}>Hình thức ví điện tử *</Text>
                  <View style={styles.ewalletSubtypeRow}>
                    <TouchableOpacity
                      style={[
                        styles.ewalletSubtypeBtn,
                        ewalletSubtype === 'BALANCE' && styles.ewalletSubtypeBtnActive,
                      ]}
                      onPress={() => setEwalletSubtype('BALANCE')}
                      activeOpacity={0.7}
                    >
                      <CircleDollarSign
                        size={14}
                        color={ewalletSubtype === 'BALANCE' ? colors.income : colors.textMuted}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.ewalletSubtypeText,
                          ewalletSubtype === 'BALANCE' && styles.ewalletSubtypeTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        Ví số dư
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.ewalletSubtypeBtn,
                        ewalletSubtype === 'PAYLATER' && styles.ewalletSubtypeBtnActive,
                      ]}
                      onPress={() => setEwalletSubtype('PAYLATER')}
                      activeOpacity={0.7}
                    >
                      <Zap
                        size={14}
                        color={ewalletSubtype === 'PAYLATER' ? colors.warning : colors.textMuted}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.ewalletSubtypeText,
                          ewalletSubtype === 'PAYLATER' && styles.ewalletSubtypeTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        Ví trả sau
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Form số tiền sử dụng CurrencyInput (Tự động định dạng dấu chấm) */}
              {walletType === 'CREDIT_CARD' ||
              (walletType === 'PAYLATER' && ewalletSubtype === 'PAYLATER') ? (
                <View style={styles.conditionalSection}>
                  <Text style={styles.fieldLabel}>Hạn mức tối đa được cấp *</Text>
                  <CurrencyInput
                    value={creditLimit}
                    onChangeValue={setCreditLimit}
                    placeholder="VD: 10,000,000"
                  />

                  <Text style={styles.fieldLabel}>Dư nợ ban đầu (Số tiền đang nợ) *</Text>
                  <CurrencyInput
                    value={currentBalance}
                    onChangeValue={setCurrentBalance}
                    placeholder="0"
                  />

                  <View style={styles.dualFieldRow}>
                    <View style={styles.dualFieldCol}>
                      <Text style={styles.fieldLabel} numberOfLines={1}>
                        Ngày chốt sao kê
                      </Text>
                      <TouchableOpacity
                        style={styles.dayPickerButton}
                        onPress={() => setDayPickerTarget('STATEMENT')}
                        activeOpacity={0.7}
                      >
                        <Calendar size={16} color={statementDateStr ? '#C084FC' : '#94A3B8'} style={{ marginRight: 6 }} />
                        <Text
                          style={[
                            styles.dayPickerText,
                            !!statementDateStr && styles.dayPickerTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {statementDateStr ? `Ngày ${statementDateStr}` : 'Chọn ngày'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.dualFieldCol}>
                      <Text style={styles.fieldLabel} numberOfLines={1}>
                        Hạn thanh toán
                      </Text>
                      <TouchableOpacity
                        style={styles.dayPickerButton}
                        onPress={() => setDayPickerTarget('DUE')}
                        activeOpacity={0.7}
                      >
                        <Calendar size={16} color={dueDateStr ? '#C084FC' : '#94A3B8'} style={{ marginRight: 6 }} />
                        <Text
                          style={[
                            styles.dayPickerText,
                            !!dueDateStr && styles.dayPickerTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {dueDateStr ? `Ngày ${dueDateStr}` : 'Chọn ngày'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.fieldLabel}>Ghi chú phí duy trì / Lưu ý</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="VD: Phí 30k/tháng nếu có giao dịch..."
                    placeholderTextColor={colors.textMuted}
                    value={feeWarningNote}
                    onChangeText={setFeeWarningNote}
                  />
                </View>
              ) : (
                <View style={styles.conditionalSection}>
                  <Text style={styles.fieldLabel}>Số dư khả dụng ban đầu *</Text>
                  <CurrencyInput
                    value={balance}
                    onChangeValue={setBalance}
                    placeholder="0"
                  />
                </View>
              )}

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

      {/* Modal Chọn Logo Thương Hiệu Toàn Diện */}
      <LogoPickerModal
        visible={logoPickerVisible}
        walletType={walletType}
        selectedLogoId={selectedLogoId}
        onClose={() => setLogoPickerVisible(false)}
        onSelectLogo={handleSelectLogo}
      />

      {/* Modal Chọn Ngày Trong Tháng (Sao kê / Đến hạn) */}
      <CustomDatePicker
        visible={dayPickerTarget !== null}
        onClose={() => setDayPickerTarget(null)}
        mode="DAY_OF_MONTH"
        title={
          dayPickerTarget === 'STATEMENT'
            ? 'Chọn ngày chốt sao kê'
            : 'Chọn ngày đến hạn thanh toán'
        }
        value={
          dayPickerTarget === 'STATEMENT'
            ? parseInt(statementDateStr, 10) || 25
            : parseInt(dueDateStr, 10) || 10
        }
        onConfirm={(day: number) => {
          if (dayPickerTarget === 'STATEMENT') {
            setStatementDateStr(day.toString());
          } else {
            setDueDateStr(day.toString());
          }
          setDayPickerTarget(null);
        }}
      />
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
    marginBottom: 12,
  },
  topHeaderTitleCol: {
    flex: 1,
    marginRight: 10,
    minWidth: 0,
  },
  pageTitle: {
    fontSize: 21, // Tăng thêm 1 size
    fontWeight: '800',
    color: colors.textPrimary,
  },
  pageSubTitle: {
    fontSize: 13, // Tăng thêm 1 size
    color: colors.textSecondary,
    marginTop: 2,
  },
  addWalletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    flexShrink: 0,
  },
  addWalletBtnText: {
    color: '#FFFFFF',
    fontSize: 14, // Tăng thêm 1 size
    fontWeight: '700',
  },
  summaryBox: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  summaryIconCash: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.incomeSoft,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  summaryIconDebt: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.expenseSoft,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  summaryTextCol: {
    flex: 1,
    minWidth: 0,
  },
  summaryLabel: {
    fontSize: 11, // Tăng thêm 1 size
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  summaryValCash: {
    fontSize: 14, // Tăng thêm 1 size
    fontWeight: '800',
    color: colors.income,
    marginTop: 1,
  },
  summaryValDebt: {
    fontSize: 14, // Tăng thêm 1 size
    fontWeight: '800',
    color: colors.expense,
    marginTop: 1,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
    marginHorizontal: 8,
    flexShrink: 0,
  },
  cardsList: {
    gap: 10,
  },
  cardWrapper: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardInner: {
    padding: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardIconAndName: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 8,
    minWidth: 0,
  },
  cardTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  dotIndicator: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    flexShrink: 0,
  },
  cardWalletName: {
    fontSize: 16, // Tăng thêm 1 size
    fontWeight: '800',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  typeBadgeText: {
    fontSize: 12, // Tăng thêm 1 size
    fontWeight: '600',
    marginTop: 1,
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0,
  },
  cardActionIconBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statSubLabel: {
    fontSize: 11, // Tăng thêm 1 size
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
  cashBody: {
    marginTop: 10,
  },
  cashAmountValue: {
    fontSize: 22, // Tăng thêm 1 size
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: 2,
    letterSpacing: -0.5,
  },
  cashFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: colors.surfaceGlass,
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    flexWrap: 'wrap',
    gap: 6,
  },
  cashFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    flexShrink: 1,
  },
  cashFooterLabel: {
    fontSize: 12, // Tăng thêm 1 size
    color: colors.textMuted,
    marginRight: 3,
  },
  cashFooterVal: {
    fontSize: 12, // Tăng thêm 1 size
    color: colors.expense,
    fontWeight: '700',
  },
  cashGocLabel: {
    fontSize: 12, // Tăng thêm 1 size
    color: colors.textSecondary,
    fontWeight: '600',
    flexShrink: 0,
  },
  creditBody: {
    marginTop: 10,
  },
  creditMainStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  creditStatColLeft: {
    flex: 1,
    minWidth: 0,
  },
  creditStatColRight: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  debtAmountValue: {
    fontSize: 18, // Tăng thêm 1 size
    fontWeight: '900',
    color: colors.expense,
    marginTop: 2,
  },
  availableLimitValue: {
    fontSize: 16, // Tăng thêm 1 size
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  limitProgressSection: {
    marginTop: 8,
  },
  limitTrack: {
    height: 5,
    backgroundColor: colors.track,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  limitFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  limitLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  limitLabelLeft: {
    fontSize: 11, // Tăng thêm 1 size
    color: colors.textSecondary,
    fontWeight: '600',
  },
  limitLabelRight: {
    fontSize: 11, // Tăng thêm 1 size
    color: colors.textMuted,
  },
  cycleInfoRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  cycleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },
  cycleBadgeText: {
    fontSize: 12, // Tăng thêm 1 size
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
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 8,
  },
  feeWarningText: {
    fontSize: 12, // Tăng thêm 1 size
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
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalBoxTitle: {
    fontSize: 18, // Tăng thêm 1 size
    fontWeight: '800',
    color: colors.textPrimary,
  },
  fieldLabel: {
    fontSize: 14, // Tăng thêm 1 size
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 10,
    marginBottom: 5,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeGridBtn: {
    flex: 1,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  typeGridBtnSelected: {
    borderColor: colors.primaryBright,
    backgroundColor: colors.primarySoft,
  },
  typeGridLabel: {
    fontSize: 13, // Tăng thêm 1 size
    color: colors.textMuted,
    fontWeight: '600',
    textAlign: 'center',
  },
  typeGridLabelSelected: {
    color: colors.primaryBright,
    fontWeight: '700',
  },

  /* Logo Row: Đơn nhất, phẳng, không lồng khung trong khung */
  logoRowContainer: {
    marginTop: 2,
  },
  logoPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 8,
  },
  logoPickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  logoPlaceholderCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPickerName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginLeft: 10,
    flexShrink: 1,
  },
  logoPickerPlaceholder: {
    color: colors.textMuted,
    fontWeight: '400',
  },
  logoPickerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  logoPickerActionText: {
    fontSize: 13,
    color: colors.primaryBright,
    fontWeight: '600',
    marginRight: 3,
  },
  quickLogoScroll: {
    gap: 6,
    paddingBottom: 2,
  },
  quickLogoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F111A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 9,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  quickLogoChipSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
  },
  quickLogoChipText: {
    fontSize: 13, // Tăng thêm 1 size
    color: colors.textSecondary,
    fontWeight: '600',
    marginLeft: 5,
  },
  quickLogoChipTextSelected: {
    color: colors.primaryBright,
  },

  /* E-wallet Subtype row */
  ewalletSubtypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ewalletSubtypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    minWidth: 0,
  },
  ewalletSubtypeBtnActive: {
    borderColor: colors.primaryBright,
    backgroundColor: colors.primarySoft,
  },
  ewalletSubtypeText: {
    fontSize: 13, // Tăng thêm 1 size
    color: colors.textMuted,
    fontWeight: '600',
  },
  ewalletSubtypeTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    fontSize: 15, // Tăng thêm 1 size
    color: colors.textPrimary,
  },
  conditionalSection: {
    gap: 2,
  },
  dualFieldRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dualFieldCol: {
    flex: 1,
    minWidth: 0,
  },
  dayPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  dayPickerText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  dayPickerTextActive: {
    color: '#C084FC',
    fontWeight: '700',
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.track,
  },
  cancelBtnText: {
    fontSize: 15, // Tăng thêm 1 size
    color: colors.textSecondary,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  confirmBtnText: {
    fontSize: 15, // Tăng thêm 1 size
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
