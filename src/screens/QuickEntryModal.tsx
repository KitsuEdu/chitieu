import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Dimensions,
  Pressable,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Wallet as WalletIcon,
  AlignLeft,
  Check,
  ArrowUpDown,
} from 'lucide-react-native';
import { CATEGORIES, TransactionType, Wallet } from '../types';
import { storageService } from '../services/storage';
import { syncService } from '../services/sync';
import { CategoryIcon, getCategoryConfig } from '../components/CategoryIcon';
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
import { colors } from '../theme/colors';
import { SegmentedTabs, SegmentedTabItem } from '../components/SegmentedTabs';
import { CustomDatePicker } from '../components/CustomDatePicker';
import { usePopup } from '../context/PopupContext';

interface QuickEntryModalProps {
  visible: boolean;
  onClose: () => void;
  onTransactionSaved: () => void;
  initialPreset?: {
    category?: string;
    note?: string;
    type?: TransactionType;
  } | null;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
    label: 'Chuyển khoản/Trả nợ',
    activeColor: '#C084FC',
    activeBgColor: 'rgba(139, 92, 246, 0.2)',
    activeBorderColor: 'rgba(168, 85, 247, 0.45)',
  },
];

export const QuickEntryModal: React.FC<QuickEntryModalProps> = ({
  visible,
  onClose,
  onTransactionSaved,
  initialPreset,
}) => {
  const { showPopup } = usePopup();
  const [expression, setExpression] = useState<string>('0');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [targetWallet, setTargetWallet] = useState<Wallet | null>(null);
  const [walletPickerMode, setWalletPickerMode] = useState<'FROM' | 'TO'>('FROM');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [note, setNote] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDatePickerVisible, setIsDatePickerVisible] = useState<boolean>(false);

  const [isAmountFocused, setIsAmountFocused] = useState<boolean>(false);
  const [isNoteFocused, setIsNoteFocused] = useState<boolean>(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [isRendered, setIsRendered] = useState<boolean>(visible);

  const handleSwapWallets = () => {
    triggerHaptic();
    const temp = selectedWallet;
    setSelectedWallet(targetWallet);
    setTargetWallet(temp);
  };


  const getTypeColor = (t: TransactionType) => {
    switch (t) {
      case 'EXPENSE':
        return '#F43F5E';
      case 'INCOME':
        return '#34D399';
      case 'TRANSFER':
        return '#8B5CF6';
      default:
        return '#F43F5E';
    }
  };

  const getTypeBadgeBg = (t: TransactionType) => {
    switch (t) {
      case 'EXPENSE':
        return 'rgba(244, 63, 94, 0.18)';
      case 'INCOME':
        return 'rgba(52, 211, 153, 0.18)';
      case 'TRANSFER':
        return 'rgba(139, 92, 246, 0.18)';
      default:
        return 'rgba(244, 63, 94, 0.18)';
    }
  };

  const noteInputRef = useRef<any>(null);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const cursorOpacity = useSharedValue(1);

  // Hiệu ứng con trỏ nhấp nháy khi focus vào ô số tiền
  useEffect(() => {
    if (visible && isAmountFocused && !isNoteFocused) {
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
  }, [visible, isAmountFocused, isNoteFocused]);

  // Load danh sách ví
  useEffect(() => {
    storageService.getWallets().then((list) => {
      setWallets(list);
      if (list.length > 0) {
        if (!selectedWallet) setSelectedWallet(list[0]);
        if (!targetWallet) {
          const secondWallet = list.find((w) => w.id !== list[0].id) || list[1] || null;
          setTargetWallet(secondWallet);
        }
      }
    });
  }, []);

  // Animation mở / đóng modal
  useEffect(() => {
    if (visible) {
      setIsAmountFocused(false);
      setIsNoteFocused(false);

      if (initialPreset) {
        if (initialPreset.category) setCategory(initialPreset.category);
        if (initialPreset.note !== undefined) setNote(initialPreset.note);
        if (initialPreset.type) setType(initialPreset.type);
      }
      setSelectedDate(new Date());

      setIsRendered(true);

      translateY.value = withTiming(0, {
        duration: 280,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });
      backdropOpacity.value = withTiming(1, {
        duration: 220,
        easing: Easing.out(Easing.quad),
      });
    } else if (isRendered) {
      Keyboard.dismiss();
      translateY.value = withTiming(
        SCREEN_HEIGHT,
        {
          duration: 240,
          easing: Easing.in(Easing.cubic),
        },
        (finished) => {
          if (finished) {
            runOnJS(setIsRendered)(false);
          }
        }
      );
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  // Back button Android
  useEffect(() => {
    if (!visible) return;
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        handleClose();
        return true;
      }
    );
    return () => backHandler.remove();
  }, [visible]);

  const handleClose = () => {
    Keyboard.dismiss();
    translateY.value = withTiming(
      SCREEN_HEIGHT,
      {
        duration: 240,
        easing: Easing.in(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(setIsRendered)(false);
          runOnJS(onClose)();
        }
      }
    );
    backdropOpacity.value = withTiming(0, { duration: 200 });
  };

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
    setExpression(result.toString());
  };

  const handleChip = (val: number) => {
    setExpression(val.toString());
  };

  const handlePrevDay = () => {
    triggerHaptic();
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() - 1);
      return next;
    });
  };

  const handleNextDay = () => {
    triggerHaptic();
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + 1);
      return next;
    });
  };

  const handleSave = async () => {
    const finalAmount = evaluateExpression(expression);
    if (!finalAmount || finalAmount <= 0) {
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
        message:
          type === 'TRANSFER'
            ? 'Vui lòng chọn ví nguồn chuyển tiền'
            : 'Vui lòng chọn ví để ghi nhận giao dịch',
      });
      return;
    }

    if (type === 'TRANSFER') {
      if (!targetWallet) {
        showPopup({
          type: 'WARNING',
          title: 'Chưa chọn ví nhận',
          message: 'Vui lòng chọn ví nhận tiền chuyển khoản',
        });
        return;
      }
      if (selectedWallet.id === targetWallet.id) {
        showPopup({
          type: 'WARNING',
          title: 'Ví không hợp lệ',
          message: 'Ví nhận không thể trùng với ví chuyển',
        });
        return;
      }
    }

    try {
      if (type === 'TRANSFER') {
        const fromW = selectedWallet;
        const toW = targetWallet;
        if (!toW) return;

        // 1. Thêm giao dịch chuyển khoản giữa 2 ví
        await storageService.addTransaction({
          date: selectedDate.toISOString(),
          amount: finalAmount,
          type: 'TRANSFER',
          category: 'Chuyển khoản',
          wallet: fromW.name,
          toWallet: toW.name,
          note: note.trim() || undefined,
        });

        // 2. Cập nhật số dư ví chuyển đi
        if (fromW.type === 'CREDIT_CARD' || fromW.type === 'PAYLATER') {
          await storageService.updateWallet({
            ...fromW,
            currentBalance: (fromW.currentBalance || 0) + finalAmount,
          });
        } else {
          await storageService.updateWallet({
            ...fromW,
            balance: (fromW.balance || 0) - finalAmount,
          });
        }

        // 3. Cập nhật số dư ví nhận tiền
        if (toW.type === 'CREDIT_CARD' || toW.type === 'PAYLATER') {
          await storageService.updateWallet({
            ...toW,
            currentBalance: Math.max((toW.currentBalance || 0) - finalAmount, 0),
          });
        } else {
          await storageService.updateWallet({
            ...toW,
            balance: (toW.balance || 0) + finalAmount,
          });
        }
      } else {
        await storageService.addTransaction({
          date: selectedDate.toISOString(),
          amount: finalAmount,
          type,
          category,
          wallet: selectedWallet.name,
          note: note.trim() || undefined,
        });

        // Cập nhật số dư ví
        let newBalance = selectedWallet.balance || 0;
        if (type === 'EXPENSE') {
          if (selectedWallet.type === 'CREDIT_CARD' || selectedWallet.type === 'PAYLATER') {
            await storageService.updateWallet({
              ...selectedWallet,
              currentBalance: (selectedWallet.currentBalance || 0) + finalAmount,
            });
          } else {
            await storageService.updateWallet({
              ...selectedWallet,
              balance: newBalance - finalAmount,
            });
          }
        } else if (type === 'INCOME') {
          if (selectedWallet.type === 'CREDIT_CARD' || selectedWallet.type === 'PAYLATER') {
            await storageService.updateWallet({
              ...selectedWallet,
              currentBalance: Math.max((selectedWallet.currentBalance || 0) - finalAmount, 0),
            });
          } else {
            await storageService.updateWallet({
              ...selectedWallet,
              balance: newBalance + finalAmount,
            });
          }
        }
      }

      setExpression('0');
      setNote('');
      syncService.syncPendingTransactions();

      onTransactionSaved();
      handleClose();
    } catch {
      showPopup({
        type: 'ERROR',
        title: 'Lỗi',
        message: 'Không thể lưu giao dịch vào bộ nhớ máy. Vui lòng thử lại.',
      });
    }
  };

  const evaluatedAmount = evaluateExpression(expression);
  const pendingOperator = hasPendingOperator(expression);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const cursorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  if (!isRendered) return null;

  return (
    <View style={styles.fullscreenOverlay} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropAnimatedStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      {/* Main Sheet */}
      <Animated.View style={[styles.bottomSheet, sheetAnimatedStyle]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetContent}
        >
          {/* Header */}
          <View style={styles.headerBar}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <X size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Thêm giao dịch</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Form Rows (Top Section) */}
          <ScrollView
            style={styles.upperScroll}
            contentContainerStyle={styles.upperContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* 1. Segmented Tabs: [Khoản chi] | [Khoản thu] | [Chuyển khoản/Trả nợ] */}
            <SegmentedTabs<TransactionType>
              tabs={QUICK_ENTRY_TABS}
              activeKey={type}
              onChange={(newType) => {
                setType(newType);
              }}
              containerStyle={{ marginBottom: 16 }}
            />

            {/* 2. Row: Chọn Ví (Đơn lẻ cho Thu/Chi hoặc Kép cho Chuyển khoản) */}
            {type === 'TRANSFER' ? (
              <View style={styles.transferWalletGroup}>
                {/* Ví chuyển đi */}
                <TouchableOpacity
                  style={styles.transferWalletRow}
                  onPress={() => {
                    Keyboard.dismiss();
                    setIsAmountFocused(false);
                    setWalletPickerMode('FROM');
                    setIsWalletModalOpen(true);
                  }}
                  activeOpacity={0.7}
                >
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
                  <View style={styles.transferTextCol}>
                    <Text style={styles.transferLabel}>Từ ví chuyển đi</Text>
                    <Text style={styles.rowText}>
                      {selectedWallet ? selectedWallet.name : 'Chọn ví chuyển'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Vạch chia kèm nút Hoán đổi (Swap) */}
                <View style={styles.transferDividerWrapper}>
                  <View style={styles.transferDividerLine} />
                  <TouchableOpacity
                    style={styles.transferSwapButton}
                    onPress={handleSwapWallets}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <ArrowUpDown size={13} color={colors.primaryLight} strokeWidth={2.2} />
                  </TouchableOpacity>
                  <View style={styles.transferDividerLine} />
                </View>

                {/* Ví nhận tiền */}
                <TouchableOpacity
                  style={styles.transferWalletRow}
                  onPress={() => {
                    Keyboard.dismiss();
                    setIsAmountFocused(false);
                    setWalletPickerMode('TO');
                    setIsWalletModalOpen(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowIconContainer}>
                    {targetWallet ? (
                      <WalletLogo
                        logoId={targetWallet.logoId || targetWallet.icon}
                        icon={targetWallet.icon}
                        name={targetWallet.name}
                        type={targetWallet.type}
                        size={22}
                      />
                    ) : (
                      <WalletIcon size={22} color="#94A3B8" />
                    )}
                  </View>
                  <View style={styles.transferTextCol}>
                    <Text style={[styles.transferLabel, { color: colors.primaryLight }]}>
                      Đến ví nhận tiền
                    </Text>
                    <Text style={styles.rowText}>
                      {targetWallet ? targetWallet.name : 'Chọn ví nhận'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.formRow}
                onPress={() => {
                  Keyboard.dismiss();
                  setIsAmountFocused(false);
                  setWalletPickerMode('FROM');
                  setIsWalletModalOpen(true);
                }}
                activeOpacity={0.7}
              >
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
                <Text style={styles.rowText}>
                  {selectedWallet ? selectedWallet.name : 'Chọn ví'}
                </Text>
              </TouchableOpacity>
            )}


            {/* 3. Row: Ô Số tiền (Active Focus) */}
            <Pressable
              style={styles.amountRow}
              onPress={() => {
                Keyboard.dismiss();
                setIsAmountFocused(true);
                setIsNoteFocused(false);
              }}
            >
              <View
                style={[
                  styles.vndBadge,
                  isAmountFocused && {
                    backgroundColor: getTypeBadgeBg(type),
                    borderWidth: 1,
                    borderColor: getTypeColor(type),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.vndBadgeText,
                    isAmountFocused && { color: getTypeColor(type) },
                  ]}
                >
                  VND
                </Text>
              </View>

              <View style={styles.amountDisplay}>
                <View style={styles.amountTextContainer}>
                  <Text
                    style={[
                      styles.amountText,
                      type === 'EXPENSE' && { color: '#F43F5E' },
                      type === 'INCOME' && { color: '#34D399' },
                      type === 'TRANSFER' && { color: '#8B5CF6' },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {formatExpressionWithCommas(expression)}
                  </Text>
                  {isAmountFocused && !isNoteFocused && (
                    <Animated.View
                      style={[
                        styles.blinkingCursor,
                        cursorAnimatedStyle,
                        { backgroundColor: getTypeColor(type) },
                      ]}
                    />
                  )}
                </View>

                <View
                  style={[
                    styles.amountActiveUnderline,
                    isAmountFocused && { backgroundColor: getTypeColor(type) },
                  ]}
                />
              </View>
            </Pressable>

            {/* 4. Row: Chọn Nhóm (Category) */}
            {type === 'TRANSFER' ? (
              <View style={styles.formRow}>
                <View style={styles.rowIconContainer}>
                  <CategoryIcon
                    category="Chuyển khoản"
                    size={20}
                    containerSize={36}
                  />
                </View>
                <Text style={[styles.rowText, { color: colors.primaryLight }]}>
                  Chuyển tiền nội bộ giữa các ví
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.formRow}
                onPress={() => {
                  Keyboard.dismiss();
                  setIsAmountFocused(false);
                  setIsCategoryModalOpen(true);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.rowIconContainer}>
                  <CategoryIcon
                    category={category}
                    size={20}
                    containerSize={36}
                  />
                </View>
                <Text style={styles.rowText}>
                  {category || 'Chọn nhóm'}
                </Text>
              </TouchableOpacity>
            )}

            {/* 5. Row: Thêm ghi chú */}
            <View style={styles.noteRow}>
              <View style={styles.rowIconContainer}>
                <AlignLeft size={22} color="#94A3B8" />
              </View>
              <TextInput
                ref={noteInputRef}
                style={styles.noteTextInput}
                placeholder={
                  type === 'TRANSFER'
                    ? 'Ghi chú (VD: Rút ATM, Nạp ví, Trả nợ thẻ...)'
                    : 'Thêm ghi chú'
                }
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
                  setIsAmountFocused(false);
                }}
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
              />

              {isNoteFocused && (
                <TouchableOpacity
                  style={styles.doneTypingBtn}
                  onPress={() => Keyboard.dismiss()}
                >
                  <Check size={18} color="#8B5CF6" strokeWidth={2.5} />
                  <Text style={styles.doneTypingText}>Xong</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 6. Row: Chọn Ngày */}
            <View style={styles.dateRow}>
              <View style={styles.rowIconContainer}>
                <Calendar size={22} color="#94A3B8" />
              </View>

              <View style={styles.dateSelectorPill}>
                <TouchableOpacity
                  style={styles.dateArrowBtn}
                  onPress={handlePrevDay}
                  activeOpacity={0.7}
                >
                  <ChevronLeft size={20} color="#34D399" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setIsDatePickerVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dateDisplayValue}>
                    {formatVietnameseDate(selectedDate)}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dateArrowBtn}
                  onPress={handleNextDay}
                  activeOpacity={0.7}
                >
                  <ChevronRight size={20} color="#34D399" />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          {/* Calculator Numpad (Chỉ hiện khi người dùng chủ động bấm vào ô Số tiền) */}
          {isAmountFocused && !isNoteFocused && (
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
            />
          )}

          {/* Nút Lưu cố định khi không mở bàn phím số */}
          {!isAmountFocused && !isNoteFocused && (
            <View style={styles.bottomSaveContainer}>
              <TouchableOpacity
                style={styles.bottomSaveBtn}
                onPress={handleSave}
                activeOpacity={0.8}
              >
                <Check size={20} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 8 }} />
                <Text style={styles.bottomSaveText}>Lưu</Text>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>

        {/* Modal Chọn Ví */}
        <WalletSelectModal
          visible={isWalletModalOpen}
          wallets={wallets}
          title={
            type === 'TRANSFER'
              ? walletPickerMode === 'FROM'
                ? 'Chọn ví chuyển đi'
                : 'Chọn ví nhận tiền'
              : 'Chọn Ví'
          }
          subtitle={
            type === 'TRANSFER'
              ? walletPickerMode === 'FROM'
                ? 'Số tiền sẽ được trích từ ví này'
                : 'Số tiền sẽ được chuyển vào ví này'
              : 'Chọn tài khoản cho giao dịch này'
          }
          excludeWalletId={
            type === 'TRANSFER'
              ? walletPickerMode === 'FROM'
                ? targetWallet?.id
                : selectedWallet?.id
              : undefined
          }
          selectedWalletName={
            walletPickerMode === 'FROM'
              ? selectedWallet?.name || ''
              : targetWallet?.name || ''
          }
          onClose={() => setIsWalletModalOpen(false)}
          onSelectWallet={(w) => {
            if (walletPickerMode === 'FROM') {
              setSelectedWallet(w);
            } else {
              setTargetWallet(w);
            }
            setIsWalletModalOpen(false);
          }}
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
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  fullscreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
    backgroundColor: '#0F111A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  sheetContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  upperScroll: {
    flex: 1,
  },
  upperContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 16,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  transferWalletGroup: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  transferWalletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  transferTextCol: {
    flex: 1,
  },
  transferLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  transferDividerWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: -2,
  },
  transferDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  transferSwapButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1D2132',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  rowIconContainer: {
    width: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  rowText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#F8FAFC',
    flex: 1,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  vndBadge: {
    backgroundColor: '#1E2235',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginRight: 14,
  },
  vndBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  amountDisplay: {
    flex: 1,
    justifyContent: 'center',
  },
  amountText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#34D399',
    letterSpacing: 0.5,
  },
  amountActiveUnderline: {
    height: 2,
    backgroundColor: '#34D399',
    borderRadius: 1,
    marginTop: 4,
    width: '100%',
  },
  amountActiveUnderlineFocused: {
    backgroundColor: '#8B5CF6',
    height: 2.5,
  },
  amountTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  blinkingCursor: {
    width: 2.5,
    height: 28,
    backgroundColor: '#A855F7',
    marginLeft: 4,
    borderRadius: 1.5,
  },
  vndBadgeFocused: {
    borderColor: 'rgba(139, 92, 246, 0.4)',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
  },
  vndBadgeTextFocused: {
    color: '#A855F7',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  noteTextInput: {
    flex: 1,
    fontSize: 16,
    color: '#F8FAFC',
    paddingVertical: 6,
  },
  doneTypingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  doneTypingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  dateSelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161926',
    borderRadius: 18,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  dateArrowBtn: {
    padding: 6,
  },
  dateDisplayValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34D399',
    paddingHorizontal: 8,
  },
  bottomSaveContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    backgroundColor: '#12141F',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  bottomSaveBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#8B5CF6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSaveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
