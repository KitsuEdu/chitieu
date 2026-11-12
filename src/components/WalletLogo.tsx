import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import {
  Wallet as WalletIcon,
  Landmark,
  CreditCard,
  Zap,
  PiggyBank,
  Smartphone,
} from 'lucide-react-native';
import { matchLogoForWallet } from '../constants/logos';
import { WalletType } from '../types';
import { colors } from '../theme/colors';

interface WalletLogoProps {
  logoId?: string;
  icon?: string;
  name?: string;
  type?: WalletType;
  size?: number;
  containerSize?: number;
  containerBg?: string;
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
}

export const WalletLogo: React.FC<WalletLogoProps> = ({
  logoId,
  icon,
  name,
  type,
  size = 22,
  containerSize,
  containerBg,
  borderColor,
  style,
}) => {
  const matched = matchLogoForWallet({ logoId, icon, name, type });

  const renderFallbackIcon = () => {
    const iconColor = colors.textPrimary;
    const iconSize = Math.max(14, size);

    if (icon === 'Landmark' || type === 'BANK_EWALLET') {
      return <Landmark size={iconSize} color={iconColor} />;
    }
    if (icon === 'CreditCard' || type === 'CREDIT_CARD') {
      return <CreditCard size={iconSize} color={iconColor} />;
    }
    if (icon === 'Zap') {
      return <Zap size={iconSize} color={iconColor} />;
    }
    if (icon === 'Smartphone' || type === 'PAYLATER') {
      return <Smartphone size={iconSize} color={iconColor} />;
    }
    if (icon === 'PiggyBank') {
      return <PiggyBank size={iconSize} color={iconColor} />;
    }
    return <WalletIcon size={iconSize} color={iconColor} />;
  };

  const content = matched && matched.xml ? (
    <SvgXml xml={matched.xml} width={size} height={size} />
  ) : (
    renderFallbackIcon()
  );

  if (containerSize) {
    const cSize = containerSize;
    return (
      <View
        style={[
          styles.container,
          {
            width: cSize,
            height: cSize,
            borderRadius: Math.round(cSize * 0.28),
            backgroundColor: containerBg || 'rgba(255, 255, 255, 0.04)',
            borderColor: borderColor || 'rgba(255, 255, 255, 0.08)',
          },
          style,
        ]}
      >
        {content}
      </View>
    );
  }

  return <View style={style}>{content}</View>;
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
});
