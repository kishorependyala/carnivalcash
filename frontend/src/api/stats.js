import api from './index';

const statsApi = {
  async get() {
    return (await api.get('/api/stats')).data;
  },
};

export default statsApi;
