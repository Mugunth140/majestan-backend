import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface NearbyPlace {
  name: string;
  distance: string;
}

export interface LocalityCategory {
  title: string;
  icon: string;
  places: NearbyPlace[];
}

@Injectable()
export class LocalityService {
  private readonly logger = new Logger(LocalityService.name);
  private apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY') || '';
  }

  // Haversine formula
  private getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async fetchNearbyPlaces(lat: number, lng: number): Promise<LocalityCategory[]> {
    if (!this.apiKey) {
      this.logger.warn('GOOGLE_MAPS_API_KEY is not set. Cannot fetch nearby places.');
      return [];
    }

    const categories = [
      { title: 'Education', icon: 'GraduationCap', types: 'school|university' },
      { title: 'Healthcare', icon: 'Heart', types: 'hospital|pharmacy|doctor' },
      { title: 'Shopping', icon: 'ShoppingBag', types: 'shopping_mall|supermarket' },
      { title: 'Transport', icon: 'Bus', types: 'bus_station|train_station|transit_station' },
      { title: 'Entertainment', icon: 'Clapperboard', types: 'movie_theater|park' },
      { title: 'Banking', icon: 'Building', types: 'bank|atm' },
    ];

    const results: LocalityCategory[] = [];

    // Run fetches in parallel for speed
    await Promise.all(categories.map(async (cat) => {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=3000&type=${cat.types.split('|')[0]}&key=${this.apiKey}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.status === 'OK' && data.results) {
          // Map and sort by distance
          const placesWithDistance = data.results.map((p: any) => {
            const dist = this.getDistanceKm(lat, lng, p.geometry.location.lat, p.geometry.location.lng);
            return {
              name: p.name,
              distanceVal: dist,
              distance: dist < 1 ? `${(dist * 1000).toFixed(0)} m` : `${dist.toFixed(1)} km`
            };
          }).sort((a: any, b: any) => a.distanceVal - b.distanceVal).slice(0, 4);

          results.push({
            title: cat.title,
            icon: cat.icon,
            places: placesWithDistance.map(p => ({ name: p.name, distance: p.distance }))
          });
        } else {
          results.push({ title: cat.title, icon: cat.icon, places: [] });
        }
      } catch (err) {
        this.logger.error(`Failed to fetch places for category ${cat.title}`, err);
        results.push({ title: cat.title, icon: cat.icon, places: [] });
      }
    }));

    // Ensure they stay in the original order
    return categories.map(c => results.find(r => r.title === c.title) || { title: c.title, icon: c.icon, places: [] });
  }
}
