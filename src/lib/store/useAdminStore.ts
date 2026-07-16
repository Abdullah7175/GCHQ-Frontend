import { create } from 'zustand';
import { api, cityQuery, City } from '../api';

type Entity = Record<string, any>;

interface RefData {
  cities: City[];
  providers: Entity[];
  hospitals: Entity[];
  sectors: Entity[];
  paramedics: Entity[];
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
  
  setActiveResource: (res: string) => void;
  setForm: (form: Entity) => void;
  setEditingId: (id: string | null) => void;
  setFormOpen: (open: boolean) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setRefs: (refs: RefData) => void;
  
  fetchItems: (cityId: string | null, isScoped: boolean) => Promise<void>;
  resetForm: () => void;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  activeResource: 'cities',
  items: [],
  form: {},
  editingId: null,
  formOpen: false,
  isFetching: false,
  refs: { cities: [], providers: [], hospitals: [], sectors: [], paramedics: [] },
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,

  setActiveResource: (res) => set({ activeResource: res, form: {}, editingId: null, formOpen: false, page: 1 }),
  setForm: (form) => set({ form }),
  setEditingId: (id) => set({ editingId: id }),
  setFormOpen: (open) => set({ formOpen: open }),
  setPage: (page) => set({ page }),
  setLimit: (limit) => set({ limit }),
  setRefs: (refs) => set({ refs }),

  resetForm: () => set({ form: {}, editingId: null, formOpen: false }),

  fetchItems: async (cityId, isScoped) => {
    const { activeResource, page, limit } = get();
    set({ isFetching: true });
    try {
      let path = isScoped && cityId ? `/${activeResource}${cityQuery(cityId)}` : `/${activeResource}?`;
      if (!path.includes('?')) path += '?';
      else path += '&';
      path += `page=${page}&limit=${limit}`;
      if (activeResource === 'transits') {
        path += '&paginated=true&active=true';
      }

      const res = await api<any>(path);
      if (res && typeof res === 'object' && 'data' in res) {
        set({ items: res.data, total: res.total, totalPages: res.totalPages, isFetching: false });
      } else {
        set({ items: Array.isArray(res) ? res : [], total: Array.isArray(res) ? res.length : 0, totalPages: 1, isFetching: false });
      }
    } catch (err) {
      console.error(err);
      set({ items: [], isFetching: false });
    }
  },
}));
