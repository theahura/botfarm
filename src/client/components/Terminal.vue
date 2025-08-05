<template>
  <div class="terminal-container">
    <div class="terminal-header">
      <h3>Claude Terminal - {{ developerName }}</h3>
      <div class="terminal-controls">
        <button @click="clearTerminal" class="btn-clear">Clear</button>
        <button @click="toggleTerminal" class="btn-toggle">
          {{ isVisible ? 'Hide' : 'Show' }} Terminal
        </button>
      </div>
    </div>
    
    <div v-show="isVisible" class="terminal-wrapper">
      <div ref="terminalElement" class="terminal"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
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
const isVisible = ref(true)

let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null

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
    if (socket) {
      socket.emit('terminal:input', { developerId: props.developerId, data })
    }
  })

  // Connect to terminal stream
  if (socket) {
    socket.emit('terminal:connect', props.developerId)
    
    socket.on('terminal:data', (data) => {
      if (terminal) {
        terminal.write(data)
      }
    })
    
    socket.on('terminal:error', (error) => {
      if (terminal) {
        terminal.write(`\r\n\x1b[31mTerminal Error: ${error}\x1b[0m\r\n`)
      }
    })
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
    if (socket) {
      socket.emit('terminal:disconnect', props.developerId)
      socket.off('terminal:data')
      socket.off('terminal:error')
    }
    if (terminal) {
      terminal.dispose()
    }
  }
}

const clearTerminal = () => {
  if (terminal) {
    terminal.clear()
  }
}

const toggleTerminal = () => {
  isVisible.value = !isVisible.value
  if (isVisible.value) {
    nextTick(() => {
      if (fitAddon) {
        fitAddon.fit()
      }
    })
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
</script>

<style scoped>
.terminal-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 1rem;
  overflow: hidden;
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

.btn-clear,
.btn-toggle {
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background-color 0.2s;
}

.btn-clear:hover,
.btn-toggle:hover {
  background: #5a6268;
}

.terminal-wrapper {
  background: #1e1e1e;
  overflow: hidden;
}

.terminal {
  height: 500px;
  padding: 1rem;
}

/* Ensure xterm.js styles work correctly */
:global(.xterm) {
  height: 100% !important;
}

:global(.xterm-viewport) {
  overflow-y: auto;
}
</style>