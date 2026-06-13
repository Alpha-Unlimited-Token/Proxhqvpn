export type KeyboardShortcut = {
  id: string;
  label: string;
  keys: string[];
  action: () => void;
};

const shortcuts = new Map<string, KeyboardShortcut>();

export function registerKeyboardShortcut(shortcut: KeyboardShortcut): () => void {
  shortcuts.set(shortcut.id, shortcut);
  return () => { shortcuts.delete(shortcut.id); };
}

export function getKeyboardShortcuts() {
  return [...shortcuts.values()];
}

export function handleGlobalShortcut(event: KeyboardEvent) {
  for (const shortcut of shortcuts.values()) {
    const matched = shortcut.keys.every((key) => {
      if (key === "mod") return event.ctrlKey || event.metaKey;
      if (key === "shift") return event.shiftKey;
      if (key === "alt") return event.altKey;
      return event.key.toLowerCase() === key.toLowerCase();
    });

    if (matched) {
      event.preventDefault();
      shortcut.action();
      return true;
    }
  }

  return false;
}
