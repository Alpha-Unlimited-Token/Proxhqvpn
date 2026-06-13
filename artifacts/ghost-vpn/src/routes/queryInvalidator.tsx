// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useEffect, useRef } from "react";
import { useClerk } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";

export function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const previousUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;

      if (
        previousUserIdRef.current !== undefined &&
        previousUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }

      previousUserIdRef.current = userId;
    });

    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}
