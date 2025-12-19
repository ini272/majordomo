//const API_URL = 'http://localhost:8000/api';
const API_URL = 'http://192.168.178.33:8000/api';
export const api = {
  auth: {
    login: async (homeId, username, password) => {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ home_id: homeId, username, password })
      });
      if (!res.ok) throw new Error('Login failed');
      return res.json();
    }
  },

  user: {
    getStats: async (token) => {
      const res = await fetch(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch user stats');
      return res.json();
    }
  },
  
  quests: {
    getAll: async (token) => {
      const res = await fetch(`${API_URL}/quests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch quests');
      return res.json();
    },
    
    complete: async (questId, token) => {
      const res = await fetch(`${API_URL}/quests/${questId}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to complete quest');
      return res.json();
    }
  },

  triggers: {
    quest: async (questTemplateId, token) => {
      const res = await fetch(`${API_URL}/triggers/quest/${questTemplateId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to trigger quest');
      return res.json();
    }
  }
};
