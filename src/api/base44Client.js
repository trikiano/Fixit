// Client local remplaçant @base44/sdk — pointe vers le backend Express/PostgreSQL

const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('fixit_token');
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const e = new Error(err.error || 'Erreur API');
    e.status = res.status;
    e.data = err;
    throw e;
  }

  return res.json();
}

function parseSortParam(sort) {
  if (!sort) return '';
  return `?sort=${encodeURIComponent(sort)}`;
}

function buildFilterParams(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  }
  return params.toString() ? `?${params.toString()}` : '';
}

function makeEntityClient(entityName) {
  return {
    list: (sort, limit) => {
      const params = new URLSearchParams();
      if (sort) params.set('sort', sort);
      if (limit) params.set('limit', String(limit));
      const qs = params.toString() ? `?${params.toString()}` : '';
      return apiFetch(`/entities/${entityName}${qs}`);
    },
    filter: (filters = {}, sort, limit) => {
      return apiFetch(`/entities/${entityName}/filter`, {
        method: 'POST',
        body: JSON.stringify({ filters, sort, limit }),
      });
    },
    get: (id) => apiFetch(`/entities/${entityName}/${id}`),
    create: (data) => apiFetch(`/entities/${entityName}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiFetch(`/entities/${entityName}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiFetch(`/entities/${entityName}/${id}`, {
      method: 'DELETE',
    }),
  };
}

export const base44 = {
  entities: {
    Client: makeEntityClient('Client'),
    Product: makeEntityClient('Product'),
    Repair: makeEntityClient('Repair'),
    Sale: makeEntityClient('Sale'),
    Supplier: makeEntityClient('Supplier'),
    Expense: makeEntityClient('Expense'),
    PurchaseOrder: makeEntityClient('PurchaseOrder'),
    SupplierInvoice: makeEntityClient('SupplierInvoice'),
    SupplierPayment: makeEntityClient('SupplierPayment'),
    StockMovement: makeEntityClient('StockMovement'),
    CashRegister: makeEntityClient('CashRegister'),
    Warranty: makeEntityClient('Warranty'),
    Promotion: makeEntityClient('Promotion'),
    ServiceCategory: makeEntityClient('ServiceCategory'),
    ServiceItem: makeEntityClient('ServiceItem'),
    ServiceSale: makeEntityClient('ServiceSale'),
    PrepaidCard: makeEntityClient('PrepaidCard'),
    CardTopup: makeEntityClient('CardTopup'),
    InternetPackage: makeEntityClient('InternetPackage'),
    InternetSale: makeEntityClient('InternetSale'),
    NotificationLog: makeEntityClient('NotificationLog'),
    AuditLog: makeEntityClient('AuditLog'),
  },

  auth: {
    me: () => apiFetch('/auth/me'),
    login: (email, password) => apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
    logout: () => {
      localStorage.removeItem('fixit_token');
    },
    redirectToLogin: () => {
      window.location.href = '/login';
    },
  },

  functions: {
    invoke: (name, data) => apiFetch(`/functions/${name}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },

  integrations: {
    Core: {
      UploadFile: async ({ file }) => {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API_BASE}/upload`, {
          method: 'POST',
          headers: authHeaders(),
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Erreur upload');
        }
        return res.json();
      },
    },
  },
};
