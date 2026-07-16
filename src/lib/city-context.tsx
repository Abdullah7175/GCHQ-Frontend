'use client';

import { useEffect, useState } from 'react';
import { City, fetchCities, getSelectedCityId, getStoredUser, setSelectedCityId } from './api';

export function useCityContext() {
  const user = getStoredUser();
  const [cities, setCities] = useState<City[]>([]);
  // City-bound roles must always use their assigned city (ignore stale localStorage e.g. Lahore)
  const lockedCityId = user?.cityId && user.role !== 'admin' && user.role !== 'vvip'
    ? user.cityId
    : null;
  const initialCityId = lockedCityId || getSelectedCityId() || user?.cityId || null;
  const [cityId, setCityId] = useState<string | null>(initialCityId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (lockedCityId) {
      setCityId(lockedCityId);
      setSelectedCityId(lockedCityId);
    }
  }, [lockedCityId]);

  useEffect(() => {
    fetchCities()
      .then((list) => {
        setCities(list);
        const preferred = lockedCityId || cityId;
        if (!preferred && list.length > 0) {
          const resolved = list[0].id;
          setCityId(resolved);
          setSelectedCityId(resolved);
        } else if (preferred && !list.some((c) => c.id === preferred)) {
          const resolved = lockedCityId && list.some((c) => c.id === lockedCityId)
            ? lockedCityId
            : list[0]?.id || null;
          if (resolved) {
            setCityId(resolved);
            setSelectedCityId(resolved);
          }
        } else if (lockedCityId) {
          setCityId(lockedCityId);
          setSelectedCityId(lockedCityId);
        }
      })
      .catch(() => setCities([]))
      .finally(() => setLoading(false));
  }, [user?.cityId, lockedCityId]);

  function selectCity(id: string) {
    if (lockedCityId) return;
    setCityId(id);
    setSelectedCityId(id);
  }

  const currentCity = cities.find((c) => c.id === cityId) ?? null;
  const canSwitchCity = !lockedCityId && (user?.role === 'admin' || user?.role === 'vvip' || !user?.cityId);

  return { cities, cityId, currentCity, selectCity, canSwitchCity, loading };
}
