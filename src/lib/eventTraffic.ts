export interface EventTrafficCell {
  category_name: string;
  hour_of_day: number;
  traffic_count: number;
  unique_viewers: number;
}

export function trafficCellKey(categoryName: string, hourOfDay: number): string {
  return `${categoryName}-${hourOfDay}`;
}

export function maxTrafficCount(records: EventTrafficCell[]): number {
  return records.reduce((maximum, record) => Math.max(maximum, record.traffic_count), 0);
}

export function trafficIntensity(value: number, maximum: number): number {
  if (value <= 0 || maximum <= 0) return 0;
  return Math.min(1, value / maximum);
}
