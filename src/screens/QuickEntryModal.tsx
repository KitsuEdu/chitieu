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

export const QuickEntryModal: React.FC<QuickEntryModalProps> = ({
  visible,
  onClose,
  onTransactionSaved,
  initialPreset,
}) => {
  const [expression, setExpression] = useState<string>('0');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [note, setNote] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [isNoteFocused, setIsNoteFocused] = useState<boolean>(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [isRendered, setIsRendered] = useState<boolean>(visible);

  const noteInputRef = useRef<any>(null);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  // Load danh sách ví
  useEffect(() => {
    storageService.getWallets().then((list) => {
      setWallets(list);
      if (list.length > 0 && !selectedWallet) {
        setSelectedWallet(list[0]);
      }
    });
  }, []);

  // Animation mở / đóng modal
  useEffect(() => {
    if (visible) {
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
      Alert.alert('Số tiền chưa hợp lệ', 'Vui lòng nhập số tiền lớn hơn 0 VND');
      return;
    }

    try {
      await storageService.addTransaction({
        date: selectedDate.toISOString(),
        amount: finalAmount,
        type,
        category,
        wallet: selectedWallet?.name || 'Tiền mặt',
        note: note.trim() || undefined,
      });

      setExpression('0');
      setNote('');
      syncService.syncPendingTransactions();

      onTransactionSaved();
      handleClose();
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu giao dịch vào bộ nhớ máy');
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
            <View style={styles.segmentedContainer}>
              <TouchableOpacity
                style={[
                  styles.segmentTab,
                  type === 'EXPENSE' && styles.segmentTabExpenseActive,
                ]}
                onPress={() => {
                  triggerHaptic();
                  setType('EXPENSE');
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.segmentText,
                    type === 'EXPENSE' && styles.segmentTextExpenseActive,
                  ]}
                >
                  Khoản chi
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentTab,
                  type === 'INCOME' && styles.segmentTabIncomeActive,
                ]}
                onPress={() => {
                  triggerHaptic();
                  setType('INCOME');
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.segmentText,
                    type === 'INCOME' && styles.segmentTextIncomeActive,
                  ]}
                >
                  Khoản thu
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentTab,
                  type === 'TRANSFER' && styles.segmentTabTransferActive,
                ]}
                onPress={() => {
                  triggerHaptic();
                  setType('TRANSFER');
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.segmentText,
                    type === 'TRANSFER' && styles.segmentTextTransferActive,
                  ]}
                >
                  Chuyển khoản/Trả nợ
                </Text>
              </TouchableOpacity>
            </View>

            {/* 2. Row: Chọn Ví */}
            <TouchableOpacity
              style={styles.formRow}
              onPress={() => {
                Keyboard.dismiss();
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

            {/* 3. Row: Ô Số tiền (Active Focus) */}
            <Pressable
              style={styles.amountRow}
              onPress={() => {
                Keyboard.dismiss();
              }}
            >
              <View style={styles.vndBadge}>
                <Text style={styles.vndBadgeText}>VND</Text>
              </View>

              <View style={styles.amountDisplay}>
                <Text
                  style={[
                    styles.amountText,
                    type === 'EXPENSE' && { color: '#34D399' },
                    type === 'INCOME' && { color: '#34D399' },
                    type === 'TRANSFER' && { color: '#8B5CF6' },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatExpressionWithCommas(expression)}
                </Text>
                <View
                  style={[
                    styles.amountActiveUnderline,
                    type === 'EXPENSE' && { backgroundColor: '#34D399' },
                    type === 'INCOME' && { backgroundColor: '#34D399' },
                    type === 'TRANSFER' && { backgroundColor: '#8B5CF6' },
                  ]}
                />
              </View>
            </Pressable>

            {/* 4. Row: Chọn Nhóm (Category) */}
            <TouchableOpacity
              style={styles.formRow}
              onPress={() => {
                Keyboard.dismiss();
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

            {/* 5. Row: Thêm ghi chú */}
            <View style={styles.noteRow}>
              <View style={styles.rowIconContainer}>
                <AlignLeft size={22} color="#94A3B8" />
              </View>
              <TextInput
                ref={noteInputRef}
                style={styles.noteTextInput}
                placeholder="Thêm ghi chú"
                placeholderTextColor="#64748B"
                value={note}
                onChangeText={setNote}
                maxLength={80}
                onFocus={() => setIsNoteFocused(true)}
                onBlur={() => setIsNoteFocused(false)}
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

                <Text style={styles.dateDisplayValue}>
                  {formatVietnameseDate(selectedDate)}
                </Text>

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

          {/* Calculator Numpad (Pinned Bottom) */}
          {!isNoteFocused && (
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
        </KeyboardAvoidingView>

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
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#161926',
    borderRadius: 22,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  segmentTabExpenseActive: {
    backgroundColor: '#1E252B',
  },
  segmentTabIncomeActive: {
    backgroundColor: '#1E252B',
  },
  segmentTabTransferActive: {
    backgroundColor: '#201D33',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  segmentTextExpenseActive: {
    color: '#34D399',
    fontWeight: '700',
  },
  segmentTextIncomeActive: {
    color: '#34D399',
    fontWeight: '700',
  },
  segmentTextTransferActive: {
    color: '#A855F7',
    fontWeight: '700',
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
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
});
