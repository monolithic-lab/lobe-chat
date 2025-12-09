# Terminal Package for LobeChat

This package provides comprehensive terminal functionality for LobeChat, integrating advanced terminal features while removing redundant parts already present in LobeChat.

## Overview

The terminal package extracts and integrates terminal capabilities from the UI library while avoiding duplication of LobeChat's existing features.

## Features Map

### ✅ Already Available in LobeChat (KEEP)
- Command execution display (`/src/tools/local-system/Render/RunCommand/index.tsx`)
- Command execution runtime (`/src/tools/local-system/ExecutionRuntime/index.ts`)
- Streaming infrastructure (`/src/store/chat/slices/aiChat/actions/streamingExecutor.ts`)
- File system operations (13 different file operations)
- User confirmation dialogs (`/src/tools/local-system/Intervention/RunCommand/index.tsx`)
- Syntax highlighting for shell commands
- Real-time output display
- Cross-platform support
- Error handling with exit codes
- Process management
- Timeout controls

### ❌ Missing in LobeChat (ADD)
- Real PTY (Pseudo Terminal) emulation
- Interactive terminal applications (vim, htop, git rebase)
- Bidirectional WebSocket communication
- Terminal session management
- ANSI escape sequence support
- Keyboard input handling for terminal
- Multi-agent terminal collaboration
- Terminal session persistence
- Shell history and completion
- Terminal resizing capabilities

### 🗑️ Redundant in UI Library (REMOVE)
- MCP (Model Context Protocol) handling
- Authentication system
- Theme management
- Config management
- File editor integration
- Extension system
- Agent management system
- Git integration
- Language processing
- IDE integration
- Memory management
- Document processing

## Package Structure

```
packages/terminal/
├── src/
│   ├── components/          # Terminal UI components
│   ├── services/           # Backend terminal services
│   ├── hooks/              # React hooks for terminal
│   ├── utils/              # Utility functions
│   └── types/              # TypeScript definitions
├── package.json
└── README.md
```

## Integration Points

### 1. Core Terminal Service
- File: `/src/services/terminal/terminalService.ts`
- Purpose: PTY session management and command execution
- Replaces: Basic `child_process.spawn()` with `node-pty`

### 2. WebSocket Communication
- File: `/src/app/api/terminal/route.ts`
- Purpose: Bidirectional terminal communication
- Enables: Real-time terminal interaction

### 3. Terminal UI Component
- File: `/src/components/Terminal/Terminal.tsx`
- Purpose: xterm.js integration
- Replaces: Current command display with full terminal emulation

### 4. Enhanced Local System Tools
- File: `/src/tools/local-system/ExecutionRuntime/index.ts`
- Purpose: Add PTY mode to existing tools
- Maintains: All existing functionality + interactive mode

## Dependencies Required

```json
{
  "node-pty": "^1.0.0",
  "ws": "^8.17.0", 
  "@xterm/addon-fit": "^0.10.0",
  "@xterm/addon-web-links": "^0.10.0"
}
```

## Implementation Phases

### Phase 1: Core Terminal Infrastructure
1. Add required dependencies
2. Create TerminalService with PTY support
3. Add WebSocket API route
4. Integrate with existing LocalSystem tools

### Phase 2: UI Integration
1. Create Terminal component using xterm.js
2. Replace RunCommand display with terminal emulator
3. Add terminal session management
4. Implement keyboard input handling

### Phase 3: Advanced Features
1. Multi-agent terminal collaboration
2. Terminal session persistence
3. Shell history and completion
4. Terminal resizing

## File Mapping

### LobeChat Existing (Keep)
```
/src/tools/local-system/index.ts           → File operations API
/src/tools/local-system/ExecutionRuntime/  → Command execution logic
/src/tools/local-system/Render/           → Command display UI
/src/tools/local-system/Intervention/     → User confirmation
/src/store/chat/slices/aiChat/actions/    → Streaming system
/src/components/ChatInput/               → Input handling
```

### UI Library Terminal (Extract)
```
/components/AnsiOutput.tsx                → ANSI rendering
/hooks/shellCommandProcessor.ts          → Shell execution logic
/hooks/keyToAnsi.ts                      → Keyboard to ANSI conversion
/components/ShellInputPrompt.tsx         → Terminal input handling
/services/TerminalSessionManager.ts      → Session management
```

### New Terminal Package (Create)
```
packages/terminal/src/services/terminal.ts    → PTY service
packages/terminal/src/components/Terminal.tsx → xterm.js integration
packages/terminal/src/hooks/useTerminal.ts    → Terminal React hook
```

## Benefits

1. **Interactive Terminal**: Enable vim, htop, git rebase, etc.
2. **Real-time Communication**: Bidirectional terminal I/O
3. **Session Management**: Persistent terminal state
4. **Multi-agent Support**: Shared terminal access
5. **Full ANSI Support**: Colors, formatting, cursor control
6. **Enhanced UX**: Terminal-like experience in chat interface

## Security Considerations

1. **PTY Process Isolation**: Each session runs in isolated process
2. **User Confirmation**: Maintain existing approval workflows
3. **Resource Limits**: Timeout and memory constraints
4. **Path Restrictions**: Workspace directory limitations
5. **Permission Management**: Command approval system

## Testing Strategy

1. **Unit Tests**: Terminal service methods
2. **Integration Tests**: WebSocket communication
3. **E2E Tests**: Complete terminal workflows
4. **Security Tests**: Permission and isolation
5. **Performance Tests**: Concurrent session handling
