import api from './index';

const userApi = {
  async getProfile() {
    const response = await api.get('/api/user/profile');
    return response.data;
  },
  async updateProfile(payload) {
    const response = await api.put('/api/user/profile', payload);
    return response.data;
  },
  async getBalance() {
    const response = await api.get('/api/user/balance');
    return response.data;
  },
  async getTransactions() {
    const response = await api.get('/api/user/transactions');
    return response.data;
  },
  async getKids() {
    const response = await api.get('/api/user/kids');
    return response.data;
  },
  async createKid(payload) {
    const response = await api.post('/api/user/kids', payload);
    return response.data;
  },
  async deleteKid(kidId) {
    const response = await api.delete(`/api/user/kids/${kidId}`);
    return response.data;
  },
};

export default userApi;
