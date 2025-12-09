/**
 * Terminal Service - Core PTY session management for LobeChat
 * 
 * This service provides pseudo-terminal (PTY) functionality for interactive
 * terminal applications like vim, htop, git rebase, etc.
 */

import { spawn, IPty } from 'node-pty';
import { EventEmitter } from 'events';
import crypto from 'node:crypto';

export interface TerminalSession {
  id: string;
  pty: IPty;
  userId: string;
  createdAt: Date;
  lastActivity: Date;
  workingDirectory: string;
  participants: Set<string>; // For multi-agent collaboration
  outputBuffer: string[];
  isActive: boolean;
}

export interface TerminalOptions {
  cols?: number;
  rows?: number;
  shell?: string;
  workingDirectory?: string;
  environment?: Record<string, string>;
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

export class TerminalService extends EventEmitter {
  private sessions = new Map<string, TerminalSession>();
  private readonly maxSessions = 10;
  private readonly maxOutputBuffer = 1000;
  private readonly sessionTimeout = 30 * 60 * 1000; // 30 minutes

  constructor() {
    super();
    this.setupCleanupInterval();
  }

  /**
   * Create a new PTY terminal session
   */
  async createSession(
    userId: string,
    options: TerminalOptions = {}
  ): Promise<string> {
    if (this.sessions.size >= this.maxSessions) {
      throw new Error(`Maximum number of terminal sessions (${this.maxSessions}) reached`);
    }

    const sessionId = this.generateSessionId();
    const shell = options.shell || this.getDefaultShell();
    const cols = options.cols || 80;
    const rows = options.rows || 24;
    const workingDirectory = options.workingDirectory || process.cwd();

    // Create PTY process
    const pty = spawn(shell, [], {
      name: 'xterm-color',
      cols,
      rows,
      cwd: workingDirectory,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        ...options.environment,
      },
    });

    // Create session object
    const session: TerminalSession = {
      id: sessionId,
      pty,
      userId,
      createdAt: new Date(),
      lastActivity: new Date(),
      workingDirectory,
      participants: new Set([userId]),
      outputBuffer: [],
      isActive: true,
    };

    // Setup PTY event listeners
    this.setupPtyEvents(session);

    // Store session
    this.sessions.set(sessionId, session);

    // Emit session created event
    this.emit('sessionCreated', {
      sessionId,
      userId,
      workingDirectory,
    });

    return sessionId;
  }

  /**
   * Write input to a terminal session
   */
  writeToSession(sessionId: string, data: string, userId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Terminal session ${sessionId} not found`);
    }

    if (!session.isActive) {
      throw new Error(`Terminal session ${sessionId} is not active`);
    }

    // Add participant if not already present
    session.participants.add(userId);
    session.lastActivity = new Date();

    // Write to PTY
    session.pty.write(data);

    // Emit input event
    this.emit('input', {
      sessionId,
      data,
      userId,
      timestamp: new Date(),
    } as TerminalInput);
  }

  /**
   * Resize a terminal session
   */
  resizeSession(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Terminal session ${sessionId} not found`);
    }

    session.pty.resize(cols, rows);
    session.lastActivity = new Date();

    this.emit('sessionResized', {
      sessionId,
      cols,
      rows,
    });
  }

  /**
   * Get session information
   */
  getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * List all active sessions for a user
   */
  getUserSessions(userId: string): TerminalSession[] {
    return Array.from(this.sessions.values()).filter(
      session => session.userId === userId && session.isActive
    );
  }

  /**
   * Close a terminal session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Terminal session ${sessionId} not found`);
    }

    // Mark as inactive
    session.isActive = false;

    // Kill PTY process
    session.pty.kill();

    // Remove from sessions
    this.sessions.delete(sessionId);

    // Emit session closed event
    this.emit('sessionClosed', {
      sessionId,
      userId: session.userId,
      duration: Date.now() - session.createdAt.getTime(),
    });
  }

  /**
   * Get output buffer for a session
   */
  getOutputBuffer(sessionId: string): string[] {
    const session = this.sessions.get(sessionId);
    return session ? [...session.outputBuffer] : [];
  }

  /**
   * Clear output buffer for a session
   */
  clearOutputBuffer(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.outputBuffer = [];
    }
  }

  /**
   * Get session statistics
   */
  getStats() {
    return {
      totalSessions: this.sessions.size,
      activeSessions: Array.from(this.sessions.values()).filter(s => s.isActive).length,
      maxSessions: this.maxSessions,
      sessions: Array.from(this.sessions.values()).map(session => ({
        id: session.id,
        userId: session.userId,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        workingDirectory: session.workingDirectory,
        participantCount: session.participants.size,
        isActive: session.isActive,
      })),
    };
  }

  /**
   * Add participant to session (for multi-agent collaboration)
   */
  addParticipant(sessionId: string, userId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.participants.add(userId);
      this.emit('participantAdded', { sessionId, userId });
    }
  }

  /**
   * Remove participant from session
   */
  removeParticipant(sessionId: string, userId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.participants.delete(userId);
      this.emit('participantRemoved', { sessionId, userId });
    }
  }

  /**
   * Get session participants
   */
  getParticipants(sessionId: string): string[] {
    const session = this.sessions.get(sessionId);
    return session ? Array.from(session.participants) : [];
  }

  // Private methods

  private generateSessionId(): string {
    return `term_${crypto.randomBytes(8).toString('hex')}`;
  }

  private getDefaultShell(): string {
    if (process.platform === 'win32') {
      return process.env.COMSPEC || 'cmd.exe';
    }
    return process.env.SHELL || '/bin/bash';
  }

  private setupPtyEvents(session: TerminalSession): void {
    const { pty, id } = session;

    // Handle PTY output
    pty.onData((data: string) => {
      // Add to output buffer
      session.outputBuffer.push(data);
      
      // Limit buffer size
      if (session.outputBuffer.length > this.maxOutputBuffer) {
        session.outputBuffer = session.outputBuffer.slice(-this.maxOutputBuffer);
      }

      session.lastActivity = new Date();

      // Emit output event
      this.emit('output', {
        sessionId: id,
        data,
        timestamp: new Date(),
        type: 'stdout' as const,
      } as TerminalOutput);
    });

    // Handle PTY exit
    pty.onExit(({ exitCode, signal }) => {
      session.isActive = false;
      
      this.emit('sessionEnded', {
        sessionId: id,
        exitCode,
        signal,
        userId: session.userId,
      });

      // Auto-cleanup after a delay
      setTimeout(() => {
        this.sessions.delete(id);
      }, 5000);
    });

    // Handle PTY error
    pty.onError((error: Error) => {
      this.emit('sessionError', {
        sessionId: id,
        error: error.message,
        userId: session.userId,
      });
    });
  }

  private setupCleanupInterval(): void {
    // Clean up inactive sessions periodically
    setInterval(() => {
      const now = Date.now();
      const inactiveSessions: string[] = [];

      for (const [sessionId, session] of this.sessions) {
        if (!session.isActive || 
            (now - session.lastActivity.getTime()) > this.sessionTimeout) {
          inactiveSessions.push(sessionId);
        }
      }

      // Close inactive sessions
      for (const sessionId of inactiveSessions) {
        this.closeSession(sessionId).catch(console.error);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }
}

// Export singleton instance
export const terminalService = new TerminalService();
