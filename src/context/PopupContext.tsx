import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Platform,
} from 'react-native';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Trash2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';

export type PopupType = 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO' | 'DANGER';

export interface PopupOptions {
  type?: PopupType;
  title: string;
  message: string;
  confirmText?: string; // Mặc định: 'Đồng ý' hoặc 'Đã hiểu'
  cancelText?: string;  // Mặc định: 'Hủy' (chỉ hiện ở showConfirm)
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

export interface PopupContextType {
  showPopup: (options: PopupOptions) => void;
  showConfirm: (options: PopupOptions) => void;
  hidePopup: () => void;
}

const PopupContext = createContext<PopupContextType | undefined>(undefined);

const triggerHaptic = (type: PopupType) => {
  try {
    switch (type) {
      case 'SUCCESS':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'ERROR':
      case 'DANGER':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case 'WARNING':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'INFO':
      default:
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
    }
  } catch {
    // Ignore on unsupported devices
  }
};

export const PopupProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isConfirm, setIsConfirm] = useState<boolean>(false);
  const [currentOptions, setCurrentOptions] = useState<PopupOptions | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const showPopup = useCallback((options: PopupOptions) => {
    setCurrentOptions(options);
    setIsConfirm(false);
    setIsLoading(false);
    setIsVisible(true);
    triggerHaptic(options.type || 'INFO');
  }, []);

  const showConfirm = useCallback((options: PopupOptions) => {
    setCurrentOptions(options);
    setIsConfirm(true);
    setIsLoading(false);
    setIsVisible(true);
    triggerHaptic(options.type || 'WARNING');
  }, []);

  const hidePopup = useCallback(() => {
    setIsVisible(false);
    setIsLoading(false);
    setCurrentOptions(null);
  }, []);

  const handleConfirm = async () => {
    if (!currentOptions) return;
    if (currentOptions.onConfirm) {
      try {
        setIsLoading(true);
        await currentOptions.onConfirm();
      } catch (err) {
        console.error('Error executing popup onConfirm:', err);
      } finally {
        setIsLoading(false);
        hidePopup();
      }
    } else {
      hidePopup();
    }
  };

  const handleCancel = () => {
    if (currentOptions?.onCancel) {
      currentOptions.onCancel();
    }
    hidePopup();
  };

  const popupType: PopupType = currentOptions?.type || (isConfirm ? 'WARNING' : 'INFO');

  const renderIcon = () => {
    switch (popupType) {
      case 'SUCCESS':
        return (
          <View style={[styles.iconCircle, styles.iconCircleSuccess]}>
            <CheckCircle2 size={28} color={colors.income} strokeWidth={2.4} />
          </View>
        );
      case 'ERROR':
        return (
          <View style={[styles.iconCircle, styles.iconCircleError]}>
            <XCircle size={28} color={colors.expense} strokeWidth={2.4} />
          </View>
        );
      case 'DANGER':
        return (
          <View style={[styles.iconCircle, styles.iconCircleDanger]}>
            <Trash2 size={26} color={colors.expense} strokeWidth={2.4} />
          </View>
        );
      case 'WARNING':
        return (
          <View style={[styles.iconCircle, styles.iconCircleWarning]}>
            <AlertTriangle size={26} color={colors.warning} strokeWidth={2.4} />
          </View>
        );
      case 'INFO':
      default:
        return (
          <View style={[styles.iconCircle, styles.iconCircleInfo]}>
            <Info size={28} color={colors.primaryBright} strokeWidth={2.4} />
          </View>
        );
    }
  };

  const getConfirmButtonColor = () => {
    switch (popupType) {
      case 'DANGER':
      case 'ERROR':
        return colors.expense;
      case 'SUCCESS':
        return colors.income;
      case 'WARNING':
        return colors.warning;
      case 'INFO':
      default:
        return colors.primary;
    }
  };

  return (
    <PopupContext.Provider value={{ showPopup, showConfirm, hidePopup }}>
      {children}

      <Modal
        visible={isVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleCancel}
      >
        <Pressable
          style={styles.backdrop}
          onPress={isConfirm ? undefined : handleCancel}
        >
          <Pressable style={styles.dialogCard} onPress={(e) => e.stopPropagation()}>
            {/* 1. Icon trang trí theo Type */}
            {renderIcon()}

            {/* 2. Tiêu đề */}
            <Text style={styles.title}>{currentOptions?.title}</Text>

            {/* 3. Nội dung thông báo */}
            <Text style={styles.message}>{currentOptions?.message}</Text>

            {/* 4. Nhóm nút bấm */}
            {isConfirm ? (
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancel}
                  activeOpacity={0.7}
                  disabled={isLoading}
                >
                  <Text style={styles.cancelButtonText}>
                    {currentOptions?.cancelText || 'Hủy'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    { backgroundColor: getConfirmButtonColor() },
                    isLoading && { opacity: 0.7 },
                  ]}
                  onPress={handleConfirm}
                  activeOpacity={0.8}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.confirmButtonText}>
                      {currentOptions?.confirmText || (popupType === 'DANGER' ? 'Xóa' : 'Đồng ý')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.singleButton,
                  { backgroundColor: getConfirmButtonColor() },
                  isLoading && { opacity: 0.7 },
                ]}
                onPress={handleConfirm}
                activeOpacity={0.8}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.singleButtonText}>
                    {currentOptions?.confirmText || 'Đã hiểu'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </PopupContext.Provider>
  );
};

export const usePopup = (): PopupContextType => {
  const context = useContext(PopupContext);
  if (!context) {
    throw new Error('usePopup must be used within a PopupProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.45,
        shadowRadius: 20,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1.5,
  },
  iconCircleSuccess: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  iconCircleError: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  iconCircleDanger: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  iconCircleWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  iconCircleInfo: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  message: {
    fontSize: 13.5,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  confirmButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  singleButton: {
    width: '100%',
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  singleButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
