import api from './index';

const charitiesApi = {
  async list() {
    return (await api.get('/api/charities')).data;
  },
  async add(data) {
    return (await api.post('/api/charities', data)).data;
  },
};

export default charitiesApi;
