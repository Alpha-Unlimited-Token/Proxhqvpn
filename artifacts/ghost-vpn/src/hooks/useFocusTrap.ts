import { useEffect, type RefObject } from "react";

export function useFocusTrap(ref: RefObject<HTMLElement>, enabled = true) {
  useEffect(() => {
    if (!enabled || !ref.current) return;

    const root = ref.current;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"));

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [ref, enabled]);
}
