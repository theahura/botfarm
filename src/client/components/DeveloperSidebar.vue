<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <h3>Developers</h3>
      <button class="btn-new" @click="$router.push('/')">
        + New
      </button>
    </div>
    
    <div class="developer-list">
      <div 
        v-for="dev in developers" 
        :key="dev.id"
        class="developer-item"
        :class="{ active: dev.id === currentDeveloperId }"
        @click="switchDeveloper(dev.id)"
      >
        <div class="developer-info">
          <div class="developer-name">{{ dev.name }}</div>
          <div class="developer-branch">{{ dev.branchName }}</div>
        </div>
        
        <div class="developer-indicators">
          <div 
            v-if="dev.notificationCount > 0" 
            class="notification-badge"
            :title="`${dev.notificationCount} unread notifications`"
          >
            {{ dev.notificationCount }}
          </div>
          
          <div class="status-indicator" :class="dev.status" :title="formatStatus(dev.status)"></div>
          
          <a 
            v-if="dev.pullRequestUrl" 
            :href="dev.pullRequestUrl" 
            target="_blank" 
            class="github-link"
            title="View PR on GitHub"
            @click.stop
          >
            ↗
          </a>
        </div>
      </div>
    </div>
    
    <div v-if="developers.length === 0" class="empty-state">
      <p>No developers</p>
      <button class="btn-create" @click="$router.push('/')">
        Create First Developer
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { Developer, DeveloperStatus } from '../../shared/types'

interface Props {
  developers: Developer[]
  currentDeveloperId?: string
}

const props = defineProps<Props>()
const router = useRouter()

const formatStatus = (status: DeveloperStatus): string => {
  switch (status) {
    case 'idle': return 'Idle'
    case 'active': return 'Active'
    case 'waiting_for_input': return 'Waiting for Input'
    case 'error': return 'Error'
    case 'completed': return 'Completed'
    default: return status
  }
}

const switchDeveloper = (developerId: string) => {
  if (developerId !== props.currentDeveloperId) {
    router.push(`/chat/${developerId}`)
  }
}
</script>

<style scoped>
.sidebar {
  width: 300px;
  background: white;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sidebar-header {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h3 {
  margin: 0;
  color: #374151;
  font-size: 1.1rem;
}

.btn-new {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background-color 0.2s;
}

.btn-new:hover {
  background: #2563eb;
}

.developer-list {
  flex: 1;
  overflow-y: auto;
}

.developer-item {
  padding: 0.75rem 1rem;
  cursor: pointer;
  border-bottom: 1px solid #f3f4f6;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background-color 0.2s;
}

.developer-item:hover {
  background: #f9fafb;
}

.developer-item.active {
  background: #eff6ff;
  border-right: 3px solid #3b82f6;
}

.developer-info {
  flex: 1;
  min-width: 0;
}

.developer-name {
  font-weight: 500;
  color: #374151;
  font-size: 0.9rem;
  truncate: true;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.developer-branch {
  font-size: 0.75rem;
  color: #6b7280;
  font-family: monospace;
  margin-top: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.developer-indicators {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.notification-badge {
  background: #ef4444;
  color: white;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 500;
  min-width: 18px;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-indicator.idle {
  background: #9ca3af;
}

.status-indicator.active {
  background: #10b981;
}

.status-indicator.waiting_for_input {
  background: #f59e0b;
}

.status-indicator.error {
  background: #ef4444;
}

.status-indicator.completed {
  background: #06b6d4;
}

.github-link {
  color: #6b7280;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  padding: 0.25rem;
  border-radius: 2px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.github-link:hover {
  color: #374151;
  background: #f3f4f6;
}

.empty-state {
  padding: 2rem 1rem;
  text-align: center;
  color: #6b7280;
}

.empty-state p {
  margin: 0 0 1rem 0;
  font-size: 0.9rem;
}

.btn-create {
  background: #10b981;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background-color 0.2s;
}

.btn-create:hover {
  background: #059669;
}
</style>