import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  Dimensions,
  Platform,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import {
  X,
  Search,
  Check,
  Ban,
  Building2,
  Smartphone,
  Layers,
} from 'lucide-react-native';
import {
  BANK_LOGOS,
  EWALLET_LOGOS,
  ALL_LOGOS,
  WalletLogoItem,
  searchLogos,
} from '../constants/logos';
import { WalletType } from '../types';
import { colors } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = 4;
const ITEM_SPACING = 8;
const HORIZONTAL_PADDING = 16;
const CARD_WIDTH = Math.floor(
  (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - ITEM_SPACING * (NUM_COLUMNS - 1)) /
    NUM_COLUMNS
);

interface LogoPickerModalProps {
  visible: boolean;
  walletType?: WalletType;
  selectedLogoId?: string;
  onClose: () => void;
  onSelectLogo: (logo: WalletLogoItem | null) => void;
}

export const LogoPickerModal: React.FC<LogoPickerModalProps> = ({
  visible,
  walletType,
  selectedLogoId,
  onClose,
  onSelectLogo,
}) => {
  const defaultCategory = useMemo(() => {
    if (walletType === 'PAYLATER') return 'ewallet';
    return 'bank';
  }, [walletType]);

  const [activeCategory, setActiveCategory] = useState<'bank' | 'ewallet' | 'all'>(
    defaultCategory
  );
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sync category when walletType changes or modal opens
  React.useEffect(() => {
    if (visible) {
      setActiveCategory(walletType === 'PAYLATER' ? 'ewallet' : 'bank');
      setSearchQuery('');
    }
  }, [visible, walletType]);

  const filteredLogos = useMemo(() => {
    return searchLogos(searchQuery, activeCategory);
  }, [searchQuery, activeCategory]);

  const renderItem = ({ item }: { item: WalletLogoItem }) => {
    const isSelected = selectedLogoId === item.id;

    return (
      <TouchableOpacity
        style={[styles.logoCard, isSelected && styles.logoCardSelected]}
        onPress={() => {
          onSelectLogo(item);
          onClose();
        }}
        activeOpacity={0.7}
      >
        <View style={styles.svgWrapper}>
          <SvgXml xml={item.xml} width={34} height={34} />
        </View>
        <Text style={[styles.logoName, isSelected && styles.logoNameSelected]} numberOfLines={1}>
          {item.name}
        </Text>
        {isSelected && (
          <View style={styles.selectedBadge}>
            <Check size={10} color="#FFFFFF" strokeWidth={3} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Chọn logo thương hiệu</Text>
              <Text style={styles.subTitle}>
                {activeCategory === 'bank'
                  ? '64 ngân hàng tại Việt Nam'
                  : activeCategory === 'ewallet'
                  ? '20 ví điện tử phổ biến'
                  : 'Tất cả 84 logo ngân hàng & ví'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Ô Tìm Kiếm */}
          <View style={styles.searchBar}>
            <Search size={16} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm ngân hàng, ví (VD: VCB, MB, Momo...)"
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Tabs */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeCategory === 'bank' && styles.tabBtnActive,
              ]}
              onPress={() => setActiveCategory('bank')}
              activeOpacity={0.7}
            >
              <Building2
                size={14}
                color={
                  activeCategory === 'bank' ? colors.primaryBright : colors.textMuted
                }
                style={{ marginRight: 5 }}
              />
              <Text
                style={[
                  styles.tabText,
                  activeCategory === 'bank' && styles.tabTextActive,
                ]}
              >
                Ngân hàng ({BANK_LOGOS.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeCategory === 'ewallet' && styles.tabBtnActive,
              ]}
              onPress={() => setActiveCategory('ewallet')}
              activeOpacity={0.7}
            >
              <Smartphone
                size={14}
                color={
                  activeCategory === 'ewallet' ? colors.primaryBright : colors.textMuted
                }
                style={{ marginRight: 5 }}
              />
              <Text
                style={[
                  styles.tabText,
                  activeCategory === 'ewallet' && styles.tabTextActive,
                ]}
              >
                Ví điện tử ({EWALLET_LOGOS.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeCategory === 'all' && styles.tabBtnActive,
              ]}
              onPress={() => setActiveCategory('all')}
              activeOpacity={0.7}
            >
              <Layers
                size={14}
                color={
                  activeCategory === 'all' ? colors.primaryBright : colors.textMuted
                }
                style={{ marginRight: 5 }}
              />
              <Text
                style={[
                  styles.tabText,
                  activeCategory === 'all' && styles.tabTextActive,
                ]}
              >
                Tất cả ({ALL_LOGOS.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Nút hủy chọn logo (Dùng icon mặc định) */}
          <TouchableOpacity
            style={styles.noLogoBtn}
            onPress={() => {
              onSelectLogo(null);
              onClose();
            }}
            activeOpacity={0.7}
          >
            <Ban size={15} color={colors.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.noLogoText}>Không sử dụng logo (Dùng icon mặc định)</Text>
          </TouchableOpacity>

          {/* Grid Logo */}
          <FlatList
            data={filteredLogos}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            numColumns={NUM_COLUMNS}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={true}
            initialNumToRender={24}
            maxToRenderPerBatch={24}
            windowSize={5}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  Không tìm thấy logo phù hợp với từ khóa "{searchQuery}"
                </Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subTitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    marginHorizontal: HORIZONTAL_PADDING,
    paddingHorizontal: 10,
    height: 42,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: HORIZONTAL_PADDING,
    marginBottom: 10,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  tabText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.primaryBright,
    fontWeight: '700',
  },
  noLogoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: HORIZONTAL_PADDING,
    marginBottom: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderStyle: 'dashed',
  },
  noLogoText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 20,
  },
  columnWrapper: {
    justifyContent: 'flex-start',
    gap: ITEM_SPACING,
    marginBottom: ITEM_SPACING,
  },
  logoCard: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.12,
    backgroundColor: '#0F111A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 6,
    position: 'relative',
  },
  logoCardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(139, 92, 246, 0.14)',
  },
  svgWrapper: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  logoName: {
    fontSize: 11, // Tăng 1px (cũ: 10)
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
    width: '100%',
  },
  logoNameSelected: {
    color: colors.primaryBright,
    fontWeight: '700',
  },
  selectedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14, // Tăng 1px (cũ: 13)
    color: colors.textMuted,
    textAlign: 'center',
  },
});
