import type { Developer, CreateDeveloperRequest, Notification, CommitRequest } from '../../shared/types'

const API_BASE = '/api'

export function useApi() {
  const fetchJson = async <T>(url: string, options?: RequestInit): Promise<T> => {
    const response = await fetch(`${API_BASE}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      },
      ...options
    })
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`)
    }
    
    return response.json()
  }

  const getDevelopers = (): Promise<Developer[]> => {
    return fetchJson('/developers')
  }

  const getDeveloper = (id: string): Promise<Developer> => {
    return fetchJson(`/developers/${id}`)
  }

  const createDeveloper = (data: CreateDeveloperRequest): Promise<Developer> => {
    return fetchJson('/developers', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  const deleteDeveloper = (id: string): Promise<{ success: boolean }> => {
    return fetchJson(`/developers/${id}`, {
      method: 'DELETE'
    })
  }

  const commitChanges = (id: string, message: string): Promise<{ pullRequestUrl: string }> => {
    return fetchJson(`/developers/${id}/commit`, {
      method: 'POST',
      body: JSON.stringify({ message })
    })
  }

  const mergePR = (id: string): Promise<{ success: boolean }> => {
    return fetchJson(`/developers/${id}/merge`, {
      method: 'POST'
    })
  }

  const sendInput = (id: string, input: string): Promise<{ success: boolean }> => {
    return fetchJson(`/developers/${id}/input`, {
      method: 'POST',
      body: JSON.stringify({ input })
    })
  }

  const getNotifications = (): Promise<Notification[]> => {
    return fetchJson('/notifications')
  }

  const markNotificationAsRead = (id: string): Promise<{ success: boolean }> => {
    return fetchJson(`/notifications/${id}/read`, {
      method: 'POST'
    })
  }

  return {
    getDevelopers,
    getDeveloper,
    createDeveloper,
    deleteDeveloper,
    commitChanges,
    mergePR,
    sendInput,
    getNotifications,
    markNotificationAsRead
  }
}