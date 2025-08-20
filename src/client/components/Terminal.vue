<template>
  <div class="terminal-container">
    <div class="terminal-header">
      <h3>Claude Terminal - {{ developerName }}</h3>
      <div class="terminal-controls">
        <button @click="resetTerminal" class="btn-reset">Reset Terminal</button>
      </div>
    </div>
    
    <div class="terminal-wrapper">
      <div ref="terminalElement" class="terminal"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { useSocket } from '../composables/useSocket'

interface Props {
  developerId: string
  developerName: string
}

const props = defineProps<Props>()

const { socket } = useSocket()
const terminalElement = ref<HTMLElement>()

let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null

const setupSocketConnection = (socketInstance: any) => {
  if (!socketInstance || !terminal) return

  // Connect to terminal stream
  socketInstance.emit('terminal:connect', props.developerId)
  
  socketInstance.on('terminal:history', (history: string) => {
    if (terminal && history) {
      terminal.write(history)
    }
  })
  
  socketInstance.on('terminal:data', (data: string) => {
    if (terminal) {
      terminal.write(data)
    }
  })
  
  socketInstance.on('terminal:error', (error: string) => {
    if (terminal) {
      terminal.write(`\r\n\x1b[31mTerminal Error: ${error}\x1b[0m\r\n`)
    }
  })
}

const initializeTerminal = () => {
  if (!terminalElement.value) return

  terminal = new Terminal({
    cursorBlink: true,
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#ffffff',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
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
      brightWhite: '#e5e5e5'
    },
    fontSize: 14,
    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
    rows: 30,
    cols: 120
  })

  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)

  terminal.open(terminalElement.value)
  fitAddon.fit()

  // Handle user input
  terminal.onData((data) => {
    if (socket.value) {
      socket.value.emit('terminal:input', { developerId: props.developerId, data })
    }
  })

  // Set up socket connection if available
  if (socket.value) {
    setupSocketConnection(socket.value)
  }

  // Handle window resize
  const handleResize = () => {
    if (fitAddon) {
      fitAddon.fit()
    }
  }
  
  window.addEventListener('resize', handleResize)
  
  // Return cleanup function
  return () => {
    window.removeEventListener('resize', handleResize)
    if (socket.value) {
      socket.value.emit('terminal:disconnect', props.developerId)
      socket.value.off('terminal:history')
      socket.value.off('terminal:data')
      socket.value.off('terminal:error')
    }
    if (terminal) {
      terminal.dispose()
    }
  }
}

const resetTerminal = () => {
  if (socket.value) {
    console.log('🔄 Requesting terminal reset for developer', props.developerId)
    socket.value.emit('terminal:reset', props.developerId)
    
    // Clear the current terminal display immediately for better UX
    if (terminal) {
      terminal.clear()
    }
  }
}

let cleanup: (() => void) | null = null

onMounted(() => {
  nextTick(() => {
    cleanup = initializeTerminal()
  })
})

onUnmounted(() => {
  if (cleanup) {
    cleanup()
  }
})

// Watch for socket to become available and connect
watch(socket, (newSocket) => {
  if (newSocket && terminal) {
    console.log('🔌 Terminal: Setting up socket connection for developer', props.developerId)
    setupSocketConnection(newSocket)
  }
}, { immediate: true })

// Watch for developerId changes and reconnect terminal
watch(() => props.developerId, (newDeveloperId, oldDeveloperId) => {
  if (newDeveloperId !== oldDeveloperId && terminal && socket.value) {
    // Disconnect from old developer
    if (oldDeveloperId) {
      socket.value.emit('terminal:disconnect', oldDeveloperId)
    }
    
    // Clear terminal display
    terminal.clear()
    
    // Connect to new developer
    socket.value.emit('terminal:connect', newDeveloperId)
  }
})
</script>

<style scoped>
.terminal-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 1rem;
  overflow: hidden;
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.terminal-header {
  background: #f8f9fa;
  padding: 1rem;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.terminal-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.1rem;
}

.terminal-controls {
  display: flex;
  gap: 0.5rem;
}

.btn-reset {
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background-color 0.2s;
}

.btn-reset:hover {
  background: #c82333;
}

.terminal-wrapper {
  background: #1e1e1e;
  overflow: hidden;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.terminal {
  flex: 1;
  padding: 1rem;
  height: auto;
}

/* Ensure xterm.js styles work correctly */
:global(.xterm) {
  height: 100% !important;
}

:global(.xterm-viewport) {
  overflow-y: auto;
}
</style>