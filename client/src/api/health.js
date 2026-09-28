import { api } from './client.js';

/** Health check — used by landing / status UI in Phase 0 */
export async function getHealth() {
  const { data } = await api.get('/health');
  return data;
}
