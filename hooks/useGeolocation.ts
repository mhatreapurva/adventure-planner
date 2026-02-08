// hooks/useGeolocation.ts
import { useState } from "react";

export function useGeolocation() {
  const [error, setError] = useState<string>("");

  async function getLocation(): Promise<{ lat: number; lon: number } | null> {
    setError("");

    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return null;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        (err) => {
          setError(err.message || "Failed to get location.");
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  return { getLocation, error };
}
