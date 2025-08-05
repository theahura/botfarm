import { ref, onMounted, onUnmounted } from 'vue'
import { io, Socket } from 'socket.io-client'
import type { SocketEvents } from '../../shared/types'

const socket = ref<Socket<SocketEvents, SocketEvents> | null>(null)

export function useSocket() {
  onMounted(() => {
    if (!socket.value) {
      socket.value = io('http://localhost:3001')
      
      socket.value.on('connect', () => {
        console.log('Connected to server')
      })
      
      socket.value.on('disconnect', () => {
        console.log('Disconnected from server')
      })
    }
  })

  onUnmounted(() => {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
    }
  })

  return {
    socket: socket.value
  }
}