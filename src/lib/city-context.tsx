'use client';

import { useEffect, useState } from 'react';
import { City, fetchCities, getSelectedCityId, getStoredUser, setSelectedCityId } from './api';

export function useCityContext() {
  const user = getStoredUser();
  const [cities, setCities] = useState<City[]>([]);
  const initialCityId = getSelectedCityId() || user?.cityId || null;
  const [cityId, setCityId] = useState<string | null>(initialCityId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCities()
      .then((list) => {
        setCities(list);
        if (!cityId && list.length > 0) {
          const resolved = list[0].id;
          setCityId(resolved);
          setSelectedCityId(resolved);
        } else if (cityId && !list.some((c) => c.id === cityId)) {
          // If stored city is invalid, reset it
          const resolved = list[0]?.id || null;
          if (resolved) {
             setCityId(resolved);
             setSelectedCityId(resolved);
          }
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
