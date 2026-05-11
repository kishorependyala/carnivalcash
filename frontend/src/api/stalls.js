import api from './index';

const stallsApi = {
  async create(payload) {
    return (await api.post('/api/stalls', payload)).data;
  },
  async mine() {
    return (await api.get('/api/stalls/mine')).data;
  },
  async get(stallId) {
    return (await api.get(`/api/stalls/${stallId}`)).data;
  },
  async update(stallId, payload) {
    return (await api.put(`/api/stalls/${stallId}`, payload)).data;
  },
  async catalog(stallId) {
    return (await api.get(`/api/stalls/${stallId}/catalog`)).data;
  },
  async addMember(stallId, phone) {
    return (await api.post(`/api/stalls/${stallId}/members`, { phone })).data;
  },
  async removeMember(stallId, userId) {
    return (await api.delete(`/api/stalls/${stallId}/members/${userId}`)).data;
  },
  async addItem(stallId, payload) {
    return (await api.post(`/api/stalls/${stallId}/items`, payload)).data;
  },
  async updateItem(stallId, itemId, payload) {
    return (await api.put(`/api/stalls/${stallId}/items/${itemId}`, payload)).data;
  },
  async charge(stallId, payload) {
    return (await api.post(`/api/stalls/${stallId}/charge`, payload)).data;
  },
  async transactions(stallId) {
    return (await api.get(`/api/stalls/${stallId}/transactions`)).data;
  },
  async searchUsers(q) {
    return (await api.get('/api/stalls/search-users', { params: { q } })).data;
  },
};

export default stallsApi;
