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
  User,
  Calendar as CalendarIcon,
  Wallet as WalletIcon,
  ChevronDown,
  Check,
  Clock,
} from 'lucide-react-native';
import { DebtRecord, DebtType, Wallet } from '../types';
import { CurrencyInput } from './CurrencyInput';
import { CustomDatePicker } from './CustomDatePicker';
import { WalletSelectModal } from './WalletSelectModal';
import { WalletLogo } from './WalletLogo';
import { SegmentedTabs, SegmentedTabItem } from './SegmentedTabs';
import { colors } from '../theme/colors';
import { usePopup } from '../context/PopupContext';

const DEBT_TYPE_TABS: readonly SegmentedTabItem<DebtType>[] = [
  {
    key: 'LEND',
    label: 'Cho vay (Thu về)',
    activeColor: colors.income,
    activeBgColor: 'rgba(52, 211, 153, 0.18)',
    activeBorderColor: 'rgba(52, 211, 153, 0.45)',
  },
  {
    key: 'BORROW',
    label: 'Đi vay (Trả đi)',
    activeColor: colors.expense,
    activeBgColor: 'rgba(244, 63, 94, 0.18)',
    activeBorderColor: 'rgba(244, 63, 94, 0.45)',
  },
];

interface DebtFormModalProps {
  visible: boolean;
  initialDebt?: DebtRecord | null;
  wallets: Wallet[];
  onClose: () => void;
  onSubmit: (debtData: {
    type: DebtType;
    personName: string;
    totalAmount: number;
    createdDate: string;
    dueDate?: string;
    walletId?: string;
    syncWithWallet: boolean;
    note?: string;
  }) => Promise<void>;
}

