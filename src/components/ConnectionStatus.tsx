/**
 * ConnectionStatus Component
 *
 * Displays real-time connection health and last update information
 * Provides manual refresh button for users
 *
 * Usage:
 * <ConnectionStatus
 *   health={connectionHealth}
 *   lastUpdate={lastUpdate}
 *   onRefresh={refetchSession}
 * />
 */

import { ConnectionHealth } from "@/hooks/usePolling";

interface ConnectionStatusProps {
  health: ConnectionHealth;
  lastUpdate: Date | null;
  onRefresh: () => void;
}

export function ConnectionStatus({ health, lastUpdate, onRefresh }: ConnectionStatusProps) {
  const statusConfig = {
    healthy: {
      color: "bg-green-500",
      text: "Live",
      textColor: "text-green-400",
    },
    degraded: {
      color: "bg-yellow-500",
      text: "Connecting...",
      textColor: "text-yellow-400",
    },
    disconnected: {
      color: "bg-red-500",
      text: "Connection lost",
      textColor: "text-red-400",
    },
  };

  const config = statusConfig[health];

  const formatTimeSince = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 10) return "just now";
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="flex items-center gap-2 text-xs text-stone-400">
      {/* Status indicator dot */}
      <div className={`w-2 h-2 rounded-full ${config.color} animate-pulse`} />

      {/* Status text */}
      <span className={config.textColor}>{config.text}</span>

      {/* Last update timestamp */}
      {lastUpdate && health === "healthy" && (
        <span className="text-stone-500">• Updated {formatTimeSince(lastUpdate)}</span>
      )}

      {/* Manual refresh button */}
      <button
        onClick={onRefresh}
        className="text-amber-600 hover:text-amber-500 hover:underline transition-colors"
        aria-label="Refresh data"
      >
        Refresh
      </button>
    </div>
  );
}
