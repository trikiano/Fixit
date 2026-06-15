import { OfflineManager } from './OfflineManager';
import { fixitFetch, setToken, clearToken, getToken } from './fixitFetch';

export { setToken, clearToken, getToken, OfflineManager };

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// --- Table client factory (REST: /api/products, /api/repairs, etc.) ---

function createTableClient(tablePath) {
  return {
    async list(sortOrOptions, limit) {
      if (!OfflineManager.isOnline) {
        return OfflineManager.getCached(tablePath);
      }

      let sort = '-created_date';
      let lim = limit;
      if (typeof sortOrOptions === 'string') sort = sortOrOptions;
      const params = new URLSearchParams();
      if (sort) params.set('sort', sort);
      if (lim) params.set('limit', String(lim));

      try {
        const data = await fixitFetch(`/${tablePath}?${params.toString()}`);
        if (Array.isArray(data)) {
          OfflineManager.setCache(tablePath, data);
        }
        return data;
      } catch (err) {
        if (err.message === 'OFFLINE') return OfflineManager.getCached(tablePath);
        throw err;
      }
    },

    get(id) {
      return fixitFetch(`/${tablePath}/${id}`);
    },

    async create(data) {
      return await fixitFetch(`/${tablePath}`, { method: 'POST', body: JSON.stringify(data) });
    },

    async update(id, data) {
      return await fixitFetch(`/${tablePath}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },

    async delete(id) {
      return await fixitFetch(`/${tablePath}/${id}`, { method: 'DELETE' });
    },

    filter(filters, sort = '-created_date', limit = 500) {
      const params = new URLSearchParams(filters);
      if (sort) params.set('sort', sort);
      if (limit) params.set('limit', String(limit));
      return fixitFetch(`/${tablePath}?${params.toString()}`);
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
          headers,
        });
        if (!res.ok) throw new Error('Upload failed');
        return res.json();
      },
    },
  },
  entities: {
    Product:          createTableClient('products'),
    CashRegister:     createTableClient('cash-registers'),
    Client:           createTableClient('clients'),
    Repair:           createTableClient('repairs'),
    Sale:             createTableClient('sales'),
    StockMovement:    createTableClient('stock-movements'),
    Supplier:         createTableClient('suppliers'),
    SupplierInvoice:  createTableClient('supplier-invoices'),
    PurchaseOrder:    createTableClient('purchase-orders'),
    Expense:          createTableClient('expenses'),
    Warranty:         createTableClient('warranties'),
    Promotion:        createTableClient('promotions'),
    ServiceSale:      createTableClient('service-sales'),
    ServiceItem:      createTableClient('service-items'),
    ServiceCategory:  createTableClient('service-categories'),
    PrepaidCard:      createTableClient('prepaid-cards'),
    CardTopup:        createTableClient('card-topups'),
    AuditLog:         createTableClient('audit-logs'),
    Notification:     createTableClient('notifications'),
    Setting:          createTableClient('settings'),
    User:             createTableClient('users'),
    Brand:            createTableClient('brands'),
    DeviceType:       createTableClient('device-types'),
    DeviceModel:      createTableClient('device-models'),
    ProductCategory:  createTableClient('product-categories'),
    Invoice:          createTableClient('invoices'),
  },
};
