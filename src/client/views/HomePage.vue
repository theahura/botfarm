<template>
  <div class="home-page">
    <div class="header">
      <h2>Developers</h2>
      <button class="btn-primary" @click="showCreateForm = true">
        + New Developer
      </button>
    </div>

    <div class="developers-grid">
      <div 
        v-for="developer in developers" 
        :key="developer.id"
        class="developer-card"
        @click="openDeveloper(developer.id)"
      >
        <div class="developer-header">
          <h3>{{ developer.name }}</h3>
          <span class="status-badge" :class="developer.status">
            {{ formatStatus(developer.status) }}
          </span>
        </div>
        
        <div class="developer-info">
          <p><strong>Branch:</strong> {{ developer.branchName }}</p>
          <p><strong>Created:</strong> {{ formatDate(developer.createdAt) }}</p>
          <p><strong>Last Activity:</strong> {{ formatDate(developer.lastActivity) }}</p>
          
          <div v-if="developer.pullRequestUrl" class="pr-link">
            <a :href="developer.pullRequestUrl" target="_blank" @click.stop>
              View PR →
            </a>
          </div>
          
          <div v-if="developer.notificationCount > 0" class="notification-count">
            {{ developer.notificationCount }} unread notifications
          </div>
        </div>

        <div class="developer-actions">
          <button 
            class="btn-danger btn-sm" 
            @click.stop="deleteDeveloper(developer.id)"
            :disabled="loading"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <div v-if="developers.length === 0" class="empty-state">
      <h3>No developers yet</h3>
      <p>Create your first Claude Code developer to get started!</p>
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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '../composables/useApi'
import { useSocket } from '../composables/useSocket'
import type { Developer, CreateDeveloperRequest, DeveloperStatus } from '../../shared/types'

const router = useRouter()
const api = useApi()
const { socket } = useSocket()

const developers = ref<Developer[]>([])
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

const formatDate = (date: Date): string => {
  return new Date(date).toLocaleString()
}

const openDeveloper = (id: string) => {
  router.push(`/chat/${id}`)
}

const createDeveloper = async () => {
  if (!newDeveloper.value.name || !newDeveloper.value.branchName) return
  
  loading.value = true
  try {
    const developer = await api.createDeveloper(newDeveloper.value)
    developers.value.push(developer)
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

const deleteDeveloper = async (id: string) => {
  if (!confirm('Are you sure you want to delete this developer? This will stop the Claude process and remove the worktree.')) {
    return
  }
  
  loading.value = true
  try {
    await api.deleteDeveloper(id)
    developers.value = developers.value.filter(d => d.id !== id)
  } catch (error) {
    console.error('Failed to delete developer:', error)
    alert('Failed to delete developer. Please try again.')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    developers.value = await api.getDevelopers()
  } catch (error) {
    console.error('Failed to load developers:', error)
  }

  if (socket) {
    socket.on('developer:created', (developer) => {
      const exists = developers.value.find(d => d.id === developer.id)
      if (!exists) {
        developers.value.push(developer)
      }
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
.home-page {
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header h2 {
  margin: 0;
  color: #2c3e50;
}

.btn-primary {
  background: #3498db;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.btn-primary:hover {
  background: #2980b9;
}

.btn-primary:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}

.developers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.developer-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: all 0.2s;
}

.developer-card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  transform: translateY(-2px);
}

.developer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.developer-header h3 {
  margin: 0;
  color: #2c3e50;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: uppercase;
}

.status-badge.idle {
  background: #ecf0f1;
  color: #7f8c8d;
}

.status-badge.active {
  background: #d5f4e6;
  color: #27ae60;
}

.status-badge.waiting_for_input {
  background: #fff3cd;
  color: #856404;
}

.status-badge.error {
  background: #f8d7da;
  color: #721c24;
}

.status-badge.completed {
  background: #d1ecf1;
  color: #0c5460;
}

.developer-info p {
  margin: 0.5rem 0;
  color: #666;
  font-size: 0.9rem;
}

.pr-link {
  margin-top: 1rem;
}

.pr-link a {
  color: #3498db;
  text-decoration: none;
  font-weight: 500;
}

.pr-link a:hover {
  text-decoration: underline;
}

.notification-count {
  color: #e74c3c;
  font-weight: 500;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.developer-actions {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;
}

.btn-danger {
  background: #e74c3c;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}

.btn-danger:hover {
  background: #c0392b;
}

.btn-danger:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}

.btn-sm {
  font-size: 0.8rem;
  padding: 0.4rem 0.8rem;
}

.empty-state {
  text-align: center;
  padding: 4rem;
  color: #666;
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
  color: #2c3e50;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #2c3e50;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
}

.form-group input:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
}

.form-actions button {
  padding: 0.75rem 1.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.form-actions button:not(.btn-primary) {
  background: white;
  color: #666;
}

.form-actions button:not(.btn-primary):hover {
  background: #f8f9fa;
}
</style>