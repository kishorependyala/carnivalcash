import api from './index';

const donationsApi = {
  async get() {
    const response = await api.get('/api/donations');
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
};

export default donationsApi;
