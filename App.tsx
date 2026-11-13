import React, { useState, useEffect } from 'react';
import { StyleSheet, View, AppState, AppStateStatus } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { OverviewScreen, QuickPreset } from './src/screens/OverviewScreen';
import { WalletsScreen } from './src/screens/WalletsScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { DebtLedgerScreen } from './src/screens/DebtLedgerScreen';
import { QuickEntryScreen } from './src/screens/QuickEntryScreen';
import { LiquidNavBar, MainTabType } from './src/components/LiquidNavBar';
import { PopupProvider } from './src/context/PopupContext';
import { colors } from './src/theme/colors';
import { storageService } from './src/services/storage';
import { syncService, SyncEvent } from './src/services/sync';

export default function App() {
  const [currentTab, setCurrentTab] = useState<MainTabType>('OVERVIEW');
  const [profileSubScreen, setProfileSubScreen] = useState<'MAIN' | 'SETTINGS' | 'DEBTS'>('MAIN');
  const [quickEntryPreset, setQuickEntryPreset] = useState<QuickPreset | null>(null);
  const [dataVersion, setDataVersion] = useState<number>(0);

  const handleDataChanged = () => {
    setDataVersion((v) => v + 1);
  };

  // Đồng bộ khi mở app và lắng nghe sự kiện đồng bộ toàn cục
  useEffect(() => {
    // 1. Lắng nghe sync event để tự động refresh toàn app khi có dữ liệu mới từ Cloud
    const unsubscribeSync = syncService.addListener((event: SyncEvent) => {
      if (event.type === 'SYNC_SUCCESS' || event.type === 'RESTORE_SUCCESS') {
        handleDataChanged();
      }
    });

    // 2. Tự động chạy silent sync sau 1500ms khi app active
    let syncTimer: ReturnType<typeof setTimeout> | null = null;

    const triggerSilentSync = async () => {
      try {
        const settings = await storageService.getSettings();
        if (settings?.googleScriptUrl?.trim()) {
          if (syncTimer) clearTimeout(syncTimer);
          syncTimer = setTimeout(() => {
            syncService.syncNow(true); // Silent sync không block UI
          }, 1500);
        }
      } catch (err) {
        console.warn('[App] Error scheduling initial silent sync:', err);
      }
    };

    triggerSilentSync();

    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          triggerSilentSync();
        } else if (syncTimer) {
          clearTimeout(syncTimer);
        }
      }
    );

    return () => {
      unsubscribeSync();
      appStateSubscription.remove();
      if (syncTimer) {
        clearTimeout(syncTimer);
      }
    };
  }, []);

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

  const isSubScreen =
    (currentTab === 'PROFILE' || currentTab === 'SETTINGS') &&
    (profileSubScreen === 'SETTINGS' || profileSubScreen === 'DEBTS');

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PopupProvider>
          <SafeAreaView
            style={styles.safeArea}
            edges={isSubScreen ? ['top', 'bottom', 'left', 'right'] : ['top', 'left', 'right']}
          >
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
              ) : profileSubScreen === 'DEBTS' ? (
                <DebtLedgerScreen
                  key={`debts-${dataVersion}`}
                  onBack={() => setProfileSubScreen('MAIN')}
                  onDataChanged={handleDataChanged}
                />
              ) : (
                <ProfileScreen
                  key={`profile-${dataVersion}`}
                  onNavigateToSettings={() => setProfileSubScreen('SETTINGS')}
                  onNavigateToDebts={() => setProfileSubScreen('DEBTS')}
                  onDataChanged={handleDataChanged}
                />
              )
            )}

          </View>

          {/* Thanh Bottom Navigation: Bouncing Ball Tab Animation (Ẩn khi vào các trang con) */}
          {!isSubScreen && (
            <LiquidNavBar
              currentTab={currentTab === 'SETTINGS' ? 'PROFILE' : currentTab}
              onSelectTab={handleSelectTab}
              onPressPlus={() => handleOpenQuickEntry()}
            />
          )}
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
