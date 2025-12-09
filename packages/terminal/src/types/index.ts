/**
 * Type definitions for LobeChat Terminal Package
 */

export interface TerminalSession {
  id: string;
  userId: string;
  createdAt: Date;
  lastActivity: Date;
  workingDirectory: string;
  participants: Set<string>;
  outputBuffer: string[];
  isActive: boolean;
  shell: string;
  cols: number;
  rows: number;
}

export interface TerminalOptions {
  cols?: number;
  rows?: number;
  shell?: string;
  workingDirectory?: string;
  environment?: Record<string, string>;
  timeout?: number;
}

export interface TerminalOutput {
  sessionId: string;
  data: string;
  timestamp: Date;
  type: 'stdout' | 'stderr';
}

export interface TerminalInput {
  sessionId: string;
  data: string;
  userId: string;
  timestamp: Date;
}

export interface TerminalResize {
  sessionId: string;
  cols: number;
  rows: number;
  timestamp: Date;
}

export interface TerminalEvent {
  sessionId: string;
  userId: string;
  timestamp: Date;
}

export interface SessionCreatedEvent extends TerminalEvent {
  workingDirectory: string;
}

export interface SessionClosedEvent extends TerminalEvent {
  exitCode?: number;
  signal?: string;
  duration: number;
}

export interface SessionEndedEvent extends TerminalEvent {
  exitCode: number;
  signal: string;
}

export interface SessionErrorEvent extends TerminalEvent {
  error: string;
}

export interface ParticipantEvent extends TerminalEvent {
  participantUserId: string;
}

export interface WebSocketMessage {
  type: 'input' | 'output' | 'resize' | 'ping' | 'pong' | 'error' | 
        'session_created' | 'session_closed' | 'participant_added' | 'participant_removed';
  sessionId?: string;
  data?: string;
  cols?: number;
  rows?: number;
  error?: string;
  timestamp?: number;
  userId?: string;
  participantUserId?: string;
}

export interface WebSocketConnection {
  ws: WebSocket;
  sessionId: string;
  userId: string;
  isAlive: boolean;
  connectedAt: Date;
}

export interface TerminalStats {
  totalSessions: number;
  activeSessions: number;
  maxSessions: number;
  totalConnections: number;
  activeConnections: number;
  sessions: Array<{
    id: string;
    userId: string;
    createdAt: Date;
    lastActivity: Date;
    workingDirectory: string;
    participantCount: number;
    isActive: boolean;
  }>;
  connections: Array<{
    connectionId: string;
    sessionId: string;
    userId: string;
    isAlive: boolean;
  }>;
}

export interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
  selection: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export interface TerminalComponentProps {
  sessionId: string;
  userId: string;
  className?: string;
  onError?: (error: string) => void;
  onOutput?: (data: string) => void;
  onInput?: (data: string) => void;
  autoFocus?: boolean;
  theme?: 'dark' | 'light' | TerminalTheme;
  cols?: number;
  rows?: number;
}

export interface TerminalSessionProps {
  session: TerminalSession;
  className?: string;
  onClose?: (sessionId: string) => void;
  onError?: (error: string) => void;
}

export interface TerminalToolbarProps {
  sessionId: string;
  userId: string;
  isConnected: boolean;
  participants: string[];
  onClear: () => void;
  onDisconnect: () => void;
  onResize: (cols: number, rows: number) => void;
  className?: string;
}

export interface UseTerminalOptions {
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  bufferSize?: number;
}

export interface UseTerminalState {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  sessionId: string | null;
  userId: string;
  output: string;
  participants: string[];
}

export interface UseTerminalActions {
  connect: () => Promise<void>;
  disconnect: () => void;
  sendInput: (input: string) => void;
  resize: (cols: number, rows: number) => void;
  clear: () => void;
  reconnect: () => Promise<void>;
}

export interface UseTerminalReturn extends UseTerminalState, UseTerminalActions {
  canConnect: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
}

export interface ANSItoken {
  text: string;
  fg?: string;
  bg?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  dim?: boolean;
  inverse?: boolean;
}

export interface ANSIline {
  tokens: ANSItoken[];
}

export interface ANSIOutput {
  lines: ANSIline[];
}

// Shell-specific types
export interface ShellCommand {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface ShellExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  command: string;
}

// Multi-agent collaboration types
export interface TerminalCollaboration {
  sessionId: string;
  participants: Array<{
    userId: string;
    role: 'owner' | 'collaborator';
    permissions: {
      canWrite: boolean;
      canResize: boolean;
      canViewOutput: boolean;
    };
    joinedAt: Date;
  }>;
  sharedHistory: Array<{
    userId: string;
    input: string;
    output: string;
    timestamp: Date;
  }>;
}

// Security and permissions types
export interface TerminalPermissions {
  userId: string;
  canCreateSessions: boolean;
  canJoinSessions: boolean;
  canViewOutput: boolean;
  canSendInput: boolean;
  canResize: boolean;
  allowedShells: string[];
  maxSessionTimeout: number;
  maxOutputBuffer: number;
}

export interface SecurityPolicy {
  allowedShells: string[];
  maxSessionsPerUser: number;
  maxSessionTimeout: number;
  maxOutputBuffer: number;
  requireConfirmation: boolean;
  workspaceRestriction: boolean;
  dangerousCommandPatterns: string[];
}

// Error types
export interface TerminalError {
  code: string;
  message: string;
  details?: string;
  timestamp: Date;
  sessionId?: string;
  userId?: string;
}

export type TerminalErrorCode = 
  | 'SESSION_NOT_FOUND'
  | 'SESSION_LIMIT_EXCEEDED'
  | 'INVALID_PERMISSIONS'
  | 'WEBSOCKET_ERROR'
  | 'PTY_ERROR'
  | 'TIMEOUT'
  | 'INVALID_INPUT'
  | 'SECURITY_VIOLATION';

// Event types for terminal service
export type TerminalServiceEvent =
  | 'sessionCreated'
  | 'sessionClosed'
  | 'sessionEnded'
  | 'sessionError'
  | 'sessionResized'
  | 'participantAdded'
  | 'participantRemoved'
  | 'output'
  | 'input';

// Event types for WebSocket service
export type WebSocketServiceEvent =
  | 'connectionEstablished'
  | 'connectionClosed'
  | 'connectionError'
  | 'messageReceived'
  | 'messageSent';

// Re-export commonly used types
export type {
  IPty,
} from 'node-pty';

export type {
  Terminal as XTermTerminal,
} from '@xterm/xterm';