export const DebtFormModal: React.FC<DebtFormModalProps> = ({
  visible,
  initialDebt,
  wallets,
  onClose,
  onSubmit,
}) => {
  const { showPopup } = usePopup();

  const [type, setType] = useState<DebtType>('LEND');
  const [personName, setPersonName] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [createdDate, setCreatedDate] = useState<Date>(new Date());
  const [hasDueDate, setHasDueDate] = useState<boolean>(false);
  const [dueDate, setDueDate] = useState<Date>(new Date(Date.now() + 7 * 86400000));
  const [selectedWalletId, setSelectedWalletId] = useState<string | undefined>(undefined);
  const [syncWithWallet, setSyncWithWallet] = useState<boolean>(true);
  const [note, setNote] = useState<string>('');

  const [showCreatedDatePicker, setShowCreatedDatePicker] = useState<boolean>(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState<boolean>(false);
  const [showWalletPicker, setShowWalletPicker] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const isEditMode = Boolean(initialDebt);

  useEffect(() => {
    if (visible) {
      if (initialDebt) {
        setType(initialDebt.type);
        setPersonName(initialDebt.personName);
        setTotalAmount(initialDebt.totalAmount);
        setCreatedDate(new Date(initialDebt.createdDate));
        if (initialDebt.dueDate) {
          setHasDueDate(true);
          setDueDate(new Date(initialDebt.dueDate));
        } else {
          setHasDueDate(false);
          setDueDate(new Date(Date.now() + 7 * 86400000));
        }
        setSelectedWalletId(initialDebt.walletId || wallets[0]?.id);
        setSyncWithWallet(initialDebt.syncWithWallet ?? false);
        setNote(initialDebt.note || '');
      } else {
        setType('LEND');
        setPersonName('');
        setTotalAmount(0);
        setCreatedDate(new Date());
        setHasDueDate(false);
        setDueDate(new Date(Date.now() + 7 * 86400000));
        setSelectedWalletId(wallets[0]?.id);
        setSyncWithWallet(true);
        setNote('');
      }
      setIsSubmitting(false);
    }
  }, [visible, initialDebt, wallets]);

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

  const formatDateDisplay = (d: Date) => {
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleSubmit = async () => {
    if (!personName.trim()) {
      showPopup({
        type: 'WARNING',
        title: 'Chưa nhập tên người liên quan',
        message: 'Vui lòng nhập tên người vay hoặc chủ nợ.',
      });
      return;
    }

    if (totalAmount <= 0) {
      showPopup({
        type: 'WARNING',
        title: 'Số tiền chưa hợp lệ',
        message: 'Vui lòng nhập số tiền gốc lớn hơn 0.',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

      const now = new Date();
      const createdDateWithTime = new Date(createdDate);
      createdDateWithTime.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

      let dueDateIso: string | undefined = undefined;
      if (hasDueDate) {
        const dueDateWithTime = new Date(dueDate);
        dueDateWithTime.setHours(23, 59, 59);
        dueDateIso = dueDateWithTime.toISOString();
      }

      await onSubmit({
        type,
        personName: personName.trim(),
        totalAmount,
        createdDate: createdDateWithTime.toISOString(),
        dueDate: dueDateIso,
        walletId: selectedWalletId,
        syncWithWallet: isEditMode ? false : syncWithWallet, // Khi edit không lặp lại sync ví
        note: note.trim() || undefined,
      });

      onClose();
    } catch {
      showPopup({
        type: 'ERROR',
        title: 'Lỗi',
        message: 'Không thể lưu khoản nợ. Vui lòng kiểm tra lại.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {isEditMode ? 'Chỉnh sửa khoản nợ' : 'Tạo khoản nợ mới'}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Type Switcher: Cho vay vs Đi vay (Dùng global SegmentedTabs) */}
            {!isEditMode && (
              <SegmentedTabs<DebtType>
                tabs={DEBT_TYPE_TABS}
                activeKey={type}
                onChange={(newType) => {
                  triggerHaptic();
                  setType(newType);
                }}
                tabHeight={42}
              />
            )}


            {/* Person Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {type === 'LEND' ? 'NGƯỜI VAY TIỀN *' : 'CHỦ NỢ (NGƯỜI CHO BẠN VAY) *'}
              </Text>
              <View style={styles.textInputWrapper}>
                <User size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={personName}
                  onChangeText={setPersonName}
                  placeholder={type === 'LEND' ? 'Ví dụ: Anh Nam, Bạn Hùng...' : 'Ví dụ: Chị Lan, Ngân hàng...'}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* Total Amount Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>TỔNG SỐ TIỀN GỐC (VND) *</Text>
              <CurrencyInput
                value={totalAmount}
                onChangeValue={setTotalAmount}
                placeholder="0"
                containerStyle={styles.currencyContainer}
                inputStyle={styles.currencyInput}
              />
            </View>

            {/* Date Group: Created Date & Due Date */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NGÀY VAY / CHO VAY</Text>
              <TouchableOpacity
                style={styles.selectorButton}
                onPress={() => setShowCreatedDatePicker(true)}
                activeOpacity={0.7}
              >
                <View style={styles.selectorLeft}>
                  <CalendarIcon size={18} color={colors.primary} />
                  <Text style={styles.selectorValueText}>{formatDateDisplay(createdDate)}</Text>
                </View>
                <ChevronDown size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Due Date Option */}
            <View style={styles.dueDateCard}>
              <View style={styles.dueDateToggleRow}>
                <View style={styles.dueDateToggleLeft}>
                  <Clock size={18} color={colors.primary} />
                  <View>
                    <Text style={styles.dueDateToggleTitle}>Hạn hẹn trả tiền</Text>
                    <Text style={styles.dueDateToggleSubtitle}>
                      Nhắc nhở khi đến ngày thanh toán
                    </Text>
                  </View>
                </View>
                <Switch
                  value={hasDueDate}
                  onValueChange={(val) => {
                    triggerHaptic();
                    setHasDueDate(val);
                  }}
                  trackColor={{ false: '#334155', true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {hasDueDate && (
                <TouchableOpacity
                  style={[styles.selectorButton, { marginTop: 12 }]}
                  onPress={() => setShowDueDatePicker(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.selectorLeft}>
                    <CalendarIcon size={18} color={colors.primaryBright} />
                    <Text style={[styles.selectorValueText, { color: colors.primaryBright }]}>
                      {formatDateDisplay(dueDate)}
                    </Text>
                  </View>
                  <ChevronDown size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Wallet Picker */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {type === 'LEND' ? 'VÍ TIỀN TRÍCH CHO VAY' : 'VÍ TIỀN NHẬN TIỀN VAY'}
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

            {/* Sync With Wallet (chỉ cho phép khi tạo mới để tránh double sync khi sửa) */}
            {!isEditMode && (
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextCol}>
                  <Text style={styles.toggleTitle}>Cập nhật số dư ví & Tạo giao dịch</Text>
                  <Text style={styles.toggleSubtitle}>
                    {type === 'LEND'
                      ? 'Tự động trừ tiền từ ví và tạo giao dịch chi tiêu "Cho vay"'
                      : 'Tự động cộng tiền vào ví và tạo giao dịch thu nhập "Đi vay"'}
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
            )}

            {/* Note */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>GHI CHÚ / MỤC ĐÍCH (TÙY CHỌN)</Text>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="Ví dụ: Mượn tiền đóng học phí, Tiền ăn chung..."
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
                (!personName.trim() || totalAmount <= 0) && styles.submitBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!personName.trim() || totalAmount <= 0 || isSubmitting}
              activeOpacity={0.8}
            >
              <Check size={18} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
              <Text style={styles.submitBtnText}>
                {isSubmitting ? 'Đang lưu...' : isEditMode ? 'Cập nhật' : 'Tạo khoản nợ'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Date Pickers */}
      <CustomDatePicker
        visible={showCreatedDatePicker}
        mode="DATE"
        value={createdDate}
        title="Chọn ngày vay / cho vay"
        onConfirm={(newDate) => {
          if (newDate instanceof Date) {
            setCreatedDate(newDate);
          } else if (typeof newDate === 'string') {
            setCreatedDate(new Date(newDate));
          }
          setShowCreatedDatePicker(false);
        }}
        onClose={() => setShowCreatedDatePicker(false)}
      />

      <CustomDatePicker
        visible={showDueDatePicker}
        mode="DATE"
        value={dueDate}
        title="Chọn ngày hẹn trả"
        onConfirm={(newDate) => {
          if (newDate instanceof Date) {
            setDueDate(newDate);
          } else if (typeof newDate === 'string') {
            setDueDate(new Date(newDate));
          }
          setShowDueDatePicker(false);
        }}
        onClose={() => setShowDueDatePicker(false)}
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
    maxHeight: '92%',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
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
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  textInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
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
  dueDateCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dueDateToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dueDateToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dueDateToggleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dueDateToggleSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
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
