import api from './index';

const userApi = {
  async getPublicProfile(userId) {
    const response = await api.get(`/api/user/public/${encodeURIComponent(userId)}`);
    return response.data;
  },
  async getPublicKid(parentId, kidId) {
    const response = await api.get(`/api/user/public/${encodeURIComponent(parentId)}/kids/${encodeURIComponent(kidId)}`);
    return response.data;
  },
  async getQr() {
    const response = await api.get('/api/user/qr');
    return response.data;
  },
  async getProfile() {
    const response = await api.get('/api/user/profile');
    return response.data;
  },
  async updateProfile(payload) {
    const response = await api.put('/api/user/profile', payload);
    return response.data;
  },
  async updatePin(pin) {
    const response = await api.put('/api/user/pin', { pin });
    return response.data;
  },
  async requestPinReset() {
    const response = await api.post('/api/user/request-pin-reset');
    return response.data;
  },
  async getBalance() {
    const response = await api.get('/api/user/balance');
    return response.data;
  },
  async updateBirthYear(birthYear) {
    return (await api.put('/api/users/birth-year', { birthYear })).data;
  },
  async getTransactions() {
    const response = await api.get('/api/user/transactions');
    return response.data;
  },
  async getMyOrders() {
    return (await api.get('/api/users/orders')).data;
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
  async updateKid(kidId, data) {
    return (await api.put(`/api/users/kids/${kidId}`, data)).data;
  },
  async getFamily() {
    return (await api.get('/api/users/family')).data;
  },
  async linkFamily(payload) {
    const body = typeof payload === 'string' ? { phone: payload } : payload;
    return (await api.post('/api/users/link-family', body)).data;
  },
  async unlinkFamily(userId) {
    return (await api.delete(`/api/users/link-family/${userId}`)).data;
  },
  async linkCard(cardId, kidId = null) {
    const response = await api.post(`/api/user/link-card/${cardId}`, kidId ? { kidId } : {});
    return response.data;
  },
};

export default userApi;
