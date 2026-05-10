import api from './index';

const authApi = {
  async requestCode(phone) {
    const response = await api.post('/api/auth/request-code', { phone });
    return response.data;
  },
  async verifyCode(phone, code) {
    const response = await api.post('/api/auth/verify', { phone, code });
    return response.data;
  },
};

export default authApi;
