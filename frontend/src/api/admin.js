import api from './index';

const adminApi = {
  async getStats() {
    const response = await api.get('/api/admin/stats');
    return response.data;
  },
  async addTokens(payload) {
    const response = await api.post('/api/admin/tokens', payload);
    return response.data;
  },
  async setRate(payload) {
    const response = await api.post('/api/admin/rate', payload);
    return response.data;
  },
  async manageEvent(payload) {
    const response = await api.post('/api/admin/event', payload);
    return response.data;
  },
  async getEvent() {
    const response = await api.get('/api/admin/event');
    return response.data;
  },
  async zeroBalance(userId) {
    const response = await api.delete(`/api/admin/balance/${userId}`);
    return response.data;
  },
  async listUsers() {
    const response = await api.get('/api/admin/users');
    return response.data;
  },
  async setUserRoles(userId, roles) {
    const response = await api.put(`/api/admin/users/${userId}/roles`, { roles });
    return response.data;
  },
  async listVendors() {
    const response = await api.get('/api/admin/vendors');
    return response.data;
  },
  async getAuditLog() {
    const response = await api.get('/api/admin/audit');
    return response.data;
  },
  async browseFiles(path = '') {
    const response = await api.get('/api/admin/files', { params: path ? { path } : {} });
    return response.data;
  },
  async downloadFiles(path = '', exclude = []) {
    const params = {};
    if (path) params.path = path;
    if (exclude.length) params.exclude = exclude.join(',');
    const response = await api.get('/api/admin/files/download', {
      params,
      responseType: 'blob',
    });
    const url = URL.createObjectURL(response.data);
    const a = document.createElement('a');
    const cd = response.headers['content-disposition'] || '';
    const match = cd.match(/filename=([^;]+)/);
    a.href = url;
    a.download = match ? match[1].trim() : (path ? path.split('/').pop() : 'carnivalcash-data.zip');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
  async resetTokens(code) {
    const response = await api.post('/api/admin/reset-tokens', { code });
    return response.data;
  },
  async deleteUser(userId, code) {
    const response = await api.delete(`/api/admin/users/${userId}`, { data: { code } });
    return response.data;
  },
  async getPinResetRequests() {
    const response = await api.get('/api/admin/pin-reset-requests');
    return response.data;
  },
  async resetUserPin(userId) {
    const response = await api.post(`/api/admin/users/${userId}/reset-pin`);
    return response.data;
  },
  async generateCards(count = 100) {
    const response = await api.post('/api/admin/cards/generate', { count });
    return response.data;
  },
  async listCards() {
    const response = await api.get('/api/admin/cards');
    return response.data;
  },
  async adminLinkCard(cardId, payload) {
    const response = await api.post(`/api/admin/cards/${cardId}/link`, payload);
    return response.data;
  },
  async registerExternalCard(qrPayload) {
    const response = await api.post('/api/admin/cards/register-external', { qrPayload });
    return response.data;
  },
  async createOfflineUser(payload) {
    const response = await api.post('/api/admin/users', payload);
    return response.data;
  },
  async listStallsFull() {
    const response = await api.get('/api/admin/stalls');
    return response.data;
  },
  async deleteStall(stallId, code) {
    const response = await api.delete(`/api/admin/stalls/${stallId}`, { data: { code } });
    return response.data;
  },
  async updateSettings(payload) {
    const response = await api.post('/api/admin/settings', payload);
    return response.data;
  },
  async clearTransactions(code) {
    const response = await api.post('/api/admin/clear-transactions', { code });
    return response.data;
  },
  async maintenanceDedupeCheck() {
    const response = await api.get('/api/admin/maintenance/dedupe-check');
    return response.data;
  },
  async maintenanceDedupeTransactions() {
    const response = await api.post('/api/admin/maintenance/dedupe-transactions');
    return response.data;
  },
  async maintenanceAdminLoadsCheck() {
    const response = await api.get('/api/admin/maintenance/admin-loads-check');
    return response.data;
  },
  async maintenanceDedupeAdminLoads() {
    const response = await api.post('/api/admin/maintenance/dedupe-admin-loads');
    return response.data;
  },
  async maintenanceEmptyUsersCheck() {
    const response = await api.get('/api/admin/maintenance/empty-users-check');
    return response.data;
  },
  async maintenanceDeleteEmptyUsers() {
    const response = await api.post('/api/admin/maintenance/delete-empty-users');
    return response.data;
  },
  async maintenanceMarkEmptyUsersInactive() {
    const response = await api.post('/api/admin/maintenance/mark-empty-users-inactive');
    return response.data;
  },
  async maintenanceNoCharityStallsCheck() {
    const response = await api.get('/api/admin/maintenance/no-charity-stalls-check');
    return response.data;
  },
  async maintenanceAssignDefaultCharity() {
    const response = await api.post('/api/admin/maintenance/assign-default-charity');
    return response.data;
  },
  async maintenanceOrphanedCharityBalancesCheck() {
    const response = await api.get('/api/admin/maintenance/orphaned-charity-balances-check');
    return response.data;
  },
  async maintenanceClearOrphanedCharityBalances() {
    const response = await api.post('/api/admin/maintenance/clear-orphaned-charity-balances');
    return response.data;
  },
  async maintenanceZeroTokenStallsCheck() {
    const response = await api.get('/api/admin/maintenance/zero-token-stalls-check');
    return response.data;
  },
  async maintenanceMarkZeroTokenStallsInactive() {
    const response = await api.post('/api/admin/maintenance/mark-zero-token-stalls-inactive');
    return response.data;
  },
  async impersonate(userId) {
    const response = await api.post(`/api/admin/impersonate/${userId}`);
    return response.data;
  },
  async adminUpdateStallCharities(stallId, charities) {
    const response = await api.put(`/api/admin/stalls/${stallId}/charities`, { charities });
    return response.data;
  },
  async adminToggleStallAdmin(stallId, memberId, admin) {
    const response = await api.put(`/api/admin/stalls/${stallId}/members/${memberId}/admin`, { admin });
    return response.data;
  },
  async adminUpdateStallSummary(stallId, data) {
    const response = await api.put(`/api/admin/stalls/${stallId}/summary`, data);
    return response.data;
  },
  async adminUpdateKid(parentUserId, kidId, name) {
    const response = await api.put(`/api/admin/users/${parentUserId}/kids/${kidId}`, { name });
    return response.data;
  },
  async tokenSummary() {
    const response = await api.get('/api/admin/token-summary');
    return response.data;
  },
  async mapEmployerMatches(userIds) {
    const response = await api.post('/api/admin/donations/map-employer-matches', { userIds });
    return response.data;
  },
  async distributeStallCharities() {
    const response = await api.post('/api/admin/stalls/distribute-charities');
    return response.data;
  },
};

export default adminApi;
