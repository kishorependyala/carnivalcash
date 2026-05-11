import api from './index';

const transactionsApi = {
  async getVendorCatalog(vendorId) {
    const response = await api.get(`/api/transactions/catalog/${vendorId}`);
    return response.data;
  },
  async getMyVendorCatalog() {
    const response = await api.get('/api/transactions/vendor-catalog');
    return response.data;
  },
  async transferTokens(payload) {
    const response = await api.post('/api/transactions/transfer', payload);
    return response.data;
  },
  async vendorCharge(payload) {
    const response = await api.post('/api/transactions/vendor-charge', payload);
    return response.data;
  },
};

export default transactionsApi;
