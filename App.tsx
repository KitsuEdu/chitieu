import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { OverviewScreen, QuickPreset } from './src/screens/OverviewScreen';
import { WalletsScreen } from './src/screens/WalletsScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { QuickEntryScreen } from './src/screens/QuickEntryScreen';
import { LiquidNavBar, MainTabType } from './src/components/LiquidNavBar';
import { PopupProvider } from './src/context/PopupContext';
import { colors } from './src/theme/colors';

export default function App() {
  const [currentTab, setCurrentTab] = useState<MainTabType>('OVERVIEW');
  const [profileSubScreen, setProfileSubScreen] = useState<'MAIN' | 'SETTINGS'>('MAIN');
  const [quickEntryPreset, setQuickEntryPreset] = useState<QuickPreset | null>(null);
  const [dataVersion, setDataVersion] = useState<number>(0);

  const handleDataChanged = () => {
    setDataVersion((v) => v + 1);
  };

  const handleOpenQuickEntry = (preset?: QuickPreset) => {
    setQuickEntryPreset(preset || null);
    setCurrentTab('QUICK_ENTRY');
  };

  const handleNavigateToSettings = () => {
    setCurrentTab('PROFILE');
    setProfileSubScreen('SETTINGS');
  };

  const handleSelectTab = (tab: MainTabType) => {
    if (tab === 'PROFILE' || tab === 'SETTINGS') {
      setProfileSubScreen('MAIN');
      setCurrentTab('PROFILE');
    } else {
      setCurrentTab(tab);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PopupProvider>
          <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <StatusBar style="light" />

          {/* Nội dung Màn hình chính theo Tab */}
          <View style={styles.screenContainer}>
            {currentTab === 'OVERVIEW' && (
              <OverviewScreen
                key={`overview-${dataVersion}`}
                onNavigateToHistory={() => setCurrentTab('HISTORY')}
                onNavigateToWallets={() => setCurrentTab('WALLETS')}
                onNavigateToSettings={handleNavigateToSettings}
                onOpenQuickEntry={handleOpenQuickEntry}
              />
            )}

            {currentTab === 'WALLETS' && (
              <WalletsScreen
                key={`wallets-${dataVersion}`}
                onWalletsUpdated={handleDataChanged}
              />
            )}

            {currentTab === 'QUICK_ENTRY' && (
              <QuickEntryScreen
                key={`quick-entry-${dataVersion}`}
                initialPreset={quickEntryPreset}
                onTransactionSaved={() => {
                  handleDataChanged();
                  setQuickEntryPreset(null);
                  setCurrentTab('OVERVIEW');
                }}
              />
            )}

            {currentTab === 'HISTORY' && (
              <HistoryScreen
                key={`history-${dataVersion}`}
                onRefreshTriggered={handleDataChanged}
              />
            )}

            {(currentTab === 'PROFILE' || currentTab === 'SETTINGS') && (
              profileSubScreen === 'SETTINGS' ? (
                <SettingsScreen
                  key={`settings-${dataVersion}`}
                  onSettingsSaved={handleDataChanged}
                  onBack={() => setProfileSubScreen('MAIN')}
                />
              ) : (
                <ProfileScreen
                  key={`profile-${dataVersion}`}
                  onNavigateToSettings={() => setProfileSubScreen('SETTINGS')}
                  onDataChanged={handleDataChanged}
                />
              )
            )}
          </View>

          {/* Thanh Bottom Navigation: Bouncing Ball Tab Animation (Navbar luôn ở phía dưới) */}
          <LiquidNavBar
            currentTab={currentTab === 'SETTINGS' ? 'PROFILE' : currentTab}
            onSelectTab={handleSelectTab}
            onPressPlus={() => handleOpenQuickEntry()}
          />
        </SafeAreaView>
        </PopupProvider>
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
});
