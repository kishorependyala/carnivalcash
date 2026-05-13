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
  async listUsers() {
    const response = await api.get('/api/admin/users');
    return response.data;
  },
  async setUserRoles(userId, roles) {
    const response = await api.put(`/api/admin/users/${userId}/roles`, { roles });
    return response.data;
  },
  async listVendors() {
    const response = await api.get('/api/admin/vendors');
    return response.data;
  },
  async getAuditLog() {
    const response = await api.get('/api/admin/audit');
    return response.data;
  },
  async browseFiles(path = '') {
    const response = await api.get('/api/admin/files', { params: path ? { path } : {} });
    return response.data;
  },
  async resetTokens(code) {
    const response = await api.post('/api/admin/reset-tokens', { code });
    return response.data;
  },
  async deleteUser(userId, code) {
    const response = await api.delete(`/api/admin/users/${userId}`, { data: { code } });
    return response.data;
  },
};

export default adminApi;
