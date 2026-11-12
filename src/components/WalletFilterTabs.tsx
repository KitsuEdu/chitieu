import React from 'react';
import { SegmentedTabs, SegmentedTabItem } from './SegmentedTabs';

export type WalletFilterMode = 'ALL' | 'ASSETS' | 'LIABILITIES';

export const WALLET_FILTER_TABS: readonly SegmentedTabItem<WalletFilterMode>[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'ASSETS', label: 'Khả dụng' },
  { key: 'LIABILITIES', label: 'Tín dụng / Nợ' },
];

export interface WalletFilterTabsProps {
  filterMode: WalletFilterMode;
  onChangeFilterMode: (mode: WalletFilterMode) => void;
}

export const WalletFilterTabs: React.FC<WalletFilterTabsProps> = ({
  filterMode,
  onChangeFilterMode,
}) => {
  return (
    <SegmentedTabs<WalletFilterMode>
      tabs={WALLET_FILTER_TABS}
      activeKey={filterMode}
      onChange={onChangeFilterMode}
    />
  );
};
