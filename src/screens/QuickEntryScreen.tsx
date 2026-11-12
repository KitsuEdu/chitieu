import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Pressable,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Wallet as WalletIcon,
  AlignLeft,
  Check,
  ChevronDown,
} from 'lucide-react-native';
import { CATEGORIES, TransactionType, Wallet } from '../types';
import { storageService } from '../services/storage';
import { syncService } from '../services/sync';
import { CategoryIcon } from '../components/CategoryIcon';
import { WalletLogo } from '../components/WalletLogo';
import { CalculatorNumpad } from '../components/CalculatorNumpad';
import { WalletSelectModal } from '../components/WalletSelectModal';
import { CategorySelectModal } from '../components/CategorySelectModal';
import {
  evaluateExpression,
  formatExpressionWithCommas,
  hasPendingOperator,
  formatVietnameseDate,
} from '../utils/calculator';
import { formatVND } from '../utils/format';
import { colors } from '../theme/colors';
import { SegmentedTabs, SegmentedTabItem } from '../components/SegmentedTabs';
import { CustomDatePicker } from '../components/CustomDatePicker';
import { usePopup } from '../context/PopupContext';

export interface QuickPreset {
  category?: string;
  note?: string;
  type?: TransactionType;
}

interface QuickEntryScreenProps {
  initialPreset?: QuickPreset | null;
  onTransactionSaved?: () => void;
  onNavigateToSettings?: () => void;
}

const triggerHaptic = () => {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Ignore on unsupported devices
  }
};

const QUICK_ENTRY_TABS: readonly SegmentedTabItem<TransactionType>[] = [
  {
    key: 'EXPENSE',
    label: 'Khoản chi',
    activeColor: '#FB7185',
    activeBgColor: 'rgba(244, 63, 94, 0.2)',
    activeBorderColor: 'rgba(244, 63, 94, 0.5)',
  },
  {
    key: 'INCOME',
    label: 'Khoản thu',
    activeColor: '#34D399',
    activeBgColor: 'rgba(16, 185, 129, 0.2)',
    activeBorderColor: 'rgba(16, 185, 129, 0.5)',
  },
  {
    key: 'TRANSFER',
    label: 'Chuyển khoản',
    activeColor: '#C084FC',
    activeBgColor: 'rgba(139, 92, 246, 0.2)',
    activeBorderColor: 'rgba(168, 85, 247, 0.45)',
  },
];

