// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Thin wrappers around raw fetch for the honeypot API
// (uses the generated hooks from @workspace/api-client-react)
export {
  useGetHoneypotStats,
  useListHoneypotNodes,
  useCreateHoneypotNode,
  useUpdateHoneypotNode,
  useDeleteHoneypotNode,
  useListHoneypotAttackers,
  useGetHoneypotAttacker,
  useListHoneypotSessions,
  useGetHoneypotSession,
  useListHoneypotCommands,
  useListHoneypotFiles,
  useListHoneypotIocs,
  useCreateHoneypotIoc,
  useDeleteHoneypotIoc,
  useListHoneypotAlerts,
  useAcknowledgeHoneypotAlert,
} from "@workspace/api-client-react";
