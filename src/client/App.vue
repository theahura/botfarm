<template>
  <div id="app">
    <nav class="navbar">
      <div class="nav-brand">
        <h1>🤖 BotFarm</h1>
      </div>
      <div class="nav-notifications">
        <div class="notification-bell" @click="handleBellClick">
          <span class="bell-icon">🔔</span>
          <span class="notification-badge" v-if="unreadNotifications > 0">
            {{ unreadNotifications }}
          </span>
        </div>
      </div>
    </nav>
    
    <!-- Toast notifications -->
    <div class="toast-container">
      <div v-for="toast in toastNotifications" 
           :key="toast.id"
           class="toast-notification"
           :class="{ 
             'toast-entering': toast.entering,
             'toast-leaving': toast.leaving,
             'permission-required': toast.type === 'permission_required'
           }"
           @click="handleToastClick(toast)">
        <div class="toast-content">
          <div class="toast-header">
            <span class="notification-icon" v-if="toast.type === 'permission_required'">🔒</span>
            <span class="notification-icon" v-else-if="toast.type === 'waiting_for_input'">⏳</span>
            <span class="notification-icon" v-else-if="toast.type === 'error'">❌</span>
            <span class="notification-icon" v-else-if="toast.type === 'pr_created'">🔀</span>
            <span class="notification-icon" v-else-if="toast.type === 'idle'">💤</span>
            <strong>{{ getDeveloperName(toast.developerId) }}</strong>
            <button class="toast-close" @click.stop="dismissToast(toast.id)">×</button>
          </div>
          <p>{{ toast.message }}</p>
        </div>
      </div>
    </div>

    <div class="notifications-panel" v-if="showNotifications">
      <div class="notification-item" 
           v-for="notification in notifications" 
           :key="notification.id"
           :class="{ 
             unread: !notification.read,
             'permission-required': notification.type === 'permission_required'
           }"
           @click="handleNotificationClick(notification)">
        <div class="notification-content">
          <div class="notification-header">
            <span class="notification-icon" v-if="notification.type === 'permission_required'">🔒</span>
            <span class="notification-icon" v-else-if="notification.type === 'waiting_for_input'">⏳</span>
            <span class="notification-icon" v-else-if="notification.type === 'error'">❌</span>
            <span class="notification-icon" v-else-if="notification.type === 'pr_created'">🔀</span>
            <span class="notification-icon" v-else-if="notification.type === 'idle'">💤</span>
            <strong>{{ getDeveloperName(notification.developerId) }}</strong>
          </div>
          <p>{{ notification.message }}</p>
          <small>{{ formatTime(notification.timestamp) }}</small>
        </div>
      </div>
    </div>

    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSocket } from './composables/useSocket'
import { useApi } from './composables/useApi'
import type { Notification, Developer } from '../shared/types'

const router = useRouter()
const { socket } = useSocket()
const api = useApi()

const showNotifications = ref(false)
const notifications = ref<Notification[]>([])
const developers = ref<Developer[]>([])
const toastNotifications = ref<(Notification & { entering?: boolean; leaving?: boolean })[]>([])

const unreadNotifications = computed(() => 
  notifications.value.filter(n => !n.read).length
)

const updatePageTitle = () => {
  const baseTitle = 'BotFarm - Claude Code Developer Management'
  const count = unreadNotifications.value
  document.title = count > 0 ? `(${count}) ${baseTitle}` : baseTitle
}

const getDeveloperName = (developerId: string) => {
  const developer = developers.value.find(d => d.id === developerId)
  return developer?.name || 'Unknown Developer'
}

const formatTime = (timestamp: Date) => {
  return new Date(timestamp).toLocaleTimeString()
}

const handleBellClick = () => {
  showNotifications.value = !showNotifications.value
  if (unreadNotifications.value > 0) {
    // Immediately mark all notifications as read locally
    notifications.value.forEach(n => n.read = true)
  }
}

const handleNotificationClick = (notification: Notification) => {
  if (!notification.read) {
    notification.read = true
  }
  router.push(`/chat/${notification.developerId}`)
  showNotifications.value = false
}

const handleToastClick = (toast: Notification) => {
  dismissToast(toast.id)
  handleNotificationClick(toast)
}

const dismissToast = (toastId: string) => {
  const toast = toastNotifications.value.find(t => t.id === toastId)
  if (toast) {
    toast.leaving = true
    setTimeout(() => {
      toastNotifications.value = toastNotifications.value.filter(t => t.id !== toastId)
    }, 300)
  }
}

