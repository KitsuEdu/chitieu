import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Wallet as WalletIcon,
  FileText,
  PlusCircle,
  Edit2,
  Trash2,
  RotateCcw,
} from 'lucide-react-native';
import { DebtRecord, Wallet } from '../types';
import { WalletLogo } from './WalletLogo';
import { colors } from '../theme/colors';
import { formatVND, formatDateTime } from '../utils/format';
import { usePopup } from '../context/PopupContext';

interface DebtDetailModalProps {
  visible: boolean;
  debt: DebtRecord | null;
  wallets: Wallet[];
  onClose: () => void;
  onOpenPaymentModal: () => void;
  onOpenEditModal: () => void;
  onToggleSettled: () => void;
  onDeleteDebt: () => void;
}

export const DebtDetailModal: React.FC<DebtDetailModalProps> = ({
  visible,
  debt,
  wallets,
  onClose,
  onOpenPaymentModal,
  onOpenEditModal,
  onToggleSettled,
  onDeleteDebt,
}) => {
  const { showConfirm } = usePopup();

  if (!debt) return null;

  const isLend = debt.type === 'LEND';
  const isSettled = debt.status === 'SETTLED';
  const remainingAmount = Math.max(debt.totalAmount - (debt.paidAmount || 0), 0);
  const progressRatio = Math.min(
    Math.max((debt.paidAmount || 0) / (debt.totalAmount || 1), 0),
    1
  );
  const progressPercent = Math.round(progressRatio * 100);

  const wallet = wallets.find(
    (w) => w.id === debt.walletId || w.name === debt.walletId
  );

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    try {
      Haptics.impactAsync(style);
    } catch {
      // Ignore
    }
  };

  const formatDateDisplay = (isoStr?: string) => {
    if (!isoStr) return 'Không có';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return isoStr;
    }
  };

  // Due date status evaluation
  const getDueDateStatus = () => {
    if (!debt.dueDate) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const targetDate = new Date(debt.dueDate);
    const dueDay = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate()
    ).getTime();

    const diffDays = Math.round((dueDay - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        level: 'OVERDUE' as const,
        label: `Đã quá hạn ${Math.abs(diffDays)} ngày (${formatDateDisplay(debt.dueDate)})`,
      };
    }
    if (diffDays === 0) {
      return {
        level: 'TODAY' as const,
        label: `Đến hạn thanh toán hôm nay (${formatDateDisplay(debt.dueDate)})`,
      };
    }
    return {
      level: 'UPCOMING' as const,
      label: `Còn ${diffDays} ngày nữa đến hạn (${formatDateDisplay(debt.dueDate)})`,
    };
  };

  const dueStatus = getDueDateStatus();

  const handleConfirmToggleSettled = () => {
    triggerHaptic();
    if (isSettled) {
      showConfirm({
        type: 'INFO',
        title: 'Mở lại khoản nợ?',
        message: 'Khoản nợ sẽ được chuyển lại sang trạng thái Đang nợ (ACTIVE).',
        confirmText: 'Mở lại',
        cancelText: 'Giữ nguyên',
        onConfirm: onToggleSettled,
      });
    } else {
      showConfirm({
        type: 'SUCCESS',
        title: 'Xác nhận tất toán?',
        message: `Bạn có chắc muốn đánh dấu khoản nợ của "${debt.personName}" là đã tất toán đủ?`,
        confirmText: 'Tất toán',
        cancelText: 'Hủy',
        onConfirm: onToggleSettled,
      });
    }
  };

  const handleConfirmDelete = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    showConfirm({
      type: 'DANGER',
      title: 'Xóa khoản nợ này?',
      message: `Hành động này sẽ xóa vĩnh viễn khoản nợ "${debt.personName}" và lịch sử thanh toán liên quan khỏi thiết bị.`,
      confirmText: 'Xóa vĩnh viễn',
      cancelText: 'Hủy',
      onConfirm: onDeleteDebt,
    });
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
                  styles.typeBadge,
                  isLend ? styles.typeBadgeLend : styles.typeBadgeBorrow,
                ]}
              >
                {isLend ? (
                  <ArrowDownLeft size={16} color={colors.income} strokeWidth={2.5} />
                ) : (
                  <ArrowUpRight size={16} color={colors.expense} strokeWidth={2.5} />
                )}
                <Text
                  style={[
                    styles.typeBadgeText,
                    isLend ? styles.typeBadgeTextLend : styles.typeBadgeTextBorrow,
                  ]}
                >
                  {isLend ? 'Cho vay' : 'Đi vay'}
                </Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  isSettled ? styles.statusBadgeSettled : styles.statusBadgeActive,
                ]}
              >
                {isSettled ? (
                  <CheckCircle2 size={13} color={colors.income} strokeWidth={2.5} />
                ) : (
                  <Clock size={13} color={colors.primaryBright} strokeWidth={2.5} />
                )}
                <Text
                  style={[
                    styles.statusBadgeText,
                    isSettled ? styles.statusBadgeTextSettled : styles.statusBadgeTextActive,
                  ]}
                >
                  {isSettled ? 'Đã tất toán' : 'Đang nợ'}
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
            {/* Person & Big Remaining Amount */}
            <View style={styles.personCard}>
              <Text style={styles.personName}>{debt.personName}</Text>

              <View style={styles.remainingAmountRow}>
                <Text style={styles.remainingAmountLabel}>
                  {isSettled ? 'Đã hoàn tất thanh toán' : isLend ? 'Cần thu về còn lại' : 'Cần trả đi còn lại'}
                </Text>
                <Text
                  style={[
                    styles.remainingAmountValue,
                    isSettled && { color: colors.income },
                  ]}
                >
                  {isSettled ? '0 VND' : formatVND(remainingAmount)}
                </Text>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressSection}>
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${progressPercent}%` },
                      isSettled && { backgroundColor: colors.income },
                    ]}
                  />
                </View>
                <View style={styles.progressLabels}>
                  <Text style={styles.progressSubtext}>
                    Đã thanh toán: <Text style={{ color: colors.textPrimary }}>{formatVND(debt.paidAmount || 0)}</Text>
                  </Text>
                  <Text style={styles.progressPercentText}>{progressPercent}%</Text>
                </View>
              </View>
            </View>

            {/* Due Date Banner */}
            {!isSettled && dueStatus && (
              <View
                style={[
                  styles.dueBanner,
                  dueStatus.level === 'OVERDUE'
                    ? styles.dueBannerOverdue
                    : dueStatus.level === 'TODAY'
                    ? styles.dueBannerToday
                    : styles.dueBannerUpcoming,
                ]}
              >
                {dueStatus.level === 'OVERDUE' || dueStatus.level === 'TODAY' ? (
                  <AlertTriangle
                    size={16}
                    color={dueStatus.level === 'OVERDUE' ? colors.expense : colors.warning}
                    strokeWidth={2.2}
                  />
                ) : (
                  <Clock size={16} color={colors.primaryBright} strokeWidth={2.2} />
                )}
                <Text
                  style={[
                    styles.dueBannerText,
                    dueStatus.level === 'OVERDUE'
                      ? styles.dueBannerTextOverdue
                      : dueStatus.level === 'TODAY'
                      ? styles.dueBannerTextToday
                      : styles.dueBannerTextUpcoming,
                  ]}
                >
                  {dueStatus.label}
                </Text>
              </View>
            )}

            {/* Key Info Details Grid */}
            <View style={styles.detailsGrid}>
              <View style={styles.detailRow}>
                <View style={styles.detailLeft}>
                  <Calendar size={16} color={colors.textMuted} />
                  <Text style={styles.detailLabel}>Ngày tạo khoản nợ</Text>
                </View>
                <Text style={styles.detailValue}>{formatDateDisplay(debt.createdDate)}</Text>
              </View>

              <View style={styles.rowDivider} />

              <View style={styles.detailRow}>
                <View style={styles.detailLeft}>
                  <Clock size={16} color={colors.textMuted} />
                  <Text style={styles.detailLabel}>Hạn thanh toán</Text>
                </View>
                <Text style={styles.detailValue}>{formatDateDisplay(debt.dueDate)}</Text>
              </View>

              <View style={styles.rowDivider} />

              <View style={styles.detailRow}>
                <View style={styles.detailLeft}>
                  <WalletIcon size={16} color={colors.textMuted} />
                  <Text style={styles.detailLabel}>Ví liên kết</Text>
                </View>
                <View style={styles.walletBadgeRow}>
                  {wallet?.logoId && <WalletLogo logoId={wallet.logoId} size={18} />}
                  <Text style={styles.detailValue}>{wallet ? wallet.name : 'Không liên kết'}</Text>
                </View>
              </View>

              {debt.note ? (
                <>
                  <View style={styles.rowDivider} />
                  <View style={styles.detailRow}>
                    <View style={styles.detailLeft}>
                      <FileText size={16} color={colors.textMuted} />
                      <Text style={styles.detailLabel}>Ghi chú</Text>
                    </View>
                    <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]}>
                      {debt.note}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>

            {/* Primary Action: Record Payment Button */}
            {!isSettled && (
              <TouchableOpacity
                style={styles.paymentActionBtn}
                onPress={() => {
                  triggerHaptic();
                  onOpenPaymentModal();
                }}
                activeOpacity={0.8}
              >
                <PlusCircle size={18} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.paymentActionBtnText}>
                  {isLend ? 'Ghi nhận thu nợ' : 'Ghi nhận trả nợ'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Secondary Actions: Settle / Reopen & Edit & Delete */}
            <View style={styles.actionRowGroup}>
              <TouchableOpacity
                style={styles.secondaryActionBtn}
                onPress={handleConfirmToggleSettled}
                activeOpacity={0.7}
              >
                {isSettled ? (
                  <>
                    <RotateCcw size={16} color={colors.primaryLight} />
                    <Text style={[styles.secondaryActionText, { color: colors.primaryLight }]}>
                      Mở lại nợ
                    </Text>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} color={colors.income} />
                    <Text style={[styles.secondaryActionText, { color: colors.income }]}>
                      Đánh dấu tất toán
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryActionBtn}
                onPress={() => {
                  triggerHaptic();
                  onOpenEditModal();
                }}
                activeOpacity={0.7}
              >
                <Edit2 size={16} color={colors.textSecondary} />
                <Text style={styles.secondaryActionText}>Chỉnh sửa</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryActionBtn, styles.deleteActionBtn]}
                onPress={handleConfirmDelete}
                activeOpacity={0.7}
              >
                <Trash2 size={16} color={colors.expense} />
                <Text style={[styles.secondaryActionText, { color: colors.expense }]}>Xóa</Text>
              </TouchableOpacity>
            </View>

            {/* Payment History List */}
            <View style={styles.historySection}>
              <Text style={styles.historySectionTitle}>
                LỊCH SỬ THANH TOÁN ({debt.payments?.length || 0})
              </Text>

              {(!debt.payments || debt.payments.length === 0) ? (
                <View style={styles.historyEmptyBox}>
                  <Text style={styles.historyEmptyText}>Chưa có đợt thanh toán nào.</Text>
                </View>
              ) : (
                <View style={styles.historyList}>
                  {debt.payments.map((p, idx) => {
                    const payWallet = wallets.find((w) => w.id === p.walletId);
                    return (
                      <View key={p.id || idx} style={styles.historyItem}>
                        <View style={styles.historyItemLeft}>
                          <View
                            style={[
                              styles.historyDot,
                              isLend ? styles.historyDotIncome : styles.historyDotExpense,
                            ]}
                          />
                          <View>
                            <Text style={styles.historyAmountText}>
                              {isLend ? '+' : '-'}{formatVND(p.amount)}
                            </Text>
                            <Text style={styles.historyDateText}>
                              {formatDateTime(p.date)}
                              {payWallet ? ` · ${payWallet.name}` : ''}
                            </Text>
                            {p.note ? (
                              <Text style={styles.historyNoteText}>{p.note}</Text>
                            ) : null}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  typeBadgeLend: {
    backgroundColor: colors.incomeSoft,
  },
  typeBadgeBorrow: {
    backgroundColor: colors.expenseSoft,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  typeBadgeTextLend: {
    color: colors.income,
  },
  typeBadgeTextBorrow: {
    color: colors.expense,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusBadgeSettled: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
  },
  statusBadgeActive: {
    backgroundColor: colors.primarySoft,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadgeTextSettled: {
    color: colors.income,
  },
  statusBadgeTextActive: {
    color: colors.primaryLight,
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
    gap: 16,
    paddingBottom: 36,
  },
  personCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  personName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  remainingAmountRow: {
    marginTop: 4,
  },
  remainingAmountLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  remainingAmountValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 4,
  },
  progressSection: {
    gap: 8,
    marginTop: 6,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: colors.track,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primaryBright,
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressSubtext: {
    fontSize: 12,
    color: colors.textMuted,
  },
  progressPercentText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryLight,
  },
  dueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
  },
  dueBannerOverdue: {
    backgroundColor: colors.expenseSoft,
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  dueBannerToday: {
    backgroundColor: colors.warningSoft,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  dueBannerUpcoming: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.borderAccent,
  },
  dueBannerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dueBannerTextOverdue: {
    color: colors.expense,
  },
  dueBannerTextToday: {
    color: colors.warning,
  },
  dueBannerTextUpcoming: {
    color: colors.primaryLight,
  },
  detailsGrid: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  walletBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  paymentActionBtn: {
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  paymentActionBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionRowGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryActionBtn: {
    flex: 1,
    height: 44,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteActionBtn: {
    borderColor: 'rgba(244, 63, 94, 0.25)',
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  historySection: {
    marginTop: 6,
    gap: 10,
  },
  historySectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  historyEmptyBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyEmptyText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  historyList: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  historyItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyItemLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  historyDotIncome: {
    backgroundColor: colors.income,
  },
  historyDotExpense: {
    backgroundColor: colors.expense,
  },
  historyAmountText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  historyDateText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  historyNoteText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
