/**
 * Terminal Component - xterm.js integration for LobeChat
 * 
 * This component provides a full terminal emulator using xterm.js,
 * replacing the basic command display with interactive terminal functionality.
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useTerminal } from '../hooks/useTerminal';
import { cn } from '@lobechat/utils';

// Import xterm CSS
import '@xterm/xterm/css/xterm.css';

export interface TerminalComponentProps {
  sessionId: string;
  userId: string;
  className?: string;
  onError?: (error: string) => void;
  onOutput?: (data: string) => void;
  autoFocus?: boolean;
  theme?: 'dark' | 'light';
}

export const TerminalComponent: React.FC<TerminalComponentProps> = ({
  sessionId,
  userId,
  className,
  onError,
  onOutput,
  autoFocus = true,
  theme = 'dark',
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const webLinksAddon = useRef<WebLinksAddon | null>(null);
  const ws = useRef<WebSocket | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const {
    isConnected: terminalConnected,
    isLoading,
    error,
    output,
    connect,
    disconnect,
    sendInput,
    resize,
  } = useTerminal(sessionId, userId);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal instance
    terminal.current = new Terminal({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      theme: theme === 'dark' 
        ? {
            background: '#1e1e1e',
            foreground: '#ffffff',
            cursor: '#ffffff',
            selection: 'rgba(255, 255, 255, 0.3)',
            black: '#000000',
            red: '#cd3131',
            green: '#0dbc79',
            yellow: '#e5e50b',
            blue: '#2472c8',
            magenta: '#bc3fbc',
            cyan: '#11a8cd',
            white: '#e5e5e5',
            brightBlack: '#666666',
            brightRed: '#f14c4c',
            brightGreen: '#23d18b',
            brightYellow: '#f5f543',
            brightBlue: '#3b8eea',
            brightMagenta: '#d670d6',
            brightCyan: '#29b8db',
            brightWhite: '#e5e5e5',
          }
        : {
            background: '#ffffff',
            foreground: '#000000',
            cursor: '#000000',
            selection: 'rgba(0, 0, 0, 0.3)',
            black: '#000000',
            red: '#cd3131',
            green: '#00bc00',
            yellow: '#949800',
            blue: '#0451a5',
            magenta: '#bc05bc',
            cyan: '#0598bc',
            white: '#555555',
            brightBlack: '#666666',
            brightRed: '#cd3131',
            brightGreen: '#00bc00',
            brightYellow: '#949800',
            brightBlue: '#0451a5',
            brightMagenta: '#bc05bc',
            brightCyan: '#0598bc',
            brightWhite: '#e5e5e5',
          },
      scrollback: 1000,
      convertEol: true,
    });

    // Add addons
    fitAddon.current = new FitAddon();
    webLinksAddon.current = new WebLinksAddon({
      handleLink: (event, uri) => {
        // Open links in new tab
        window.open(uri, '_blank');
        event.preventDefault();
      },
    });

    terminal.current.loadAddon(fitAddon.current);
    terminal.current.loadAddon(webLinksAddon.current);

    // Open terminal in DOM
    terminal.current.open(terminalRef.current);

    // Setup terminal event handlers
    terminal.current.onData((data) => {
      if (isConnected && ws.current?.readyState === WebSocket.OPEN) {
        const message = {
          type: 'input',
          sessionId,
          data,
          timestamp: Date.now(),
        };
        ws.current.send(JSON.stringify(message));
      }
    });

    terminal.current.onResize(({ cols, rows }) => {
      if (isConnected && ws.current?.readyState === WebSocket.OPEN) {
        const message = {
          type: 'resize',
          sessionId,
          cols,
          rows,
          timestamp: Date.now(),
        };
        ws.current.send(JSON.stringify(message));
      }
    });

    // Handle terminal focus
    terminal.current.onFocus(() => {
      // Terminal gained focus
    });

    terminal.current.onBlur(() => {
      // Terminal lost focus
    });

    setIsReady(true);

    return () => {
      if (terminal.current) {
        terminal.current.dispose();
      }
    };
  }, [sessionId, theme]);

  // Connect to WebSocket when ready
  useEffect(() => {
    if (!isReady || isConnected) return;

    const connectWebSocket = () => {
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/terminal`;
      const wsUrlWithParams = `${wsUrl}?sessionId=${sessionId}&userId=${userId}`;

      ws.current = new WebSocket(wsUrlWithParams);

      ws.current.onopen = () => {
        console.log('Terminal WebSocket connected');
        setIsConnected(true);
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.current.onclose = () => {
        console.log('Terminal WebSocket disconnected');
        setIsConnected(false);
      };

      ws.current.onerror = (error) => {
        console.error('Terminal WebSocket error:', error);
        setIsConnected(false);
        onError?.('WebSocket connection error');
      };
    };

    connectWebSocket();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [isReady, sessionId, userId, onError]);

  // Handle terminal output from hook
  useEffect(() => {
    if (output && terminal.current) {
      terminal.current.write(output);
      onOutput?.(output);
    }
  }, [output, onOutput]);

  // Handle terminal resize
  useEffect(() => {
    if (isReady && fitAddon.current && terminal.current) {
      fitAddon.current.fit();
      
      // Ensure terminal is focused if autoFocus is true
      if (autoFocus) {
        terminal.current.focus();
      }
    }
  }, [isReady, autoFocus]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddon.current && terminal.current) {
        fitAddon.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: any) => {
    if (!terminal.current) return;

    switch (message.type) {
      case 'output':
        if (message.data) {
          terminal.current.write(message.data);
        }
        break;

      case 'error':
        onError?.(message.error || 'Terminal error');
        break;

      case 'session_closed':
        terminal.current.writeln('\r\n\x1b[33m[Terminal session closed]\x1b[0m');
        break;

      case 'ping':
        // Respond to ping
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now(),
          }));
        }
        break;

      default:
        console.log('Unknown WebSocket message type:', message.type);
    }
  }, [onError]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn(
        'flex items-center justify-center h-64 bg-gray-100 dark:bg-gray-800 rounded-lg',
        className
      )}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Connecting to terminal...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn(
        'flex items-center justify-center h-64 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800',
        className
      )}>
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-2">Terminal Error</p>
          <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  // Connection status indicator
  const getStatusIndicator = () => {
    if (!isConnected) {
      return (
        <div className="absolute top-2 right-2 flex items-center space-x-2">
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
          <span className="text-xs text-red-500">Disconnected</span>
        </div>
      );
    }

    return (
      <div className="absolute top-2 right-2 flex items-center space-x-2">
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        <span className="text-xs text-green-500">Connected</span>
      </div>
    );
  };

  return (
    <div className={cn(
      'relative bg-black rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600',
      className
    )}>
      {/* Status Indicator */}
      {getStatusIndicator()}
      
      {/* Terminal Container */}
      <div
        ref={terminalRef}
        className="w-full h-full min-h-[300px] p-2"
        style={{ fontFamily: 'Menlo, Monaco, "Courier New", monospace' }}
      />
      
      {/* Terminal Footer */}
      <div className="absolute bottom-0 left-0 right-0 bg-gray-800 dark:bg-gray-900 px-3 py-1 text-xs text-gray-400">
        Session: {sessionId} | User: {userId}
      </div>
    </div>
  );
};

export default TerminalComponent;
