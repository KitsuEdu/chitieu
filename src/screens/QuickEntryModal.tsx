import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import {
  X,
  RotateCcw,
  Banknote,
  Landmark,
  PiggyBank,
  CreditCard,
} from 'lucide-react-native';
import { CATEGORIES, TransactionType, WalletItem } from '../types';
import { storageService } from '../services/storage';
import { syncService } from '../services/sync';
import { formatVND } from '../utils/format';
import { CategoryIcon, getCategoryConfig } from '../components/CategoryIcon';
import { Numpad } from '../components/Numpad';
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

export const QuickEntryModal: React.FC<QuickEntryModalProps> = ({
  visible,
  onClose,
  onTransactionSaved,
  initialPreset,
}) => {
  const [amountStr, setAmountStr] = useState<string>('0');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [wallet, setWallet] = useState<string>('Tiền mặt');
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [note, setNote] = useState<string>('');
  const [isRendered, setIsRendered] = useState<boolean>(visible);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    storageService.getWallets().then((list) => {
      setWallets(list);
      if (list.length > 0) {
        setWallet(list[0].name);
      }
    });
  }, []);

  useEffect(() => {
    if (visible) {
      if (initialPreset) {
        if (initialPreset.category) setCategory(initialPreset.category);
        if (initialPreset.note !== undefined) setNote(initialPreset.note);
        if (initialPreset.type) setType(initialPreset.type);
      }

      setIsRendered(true);

      translateY.value = withTiming(0, {
        duration: 300,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });
      backdropOpacity.value = withTiming(1, {
        duration: 250,
        easing: Easing.out(Easing.quad),
      });
    } else if (isRendered) {
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

  const handleDigit = (digit: string) => {
    setAmountStr((prev) => {
      if (prev === '0') {
        return digit === '000' ? '0' : digit;
      }
      if (prev.length >= 11) return prev;
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

  const handleSave = async () => {
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

      setAmountStr('0');
      setNote('');
      syncService.syncPendingTransactions();

      onTransactionSaved();
      handleClose();
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu giao dịch vào bộ nhớ máy');
    }
  };

  const currentAmount = parseInt(amountStr, 10) || 0;
  const isExpense = type === 'EXPENSE';
  const themeAccentColor = isExpense ? colors.expense : colors.income;

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const getWalletIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Landmark':
        return Landmark;
      case 'PiggyBank':
        return PiggyBank;
      case 'CreditCard':
        return CreditCard;
      case 'Wallet':
      default:
        return Banknote;
    }
  };

  if (!isRendered) return null;

  return (
    <View style={styles.fullscreenOverlay} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropAnimatedStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[styles.bottomSheet, sheetAnimatedStyle]}>
        {/* Drag handle */}
        <View style={styles.dragHandleContainer}>
          <View style={styles.dragHandle} />
        </View>

        {/* Header Modal */}
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalTitle}>Thêm giao dịch mới</Text>
            <Text style={styles.modalSubTitle}>Ghi chép nhanh thu chi offline-first</Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <X size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Display Card */}
        <View style={styles.cardDisplay}>
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[
                styles.typeTab,
                isExpense && {
                  backgroundColor: colors.expenseSoft,
                  borderColor: colors.expense,
                },
              ]}
              onPress={() => setType('EXPENSE')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.typeTabText,
                  isExpense
                    ? { color: colors.expense, fontWeight: '700' }
                    : { color: colors.textSecondary },
                ]}
              >
                Chi tiêu
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeTab,
                !isExpense && {
                  backgroundColor: colors.incomeSoft,
                  borderColor: colors.income,
                },
              ]}
              onPress={() => setType('INCOME')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.typeTabText,
                  !isExpense
                    ? { color: colors.income, fontWeight: '700' }
                    : { color: colors.textSecondary },
                ]}
              >
                Thu nhập
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.amountRow}>
            <Text
              style={[styles.amountText, { color: themeAccentColor }]}
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
                <RotateCcw size={15} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Chips Danh mục & Ví */}
        <View style={styles.chipsSection}>
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
                    size={13}
                    containerSize={22}
                    style={{ marginRight: 5 }}
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

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.chipsScroll, { marginTop: 6 }]}
          >
            {wallets.map((w) => {
              const isSelected = wallet === w.name;
              const IconComponent = getWalletIcon(w.icon);
              const chipColor = w.colorGradient ? w.colorGradient[0] : colors.primaryBright;
              return (
                <TouchableOpacity
                  key={w.id}
                  style={[
                    styles.walletChip,
                    isSelected && {
                      backgroundColor: `${chipColor}22`,
                      borderColor: chipColor,
                    },
                  ]}
                  onPress={() => setWallet(w.name)}
                  activeOpacity={0.7}
                >
                  <IconComponent
                    size={14}
                    color={isSelected ? chipColor : colors.textMuted}
                    style={{ marginRight: 5 }}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      isSelected && { color: chipColor, fontWeight: '700' },
                    ]}
                  >
                    {w.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Note Input */}
        <View style={styles.noteContainer}>
          <TextInput
            style={styles.noteInput}
            placeholder="Thêm ghi chú (Cơm trưa, đổ xăng, cafe...)"
            placeholderTextColor={colors.textMuted}
            value={note}
            onChangeText={setNote}
            maxLength={60}
          />
        </View>

        {/* Numpad */}
        <View style={styles.numpadWrapper}>
          <Numpad
            onPressDigit={handleDigit}
            onPressBackspace={handleBackspace}
            onPressClear={handleClear}
          />
        </View>

        {/* Save button */}
        <View style={styles.saveActionWrapper}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: themeAccentColor },
              currentAmount === 0 && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={currentAmount === 0}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>
              LƯU {isExpense ? 'CHI TIÊU' : 'THU NHẬP'}{' '}
              {currentAmount > 0 ? `• ${formatVND(currentAmount)}` : ''}
            </Text>
          </TouchableOpacity>
        </View>
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
    justifyContent: 'flex-end',
    zIndex: 999,
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.76)',
  },
  bottomSheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    maxHeight: SCREEN_HEIGHT * 0.92,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 44,
    height: 4,
    borderRadius: 3,
    backgroundColor: colors.track,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalSubTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardDisplay: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  typeTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 9,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingVertical: 2,
    position: 'relative',
  },
  amountText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  clearMiniBtn: {
    position: 'absolute',
    right: 4,
    padding: 7,
    borderRadius: 16,
    backgroundColor: colors.track,
  },
  chipsSection: {
    paddingVertical: 6,
  },
  chipsScroll: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  noteContainer: {
    marginVertical: 4,
  },
  noteInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  numpadWrapper: {
    marginVertical: 4,
  },
  saveActionWrapper: {
    paddingTop: 4,
  },
  saveButton: {
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
