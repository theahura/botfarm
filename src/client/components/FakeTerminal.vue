<template>
  <div class="terminal-container">
    <div class="terminal-header">
      <h3>Claude Chat - {{ developerName }}</h3>
      <div class="terminal-controls">
        <button @click="clearChat" class="btn-clear">Clear</button>
        <button @click="toggleTerminal" class="btn-toggle">
          {{ isVisible ? 'Hide' : 'Show' }} Chat
        </button>
      </div>
    </div>
    
    <div v-show="isVisible" class="terminal-wrapper">
      <div class="chat-messages" ref="messagesContainer">
        <div 
          v-for="message in chatHistory" 
          :key="message.id"
          :class="['message', `message-${message.type}`]"
        >
          <div class="message-header">
            <span class="message-type">{{ getMessageTypeLabel(message.type) }}</span>
            <span class="message-time">{{ formatTime(message.timestamp) }}</span>
          </div>
          <div class="message-content">
            <pre>{{ message.content }}</pre>
          </div>
        </div>
      </div>
      
      <div class="input-area">
        <div class="input-wrapper">
          <input 
            v-model="currentInput"
            @keydown.enter="sendMessage"
            @keydown.up="navigateHistory(-1)"
            @keydown.down="navigateHistory(1)"
            placeholder="Type your message to Claude..."
            class="chat-input"
            :disabled="isLoading"
          />
          <button 
            @click="sendMessage" 
            :disabled="!currentInput.trim() || isLoading"
            class="send-button"
          >
            {{ isLoading ? 'Sending...' : 'Send' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useSocket } from '../composables/useSocket'
import type { ChatMessage } from '../../shared/types'

interface Props {
  developerId: string
  developerName: string
}

const props = defineProps<Props>()

const { socket } = useSocket()
const messagesContainer = ref<HTMLElement>()
const isVisible = ref(true)
const currentInput = ref('')
const isLoading = ref(false)
const chatHistory = ref<ChatMessage[]>([])
const inputHistory = ref<string[]>([])
const historyIndex = ref(-1)

const getMessageTypeLabel = (type: string): string => {
  const labels = {
    'input': 'You',
    'output': 'Claude',
    'error': 'Error',
    'system': 'System'
  }
  return labels[type as keyof typeof labels] || type
}

const formatTime = (timestamp: Date | string): string => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

const sendMessage = async () => {
  if (!currentInput.value.trim() || isLoading.value) return
  
  const message = currentInput.value.trim()
  
  // Add to input history
  inputHistory.value.unshift(message)
  if (inputHistory.value.length > 50) {
    inputHistory.value.pop()
  }
  historyIndex.value = -1
  
  currentInput.value = ''
  isLoading.value = true
  
  if (socket) {
    socket.emit('chat:input', { developerId: props.developerId, message })
  }
}

const navigateHistory = (direction: number) => {
  if (inputHistory.value.length === 0) return
  
  const newIndex = historyIndex.value + direction
  if (newIndex >= -1 && newIndex < inputHistory.value.length) {
    historyIndex.value = newIndex
    currentInput.value = historyIndex.value === -1 ? '' : inputHistory.value[historyIndex.value]
  }
}

const clearChat = () => {
  chatHistory.value = []
}

const toggleTerminal = () => {
  isVisible.value = !isVisible.value
  if (isVisible.value) {
    scrollToBottom()
  }
}

const setupSocketListeners = () => {
  if (!socket) return
  
  socket.emit('chat:connect', props.developerId)
  
  socket.on('chat:history', (history: ChatMessage[]) => {
    chatHistory.value = history
    scrollToBottom()
  })
  
  socket.on('chat:message', (message: ChatMessage) => {
    chatHistory.value.push(message)
    scrollToBottom()
    
    if (message.type === 'output') {
      isLoading.value = false
    }
  })
  
  socket.on('chat:error', (error: string) => {
    const errorMessage: ChatMessage = {
      id: `error-${Date.now()}`,
      developerId: props.developerId,
      type: 'error',
      content: error,
      timestamp: new Date()
    }
    chatHistory.value.push(errorMessage)
    isLoading.value = false
    scrollToBottom()
  })
}

const cleanupSocketListeners = () => {
  if (socket) {
    socket.emit('chat:disconnect', props.developerId)
    socket.off('chat:history')
    socket.off('chat:message')
    socket.off('chat:error')
  }
}

onMounted(() => {
  setupSocketListeners()
})

onUnmounted(() => {
  cleanupSocketListeners()
})

watch(() => props.developerId, (newDeveloperId, oldDeveloperId) => {
  if (newDeveloperId !== oldDeveloperId) {
    cleanupSocketListeners()
    chatHistory.value = []
    currentInput.value = ''
    isLoading.value = false
    setupSocketListeners()
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
  flex: 1;
  display: flex;
  flex-direction: column;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.message {
  border-left: 4px solid;
  padding: 0.75rem;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
}

.message-input {
  border-left-color: #3b8eea;
  background: rgba(59, 142, 234, 0.1);
}

.message-output {
  border-left-color: #23d18b;
  background: rgba(35, 209, 139, 0.1);
}

.message-error {
  border-left-color: #f14c4c;
  background: rgba(241, 76, 76, 0.1);
}

.message-system {
  border-left-color: #f5f543;
  background: rgba(245, 245, 67, 0.1);
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.message-type {
  font-weight: bold;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.message-input .message-type {
  color: #3b8eea;
}

.message-output .message-type {
  color: #23d18b;
}

.message-error .message-type {
  color: #f14c4c;
}

.message-system .message-type {
  color: #f5f543;
}

.message-time {
  color: #888;
  font-size: 0.75rem;
}

.message-content {
  color: #e5e5e5;
}

.message-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.4;
}

.input-area {
  border-top: 1px solid #333;
  padding: 1rem;
  background: #2a2a2a;
}

.input-wrapper {
  display: flex;
  gap: 0.5rem;
}

.chat-input {
  flex: 1;
  background: #1e1e1e;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 0.75rem;
  color: #e5e5e5;
  font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
  font-size: 0.9rem;
}

.chat-input:focus {
  outline: none;
  border-color: #3b8eea;
  box-shadow: 0 0 0 2px rgba(59, 142, 234, 0.2);
}

.chat-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.send-button {
  background: #3b8eea;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
  white-space: nowrap;
}

.send-button:hover:not(:disabled) {
  background: #2968c8;
}

.send-button:disabled {
  background: #666;
  cursor: not-allowed;
}

/* Scrollbar styling */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: #2a2a2a;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: #777;
}
</style>