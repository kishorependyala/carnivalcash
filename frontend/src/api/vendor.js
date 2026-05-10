import api from './index';

const vendorApi = {
  async getQr() {
    const response = await api.get('/api/vendor/qr');
    return response.data;
  },
  async getItems() {
    const response = await api.get('/api/vendor/items');
    return response.data;
  },
  async createItem(payload) {
    const response = await api.post('/api/vendor/items', payload);
    return response.data;
  },
  async updateItem(itemId, payload) {
    const response = await api.put(`/api/vendor/items/${itemId}`, payload);
    return response.data;
  },
  async deleteItem(itemId) {
    const response = await api.delete(`/api/vendor/items/${itemId}`);
    return response.data;
  },
  async getTransactions() {
    const response = await api.get('/api/vendor/transactions');
    return response.data;
  },
  async pollTransactions(since) {
    const response = await api.get('/api/vendor/poll', { params: { since } });
    return response.data;
  },
};

export default vendorApi;
