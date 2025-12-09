/**
 * WebSocket Service - Real-time bidirectional terminal communication
 * 
 * This service handles WebSocket connections for real-time terminal I/O,
 * enabling interactive terminal applications in the browser.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { terminalService, type TerminalSession } from './terminalService.js';
import { createServer, Server as HttpServer } from 'http';
import url from 'node:url';

export interface WebSocketMessage {
  type: 'input' | 'output' | 'resize' | 'ping' | 'pong' | 'error' | 'session_created' | 'session_closed';
  sessionId?: string;
  data?: string;
  cols?: number;
  rows?: number;
  error?: string;
  timestamp?: number;
}

export interface WebSocketConnection {
  ws: WebSocket;
  sessionId: string;
  userId: string;
  isAlive: boolean;
}

export class WebSocketTerminalService {
  private wss: WebSocketServer | null = null;
  private connections = new Map<string, WebSocketConnection>();
  private server: HttpServer | null = null;

  /**
   * Start WebSocket server for terminal communication
   */
  startServer(port: number = 8080): void {
    this.server = createServer();
    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on('connection', (ws: WebSocket, request) => {
      this.handleConnection(ws, request);
    });

    this.server.listen(port, () => {
      console.log(`Terminal WebSocket server started on port ${port}`);
    });

    // Setup ping/pong for connection health
    this.setupHeartbeat();
  }

  /**
   * Stop WebSocket server
   */
  stopServer(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    
    if (this.server) {
      this.server.close();
      this.server = null;
    }

    // Close all connections
    for (const conn of this.connections.values()) {
      conn.ws.close();
    }
    this.connections.clear();
  }

  /**
   * Send message to specific session connections
   */
  sendToSession(sessionId: string, message: WebSocketMessage): void {
    for (const [connectionId, connection] of this.connections) {
      if (connection.sessionId === sessionId) {
        this.sendToConnection(connectionId, message);
      }
    }
  }

  /**
   * Send message to specific user
   */
  sendToUser(userId: string, message: WebSocketMessage): void {
    for (const [connectionId, connection] of this.connections) {
      if (connection.userId === userId) {
        this.sendToConnection(connectionId, message);
      }
    }
  }

  /**
   * Broadcast message to all connections
   */
  broadcast(message: WebSocketMessage): void {
    for (const connectionId of this.connections.keys()) {
      this.sendToConnection(connectionId, message);
    }
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      totalConnections: this.connections.size,
      activeConnections: Array.from(this.connections.values()).filter(c => c.isAlive).length,
      connections: Array.from(this.connections.values()).map(conn => ({
        connectionId: this.getConnectionId(conn),
        sessionId: conn.sessionId,
        userId: conn.userId,
        isAlive: conn.isAlive,
      })),
    };
  }

  // Private methods

  private handleConnection(ws: WebSocket, request: any): void {
    try {
      // Parse query parameters
      const parsedUrl = url.parse(request.url, true);
      const { sessionId, userId } = parsedUrl.query;

      if (!sessionId || !userId) {
        ws.close(1008, 'Missing sessionId or userId');
        return;
      }

      // Verify session exists
      const session = terminalService.getSession(sessionId as string);
      if (!session) {
        ws.close(1008, 'Invalid sessionId');
        return;
      }

      // Create connection
      const connectionId = this.generateConnectionId();
      const connection: WebSocketConnection = {
        ws,
        sessionId: sessionId as string,
        userId: userId as string,
        isAlive: true,
      };

      this.connections.set(connectionId, connection);

      // Add participant to terminal session
      terminalService.addParticipant(sessionId as string, userId as string);

      // Setup message handler
      ws.on('message', (data: Buffer) => {
        this.handleMessage(connectionId, data);
      });

      // Setup close handler
      ws.on('close', () => {
        this.handleClose(connectionId);
      });

      // Setup error handler
      ws.on('error', (error: Error) => {
        this.handleError(connectionId, error);
      });

      // Send session created confirmation
      this.sendToConnection(connectionId, {
        type: 'session_created',
        sessionId: sessionId as string,
        timestamp: Date.now(),
      });

      console.log(`WebSocket connection established: ${connectionId} for session ${sessionId}`);

    } catch (error) {
      console.error('WebSocket connection error:', error);
      ws.close(1011, 'Internal server error');
    }
  }

  private handleMessage(connectionId: string, data: Buffer): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      connection.isAlive = true;

      switch (message.type) {
        case 'input':
          if (message.data && message.sessionId) {
            // Send input to terminal
            terminalService.writeToSession(
              message.sessionId,
              message.data,
              connection.userId
            );
          }
          break;

        case 'resize':
          if (message.sessionId && message.cols && message.rows) {
            // Resize terminal
            terminalService.resizeSession(
              message.sessionId,
              message.cols,
              message.rows
            );
          }
          break;

        case 'ping':
          // Respond to ping
          this.sendToConnection(connectionId, {
            type: 'pong',
            timestamp: Date.now(),
          });
          break;

        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      this.sendToConnection(connectionId, {
        type: 'error',
        error: 'Invalid message format',
        timestamp: Date.now(),
      });
    }
  }

  private handleClose(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove participant from terminal session
    terminalService.removeParticipant(connection.sessionId, connection.userId);

    // Remove connection
    this.connections.delete(connectionId);

    console.log(`WebSocket connection closed: ${connectionId}`);
  }

  private handleError(connectionId: string, error: Error): void {
    console.error(`WebSocket error for connection ${connectionId}:`, error);
    this.handleClose(connectionId);
  }

  private sendToConnection(connectionId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.isAlive) return;

    try {
      connection.ws.send(JSON.stringify({
        ...message,
        timestamp: message.timestamp || Date.now(),
      }));
    } catch (error) {
      console.error(`Error sending message to connection ${connectionId}:`, error);
      this.handleClose(connectionId);
    }
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getConnectionId(connection: WebSocketConnection): string {
    for (const [id, conn] of this.connections) {
      if (conn === connection) return id;
    }
    return 'unknown';
  }

  private setupHeartbeat(): void {
    // Ping connections every 30 seconds
    setInterval(() => {
      for (const [connectionId, connection] of this.connections) {
        if (!connection.isAlive) {
          // Connection is dead, close it
          connection.ws.terminate();
          this.handleClose(connectionId);
          continue;
        }

        // Reset alive flag and send ping
        connection.isAlive = false;
        this.sendToConnection(connectionId, {
          type: 'ping',
          timestamp: Date.now(),
        });
      }
    }, 30000);
  }
}

// Setup terminal service event listeners
function setupTerminalEventListeners(wsService: WebSocketTerminalService): void {
  // Forward terminal output to WebSocket connections
  terminalService.on('output', (output) => {
    wsService.sendToSession(output.sessionId, {
      type: 'output',
      sessionId: output.sessionId,
      data: output.data,
      timestamp: output.timestamp.getTime(),
    });
  });

  // Handle session events
  terminalService.on('sessionCreated', (event) => {
    wsService.sendToUser(event.userId, {
      type: 'session_created',
      sessionId: event.sessionId,
      timestamp: Date.now(),
    });
  });

  terminalService.on('sessionClosed', (event) => {
    wsService.sendToUser(event.userId, {
      type: 'session_closed',
      sessionId: event.sessionId,
      timestamp: Date.now(),
    });
  });

  // Handle errors
  terminalService.on('sessionError', (event) => {
    wsService.sendToUser(event.userId, {
      type: 'error',
      error: event.error,
      sessionId: event.sessionId,
      timestamp: Date.now(),
    });
  });
}

// Export singleton instance
export const wsTerminalService = new WebSocketTerminalService();

// Setup event listeners
setupTerminalEventListeners(wsTerminalService);
