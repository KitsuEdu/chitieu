import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  X,
  Calendar as CalendarIcon,
  Wallet as WalletIcon,
  ChevronDown,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
} from 'lucide-react-native';
import { DebtRecord, Wallet } from '../types';
import { CurrencyInput } from './CurrencyInput';
import { CustomDatePicker } from './CustomDatePicker';
import { WalletSelectModal } from './WalletSelectModal';
import { WalletLogo } from './WalletLogo';
import { colors } from '../theme/colors';
import { formatVND } from '../utils/format';
import { usePopup } from '../context/PopupContext';

interface DebtPaymentModalProps {
  visible: boolean;
  debt: DebtRecord | null;
  wallets: Wallet[];
  onClose: () => void;
  onSubmit: (payment: {
    amount: number;
    date: string;
    walletId?: string;
    note?: string;
    syncWithWallet: boolean;
  }) => Promise<void>;
}

export const DebtPaymentModal: React.FC<DebtPaymentModalProps> = ({
  visible,
  debt,
  wallets,
  onClose,
  onSubmit,
}) => {
  const { showPopup } = usePopup();

  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  const [selectedWalletId, setSelectedWalletId] = useState<string | undefined>(undefined);
  const [showWalletPicker, setShowWalletPicker] = useState<boolean>(false);

  const [syncWithWallet, setSyncWithWallet] = useState<boolean>(true);
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const remainingAmount = debt ? Math.max(debt.totalAmount - (debt.paidAmount || 0), 0) : 0;
  const isLend = debt?.type === 'LEND';

  useEffect(() => {
    if (visible && debt) {
      setAmount(remainingAmount);
      setDate(new Date());
      setSelectedWalletId(debt.walletId || wallets[0]?.id);
      setSyncWithWallet(debt.syncWithWallet ?? true);
      setNote('');
      setIsSubmitting(false);
    }
  }, [visible, debt, wallets, remainingAmount]);

  if (!debt) return null;

  const selectedWallet = wallets.find(
    (w) => w.id === selectedWalletId || w.name === selectedWalletId
  );

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    try {
      Haptics.impactAsync(style);
    } catch {
      // Ignore
    }
  };

  const handleQuickFillRemaining = () => {
    triggerHaptic();
    setAmount(remainingAmount);
  };

  const handleSubmit = async () => {
    if (amount <= 0) {
      showPopup({
        type: 'WARNING',
        title: 'Số tiền chưa hợp lệ',
        message: 'Vui lòng nhập số tiền lớn hơn 0.',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

      const now = new Date();
      const paymentDate = new Date(date);
      paymentDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

      await onSubmit({
        amount,
        date: paymentDate.toISOString(),
        walletId: selectedWalletId,
        note: note.trim() || undefined,
        syncWithWallet,
      });

      onClose();
    } catch {
      showPopup({
        type: 'ERROR',
        title: 'Lỗi',
        message: 'Không thể ghi nhận thanh toán. Vui lòng thử lại.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateDisplay = (d: Date) => {
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.typeIconBadge,
                  isLend ? styles.typeIconBadgeLend : styles.typeIconBadgeBorrow,
                ]}
              >
                {isLend ? (
                  <ArrowDownLeft size={18} color={colors.income} strokeWidth={2.5} />
                ) : (
                  <ArrowUpRight size={18} color={colors.expense} strokeWidth={2.5} />
                )}
              </View>
              <View>
                <Text style={styles.headerTitle}>
                  {isLend ? 'Thu hồi nợ' : 'Trả nợ'}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {isLend ? `Thu tiền từ ${debt.personName}` : `Trả tiền cho ${debt.personName}`}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Remaining Amount Box */}
            <View style={styles.summaryBox}>
              <View>
                <Text style={styles.summaryLabel}>Số nợ còn lại</Text>
                <Text style={styles.summaryAmount}>{formatVND(remainingAmount)}</Text>
              </View>

              <TouchableOpacity
                style={styles.quickFillBtn}
                onPress={handleQuickFillRemaining}
                activeOpacity={0.7}
              >
                <Text style={styles.quickFillBtnText}>Trả hết</Text>
              </TouchableOpacity>
            </View>

            {/* Input Amount */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {isLend ? 'SỐ TIỀN THU VỀ (VND)' : 'SỐ TIỀN TRẢ ĐI (VND)'}
              </Text>
              <CurrencyInput
                value={amount}
                onChangeValue={setAmount}
                placeholder="0"
                containerStyle={styles.currencyContainer}
                inputStyle={styles.currencyInput}
              />
            </View>

            {/* Date Picker Button */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NGÀY THỰC HIỆN</Text>
              <TouchableOpacity
                style={styles.selectorButton}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
              >
                <View style={styles.selectorLeft}>
                  <CalendarIcon size={18} color={colors.primary} />
                  <Text style={styles.selectorValueText}>{formatDateDisplay(date)}</Text>
                </View>
                <ChevronDown size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Wallet Picker Button */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {isLend ? 'VÍ TIỀN NHẬN VỀ' : 'VÍ TIỀN TRÍCH TRẢ'}
              </Text>
              <TouchableOpacity
                style={styles.selectorButton}
                onPress={() => setShowWalletPicker(true)}
                activeOpacity={0.7}
              >
                <View style={styles.selectorLeft}>
                  {selectedWallet?.logoId ? (
                    <WalletLogo logoId={selectedWallet.logoId} size={22} />
                  ) : (
                    <WalletIcon size={18} color={colors.primary} />
                  )}
                  <Text style={styles.selectorValueText}>
                    {selectedWallet ? selectedWallet.name : 'Chọn ví nguồn'}
                  </Text>
                </View>
                <ChevronDown size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Sync With Wallet Toggle */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextCol}>
                <Text style={styles.toggleTitle}>Cập nhật số dư ví & Tạo giao dịch</Text>
                <Text style={styles.toggleSubtitle}>
                  {isLend
                    ? 'Tự động cộng tiền vào ví và ghi nhận khoản thu nhập "Thu nợ"'
                    : 'Tự động trừ tiền trong ví và ghi nhận khoản chi tiêu "Trả nợ"'}
                </Text>
              </View>
              <Switch
                value={syncWithWallet}
                onValueChange={(val) => {
                  triggerHaptic();
                  setSyncWithWallet(val);
                }}
                trackColor={{ false: '#334155', true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Note Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>GHI CHÚ (TÙY CHỌN)</Text>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder={isLend ? 'Ví dụ: Trả đợt 1 tiền ăn tối...' : 'Ví dụ: Chuyển khoản qua TPBank...'}
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                amount <= 0 && styles.submitBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={amount <= 0 || isSubmitting}
              activeOpacity={0.8}
            >
              <Check size={18} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
              <Text style={styles.submitBtnText}>
                {isSubmitting ? 'Đang lưu...' : 'Xác nhận'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Date Picker Modal */}
      <CustomDatePicker
        visible={showDatePicker}
        mode="DATE"
        value={date}
        title="Chọn ngày thanh toán"
        onConfirm={(newDate) => {
          if (newDate instanceof Date) {
            setDate(newDate);
          } else if (typeof newDate === 'string') {
            setDate(new Date(newDate));
          }
          setShowDatePicker(false);
        }}
        onClose={() => setShowDatePicker(false)}
      />

      {/* Wallet Select Modal */}
      <WalletSelectModal
        visible={showWalletPicker}
        wallets={wallets}
        selectedWalletName={selectedWallet?.name || ''}
        onSelectWallet={(w) => {
          setSelectedWalletId(w.id);
          setShowWalletPicker(false);
        }}
        onClose={() => setShowWalletPicker(false)}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: colors.borderLight,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  typeIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconBadgeLend: {
    backgroundColor: colors.incomeSoft,
  },
  typeIconBadgeBorrow: {
    backgroundColor: colors.expenseSoft,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 20,
  },
  bodyContent: {
    paddingVertical: 18,
    gap: 18,
  },
  summaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  summaryAmount: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 4,
  },
  quickFillBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  quickFillBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryBright,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  currencyContainer: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    height: 52,
    justifyContent: 'center',
  },
  currencyInput: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    height: 50,
  },
  selectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectorValueText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  toggleTextCol: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  toggleSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 3,
    lineHeight: 16,
  },
  noteInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    height: 48,
    fontSize: 14,
    color: colors.textPrimary,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  submitBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
