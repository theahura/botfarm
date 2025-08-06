<template>
  <div class="chat-page">
    <DeveloperSidebar 
      :developers="allDevelopers" 
      :currentDeveloperId="developerId" 
      @developer-created="handleDeveloperCreated"
    />
    <div class="chat-main">
      <div class="chat-header">
      <div class="developer-info">
        <button class="back-btn" @click="$router.push('/')">← Back</button>
        <div v-if="developer">
          <h2>{{ developer.name }}</h2>
          <div class="developer-meta">
            <span class="status-badge" :class="developer.status">
              {{ formatStatus(developer.status) }}
            </span>
            <span class="branch-name">{{ developer.branchName }}</span>
            <a v-if="developer.pullRequestUrl" 
               :href="developer.pullRequestUrl" 
               target="_blank" 
               class="pr-link">
              View PR →
            </a>
          </div>
        </div>
      </div>
      
      <div class="chat-actions">
        <button 
          v-if="developer?.pullRequestUrl"
          class="btn-merge" 
          @click="mergePRAndCleanup"
          :disabled="loading"
        >
          Merge PR & Cleanup
        </button>
        <button 
          class="btn-commit" 
          @click="showCommitModal = true"
          :disabled="!developer || loading"
        >
          Commit Changes
        </button>
      </div>
    </div>

    <!-- Terminal Component -->
    <Terminal 
      v-if="developer" 
      :developerId="developerId" 
      :developerName="developer.name" 
    />

    <!-- Commit Modal -->
    <div v-if="showCommitModal" class="modal-overlay" @click="showCommitModal = false">
      <div class="modal-content" @click.stop>
        <h3>Commit Changes</h3>
        
        <form @submit.prevent="commitChanges">
          <div class="form-group">
            <label for="commit-message">Commit Message:</label>
            <textarea 
              id="commit-message"
              v-model="commitMessage" 
              rows="4"
              required 
              placeholder="Describe the changes made by this developer..."
            ></textarea>
          </div>
          
          <div class="form-actions">
            <button type="button" @click="showCommitModal = false" :disabled="loading">
              Cancel
            </button>
            <button type="submit" class="btn-primary" :disabled="loading">
              {{ loading ? 'Committing...' : 'Commit & Create PR' }}
            </button>
          </div>
        </form>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useApi } from '../composables/useApi'
import { useSocket } from '../composables/useSocket'
import Terminal from '../components/Terminal.vue'
import DeveloperSidebar from '../components/DeveloperSidebar.vue'
import type { Developer, ChatMessage, DeveloperStatus } from '../../shared/types'

const route = useRoute()
const api = useApi()
const { socket } = useSocket()

const developer = ref<Developer | null>(null)
const allDevelopers = ref<Developer[]>([])
const messages = ref<ChatMessage[]>([])
const loading = ref(false)
const showCommitModal = ref(false)
const commitMessage = ref('')

const developerId = route.params.id as string

const formatStatus = (status: DeveloperStatus): string => {
  switch (status) {
    case 'inactive': return 'Inactive'
    case 'idle': return 'Idle'
    case 'active': return 'Active'
    case 'waiting_for_input': return 'Waiting for Input'
    case 'error': return 'Error'
    case 'completed': return 'Completed'
    default: return status
  }
}


const mergePRAndCleanup = async () => {
  if (!developer.value || !developer.value.pullRequestUrl) return
  
  if (!confirm(`Are you sure you want to merge the PR for "${developer.value.name}"? This will merge the PR, remove the worktree, delete the developer, and remove the git branch. You will be redirected to the home page.`)) {
    return
  }
  
  loading.value = true
  try {
    await api.mergePR(developerId)
    alert('PR merged successfully and cleanup completed!')
    // Redirect to home page since developer is deleted
    window.location.href = '/'
  } catch (error) {
    console.error('Failed to merge PR:', error)
    alert('Failed to merge PR. Please try again.')
  } finally {
    loading.value = false
  }
}

const commitChanges = async () => {
  if (!commitMessage.value.trim() || loading.value) return
  
  loading.value = true
  try {
    const result = await api.commitChanges(developerId, commitMessage.value)
    if (developer.value) {
      developer.value.pullRequestUrl = result.pullRequestUrl
    }
    showCommitModal.value = false
    commitMessage.value = ''
    alert('Changes committed and PR created successfully!')
  } catch (error) {
    console.error('Failed to commit changes:', error)
    alert('Failed to commit changes. Please try again.')
  } finally {
    loading.value = false
  }
}

const handleDeveloperCreated = (newDeveloper: Developer) => {
  const exists = allDevelopers.value.find(d => d.id === newDeveloper.id)
  if (!exists) {
    allDevelopers.value.push(newDeveloper)
  }
}

onMounted(async () => {
  try {
    developer.value = await api.getDeveloper(developerId)
    allDevelopers.value = await api.getDevelopers()
  } catch (error) {
    console.error('Failed to load developer:', error)
  }

  if (socket) {
    socket.on('developer:updated', (updatedDeveloper) => {
      if (updatedDeveloper.id === developerId) {
        developer.value = updatedDeveloper
      }
      // Update the developer in the sidebar list
      const index = allDevelopers.value.findIndex(d => d.id === updatedDeveloper.id)
      if (index >= 0) {
        allDevelopers.value[index] = updatedDeveloper
      }
    })

    socket.on('developer:created', (newDeveloper) => {
      const exists = allDevelopers.value.find(d => d.id === newDeveloper.id)
      if (!exists) {
        allDevelopers.value.push(newDeveloper)
      }
    })

    socket.on('developer:deleted', (deletedId) => {
      allDevelopers.value = allDevelopers.value.filter(d => d.id !== deletedId)
    })
  }
})
</script>

<style scoped>
.chat-page {
  height: calc(100vh - 70px);
  display: flex;
  max-width: none;
  margin: 0;
  padding: 0;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  padding: 1rem;
}

.chat-header {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.developer-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.back-btn {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
  color: #666;
}

.back-btn:hover {
  background: #e9ecef;
}

.developer-info h2 {
  margin: 0;
  color: #2c3e50;
}

.developer-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 0.5rem;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: uppercase;
}

.status-badge.inactive {
  background: #f8f9fa;
  color: #6c757d;
  border: 1px solid #dee2e6;
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

.branch-name {
  background: #f8f9fa;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
  color: #666;
  font-family: monospace;
}

.pr-link {
  color: #3498db;
  text-decoration: none;
  font-weight: 500;
}

.pr-link:hover {
  text-decoration: underline;
}

.chat-actions {
  display: flex;
  gap: 1rem;
}

.btn-commit {
  background: #27ae60;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.btn-commit:hover {
  background: #219a52;
}

.btn-merge {
  background: #27ae60;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
  margin-right: 1rem;
}

.btn-merge:hover {
  background: #229954;
}

.btn-merge:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}

.btn-commit:disabled {
  background: #95a5a6;
  cursor: not-allowed;
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

.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
  font-family: inherit;
  resize: vertical;
}

.form-group textarea:focus {
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

.btn-primary {
  background: #3498db;
  color: white;
  border-color: #3498db;
}

.btn-primary:hover {
  background: #2980b9;
  border-color: #2980b9;
}

.btn-primary:disabled {
  background: #95a5a6;
  border-color: #95a5a6;
  cursor: not-allowed;
}
</style>
