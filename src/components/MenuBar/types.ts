export type ActionMap = Record<string, () => void>;

export interface MenuSeparator {
  type: 'separator';
}

export interface MenuItemConfig {
  label: string;
  action?: string;
  shortcut?: string;
  items?: MenuNode[]; // For submenus
  disabled?: boolean;
}

export type MenuNode = MenuItemConfig | MenuSeparator;

export interface TopLevelMenu {
  label: string;
  items: MenuNode[];
}

export type MenuConfig = TopLevelMenu[];
