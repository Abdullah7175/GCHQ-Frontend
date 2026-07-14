'use client';

import { useEffect, useState } from 'react';
import { City, fetchCities, getSelectedCityId, getStoredUser, setSelectedCityId } from './api';

export function useCityContext() {
  const user = getStoredUser();
  const [cities, setCities] = useState<City[]>([]);
  const [cityId, setCityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCities()
      .then((list) => {
        setCities(list);
        const stored = getSelectedCityId() || user?.cityId;
        const validStored = stored && list.some((c) => c.id === stored) ? stored : null;
        const resolved = validStored ?? list[0]?.id ?? null;
        if (resolved) {
          setCityId(resolved);
          setSelectedCityId(resolved);
        }
      })
      .catch(() => setCities([]))
      .finally(() => setLoading(false));
  }, [user?.cityId]);

  function selectCity(id: string) {
    setCityId(id);
    setSelectedCityId(id);
  }

  const currentCity = cities.find((c) => c.id === cityId) ?? null;
  const canSwitchCity = user?.role === 'admin' || user?.role === 'vvip' || !user?.cityId;

  return { cities, cityId, currentCity, selectCity, canSwitchCity, loading };
}
