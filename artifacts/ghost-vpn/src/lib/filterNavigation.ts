// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Filter navigation items by commercial feature entitlements.
import type { FeatureKey } from "./entitlements";

export type NavItem = {
  label: string;
  href: string;
  requiredFeatures?: FeatureKey[];
  children?: NavItem[];
  [key: string]: unknown;
};

export function filterNavigationByFeatures(
  items: NavItem[],
  hasFeature: (feature: FeatureKey) => boolean,
): NavItem[] {
  return items
    .map((item) => ({
      ...item,
      children: item.children
        ? filterNavigationByFeatures(item.children, hasFeature)
        : undefined,
    }))
    .filter((item) => {
      const featsOk = (item.requiredFeatures ?? []).every(hasFeature);
      const hasVisibleChildren = (item.children?.length ?? 0) > 0;
      return featsOk || hasVisibleChildren;
    });
}
