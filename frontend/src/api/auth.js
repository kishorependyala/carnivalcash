import api from './index';

const authApi = {
  async requestCode(phone) {
    const response = await api.post('/api/auth/request-code', { phone });
    return response.data;
  },
  async loginWithPin(phone, pin) {
    const response = await api.post('/api/auth/login-with-pin', { phone, pin });
    return response.data;
  },
};

export default authApi;
