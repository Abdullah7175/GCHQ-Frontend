import { create } from 'zustand';
import { api, cityQuery, City } from '../api';

type Entity = Record<string, any>;

interface RefData {
  cities: City[];
  providers: Entity[];
  hospitals: Entity[];
  sectors: Entity[];
  paramedics: Entity[];
  emergencyTypes: Entity[];
  latencyRules: Entity[];
  ambulances: Entity[];
}

export interface TransitFilters {
  ambulanceId: string;
  from: string;
  to: string;
  status: string;
}

/** Shared list filters: search `q`, person filters, date range, optional role. */
export interface ListFilters {
  q: string;
  name: string;
  email: string;
  role: string;
  from: string;
  to: string;
}

interface AdminState {
  activeResource: string;
  items: Entity[];
  form: Entity;
  editingId: string | null;
  formOpen: boolean;
  isFetching: boolean;
  refs: RefData;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  transitFilters: TransitFilters;
  listFilters: ListFilters;

  setActiveResource: (res: string) => void;
  setForm: (form: Entity) => void;
  setEditingId: (id: string | null) => void;
  setFormOpen: (open: boolean) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setRefs: (refs: RefData) => void;
  setTransitFilters: (filters: Partial<TransitFilters>) => void;
  resetTransitFilters: () => void;
  setListFilters: (filters: Partial<ListFilters>) => void;
  resetListFilters: () => void;

  fetchItems: (cityId: string | null, isScoped: boolean) => Promise<void>;
  resetForm: () => void;
}

const EMPTY_TRANSIT_FILTERS: TransitFilters = {
  ambulanceId: '',
  from: '',
  to: '',
  status: '',
};

const EMPTY_LIST_FILTERS: ListFilters = {
  q: '',
  name: '',
  email: '',
  role: '',
  from: '',
  to: '',
};

const SEARCH_RESOURCES = new Set([
  'providers',
  'hospitals',
  'sectors',
  'emergency-types',
  'users',
  'ambulances',
  'latency-rules',
  'latency-recipients',
]);

const PERSON_DATE_RESOURCES = new Set(['audit-logs', 'latency-breaches']);

export const useAdminStore = create<AdminState>((set, get) => ({
  activeResource: 'cities',
  items: [],
  form: {},
  editingId: null,
  formOpen: false,
  isFetching: false,
  refs: {
    cities: [],
    providers: [],
    hospitals: [],
    sectors: [],
    paramedics: [],
    emergencyTypes: [],
    latencyRules: [],
    ambulances: [],
  },
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
  transitFilters: { ...EMPTY_TRANSIT_FILTERS },
  listFilters: { ...EMPTY_LIST_FILTERS },

  setActiveResource: (res) =>
    set({
      activeResource: res,
      form: {},
      editingId: null,
      formOpen: false,
      page: 1,
      transitFilters: { ...EMPTY_TRANSIT_FILTERS },
      listFilters: { ...EMPTY_LIST_FILTERS },
    }),
  setForm: (form) => set({ form }),
  setEditingId: (id) => set({ editingId: id }),
  setFormOpen: (open) => set({ formOpen: open }),
  setPage: (page) => set({ page }),
  setLimit: (limit) => set({ limit }),
  setRefs: (refs) => set({ refs }),
  setTransitFilters: (filters) =>
    set((state) => ({
      transitFilters: { ...state.transitFilters, ...filters },
      page: 1,
    })),
  resetTransitFilters: () => set({ transitFilters: { ...EMPTY_TRANSIT_FILTERS }, page: 1 }),
  setListFilters: (filters) =>
    set((state) => ({
      listFilters: { ...state.listFilters, ...filters },
      page: 1,
    })),
  resetListFilters: () => set({ listFilters: { ...EMPTY_LIST_FILTERS }, page: 1 }),

  resetForm: () => set({ form: {}, editingId: null, formOpen: false }),

  fetchItems: async (cityId, isScoped) => {
    const { activeResource, page, limit, transitFilters, listFilters } = get();
    set({ isFetching: true });
    try {
      let path = isScoped && cityId ? `/${activeResource}${cityQuery(cityId)}` : `/${activeResource}?`;
      if (!path.includes('?')) path += '?';
      else path += '&';
      path += `page=${page}&limit=${limit}`;

      if (activeResource === 'transits') {
        path += '&paginated=true';
        if (transitFilters.ambulanceId) path += `&ambulanceId=${encodeURIComponent(transitFilters.ambulanceId)}`;
        if (transitFilters.from) path += `&from=${encodeURIComponent(transitFilters.from)}`;
        if (transitFilters.to) path += `&to=${encodeURIComponent(transitFilters.to)}`;
        if (transitFilters.status) path += `&status=${encodeURIComponent(transitFilters.status)}`;
      }

      if (PERSON_DATE_RESOURCES.has(activeResource)) {
        if (listFilters.name) path += `&name=${encodeURIComponent(listFilters.name)}`;
        if (listFilters.email) path += `&email=${encodeURIComponent(listFilters.email)}`;
        if (listFilters.role) path += `&role=${encodeURIComponent(listFilters.role)}`;
        if (listFilters.from) path += `&from=${encodeURIComponent(listFilters.from)}`;
        if (listFilters.to) path += `&to=${encodeURIComponent(listFilters.to)}`;
      }

      if (SEARCH_RESOURCES.has(activeResource)) {
        if (listFilters.q) path += `&q=${encodeURIComponent(listFilters.q)}`;
        if (activeResource === 'users' && listFilters.role) {
          path += `&role=${encodeURIComponent(listFilters.role)}`;
        }
      }

      const res = await api<any>(path);
      if (res && typeof res === 'object' && 'data' in res) {
        const total = res.total ?? res.meta?.total ?? 0;
        const totalPages = res.totalPages ?? res.meta?.totalPages ?? 1;
        set({ items: res.data, total, totalPages, isFetching: false });
      } else {
        set({ items: Array.isArray(res) ? res : [], total: Array.isArray(res) ? res.length : 0, totalPages: 1, isFetching: false });
      }
    } catch (err) {
      console.error(err);
      set({ items: [], isFetching: false });
    }
  },
}));
