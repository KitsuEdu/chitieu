import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import {
  Utensils,
  Dumbbell,
  Laptop,
  Car,
  ShoppingBag,
  Zap,
  CircleEllipsis,
  ArrowRightLeft,
} from 'lucide-react-native';


interface CategoryIconProps {
  category: string;
  size?: number;
  containerSize?: number;
  style?: StyleProp<ViewStyle>;
}

export const getCategoryConfig = (category: string) => {
  switch (category) {
    case 'Ăn uống':
      return { Icon: Utensils, color: '#FB923C', bg: 'rgba(251, 146, 60, 0.12)' };
    case 'Gym/Sức khỏe':
      return { Icon: Dumbbell, color: '#34D399', bg: 'rgba(52, 211, 153, 0.12)' };
    case 'Công nghệ/Tools':
      return { Icon: Laptop, color: '#A855F7', bg: 'rgba(168, 85, 247, 0.12)' };
    case 'Di chuyển':
      return { Icon: Car, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' };
    case 'Mua sắm':
      return { Icon: ShoppingBag, color: '#EC4899', bg: 'rgba(236, 72, 153, 0.12)' };
    case 'Tiện ích':
      return { Icon: Zap, color: '#6366F1', bg: 'rgba(99, 102, 241, 0.12)' };
    case 'Chuyển khoản':
      return { Icon: ArrowRightLeft, color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)' };
    case 'Khác':
    default:
      return { Icon: CircleEllipsis, color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.1)' };
  }
};

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  size = 20,
  containerSize = 40,
  style,
}) => {
  const { Icon, color, bg } = getCategoryConfig(category);

  return (
    <View
      style={[
        styles.container,
        {
          width: containerSize,
          height: containerSize,
          borderRadius: containerSize / 2,
          backgroundColor: bg,
        },
        style,
      ]}
    >
      <Icon size={size} color={color} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
