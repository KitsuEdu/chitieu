import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { X, Check } from 'lucide-react-native';
import { Wallet } from '../types';
import { WalletLogo } from './WalletLogo';
import { formatVND } from '../utils/format';
import { colors } from '../theme/colors';

interface WalletSelectModalProps {
  visible: boolean;
  wallets: Wallet[];
  selectedWalletName: string;
  title?: string;
  subtitle?: string;
  excludeWalletId?: string;
  onClose: () => void;
  onSelectWallet: (wallet: Wallet) => void;
}

const triggerHaptic = () => {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Ignore on unsupported devices
  }
};

export const WalletSelectModal: React.FC<WalletSelectModalProps> = ({
  visible,
  wallets,
  selectedWalletName,
  title = 'Chọn Ví',
  subtitle = 'Chọn tài khoản cho giao dịch này',
  excludeWalletId,
  onClose,
  onSelectWallet,
}) => {
  const displayedWallets = excludeWalletId
    ? wallets.filter((w) => w.id !== excludeWalletId)
    : wallets;

  const getWalletSubtext = (w: Wallet) => {

    if (w.type === 'CREDIT_CARD' || w.type === 'PAYLATER') {
      const debt = w.currentBalance || 0;
      return `Dư nợ: ${formatVND(debt)}`;
    }
    return `Số dư: ${formatVND(w.balance || 0)}`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* List */}
          <FlatList
            data={displayedWallets}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isSelected = item.name === selectedWalletName;
              return (
                <TouchableOpacity
                  style={[
                    styles.walletItem,
                    isSelected && styles.walletItemSelected,
                  ]}
                  onPress={() => {
                    triggerHaptic();
                    onSelectWallet(item);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemLeft}>
                    <WalletLogo
                      logoId={item.logoId || item.icon}
                      icon={item.icon}
                      name={item.name}
                      type={item.type}
                      size={24}
                      style={{ marginRight: 12 }}
                    />
                    <View>
                      <Text
                        style={[
                          styles.walletName,
                          isSelected && styles.walletNameSelected,
                        ]}
                      >
                        {item.name}
                      </Text>
                      <Text style={styles.walletBalance}>
                        {getWalletSubtext(item)}
                      </Text>
                    </View>
                  </View>

                  {isSelected && (
                    <View style={styles.checkBadge}>
                      <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetContainer: {
    backgroundColor: '#12141F',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.07)',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#161926',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  walletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#161926',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  walletItemSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  walletName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  walletNameSelected: {
    color: '#8B5CF6',
  },
  walletBalance: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
