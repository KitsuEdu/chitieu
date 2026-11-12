import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  FadeInDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  LayoutDashboard,
  Wallet,
  ReceiptText,
  Settings,
  Plus,
} from 'lucide-react-native';

import { OverviewScreen, QuickPreset } from './src/screens/OverviewScreen';
import { WalletsScreen } from './src/screens/WalletsScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { QuickEntryModal } from './src/screens/QuickEntryModal';
import { colors } from './src/theme/colors';

type MainTabType = 'OVERVIEW' | 'WALLETS' | 'HISTORY' | 'SETTINGS';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_HEIGHT = 68;
const PILL_WIDTH = 64;
const NUM_SLOTS = 5;

const TAB_SLOT_INDICES: Record<MainTabType, number> = {
  OVERVIEW: 0,
  WALLETS: 1,
  HISTORY: 3,
  SETTINGS: 4,
};

const getSlotCenter = (slotIndex: number, width: number) => {
  const slotWidth = width / NUM_SLOTS;
  return slotIndex * slotWidth + slotWidth / 2;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ==========================================
// 1. COMPONENT TAB ITEM ĐỘNG CHO TỪNG TAB
// ==========================================
interface NavTabItemProps {
  label: string;
  icon: (color: string) => React.ReactNode;
  isActive: boolean;
  onPress: () => void;
}

const NavTabItem: React.FC<NavTabItemProps> = ({
  label,
  icon,
  isActive,
  onPress,
}) => {
  const iconTranslateY = useSharedValue(isActive ? -3 : 0);
  const iconScale = useSharedValue(isActive ? 1.15 : 1);
  const labelOpacity = useSharedValue(isActive ? 1 : 0.55);
  const labelScale = useSharedValue(isActive ? 1 : 0.92);

  useEffect(() => {
    if (isActive) {
      iconTranslateY.value = withSpring(-3, { damping: 12, stiffness: 160 });
      iconScale.value = withSequence(
        withTiming(0.85, { duration: 80 }),
        withSpring(1.15, { damping: 10, stiffness: 180 })
      );
      labelOpacity.value = withTiming(1, { duration: 180 });
      labelScale.value = withSpring(1, { damping: 14 });
    } else {
      iconTranslateY.value = withSpring(0, { damping: 14 });
      iconScale.value = withSpring(1, { damping: 14 });
      labelOpacity.value = withTiming(0.55, { duration: 180 });
      labelScale.value = withSpring(0.92, { damping: 14 });
    }
  }, [isActive]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: iconTranslateY.value },
      { scale: iconScale.value },
    ],
  }));

  const animatedLabelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
    transform: [{ scale: labelScale.value }],
  }));

  const activeColor = '#A855F7';
  const inactiveColor = colors.textMuted;
  const currentColor = isActive ? activeColor : inactiveColor;

  return (
    <TouchableOpacity
      style={styles.navItem}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Animated.View style={animatedIconStyle}>
        {icon(currentColor)}
      </Animated.View>

      <Animated.Text
        style={[
          styles.navLabel,
          isActive ? styles.navLabelActive : styles.navLabelInactive,
          animatedLabelStyle,
        ]}
      >
        {label}
      </Animated.Text>
    </TouchableOpacity>
  );
};

// ==========================================
// 2. NÚT FAB (+) Ở GIỮA VỚI MICRO-INTERACTION
// ==========================================
interface CenterFABProps {
  isOpen: boolean;
  onPress: () => void;
}

const CenterFAB: React.FC<CenterFABProps> = ({ isOpen, onPress }) => {
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);

  useEffect(() => {
    rotate.value = withSpring(isOpen ? 45 : 0, {
      damping: 12,
      stiffness: 150,
    });
  }, [isOpen]);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  const animatedPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const handlePressIn = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Ignore
    }
    scale.value = withSpring(0.88, { damping: 12, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10, stiffness: 180 });
    // Hiệu ứng sóng lan tỏa nhẹ
    pulseScale.value = 1;
    pulseOpacity.value = 0.55;
    pulseScale.value = withTiming(1.45, { duration: 400 });
    pulseOpacity.value = withTiming(0, { duration: 400 });
  };

  return (
    <View style={styles.fabWrapper} pointerEvents="box-none">
      {/* Vòng pulse lan tỏa */}
      <Animated.View style={[styles.fabPulseRing, animatedPulseStyle]} pointerEvents="none" />

      <AnimatedPressable
        style={[styles.fabButton, animatedButtonStyle]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
      >
        <Animated.View style={animatedIconStyle}>
          <Plus size={26} color="#FFFFFF" strokeWidth={2.6} />
        </Animated.View>
      </AnimatedPressable>
    </View>
  );
};

