export interface Snapshot {
  parkId: string; sessionId: string; sequence: number; sampledAt: string;
  source: 'ue-simulation' | 'local-simulation' | 'browser-demo'; enteredToday: number; exitedToday: number; occupancy: number;
}
export interface Dashboard {
  parkId: string; day: string; capacity: number; latest: Snapshot | null; stale: boolean; sameDay: boolean;
  trend: { time: number; entered: number | null; exited: number | null; occupancy: number }[];
}
export interface Content {
  mode: string; bookingUrl: string | null;
  weather: { condition: string; temperature: number; range: string; humidity: number; note: string };
  attractions: { id: string; name: string; description: string; total: number; remaining: number; status: string }[];
  news: { id: string; tag: string; title: string; detail: string; source: string }[];
}
