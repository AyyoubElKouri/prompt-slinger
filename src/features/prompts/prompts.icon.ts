import { FileText, icons, type LucideIcon } from 'lucide-react';

const byNormalizedName = new Map<string, LucideIcon>();

for (const [name, Icon] of Object.entries(icons)) {
  byNormalizedName.set(name.replace(/-/g, '').toLowerCase(), Icon as LucideIcon);
}

export function resolveIcon(iconName: string): LucideIcon {
  const normalized = iconName.replace(/-/g, '').toLowerCase();
  return byNormalizedName.get(normalized) ?? FileText;
}