// ==========================================
// 3. MAIN APP COMPONENT
// ==========================================
export default function App() {
  const [currentTab, setCurrentTab] = useState<MainTabType>('OVERVIEW');
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState<boolean>(false);
  const [quickEntryPreset, setQuickEntryPreset] = useState<QuickPreset | null>(null);
  const [dataVersion, setDataVersion] = useState<number>(0);
  const [barWidth, setBarWidth] = useState<number>(SCREEN_WIDTH);

  // Vị trí ngang của Active Sliding Pill
  const indicatorTranslateX = useSharedValue(
    getSlotCenter(TAB_SLOT_INDICES.OVERVIEW, SCREEN_WIDTH) - PILL_WIDTH / 2
  );

  useEffect(() => {
    const targetX =
      getSlotCenter(TAB_SLOT_INDICES[currentTab], barWidth) - PILL_WIDTH / 2;
    indicatorTranslateX.value = withSpring(targetX, {
      damping: 16,
      stiffness: 180,
      mass: 0.8,
    });
  }, [currentTab, barWidth]);

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorTranslateX.value }],
  }));

  const handleTabPress = (tab: MainTabType) => {
    if (tab !== currentTab) {
      try {
        Haptics.selectionAsync();
      } catch {
        // Ignore
      }
      setCurrentTab(tab);
    }
  };

  const handleDataChanged = () => {
    setDataVersion((v) => v + 1);
  };

  const handleOpenQuickEntry = (preset?: QuickPreset) => {
    setQuickEntryPreset(preset || null);
    setIsQuickEntryOpen(true);
  };

  const handleCloseQuickEntry = () => {
    setIsQuickEntryOpen(false);
    setQuickEntryPreset(null);
  };

  // SVG Concave Notch ôm quanh FAB
  const cx = barWidth / 2;
  const notchWidth = 46;
  const notchDepth = 26;

  const curvedBarPath = `
    M 0 0
    L ${cx - notchWidth} 0
    C ${cx - 28} 0, ${cx - 22} ${notchDepth}, ${cx} ${notchDepth}
    C ${cx + 22} ${notchDepth}, ${cx + 28} 0, ${cx + notchWidth} 0
    L ${barWidth} 0
    L ${barWidth} ${BAR_HEIGHT}
    L 0 ${BAR_HEIGHT}
    Z
  `;

  const topStrokePath = `
    M 0 0
    L ${cx - notchWidth} 0
    C ${cx - 28} 0, ${cx - 22} ${notchDepth}, ${cx} ${notchDepth}
    C ${cx + 22} ${notchDepth}, ${cx + 28} 0, ${cx + notchWidth} 0
    L ${barWidth} 0
  `;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <StatusBar style="light" />

          {/* Nội dung Màn hình chính theo Tab (Chuyển cảnh mượt mà FadeInDown) */}
          <Animated.View
            key={`screen-${currentTab}`}
            entering={FadeInDown.duration(220).springify().damping(18)}
            style={styles.screenContainer}
          >
            {currentTab === 'OVERVIEW' && (
              <OverviewScreen
                key={`overview-${dataVersion}`}
                onNavigateToHistory={() => handleTabPress('HISTORY')}
                onNavigateToWallets={() => handleTabPress('WALLETS')}
                onNavigateToSettings={() => handleTabPress('SETTINGS')}
                onOpenQuickEntry={handleOpenQuickEntry}
              />
            )}

            {currentTab === 'WALLETS' && (
              <WalletsScreen
                key={`wallets-${dataVersion}`}
                onWalletsUpdated={handleDataChanged}
              />
            )}

            {currentTab === 'HISTORY' && (
              <HistoryScreen
                key={`history-${dataVersion}`}
                onRefreshTriggered={handleDataChanged}
              />
            )}

            {currentTab === 'SETTINGS' && (
              <SettingsScreen
                key={`settings-${dataVersion}`}
                onSettingsSaved={handleDataChanged}
              />
            )}
          </Animated.View>

          {/* Thanh Bottom Navigation Khắc Đường Cong Concave */}
          <View
            style={styles.bottomNavContainer}
            onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
          >
            {/* Nền SVG Solid Flat Matte #12141F với viền mỏng 1px */}
            <Svg
              width={barWidth}
              height={BAR_HEIGHT}
              style={StyleSheet.absoluteFill}
            >
              <Path d={curvedBarPath} fill={colors.surfaceSecondary} />
              <Path
                d={topStrokePath}
                stroke={colors.border}
                strokeWidth={1}
                fill="none"
              />
            </Svg>

            {/* Sliding Active Pill & Top Glow Bar (Trượt ngang mượt mà) */}
            <Animated.View
              style={[styles.indicatorContainer, animatedIndicatorStyle]}
              pointerEvents="none"
            >
              {/* Vạch sáng trên đỉnh tab (Top Glow Bar) */}
              <View style={styles.topGlowBar} />
              {/* Khối nền viên thuốc (Active Indicator Pill) */}
              <View style={styles.activePill} />
            </Animated.View>

            {/* Các Tab điều hướng */}
            <View style={styles.bottomNavContent}>
              {/* Tab 1: Tổng quan */}
              <NavTabItem
                label="Tổng quan"
                isActive={currentTab === 'OVERVIEW'}
                icon={(color) => <LayoutDashboard size={20} color={color} />}
                onPress={() => handleTabPress('OVERVIEW')}
              />

              {/* Tab 2: Ví */}
              <NavTabItem
                label="Ví"
                isActive={currentTab === 'WALLETS'}
                icon={(color) => <Wallet size={20} color={color} />}
                onPress={() => handleTabPress('WALLETS')}
              />

              {/* Khoảng trống FAB ở giữa */}
              <View style={styles.navFabPlaceholder} pointerEvents="none" />

              {/* Tab 3: Lịch sử */}
              <NavTabItem
                label="Lịch sử"
                isActive={currentTab === 'HISTORY'}
                icon={(color) => <ReceiptText size={20} color={color} />}
                onPress={() => handleTabPress('HISTORY')}
              />

              {/* Tab 4: Cài đặt */}
              <NavTabItem
                label="Cài đặt"
                isActive={currentTab === 'SETTINGS'}
                icon={(color) => <Settings size={20} color={color} />}
                onPress={() => handleTabPress('SETTINGS')}
              />
            </View>

            {/* Nút FAB (+) ở giữa: Micro-interaction nảy đàn hồi */}
            <CenterFAB
              isOpen={isQuickEntryOpen}
              onPress={() => handleOpenQuickEntry()}
            />
          </View>

          {/* Modal Nhập Nhanh Bottom Sheet */}
          <QuickEntryModal
            visible={isQuickEntryOpen}
            onClose={handleCloseQuickEntry}
            onTransactionSaved={handleDataChanged}
            initialPreset={quickEntryPreset}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  screenContainer: {
    flex: 1,
  },
  bottomNavContainer: {
    position: 'relative',
    height: BAR_HEIGHT,
    backgroundColor: 'transparent',
  },
  indicatorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PILL_WIDTH,
    height: BAR_HEIGHT,
    alignItems: 'center',
    zIndex: 1,
  },
  topGlowBar: {
    position: 'absolute',
    top: 0,
    width: 20,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#A855F7',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  activePill: {
    position: 'absolute',
    top: 16,
    width: 64,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  bottomNavContent: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  navLabel: {
    fontSize: 10,
    marginTop: 3,
  },
  navLabelActive: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
  navLabelInactive: {
    color: '#64748B',
    fontWeight: '500',
  },
  navFabPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabWrapper: {
    position: 'absolute',
    top: -18,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  fabPulseRing: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(139, 92, 246, 0.4)',
  },
  fabButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary, // Solid Matte Violet #8B5CF6
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
});