const showToast = (notification: Notification) => {
  const toast = { ...notification, entering: true }
  toastNotifications.value.push(toast)
  
  // Remove entering animation after it completes
  setTimeout(() => {
    toast.entering = false
  }, 300)
  
  // Auto-dismiss after 5 seconds (longer for permission requests)
  const dismissTime = notification.type === 'permission_required' ? 10000 : 5000
  setTimeout(() => {
    dismissToast(notification.id)
  }, dismissTime)
}

const setupSocketListeners = (socketInstance: any) => {
  if (!socketInstance) return

  socketInstance.on('notification:new', (notification: Notification) => {
    console.log('📥 Received notification:new event:', notification)
    notifications.value.unshift(notification)
    showToast(notification)
  })

  socketInstance.on('developer:created', (developer: Developer) => {
    console.log('📥 Received developer:created event:', developer)
    developers.value.push(developer)
  })

  socketInstance.on('developer:updated', (developer: Developer) => {
    console.log('📥 Received developer:updated event:', developer)
    const index = developers.value.findIndex(d => d.id === developer.id)
    if (index >= 0) {
      developers.value[index] = developer
    }
  })

  socketInstance.on('developer:deleted', (developerId: string) => {
    console.log('📥 Received developer:deleted event:', developerId)
    developers.value = developers.value.filter(d => d.id !== developerId)
  })
}

onMounted(async () => {
  try {
    developers.value = await api.getDevelopers()
  } catch (error) {
    console.error('Failed to load initial data:', error)
  }
})

// Watch for socket to become available and set up listeners
watch(socket, (newSocket) => {
  if (newSocket) {
    console.log('🔌 Setting up socket listeners')
    setupSocketListeners(newSocket)
  }
}, { immediate: true })

// Watch for changes in unread notifications and update page title
watch(unreadNotifications, () => {
  updatePageTitle()
}, { immediate: true })
</script>

<style scoped>
#app {
  min-height: 100vh;
  background: #f5f5f5;
}

.navbar {
  background: #2c3e50;
  color: white;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.nav-brand h1 {
  margin: 0;
  font-size: 1.5rem;
}

.nav-notifications {
  position: relative;
}

.notification-bell {
  position: relative;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.notification-bell:hover {
  background: rgba(255, 255, 255, 0.1);
}

.bell-icon {
  font-size: 1.25rem;
}

.notification-badge {
  background: #e74c3c;
  color: white;
  border-radius: 50%;
  padding: 0.125rem 0.375rem;
  font-size: 0.75rem;
  min-width: 1.25rem;
  text-align: center;
  display: inline-block;
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  transform: translate(50%, -50%);
}

.notifications-panel {
  position: absolute;
  top: 70px;
  right: 2rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 1000;
  max-width: 400px;
  max-height: 400px;
  overflow-y: auto;
}

.notification-item {
  padding: 1rem;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background-color 0.2s;
}

.notification-item:hover {
  background: #f8f9fa;
}

.notification-item.unread {
  background: #e3f2fd;
  font-weight: 500;
}

.notification-item.permission-required {
  background: #fff3cd;
  border-left: 4px solid #ffc107;
}

.notification-item.permission-required.unread {
  background: #fffacd;
  border-left: 4px solid #ff9800;
}

.notification-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.notification-icon {
  font-size: 1rem;
}

.notification-content p {
  margin: 0.5rem 0;
  color: #666;
}

.notification-content small {
  color: #999;
}

.main-content {
  padding: 0;
  height: calc(100vh - 70px);
}

/* Toast notifications */
.toast-container {
  position: fixed;
  top: 80px;
  right: 1rem;
  z-index: 1001;
  pointer-events: none;
}

.toast-notification {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  margin-bottom: 0.5rem;
  max-width: 400px;
  pointer-events: auto;
  transform: translateX(100%);
  transition: transform 0.3s ease-in-out, opacity 0.3s ease-in-out;
  opacity: 0;
}

.toast-notification.toast-entering {
  transform: translateX(0);
  opacity: 1;
}

.toast-notification.toast-leaving {
  transform: translateX(100%);
  opacity: 0;
}

.toast-notification.permission-required {
  border-left: 4px solid #ffc107;
  background: #fffacd;
}

.toast-content {
  padding: 1rem;
}

.toast-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.toast-close {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.toast-close:hover {
  background: #f0f0f0;
  color: #333;
}

.toast-content p {
  margin: 0;
  color: #333;
  font-size: 0.9rem;
}
</style>
