export interface RawAlumniProfile {
  userId: string;
  fullName: string;
  clubId: string;
  currentCity: string;
  latitude: number;
  longitude: number;
  graduationYear: number;
  jobTitle?: string;
  company?: string;
  isVisibleOnMap: boolean;
}

export interface CityAlumniCluster {
  cityName: string;
  latitude: number;
  longitude: number;
  alumniCount: number;
  alumniList: Array<{
    userId: string;
    fullName: string;
    graduationYear: number;
    jobTitle?: string;
    company?: string;
  }>;
}

/**
 * Sanitizes and truncates latitude/longitude coordinates to city-level precision (~11km / 2 decimal places)
 * to strictly prevent sharing exact physical address coordinates.
 */
export function sanitizeToCityLevelCoordinates(
  lat: number,
  lng: number,
): { lat: number; lng: number } {
  return {
    lat: Number(lat.toFixed(2)),
    lng: Number(lng.toFixed(2)),
  };
}

/**
 * Filters alumni profiles based on explicit map opt-in consent and club affiliation,
 * then clusters profiles by city location.
 */
export function clusterAlumniByCity(
  profiles: RawAlumniProfile[],
  filterClubId?: string,
): CityAlumniCluster[] {
  const cityClusterMap = new Map<string, CityAlumniCluster>();

  for (const profile of profiles) {
    // Enforce opt-in consent and optional club filter
    if (!profile.isVisibleOnMap) continue;
    if (filterClubId && profile.clubId !== filterClubId) continue;

    const cityKey = profile.currentCity.trim().toLowerCase();
    const cityCoords = sanitizeToCityLevelCoordinates(profile.latitude, profile.longitude);

    const alumniSummary = {
      userId: profile.userId,
      fullName: profile.fullName,
      graduationYear: profile.graduationYear,
      jobTitle: profile.jobTitle,
      company: profile.company,
    };

    const existingCluster = cityClusterMap.get(cityKey);

    if (existingCluster) {
      existingCluster.alumniCount += 1;
      existingCluster.alumniList.push(alumniSummary);
    } else {
      cityClusterMap.set(cityKey, {
        cityName: profile.currentCity,
        latitude: cityCoords.lat,
        longitude: cityCoords.lng,
        alumniCount: 1,
        alumniList: [alumniSummary],
      });
    }
  }

  return Array.from(cityClusterMap.values()).sort((a, b) => b.alumniCount - a.alumniCount);
}
