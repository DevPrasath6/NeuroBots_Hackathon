// Support both development and production environments
const API_BASE_URL =
  import.meta.env.VITE_API_URL || '/api';

export interface RecommendationRequest {
  target_composition: Record<string, number>;
  current_composition: Record<string, number>;
}

export interface QualityAnalysisParams {
  hours?: number;
  furnace_id?: string;
}

export interface ProcessOptimizationRequest {
  target_grade: string;
  current_parameters: Record<string, any>;
}

class AlloyAPI {
  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    const text = await response.text();
    const isHtml = text.trim().startsWith('<') || text.trim().startsWith('<!');

    if (isHtml || response.status === 503 || response.status === 502) {
      window.dispatchEvent(new CustomEvent('backend-waking-up'));
      throw new Error('BACKEND_WAKING_UP');
    }

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('INVALID_JSON_RESPONSE');
    }
  }

  async generateRecommendations(data: RecommendationRequest) {
    return this.request('/ai/recommendations/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getQualityAnalysis(params: QualityAnalysisParams = {}) {
    const queryParams = new URLSearchParams();
    if (params.hours) queryParams.append('hours', params.hours.toString());
    if (params.furnace_id) queryParams.append('furnace_id', params.furnace_id);

    return this.request(`/ai/quality-analysis/?${queryParams.toString()}`);
  }

  async optimizeProcess(data: ProcessOptimizationRequest) {
    return this.request('/ai/optimize-process/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPredictiveMaintenance(furnace_id: string = 'F001') {
    return this.request(`/ai/predictive-maintenance/?furnace_id=${furnace_id}`);
  }

  async getDashboardMetrics() {
    return this.request('/dashboard/metrics/');
  }

  // Traditional CRUD operations
  async getAlloyCompositions() {
    return this.request('/compositions/');
  }

  async getProcessData(params: { hours?: number; furnace_id?: string } = {}) {
    const queryParams = new URLSearchParams();
    if (params.hours) queryParams.append('hours', params.hours.toString());
    if (params.furnace_id) queryParams.append('furnace_id', params.furnace_id);

    return this.request(`/process-data/?${queryParams.toString()}`);
  }

  async getInventory() {
    return this.request('/inventory/');
  }

  async getAlerts(activeOnly: boolean = false) {
    const endpoint = activeOnly ? '/alerts/active/' : '/alerts/';
    return this.request(endpoint);
  }

  async sendChat(message: string, history: Array<{ role: 'user' | 'assistant'; content: string; state?: any }>, furnaceId?: string) {
    return this.request('/ai/chat/', {
      method: 'POST',
      body: JSON.stringify({ message, history, furnace_id: furnaceId }),
    });
  }
}

export const alloyAPI = new AlloyAPI();
