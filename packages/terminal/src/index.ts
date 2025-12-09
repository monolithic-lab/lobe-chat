// ================================
// Core services
// ================================
import { TerminalService, terminalService } from './services/terminalService.js';
import {
  WebSocketTerminalService,
  wsTerminalService,
} from './services/websocketService.js';

// ================================
// React components & hooks
// ================================
import TerminalComponent from './components/TerminalComponent.js';
import { useTerminal } from './hooks/useTerminal.js';

// ================================
// Types
// ================================
export * from './types/index.js';

// ================================
// Constants
// ================================
export const TERMINAL_PACKAGE_VERSION = '0.1.0';
export const MAX_SESSIONS = 10;
export const DEFAULT_TIMEOUT = 30 * 60 * 1000; // 30 minutes
export const MAX_OUTPUT_BUFFER = 1000;

// ================================
// Re-exports (public API)
// ================================
export {
  TerminalService,
  WebSocketTerminalService,
  terminalService,
  wsTerminalService,
  TerminalComponent,
  useTerminal,
};

export { TerminalComponent as Terminal };

// ================================
// Utility functions
// ================================
import type {
  TerminalOptions,
  TerminalSession,
  TerminalStats,
} from './types/index.js';

export const createTerminalSession = async (
  userId: string,
  options: TerminalOptions = {},
): Promise<string> => {
  return terminalService.createSession(userId, options);
};

export const closeTerminalSession = async (
  sessionId: string,
): Promise<void> => {
  return terminalService.closeSession(sessionId);
};

export const getTerminalStats = (): TerminalStats => {
  const sessionStats = terminalService.getStats();
  const connectionStats = wsTerminalService.getStats();

  return {
    ...sessionStats,
    ...connectionStats,
  };
};

// ================================
// Default export (library object)
// ================================
const terminalPackage = {
  TerminalService,
  WebSocketTerminalService,
  terminalService,
  wsTerminalService,
  TerminalComponent,
  useTerminal,
  version: TERMINAL_PACKAGE_VERSION,
  constants: {
    MAX_SESSIONS,
    DEFAULT_TIMEOUT,
    MAX_OUTPUT_BUFFER,
  },
  utils: {
    createTerminalSession,
    closeTerminalSession,
    getTerminalStats,
  },
};

export default terminalPackage;

// ================================
// Module augmentation
// MUST be at top-level and NOT inside exports
// ================================
declare module '@lobechat/types' {
  interface ToolManifest {
    terminal?: {
      createSession: (
        userId: string,
        options?: TerminalOptions,
      ) => Promise<string>;
      closeSession: (sessionId: string) => Promise<void>;
      writeToSession: (
        sessionId: string,
        data: string,
        userId: string,
      ) => void;
      resizeSession: (
        sessionId: string,
        cols: number,
        rows: number,
      ) => void;
      getSession: (
        sessionId: string,
      ) => TerminalSession | undefined;
      getUserSessions: (userId: string) => TerminalSession[];
      getOutputBuffer: (sessionId: string) => string[];
      clearOutputBuffer: (sessionId: string) => void;
      getStats: () => TerminalStats;
    };
  }
}
