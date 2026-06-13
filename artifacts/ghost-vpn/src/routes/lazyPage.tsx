import { lazy } from "react";

export function lazyPage<T extends { default: React.ComponentType<any> }>(
  loader: () => Promise<T>,
) {
  return lazy(loader);
}
