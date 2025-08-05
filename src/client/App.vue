<template>
  <div id="app">
    <nav class="navbar">
      <div class="nav-brand">
        <h1>🤖 BotFarm</h1>
      </div>
      <div class="nav-notifications" v-if="unreadNotifications > 0">
        <span class="notification-badge" @click="showNotifications = !showNotifications">
          {{ unreadNotifications }}
        </span>
      </div>
    </nav>
    
    <div class="notifications-panel" v-if="showNotifications">
      <div class="notification-item" 
           v-for="notification in notifications" 
           :key="notification.id"
           :class="{ unread: !notification.read }"
           @click="handleNotificationClick(notification)">
        <div class="notification-content">
          <strong>{{ getDeveloperName(notification.developerId) }}</strong>
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
import { ref, computed, onMounted } from 'vue'
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

const unreadNotifications = computed(() => 
  notifications.value.filter(n => !n.read).length
)

const getDeveloperName = (developerId: string) => {
  const developer = developers.value.find(d => d.id === developerId)
  return developer?.name || 'Unknown Developer'
}

const formatTime = (timestamp: Date) => {
  return new Date(timestamp).toLocaleTimeString()
}

const handleNotificationClick = async (notification: Notification) => {
  if (!notification.read) {
    await api.markNotificationAsRead(notification.id)
  }
  router.push(`/chat/${notification.developerId}`)
  showNotifications.value = false
}

onMounted(async () => {
  try {
    notifications.value = await api.getNotifications()
    developers.value = await api.getDevelopers()
  } catch (error) {
    console.error('Failed to load initial data:', error)
  }

  if (socket) {
    socket.on('notification:new', (notification) => {
      notifications.value.unshift(notification)
    })

    socket.on('notification:read', (notificationId) => {
      const notification = notifications.value.find(n => n.id === notificationId)
      if (notification) {
        notification.read = true
      }
    })

    socket.on('developer:created', (developer) => {
      developers.value.push(developer)
    })

    socket.on('developer:updated', (developer) => {
      const index = developers.value.findIndex(d => d.id === developer.id)
      if (index >= 0) {
        developers.value[index] = developer
      }
    })

    socket.on('developer:deleted', (developerId) => {
      developers.value = developers.value.filter(d => d.id !== developerId)
    })
  }
})
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

.notification-badge {
  background: #e74c3c;
  color: white;
  border-radius: 50%;
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
  min-width: 1.5rem;
  text-align: center;
  display: inline-block;
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

.notification-content p {
  margin: 0.5rem 0;
  color: #666;
}

.notification-content small {
  color: #999;
}

.main-content {
  padding: 2rem;
}
</style>