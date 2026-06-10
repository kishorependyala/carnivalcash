import api from './index';

const donationsApi = {
  async get() {
    const response = await api.get('/api/donations');
    return response.data;
  },
  async getPublic() {
    const response = await api.get('/api/donations/public');
    return response.data;
  },
  async addEmployerMatch(charityId, charityName, amount) {
    const response = await api.post('/api/donations/employer-match', { charityId, charityName, amount });
    return response.data;
  },
  async removeEmployerMatch(charityId) {
    const response = await api.delete(`/api/donations/employer-match/${charityId}`);
    return response.data;
  },
  async getUserNames() {
    const response = await api.get('/api/users/names');
    return response.data.names || [];
  },
  async getReceipts() {
    const response = await api.get('/api/donations/receipts');
    return response.data.receipts || {};
  },
  async addReceipt(charityId, { fileName, data, donatedBy }) {
    const response = await api.post(`/api/donations/receipts/${charityId}`, { fileName, data, donatedBy });
    return response.data;
  },
  async removeReceipt(charityId, receiptId) {
    const response = await api.delete(`/api/donations/receipts/${charityId}/${receiptId}`);
    return response.data;
  },
};

export default donationsApi;
