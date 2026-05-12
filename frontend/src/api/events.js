import api from './index';

const eventsApi = {
  async list() {
    return (await api.get('/api/events')).data;
  },
  async create(data) {
    return (await api.post('/api/events', data)).data;
  },
  async remove(eventId) {
    return (await api.delete(`/api/events/${eventId}`)).data;
  },
};

export default eventsApi;