export const QuickEntryScreen: React.FC<QuickEntryScreenProps> = ({
  initialPreset,
  onTransactionSaved,
}) => {
  const { showPopup } = usePopup();
  const insets = useSafeAreaInsets();

  const [expression, setExpression] = useState<string>('0');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [note, setNote] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDatePickerVisible, setIsDatePickerVisible] = useState<boolean>(false);

  const [isAmountFocused, setIsAmountFocused] = useState<boolean>(false);
  const [isNoteFocused, setIsNoteFocused] = useState<boolean>(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);

  const noteInputRef = useRef<any>(null);
  const scrollViewRef = useRef<any>(null);
  const cursorOpacity = useSharedValue(0);

  // Animation trượt bàn phím số từ đáy lên đè lên trên Navbar
  const numpadTranslateY = useSharedValue(600);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (isAmountFocused && !isNoteFocused) {
      numpadTranslateY.value = withTiming(0, {
        duration: 260,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      numpadTranslateY.value = withTiming(600, {
        duration: 220,
        easing: Easing.in(Easing.cubic),
      });
      backdropOpacity.value = withTiming(0, { duration: 180 });
    }
  }, [isAmountFocused, isNoteFocused]);

  const numpadAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: numpadTranslateY.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // Hiệu ứng con trỏ nhấp nháy khi focus vào ô số tiền
  useEffect(() => {
    if (isAmountFocused && !isNoteFocused) {
      cursorOpacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 450 }),
          withTiming(1, { duration: 450 })
        ),
        -1,
        true
      );
    } else {
      cursorOpacity.value = 0;
    }
  }, [isAmountFocused, isNoteFocused]);

  const cursorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  // Load danh sách ví
  useEffect(() => {
    storageService.getWallets().then((list) => {
      setWallets(list);
      if (list.length > 0 && !selectedWallet) {
        setSelectedWallet(list[0]);
      }
    });
  }, []);

  // Áp dụng preset nếu có
  useEffect(() => {
    if (initialPreset) {
      if (initialPreset.category) setCategory(initialPreset.category);
      if (initialPreset.note !== undefined) setNote(initialPreset.note);
      if (initialPreset.type) setType(initialPreset.type);
    }
  }, [initialPreset]);

  // Numpad key handlers
  const handleDigit = (digit: string) => {
    setExpression((prev) => {
      if (prev === '0' && digit !== '.' && digit !== '000') {
        return digit;
      }
      if (prev === '0' && digit === '000') {
        return '0';
      }
      if (digit === '.') {
        const parts = prev.split(/[+\-×÷*/]/);
        const lastPart = parts[parts.length - 1];
        if (lastPart.includes('.')) return prev;
        if (lastPart === '' || lastPart === ' ') return prev + '0.';
        return prev + '.';
      }
      if (digit === '000') {
        const parts = prev.split(/[+\-×÷*/]/);
        const lastPart = parts[parts.length - 1].trim();
        if (lastPart === '' || lastPart === '0') return prev;
        return prev + '000';
      }
      if (prev.length >= 30) return prev;
      return prev + digit;
    });
  };

  const handleOperator = (op: string) => {
    setExpression((prev) => {
      const trimmed = prev.trim();
      if (/[+\-×÷*/]$/.test(trimmed)) {
        return trimmed.slice(0, -1).trim() + ' ' + op + ' ';
      }
      return trimmed + ' ' + op + ' ';
    });
  };

  const handleBackspace = () => {
    setExpression((prev) => {
      const trimmed = prev.trim();
      if (trimmed.length <= 1 || trimmed === '0') return '0';
      if (/[+\-×÷*/]$/.test(trimmed)) {
        return trimmed.slice(0, -1).trim();
      }
      return prev.slice(0, -1).trim() || '0';
    });
  };

  const handleClear = () => {
    setExpression('0');
  };

  const handleEqual = () => {
    const result = evaluateExpression(expression);
    if (result !== null) {
      setExpression(result.toString());
    }
  };

  const handleChip = (addVal: number) => {
    const currentVal = evaluateExpression(expression) || 0;
    const newVal = currentVal + addVal;
    setExpression(newVal.toString());
  };

  // Chọn ngày
  const handlePrevDay = () => {
    triggerHaptic();
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  };

  const handleNextDay = () => {
    triggerHaptic();
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  };

  // Lưu giao dịch
  const handleSave = async () => {
    const evaluatedAmount = evaluateExpression(expression);
    if (!evaluatedAmount || evaluatedAmount <= 0) {
      showPopup({
        type: 'WARNING',
        title: 'Số tiền chưa hợp lệ',
        message: 'Vui lòng nhập số tiền lớn hơn 0 VND',
      });
      return;
    }

    if (!selectedWallet) {
      showPopup({
        type: 'WARNING',
        title: 'Chưa chọn ví',
        message: 'Vui lòng chọn ví để ghi nhận giao dịch',
      });
      return;
    }

    try {
      const now = new Date();
      const transactionDate = new Date(selectedDate);
      transactionDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

      await storageService.addTransaction({
        date: transactionDate.toISOString(),
        amount: evaluatedAmount,
        type,
        category: type === 'TRANSFER' ? 'Chuyển khoản' : category,
        wallet: selectedWallet.name,
        note: note.trim() || undefined,
      });

      // Cập nhật số dư ví
      let newBalance = selectedWallet.balance || 0;
      if (type === 'EXPENSE' || type === 'TRANSFER') {
        newBalance -= evaluatedAmount;
      } else if (type === 'INCOME') {
        newBalance += evaluatedAmount;
      }
      await storageService.updateWallet({
        ...selectedWallet,
        balance: newBalance,
      });

      // Reset form
      setExpression('0');
      setNote('');
      setIsAmountFocused(false);

      triggerHaptic();
      onTransactionSaved?.();

      // Đồng bộ ngầm
      syncService.syncPendingTransactions();
    } catch {
      showPopup({
        type: 'ERROR',
        title: 'Lỗi',
        message: 'Không thể lưu giao dịch vào máy. Vui lòng thử lại.',
      });
    }
  };

  const evaluatedAmount = evaluateExpression(expression);
  const pendingOperator = hasPendingOperator(expression);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header màn hình đồng bộ với Quản lý ví & Lịch sử */}
        <View style={styles.topHeader}>
          <View style={styles.topHeaderTitleCol}>
            <Text style={styles.pageTitle} numberOfLines={1}>
              Thêm giao dịch
            </Text>
            <Text style={styles.pageSubTitle} numberOfLines={1}>
              Chi tiêu • Thu nhập • Chuyển khoản
            </Text>
          </View>
        </View>

        {/* 1. Segmented Tabs: [Khoản chi] | [Khoản thu] | [Chuyển khoản] */}
        <SegmentedTabs<TransactionType>
          tabs={QUICK_ENTRY_TABS}
          activeKey={type}
          onChange={(newType) => {
            setType(newType);
            setIsAmountFocused(false);
          }}
          containerStyle={{ marginBottom: 16 }}
        />

        {/* 2. Form Box chính */}
        <View style={styles.formCard}>
          {/* Row 1: Chọn Ví */}
          <TouchableOpacity
            style={styles.formRow}
            onPress={() => {
              Keyboard.dismiss();
              setIsAmountFocused(false);
              setIsWalletModalOpen(true);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <View style={styles.rowIconContainer}>
                {selectedWallet ? (
                  <WalletLogo
                    logoId={selectedWallet.logoId || selectedWallet.icon}
                    icon={selectedWallet.icon}
                    name={selectedWallet.name}
                    type={selectedWallet.type}
                    size={22}
                  />
                ) : (
                  <WalletIcon size={22} color="#94A3B8" />
                )}
              </View>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Tài khoản / Ví</Text>
                <Text style={styles.rowMainText}>
                  {selectedWallet ? selectedWallet.name : 'Chọn ví'}
                </Text>
              </View>
            </View>

            <View style={styles.rowRight}>
              {selectedWallet?.balance !== undefined && (
                <Text style={styles.walletBalanceText}>
                  {formatVND(selectedWallet.balance)}
                </Text>
              )}
              <ChevronRight size={18} color="#64748B" />
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Row 2: Ô Số tiền (Active Focus) */}
          <Pressable
            style={styles.amountRow}
            onPress={() => {
              Keyboard.dismiss();
              setIsAmountFocused(true);
              setIsNoteFocused(false);
            }}
          >
            <View style={[styles.vndBadge, isAmountFocused && styles.vndBadgeFocused]}>
              <Text style={[styles.vndBadgeText, isAmountFocused && styles.vndBadgeTextFocused]}>
                VND
              </Text>
            </View>

            <View style={styles.amountDisplay}>
              <View style={styles.amountTextContainer}>
                <Text
                  style={[
                    styles.amountText,
                    isAmountFocused && { color: '#A855F7' },
                    type === 'EXPENSE' && !isAmountFocused && { color: '#F43F5E' },
                    type === 'INCOME' && !isAmountFocused && { color: '#34D399' },
                    type === 'TRANSFER' && !isAmountFocused && { color: '#8B5CF6' },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatExpressionWithCommas(expression)}
                </Text>
                {isAmountFocused && !isNoteFocused && (
                  <Animated.View style={[styles.blinkingCursor, cursorAnimatedStyle]} />
                )}
              </View>

              <View
                style={[
                  styles.amountActiveUnderline,
                  isAmountFocused && styles.amountActiveUnderlineFocused,
                  type === 'EXPENSE' && !isAmountFocused && { backgroundColor: '#F43F5E' },
                  type === 'INCOME' && !isAmountFocused && { backgroundColor: '#34D399' },
                  type === 'TRANSFER' && !isAmountFocused && { backgroundColor: '#8B5CF6' },
                ]}
              />
            </View>
          </Pressable>

          <View style={styles.divider} />

          {/* Row 3: Chọn Nhóm (Category) */}
          <TouchableOpacity
            style={styles.formRow}
            onPress={() => {
              Keyboard.dismiss();
              setIsAmountFocused(false);
              setIsCategoryModalOpen(true);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <View style={styles.rowIconContainer}>
                <CategoryIcon
                  category={type === 'TRANSFER' ? 'Khác' : category}
                  size={20}
                  containerSize={36}
                />
              </View>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Hạng mục</Text>
                <Text style={styles.rowMainText}>
                  {type === 'TRANSFER' ? 'Chuyển khoản / Trả nợ' : category || 'Chọn nhóm'}
                </Text>
              </View>
            </View>

            <ChevronRight size={18} color="#64748B" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Row 4: Ghi chú */}
          <View style={styles.noteRow}>
            <View style={styles.rowIconContainer}>
              <AlignLeft size={22} color="#94A3B8" />
            </View>
            <TextInput
              ref={noteInputRef}
              style={styles.noteTextInput}
              placeholder="Thêm ghi chú (không bắt buộc)..."
              placeholderTextColor="#64748B"
              value={note}
              onChangeText={setNote}
              maxLength={80}
              onFocus={() => {
                setIsAmountFocused(false);
                setIsNoteFocused(true);
              }}
              onBlur={() => {
                setIsNoteFocused(false);
              }}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
          </View>

          <View style={styles.divider} />

          {/* Row 5: Chọn Ngày */}
          <View style={styles.dateRow}>
            <TouchableOpacity
              style={styles.rowLeft}
              onPress={() => {
                Keyboard.dismiss();
                setIsAmountFocused(false);
                setIsDatePickerVisible(true);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.rowIconContainer}>
                <Calendar size={22} color="#94A3B8" />
              </View>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Ngày ghi nhận</Text>
                <Text style={styles.rowMainText}>
                  {formatVietnameseDate(selectedDate)}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.dateSelectorPill}>
              <TouchableOpacity
                style={styles.dateArrowBtn}
                onPress={handlePrevDay}
                activeOpacity={0.7}
              >
                <ChevronLeft size={18} color="#34D399" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateArrowBtn}
                onPress={handleNextDay}
                activeOpacity={0.7}
              >
                <ChevronRight size={18} color="#34D399" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Nút Lưu giao dịch */}
        <TouchableOpacity
          style={styles.saveActionBtn}
          onPress={handleSave}
          activeOpacity={0.8}
        >
          <Check size={20} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 8 }} />
          <Text style={styles.saveActionBtnText}>Lưu giao dịch</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 1. Backdrop làm mờ khi mở bàn phím số */}
      <Animated.View
        style={[styles.backdrop, backdropAnimatedStyle]}
        pointerEvents={isAmountFocused && !isNoteFocused ? 'auto' : 'none'}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setIsAmountFocused(false)}
        />
      </Animated.View>

      {/* 2. Bàn phím số gắn đáy, đè hoàn toàn lên trên LiquidNavBar */}
      <Animated.View
        style={[
          styles.dockedNumpadWrapper,
          numpadAnimatedStyle,
          { paddingBottom: Math.max(16, insets.bottom + 6) },
        ]}
        pointerEvents={isAmountFocused && !isNoteFocused ? 'auto' : 'none'}
      >
        {/* Header bàn phím hiển thị số tiền to rõ & nút Xong */}
        <View style={styles.dockedHeader}>
          <View style={styles.dockedAmountRow}>
            <View style={styles.dockedVndBadge}>
              <Text style={styles.dockedVndBadgeText}>VND</Text>
            </View>
            <Text
              style={[
                styles.dockedAmountText,
                type === 'EXPENSE' && { color: '#F43F5E' },
                type === 'INCOME' && { color: '#34D399' },
                type === 'TRANSFER' && { color: '#8B5CF6' },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatExpressionWithCommas(expression)}
            </Text>
            <Animated.View style={[styles.blinkingCursor, cursorAnimatedStyle]} />
          </View>

          <TouchableOpacity
            style={styles.dockedDoneBtn}
            onPress={() => setIsAmountFocused(false)}
            activeOpacity={0.7}
          >
            <Text style={styles.dockedDoneText}>Xong</Text>
            <ChevronDown size={18} color="#8B5CF6" />
          </TouchableOpacity>
        </View>

        {/* Numpad máy tính */}
        <CalculatorNumpad
          expression={expression}
          evaluatedAmount={evaluatedAmount}
          hasPendingOperator={pendingOperator}
          onPressDigit={handleDigit}
          onPressOperator={handleOperator}
          onPressBackspace={handleBackspace}
          onPressClear={handleClear}
          onPressEqual={handleEqual}
          onPressChip={handleChip}
          onSave={handleSave}
          containerStyle={styles.dockedNumpadInner}
          hideSaveButton
        />
      </Animated.View>

      {/* Modal Chọn Ví */}
      <WalletSelectModal
        visible={isWalletModalOpen}
        wallets={wallets}
        selectedWalletName={selectedWallet?.name || ''}
        onClose={() => setIsWalletModalOpen(false)}
        onSelectWallet={(w) => setSelectedWallet(w)}
      />

      {/* Modal Chọn Nhóm */}
      <CategorySelectModal
        visible={isCategoryModalOpen}
        categories={CATEGORIES}
        selectedCategory={category}
        onClose={() => setIsCategoryModalOpen(false)}
        onSelectCategory={(c) => setCategory(c)}
      />

      {/* Modal Chọn Ngày */}
      <CustomDatePicker
        visible={isDatePickerVisible}
        onClose={() => setIsDatePickerVisible(false)}
        mode="DATE"
        value={selectedDate}
        onConfirm={(d: Date) => setSelectedDate(d)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 160, // Đảm bảo mọi nội dung và nút Lưu cách xa LiquidNavBar ít nhất 60px
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  topHeaderTitleCol: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  pageSubTitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: '#12141F',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowTextCol: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  rowMainText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  walletBalanceText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#34D399',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  vndBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginRight: 12,
  },
  vndBadgeFocused: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  vndBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  vndBadgeTextFocused: {
    color: '#A855F7',
  },
  amountDisplay: {
    flex: 1,
  },
  amountTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  blinkingCursor: {
    width: 2.5,
    height: 24,
    backgroundColor: '#8B5CF6',
    marginLeft: 4,
    borderRadius: 2,
  },
  amountActiveUnderline: {
    height: 2,
    backgroundColor: 'transparent',
    marginTop: 4,
    borderRadius: 1,
  },
  amountActiveUnderlineFocused: {
    backgroundColor: '#8B5CF6',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  noteTextInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    paddingVertical: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  dateSelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161926',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dateArrowBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 400,
  },
  dockedNumpadWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#12141F',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 500, // Đè hoàn toàn lên trên zIndex: 100 của LiquidNavBar
    paddingHorizontal: 16,
    paddingTop: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  dockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 8,
  },
  dockedAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dockedVndBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
    borderWidth: 1,
    borderColor: '#8B5CF6',
    marginRight: 10,
  },
  dockedVndBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#A855F7',
  },
  dockedAmountText: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  dockedDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  dockedDoneText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  dockedNumpadInner: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    paddingHorizontal: 0,
    paddingBottom: 0,
    paddingTop: 4,
  },
  saveActionBtn: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#8B5CF6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 16,
  },
  saveActionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
