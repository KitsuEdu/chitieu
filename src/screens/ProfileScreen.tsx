import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  UserRound,
  Repeat,
  BookOpen,
  PieChart,
  Settings,
  ChevronRight,
} from 'lucide-react-native';
import { storageService } from '../services/storage';
import { syncService, SyncEvent } from '../services/sync';
import { colors } from '../theme/colors';
import { usePopup } from '../context/PopupContext';

interface ProfileScreenProps {
  onNavigateToSettings: () => void;
  onNavigateToDebts: () => void;
  onDataChanged?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onNavigateToSettings,
  onNavigateToDebts,
  onDataChanged,
}) => {
  const { showPopup } = usePopup();
  const [isGoogleSheetsConnected, setIsGoogleSheetsConnected] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [activeDebtCount, setActiveDebtCount] = useState<number>(0);

  useEffect(() => {
    checkSyncStatus();
    loadDebtsSummary();

    const unsubscribe = syncService.addListener((event: SyncEvent) => {
      checkSyncStatus();
      if (event.type === 'SYNC_START' || event.type === 'RESTORE_START') {
        setIsSyncing(true);
      } else if (event.type === 'SYNC_SUCCESS' || event.type === 'RESTORE_SUCCESS') {
        setIsSyncing(false);
        setSyncError(null);
        setLastSyncTime(event.timestamp || new Date().toISOString());
      } else if (event.type === 'SYNC_ERROR' || event.type === 'RESTORE_ERROR') {
        setIsSyncing(false);
        setSyncError(event.error || 'Lỗi đồng bộ');
      } else if (event.type === 'STATUS_CHANGE') {
        checkSyncStatus();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [onDataChanged]);

  const loadDebtsSummary = async () => {
    try {
      const debts = await storageService.getDebts();
      const activeCount = debts.filter((d) => d.status === 'ACTIVE').length;
      setActiveDebtCount(activeCount);
    } catch {
      setActiveDebtCount(0);
    }
  };

  const checkSyncStatus = async () => {
    try {
      const [settings, lastTime, status] = await Promise.all([
        storageService.getSettings(),
        storageService.getLastSyncTime(),
        syncService.getSyncStatus(),
      ]);
      const isConnected = Boolean(settings?.googleScriptUrl?.trim());
      setIsGoogleSheetsConnected(isConnected);
      setLastSyncTime(lastTime);
      setIsSyncing(status.isSyncing);
      setSyncError(status.lastError);
    } catch {
      setIsGoogleSheetsConnected(false);
    }
  };

  const formatTimeHHmm = (isoString?: string | null) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      const h = d.getHours().toString().padStart(2, '0');
      const m = d.getMinutes().toString().padStart(2, '0');
      return `${h}:${m}`;
    } catch {
      return '';
    }
  };

  // Tính toán Badge trạng thái
  const getBadgeConfig = () => {
    if (!isGoogleSheetsConnected) {
      return {
        badgeStyle: styles.syncBadgeDisconnected,
        dotStyle: styles.syncDotDisconnected,
        textStyle: styles.syncBadgeTextDisconnected,
        text: 'Chưa kết nối Google Sheets',
      };
    }

    if (isSyncing) {
      return {
        badgeStyle: styles.syncBadgeSyncing,
        dotStyle: styles.syncDotSyncing,
        textStyle: styles.syncBadgeTextSyncing,
        text: 'Đang đồng bộ...',
      };
    }

    if (syncError) {
      return {
        badgeStyle: styles.syncBadgeError,
        dotStyle: styles.syncDotError,
        textStyle: styles.syncBadgeTextError,
        text: 'Lỗi đồng bộ',
      };
    }

    const timeStr = formatTimeHHmm(lastSyncTime);
    return {
      badgeStyle: styles.syncBadgeConnected,
      dotStyle: styles.syncDotConnected,
      textStyle: styles.syncBadgeTextConnected,
      text: timeStr ? `Đã đồng bộ lúc ${timeStr}` : 'Đã kết nối Google Sheets',
    };
  };

  const badgeConfig = getBadgeConfig();

  const handleUpcomingFeature = (featureName: string) => {
    showPopup({
      type: 'INFO',
      title: 'Tính năng sắp ra mắt',
      message: `Tính năng "${featureName}" đang được phát triển và sẽ sớm có mặt trong bản cập nhật tiếp theo.`,
      confirmText: 'Đã hiểu',
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Header Profile: Khối card giới thiệu cá nhân tối giản */}
      <View style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          <UserRound size={30} color={colors.primary} strokeWidth={2.2} />
        </View>

        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>Kitsu</Text>
          <Text style={styles.profileRole}>Tài chính cá nhân</Text>

          {/* Badge trạng thái đồng bộ Google Sheets */}
          <View style={[styles.syncBadge, badgeConfig.badgeStyle]}>
            <View style={[styles.syncDot, badgeConfig.dotStyle]} />
            <Text style={[styles.syncBadgeText, badgeConfig.textStyle]}>
              {badgeConfig.text}
            </Text>
          </View>
        </View>
      </View>

      {/* 2. Nhóm 1: Tiện ích Tài chính Mở rộng (Chừa sẵn tính năng tương lai) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>TIỆN ÍCH TÀI CHÍNH MỞ RỘNG</Text>

        <View style={styles.cardGroup}>
          {/* Giao dịch định kỳ */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => handleUpcomingFeature('Giao dịch định kỳ')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrapper, { backgroundColor: 'rgba(168, 85, 247, 0.12)' }]}>
              <Repeat size={19} color="#A855F7" strokeWidth={2.2} />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Giao dịch định kỳ</Text>
              <Text style={styles.menuSubtitle}>Tự động hóa các khoản chi phí lặp lại</Text>
            </View>
            <View style={styles.badgeUpcoming}>
              <Text style={styles.badgeUpcomingText}>Sắp ra mắt</Text>
            </View>
            <ChevronRight size={17} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Sổ nợ & Cho vay */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={onNavigateToDebts}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrapper, { backgroundColor: 'rgba(56, 189, 248, 0.12)' }]}>
              <BookOpen size={19} color="#38BDF8" strokeWidth={2.2} />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Sổ nợ & Cho vay</Text>
              <Text style={styles.menuSubtitle}>Theo dõi các khoản vay mượn cá nhân</Text>
            </View>
            {activeDebtCount > 0 ? (
              <View style={[styles.badgeUpcoming, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                <Text style={[styles.badgeUpcomingText, { color: '#38BDF8' }]}>
                  {activeDebtCount} khoản nợ
                </Text>
              </View>
            ) : null}
            <ChevronRight size={17} color={colors.textMuted} />
          </TouchableOpacity>


          <View style={styles.rowDivider} />

          {/* Hạn mức & Ngân sách */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => handleUpcomingFeature('Hạn mức & Ngân sách')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrapper, { backgroundColor: 'rgba(251, 146, 60, 0.12)' }]}>
              <PieChart size={19} color="#FB923C" strokeWidth={2.2} />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Hạn mức & Ngân sách</Text>
              <Text style={styles.menuSubtitle}>Đặt giới hạn và kiểm soát bội chi</Text>
            </View>
            <View style={styles.badgeUpcoming}>
              <Text style={styles.badgeUpcomingText}>Sắp ra mắt</Text>
            </View>
            <ChevronRight size={17} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. Nhóm 2: Hệ thống & Dữ liệu */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>HỆ THỐNG & DỮ LIỆU</Text>

        <View style={styles.cardGroup}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={onNavigateToSettings}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrapper, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
              <Settings size={20} color="#A855F7" strokeWidth={2.2} />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Cài đặt & Đồng bộ Google Sheets</Text>
              <Text style={styles.menuSubtitle}>Cấu hình Apps Script URL, sao lưu dữ liệu</Text>
            </View>
            <ChevronRight size={19} color="#A855F7" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 4. Footer thông tin phiên bản */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Tài chính cá nhân • Phiên bản 1.0.0</Text>
        <Text style={styles.footerSubtext}>Dữ liệu được lưu trữ an toàn & mã hóa trên thiết bị</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 104,
    gap: 20,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1.5,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  profileRole: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 8,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  syncBadgeConnected: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderColor: 'rgba(52, 211, 153, 0.25)',
  },
  syncBadgeSyncing: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  syncBadgeError: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  syncBadgeDisconnected: {
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    borderColor: 'rgba(244, 63, 94, 0.2)',
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  syncDotConnected: {
    backgroundColor: '#34D399',
  },
  syncDotSyncing: {
    backgroundColor: '#FBBF24',
  },
  syncDotError: {
    backgroundColor: '#F43F5E',
  },
  syncDotDisconnected: {
    backgroundColor: '#F43F5E',
  },
  syncBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  syncBadgeTextConnected: {
    color: '#34D399',
  },
  syncBadgeTextSyncing: {
    color: '#FBBF24',
  },
  syncBadgeTextError: {
    color: '#F43F5E',
  },
  syncBadgeTextDisconnected: {
    color: '#F43F5E',
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.6,
    paddingHorizontal: 4,
  },
  cardGroup: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  menuSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badgeUpcoming: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    marginRight: 4,
  },
  badgeUpcomingText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryLight,
  },
  rowDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginLeft: 64,
  },
  footer: {
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 12,
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  footerSubtext: {
    fontSize: 11,
    color: 'rgba(100, 116, 139, 0.7)',
  },
});
