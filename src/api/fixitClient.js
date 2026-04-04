import { OfflineManager } from './OfflineManager';
import { fixitFetch, setToken, clearToken, getToken } from './fixitFetch';

export { setToken, clearToken, getToken, OfflineManager };

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// --- Entity factory ---

function createEntityClient(entityName) {
  return {
    async list(sortOrOptions, limit) {
      if (!OfflineManager.isOnline) {
        return OfflineManager.getCached(entityName);
      }
      
      let sort = '-created_date';
      let lim = limit;
      if (typeof sortOrOptions === 'string') sort = sortOrOptions;
      const params = new URLSearchParams();
      if (sort) params.set('sort', sort);
      if (lim) params.set('limit', String(lim));
      
      try {
        const data = await fixitFetch(`/entities/${entityName}?${params.toString()}`);
        if (Array.isArray(data)) {
          OfflineManager.setCache(entityName, data);
        }
        return data;
      } catch (err) {
        if (err.message === 'OFFLINE') return OfflineManager.getCached(entityName);
        throw err;
      }
    },
    get(id) {
      return fixitFetch(`/entities/${entityName}/${id}`);
    },
    async create(data) {
      return await fixitFetch(`/entities/${entityName}`, { method: 'POST', body: JSON.stringify(data) });
    },
    async update(id, data) {
      return await fixitFetch(`/entities/${entityName}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async delete(id) {
      return await fixitFetch(`/entities/${entityName}/${id}`, { method: 'DELETE' });
    },

    filter(filters, sort = '-created_date', limit = 500) {
      const params = new URLSearchParams(filters);
      if (sort) params.set('sort', sort);
      if (limit) params.set('limit', String(limit));
      return fixitFetch(`/entities/${entityName}?${params.toString()}`);
    },

  };
}

// --- Auth ---
const auth = {
  async login(email, password) {
    const data = await fixitFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) setToken(data.token);
    return data;
  },
  async me() {
    return fixitFetch('/auth/me');
  },
  logout() {
    clearToken();
    window.location.href = '/';
  },
};

// --- Functions ---
const functions = {
  invoke(functionName, payload) {
    return fixitFetch(`/functions/${functionName}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

// --- Main fixit object ---
export const fixit = {
  auth,
  functions,
  integrations: {
    Core: {
      async UploadFile({ file }) {
        const formData = new FormData();
        formData.append('file', file);
        const token = getToken();
        const headers = {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
        const res = await fetch(`${API_BASE}/upload`, { 
          method: 'POST', 
          body: formData,
          headers
        });
        if (!res.ok) throw new Error('Upload failed');
        return res.json();
      }
    }
  },
  entities: {
    Product: createEntityClient('Product'),
    CashRegister: createEntityClient('CashRegister'),
    Client: createEntityClient('Client'),
    Repair: createEntityClient('Repair'),
    Sale: createEntityClient('Sale'),
    StockMovement: createEntityClient('StockMovement'),
    Supplier: createEntityClient('Supplier'),
    SupplierInvoice: createEntityClient('SupplierInvoice'),
    PurchaseOrder: createEntityClient('PurchaseOrder'),
    Expense: createEntityClient('Expense'),
    Warranty: createEntityClient('Warranty'),
    Promotion: createEntityClient('Promotion'),
    ServiceSale: createEntityClient('ServiceSale'),
    ServiceItem: createEntityClient('ServiceItem'),
    ServiceCategory: createEntityClient('ServiceCategory'),
    PrepaidCard: createEntityClient('PrepaidCard'),
    CardTopup: createEntityClient('CardTopup'),
    AuditLog: createEntityClient('AuditLog'),
    Notification: createEntityClient('Notification'),
    Setting: createEntityClient('Setting'),
    User: createEntityClient('User'),
    Brand: createEntityClient('Brand'),
    DeviceType: createEntityClient('DeviceType'),
    DeviceModel: createEntityClient('DeviceModel'),
    ProductCategory: createEntityClient('ProductCategory'),
  },
};
