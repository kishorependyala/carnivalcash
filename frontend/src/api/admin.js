import api from './index';

const adminApi = {
  async getStats() {
    const response = await api.get('/api/admin/stats');
    return response.data;
  },
  async addTokens(payload) {
    const response = await api.post('/api/admin/tokens', payload);
    return response.data;
  },
  async setRate(payload) {
    const response = await api.post('/api/admin/rate', payload);
    return response.data;
  },
  async manageEvent(payload) {
    const response = await api.post('/api/admin/event', payload);
    return response.data;
  },
  async getEvent() {
    const response = await api.get('/api/admin/event');
    return response.data;
  },
  async zeroBalance(userId) {
    const response = await api.delete(`/api/admin/balance/${userId}`);
    return response.data;
  },
};

export default adminApi;
