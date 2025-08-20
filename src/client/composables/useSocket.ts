import { ref, onMounted, onUnmounted } from 'vue'
import { io, Socket } from 'socket.io-client'
import type { SocketEvents } from '../../shared/types'

const socket = ref<Socket<SocketEvents, SocketEvents> | null>(null)

export function useSocket() {
  onMounted(() => {
    if (!socket.value) {
      console.log('🔌 Initializing Socket.IO connection to http://localhost:3001')
      socket.value = io('http://localhost:3001')
      
      socket.value.on('connect', () => {
        console.log('🔌 ✅ Connected to server with ID:', socket.value?.id)
      })
      
      socket.value.on('disconnect', (reason) => {
        console.log('🔌 ❌ Disconnected from server, reason:', reason)
      })
      
      socket.value.on('connect_error', (error) => {
        console.error('🔌 ❌ Connection error:', error)
      })
      
      // Log all incoming events
      const originalOn = socket.value.on;
      socket.value.on = function(event, handler) {
        const wrappedHandler = (...args: any[]) => {
          console.log(`🔌 📥 Received event: ${event}`, args.length > 0 ? args : 'no data');
          return handler(...args);
        };
        return originalOn.call(this, event, wrappedHandler);
      };
    }
  })

  onUnmounted(() => {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
    }
  })

  return {
    socket
  }
}