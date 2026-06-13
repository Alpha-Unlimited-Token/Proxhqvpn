import { useEffect } from "react";
import {
  handleGlobalShortcut,
  registerKeyboardShortcut,
  type KeyboardShortcut,
} from "@/lib/keyboardShortcuts";

let listenerAttached = false;

function ensureListener() {
  if (listenerAttached) return;

  window.addEventListener("keydown", handleGlobalShortcut);
  listenerAttached = true;
}

export function useKeyboardShortcut(shortcut: KeyboardShortcut) {
  useEffect(() => {
    ensureListener();
    return registerKeyboardShortcut(shortcut);
  }, [shortcut.id, shortcut.label, shortcut.action]);
}
