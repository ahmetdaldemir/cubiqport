import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    active: 'text-green-400',
    success: 'text-green-400',
    pending: 'text-yellow-400',
    running: 'text-blue-400',
    error: 'text-red-400',
    failed: 'text-red-400',
    offline: 'text-gray-400',
    cancelled: 'text-gray-400',
  };
  return map[status] ?? 'text-gray-400';
}

export function statusBg(status: string): string {
  const map: Record<string, string> = {
    active: 'bg-green-500/10 text-green-400 border-green-500/20',
    success: 'bg-green-500/10 text-green-400 border-green-500/20',
    pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    running: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    error: 'bg-red-500/10 text-red-400 border-red-500/20',
    failed: 'bg-red-500/10 text-red-400 border-red-500/20',
    offline: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    cancelled: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  };
  return map[status] ?? 'bg-gray-500/10 text-gray-400 border-gray-500/20';
}
