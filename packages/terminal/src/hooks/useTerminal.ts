/**
 * useTerminal Hook - React hook for terminal functionality
 * 
 * This hook provides a React interface to the terminal service,
 * handling connection management, input/output, and state.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface TerminalState {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  sessionId: string | null;
  userId: string;
  output: string;
  participants: string[];
}

export interface TerminalActions {
  connect: () => Promise<void>;
  disconnect: () => void;
  sendInput: (input: string) => void;
  resize: (cols: number, rows: number) => void;
  clear: () => void;
  reconnect: () => Promise<void>;
}

export interface UseTerminalReturn extends TerminalState, TerminalActions {
  // Additional computed properties
  canConnect: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
}

export const useTerminal = (
  sessionId: string,
  userId: string,
  options: {
    autoConnect?: boolean;
    reconnectAttempts?: number;
    reconnectDelay?: number;
  } = {}
): UseTerminalReturn => {
  const {
    autoConnect = false,
    reconnectAttempts = 3,
    reconnectDelay = 2000,
  } = options;

  // State
  const [state, setState] = useState<TerminalState>({
    isConnected: false,
    isLoading: false,
    error: null,
    sessionId: null,
    userId,
    output: '',
    participants: [],
  });

  // Refs
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const reconnectCount = useRef(0);

  // Connection status
  const getConnectionStatus = useCallback((): UseTerminalReturn['connectionStatus'] => {
    if (state.isLoading) return 'connecting';
    if (state.isConnected) return 'connected';
    if (state.error) return 'error';
    return 'disconnected';
  }, [state.isLoading, state.isConnected, state.error]);

  // Connect to terminal WebSocket
  const connect = useCallback(async () => {
    if (state.isConnected || state.isLoading) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // In a real implementation, this would connect to the actual WebSocket endpoint
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/terminal`;
      const wsUrlWithParams = `${wsUrl}?sessionId=${sessionId}&userId=${userId}`;

      ws.current = new WebSocket(wsUrlWithParams);

      ws.current.onopen = () => {
        console.log('Terminal WebSocket connected');
        setState(prev => ({
          ...prev,
          isConnected: true,
          isLoading: false,
          sessionId,
          error: null,
        }));
        reconnectCount.current = 0;
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.current.onclose = () => {
        console.log('Terminal WebSocket disconnected');
        setState(prev => ({
          ...prev,
          isConnected: false,
          isLoading: false,
        }));
        
        // Attempt reconnection if configured
        if (reconnectCount.current < reconnectAttempts && autoConnect) {
          scheduleReconnect();
        }
      };

      ws.current.onerror = (error) => {
        console.error('Terminal WebSocket error:', error);
        setState(prev => ({
          ...prev,
          isConnected: false,
          isLoading: false,
          error: 'WebSocket connection error',
        }));
      };

    } catch (error) {
      console.error('Failed to connect to terminal:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to connect to terminal',
      }));
    }
  }, [sessionId, userId, reconnectAttempts, autoConnect]);

  // Disconnect from terminal
  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }

    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      isLoading: false,
      sessionId: null,
    }));
  }, []);

  // Send input to terminal
  const sendInput = useCallback((input: string) => {
    if (!state.isConnected || !ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send input: WebSocket not connected');
      return;
    }

    const message = {
      type: 'input',
      sessionId,
      data: input,
      timestamp: Date.now(),
    };

    try {
      ws.current.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send input:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to send input to terminal',
      }));
    }
  }, [state.isConnected, sessionId]);

  // Resize terminal
  const resize = useCallback((cols: number, rows: number) => {
    if (!state.isConnected || !ws.current || ws.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      type: 'resize',
      sessionId,
      cols,
      rows,
      timestamp: Date.now(),
    };

    try {
      ws.current.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to resize terminal:', error);
    }
  }, [state.isConnected, sessionId]);

  // Clear terminal output
  const clear = useCallback(() => {
    setState(prev => ({
      ...prev,
      output: '',
    }));
  }, []);

  // Reconnect to terminal
  const reconnect = useCallback(async () => {
    disconnect();
    reconnectCount.current = 0;
    await connect();
  }, [disconnect, connect]);

  // Handle WebSocket messages
  const handleMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'output':
        if (message.data) {
          setState(prev => ({
            ...prev,
            output: prev.output + message.data,
          }));
        }
        break;

      case 'error':
        setState(prev => ({
          ...prev,
          error: message.error || 'Terminal error',
        }));
        break;

      case 'session_created':
        setState(prev => ({
          ...prev,
          sessionId: message.sessionId,
        }));
        break;

      case 'session_closed':
        setState(prev => ({
          ...prev,
          isConnected: false,
          sessionId: null,
        }));
        break;

      case 'participant_added':
        setState(prev => ({
          ...prev,
          participants: [...prev.participants, message.userId],
        }));
        break;

      case 'participant_removed':
        setState(prev => ({
          ...prev,
          participants: prev.participants.filter(id => id !== message.userId),
        }));
        break;

      default:
        console.log('Unknown terminal message type:', message.type);
    }
  }, []);

  // Schedule reconnection
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }

    reconnectCount.current += 1;
    
    if (reconnectCount.current <= reconnectAttempts) {
      reconnectTimeout.current = setTimeout(() => {
        console.log(`Attempting to reconnect (${reconnectCount.current}/${reconnectAttempts})...`);
        connect();
      }, reconnectDelay * reconnectCount.current);
    }
  }, [reconnectAttempts, reconnectDelay, connect]);

  // Auto-connect if enabled
  useEffect(() => {
    if (autoConnect && sessionId && userId) {
      connect();
    }

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, [autoConnect, sessionId, userId, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Computed values
  const canConnect = !state.isConnected && !state.isLoading && !state.error;
  const connectionStatus = getConnectionStatus();

  return {
    // State
    ...state,
    
    // Actions
    connect,
    disconnect,
    sendInput,
    resize,
    clear,
    reconnect,
    
    // Computed
    canConnect,
    connectionStatus,
  };
};

export default useTerminal;
