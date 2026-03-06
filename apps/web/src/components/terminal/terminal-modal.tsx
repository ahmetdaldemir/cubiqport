'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { XIcon } from 'lucide-react';
import { AUTH_TOKEN_KEY } from '@/lib/constants';
import '@xterm/xterm/css/xterm.css';

interface TerminalModalProps {
  serverId: string;
  serverName: string;
  onClose: () => void;
}

export function TerminalModal({ serverId, serverName, onClose }: TerminalModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'closed' | 'error'>('connecting');

  const connect = useCallback(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
    if (!token) {
      setStatus('error');
      return;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/v1/servers/${serverId}/terminal?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      const term = terminalRef.current;
      const fit = fitRef.current;
      if (term && fit) {
        const { rows, cols } = fit.proposeDimensions() || { rows: 24, cols: 80 };
        ws.send(JSON.stringify({ type: 'resize', rows, cols }));
      }
    };

    ws.onclose = () => setStatus('closed');
    ws.onerror = () => setStatus('error');

    ws.onmessage = (ev) => {
      const term = terminalRef.current;
      if (term && typeof ev.data === 'string') term.write(ev.data);
    };
  }, [serverId]);

  useEffect(() => {
    if (!containerRef.current) return;
    const term = new Terminal({
      cursorBlink: true,
      theme: { background: '#0f172a', foreground: '#e2e8f0' },
      fontFamily: 'ui-monospace, monospace',
      fontSize: 14,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    terminalRef.current = term;
    fitRef.current = fit;

    term.onData((data) => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) ws.send(data);
    });

    const onResize = () => {
      fit.fit();
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        const dim = fit.proposeDimensions();
        if (dim) ws.send(JSON.stringify({ type: 'resize', rows: dim.rows, cols: dim.cols }));
      }
    };
    const ro = new ResizeObserver(onResize);
    if (containerRef.current) ro.observe(containerRef.current);

    connect();

    return () => {
      ro.disconnect();
      wsRef.current?.close();
      wsRef.current = null;
      term.dispose();
      terminalRef.current = null;
      fitRef.current = null;
    };
  }, [connect]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-foreground">SSH — {serverName}</span>
            {status === 'connecting' && (
              <span className="text-xs text-muted-foreground">Bağlanıyor…</span>
            )}
            {status === 'connected' && (
              <span className="text-xs text-green-500">Bağlı</span>
            )}
            {status === 'error' && (
              <span className="text-xs text-red-400">Bağlantı hatası</span>
            )}
            {status === 'closed' && (
              <span className="text-xs text-muted-foreground">Bağlantı kapandı</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Kapat"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div ref={containerRef} className="flex-1 min-h-0 w-full p-2" />
      </div>
    </div>
  );
}
