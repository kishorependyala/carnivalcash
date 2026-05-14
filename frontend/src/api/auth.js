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
  async requestPinResetCode(phone) {
    const response = await api.post('/api/auth/request-pin-reset-code', { phone });
    return response.data;
  },
  async verifyPinResetCode(phone, code, newPin) {
    const response = await api.post('/api/auth/verify-pin-reset-code', { phone, code, newPin });
    return response.data;
  },
};

export default authApi;
