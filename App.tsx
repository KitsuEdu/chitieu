import React, { useState } from 'react';
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
  withTiming,
  Easing,
} from 'react-native-reanimated';
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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Nút FAB (+) ở giữa: Solid Flat Matte Primary #8B5CF6, Tối giản, Tinh tế
const CenterFAB: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.96, {
      duration: 100,
      easing: Easing.out(Easing.ease),
    });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, {
      duration: 140,
      easing: Easing.out(Easing.ease),
    });
  };

  return (
    <View style={styles.fabWrapper} pointerEvents="box-none">
      <AnimatedPressable
        style={[styles.fabButton, animatedStyle]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
      >
        <Plus size={26} color="#FFFFFF" strokeWidth={2.6} />
      </AnimatedPressable>
    </View>
  );
};

export default function App() {
  const [currentTab, setCurrentTab] = useState<MainTabType>('OVERVIEW');
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState<boolean>(false);
  const [quickEntryPreset, setQuickEntryPreset] = useState<QuickPreset | null>(null);
  const [dataVersion, setDataVersion] = useState<number>(0);
  const [barWidth, setBarWidth] = useState<number>(SCREEN_WIDTH);

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

          {/* Nội dung Màn hình chính theo Tab */}
          <View style={styles.screenContainer}>
            {currentTab === 'OVERVIEW' && (
              <OverviewScreen
                key={`overview-${dataVersion}`}
                onNavigateToHistory={() => setCurrentTab('HISTORY')}
                onNavigateToWallets={() => setCurrentTab('WALLETS')}
                onNavigateToSettings={() => setCurrentTab('SETTINGS')}
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
          </View>

          {/* Thanh Bottom Navigation Khắc Đường Cong Concave: Solid Flat Matte Dark */}
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

            {/* Các Tab điều hướng */}
            <View style={styles.bottomNavContent}>
              {/* Tab 1: Tổng quan */}
              <TouchableOpacity
                style={[
                  styles.navItem,
                  currentTab === 'OVERVIEW' && styles.navItemActive,
                ]}
                onPress={() => setCurrentTab('OVERVIEW')}
                activeOpacity={0.7}
              >
                <LayoutDashboard
                  size={20}
                  color={currentTab === 'OVERVIEW' ? colors.primaryBright : colors.textMuted}
                />
                <Text
                  style={[
                    styles.navLabel,
                    currentTab === 'OVERVIEW' && styles.navLabelActive,
                  ]}
                >
                  Tổng quan
                </Text>
              </TouchableOpacity>

              {/* Tab 2: Ví & Tài khoản */}
              <TouchableOpacity
                style={[
                  styles.navItem,
                  currentTab === 'WALLETS' && styles.navItemActive,
                ]}
                onPress={() => setCurrentTab('WALLETS')}
                activeOpacity={0.7}
              >
                <Wallet
                  size={20}
                  color={currentTab === 'WALLETS' ? colors.primaryBright : colors.textMuted}
                />
                <Text
                  style={[
                    styles.navLabel,
                    currentTab === 'WALLETS' && styles.navLabelActive,
                  ]}
                >
                  Ví
                </Text>
              </TouchableOpacity>

              {/* Khoảng trống FAB */}
              <View style={styles.navFabPlaceholder} pointerEvents="none" />

              {/* Tab 3: Lịch sử */}
              <TouchableOpacity
                style={[
                  styles.navItem,
                  currentTab === 'HISTORY' && styles.navItemActive,
                ]}
                onPress={() => setCurrentTab('HISTORY')}
                activeOpacity={0.7}
              >
                <ReceiptText
                  size={20}
                  color={currentTab === 'HISTORY' ? colors.primaryBright : colors.textMuted}
                />
                <Text
                  style={[
                    styles.navLabel,
                    currentTab === 'HISTORY' && styles.navLabelActive,
                  ]}
                >
                  Lịch sử
                </Text>
              </TouchableOpacity>

              {/* Tab 4: Cài đặt */}
              <TouchableOpacity
                style={[
                  styles.navItem,
                  currentTab === 'SETTINGS' && styles.navItemActive,
                ]}
                onPress={() => setCurrentTab('SETTINGS')}
                activeOpacity={0.7}
              >
                <Settings
                  size={20}
                  color={currentTab === 'SETTINGS' ? colors.primaryBright : colors.textMuted}
                />
                <Text
                  style={[
                    styles.navLabel,
                    currentTab === 'SETTINGS' && styles.navLabelActive,
                  ]}
                >
                  Cài đặt
                </Text>
              </TouchableOpacity>
            </View>

            {/* Nút FAB (+) ở giữa: Solid Color */}
            <CenterFAB onPress={() => handleOpenQuickEntry()} />
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
  bottomNavContent: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 14,
  },
  navItemActive: {
    backgroundColor: colors.primarySoft,
  },
  navLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 3,
    fontWeight: '500',
  },
  navLabelActive: {
    color: colors.primaryBright,
    fontWeight: '700',
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
