<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <h3>Developers</h3>
      <button class="btn-new" @click="showCreateForm = true">
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
      <button class="btn-create" @click="showCreateForm = true">
        Create First Developer
      </button>
    </div>
    
    <!-- Create Developer Modal -->
    <div v-if="showCreateForm" class="modal-overlay" @click="showCreateForm = false">
      <div class="modal-content" @click.stop>
        <h3>Create New Developer</h3>
        
        <form @submit.prevent="createDeveloper">
          <div class="form-group">
            <label for="name">Developer Name:</label>
            <input 
              id="name"
              v-model="newDeveloper.name" 
              type="text" 
              required 
              placeholder="e.g., Feature Developer"
            />
          </div>
          
          <div class="form-group">
            <label for="branch">Branch Name:</label>
            <input 
              id="branch"
              v-model="newDeveloper.branchName" 
              type="text" 
              required 
              placeholder="e.g., feature/new-feature"
            />
          </div>
          
          <div class="form-actions">
            <button type="button" @click="showCreateForm = false" :disabled="loading">
              Cancel
            </button>
            <button type="submit" class="btn-primary" :disabled="loading">
              {{ loading ? 'Creating...' : 'Create Developer' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '../composables/useApi'
import type { Developer, DeveloperStatus, CreateDeveloperRequest } from '../../shared/types'

interface Props {
  developers: Developer[]
  currentDeveloperId?: string
}

interface Emits {
  (e: 'developer-created', developer: Developer): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const router = useRouter()
const api = useApi()

const showCreateForm = ref(false)
const loading = ref(false)
const newDeveloper = ref<CreateDeveloperRequest>({
  name: '',
  branchName: ''
})

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

const createDeveloper = async () => {
  if (!newDeveloper.value.name || !newDeveloper.value.branchName) return
  
  loading.value = true
  try {
    const developer = await api.createDeveloper(newDeveloper.value)
    emit('developer-created', developer)
    showCreateForm.value = false
    newDeveloper.value = { name: '', branchName: '' }
    
    // Navigate to the new developer's chat
    router.push(`/chat/${developer.id}`)
  } catch (error) {
    console.error('Failed to create developer:', error)
    alert('Failed to create developer. Please try again.')
  } finally {
    loading.value = false
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

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content h3 {
  margin: 0 0 1.5rem 0;
  color: #374151;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #374151;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.9rem;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
}

.form-actions button {
  padding: 0.75rem 1.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.form-actions button:not(.btn-primary) {
  background: white;
  color: #6b7280;
}

.form-actions button:not(.btn-primary):hover {
  background: #f9fafb;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  border: 1px solid #3b82f6;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-primary:disabled {
  background: #9ca3af;
  border-color: #9ca3af;
  cursor: not-allowed;
}
</style>