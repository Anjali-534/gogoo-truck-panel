'use client';
import { useEffect, useState, useCallback } from 'react';
import Pagination from '@/components/Pagination';

const API = process.env.NEXT_PUBLIC_API_URL;
const TRUCK_CITY_TYPES = ['truck_city_tata_ace', 'truck_city_14ft', 'truck_city_open', 'truck_city_container'];
const STATUS_COLORS: Record<string, string> = {
  completed: '#10B981', cancelled: '#EF4444', in_progress: '#3B82F6', accepted: '#F59E0B', searching: '#6B7280',
};
const PAGE_SIZE = 50;

const CITY_VEHICLES = [
  { key: 'tata_ace', slug: 'truck_city_tata_ace', label: 'Tata Ace', emoji: '🛻', capacity: '500 kg' },
  { key: '14ft', slug: 'truck_city_14ft', label: '14ft Truck', emoji: '🚛', capacity: '3 tons' },
  { key: 'open', slug: 'truck_city_open', label: 'Open Body', emoji: '🚚', capacity: '5 tons' },
  { key: 'container', slug: 'truck_city_container', label: 'Container', emoji: '📦', capacity: '8 tons' },
];

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('truck_panel_token') : ''; }
function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }

export default function CityDeliveryPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    try {
      const [bRes, dRes] = await Promise.all([
        fetch(`${API}/gogoo/bookings`, { headers: authHeaders() }),
        fetch(`${API}/gogoo/drivers`, { headers: authHeaders() }),
      ]);
      const [bData, dData] = await Promise.all([bRes.json(), dRes.json()]);
      const allB = Array.isArray(bData) ? bData : bData.data || bData.bookings || [];
      const allD = Array.isArray(dData) ? dData : dData.data || dData.drivers || [];
      setBookings(allB.filter((b: any) => TRUCK_CITY_TYPES.includes(b.service_type?.slug || b.vehicle_type || '') || (b.service_type?.slug || b.vehicle_type || '').includes('city')));
      setDrivers(allD.filter((d: any) => TRUCK_CITY_TYPES.includes(d.vehicle_type || '')));
    } catch { /**/ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const today = new Date().toDateString();
  const todayB = bookings.filter(b => b.created_at && new Date(b.created_at).toDateString() === today);

  const vehicleStats = CITY_VEHICLES.map(v => {
    const vB = bookings.filter(b => (b.service_type?.slug || b.vehicle_type || '') === v.slug);
    const todayVB = todayB.filter(b => (b.service_type?.slug || b.vehicle_type || '') === v.slug);
    const completed = vB.filter(b => b.status === 'completed');
    const revenue = todayVB.filter(b => b.status === 'completed').reduce((s: number, b: any) => s + (b.final_fare || b.estimated_fare || 0), 0);
    const onlineD = drivers.filter(d => d.vehicle_type === v.slug && (d.online || d.status === 'online'));
    return { ...v, rides: todayVB.length, revenue, driversOnline: onlineD.length, totalRides: completed.length };
  });

  // Popular routes derived from addresses
  const routeCounts: Record<string, { count: number; fares: number[] }> = {};
  todayB.forEach((b: any) => {
    if (b.pickup_address && b.drop_address) {
      const key = `${b.pickup_address.split(',')[0]} → ${b.drop_address.split(',')[0]}`;
      if (!routeCounts[key]) routeCounts[key] = { count: 0, fares: [] };
      routeCounts[key].count++;
      if (b.final_fare || b.estimated_fare) routeCounts[key].fares.push(b.final_fare || b.estimated_fare || 0);
    }
  });
  const popularRoutes = Object.entries(routeCounts)
    .sort(([, a], [, b]) => b.count - a.count).slice(0, 5)
    .map(([route, data]) => ({ route, count: data.count, avgFare: data.fares.length ? Math.round(data.fares.reduce((s, f) => s + f, 0) / data.fares.length) : 0 }));

  const paginated = bookings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) return <div className="animate-pulse space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-40 bg-white rounded-2xl border border-gray-100" />)}</div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">City Delivery</h1><p className="text-sm text-gray-500 mt-0.5">Within-city truck deliveries</p></div>

      {/* Vehicle Performance Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {vehicleStats.map(v => (
          <div key={v.key} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-3xl">{v.emoji}</span>
              <div>
                <p className="font-bold text-gray-900 text-sm">{v.label}</p>
                <p className="text-xs text-gray-400">Capacity: {v.capacity}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm"><span className="text-gray-500">Rides Today</span><span className="font-bold" style={{ color: '#3B82F6' }}>{v.rides}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Revenue</span><span className="font-semibold text-gray-800">₹{v.revenue.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Online Drivers</span><span className="text-green-600 font-medium">{v.driversOnline}</span></div>
            </div>
          </div>
        ))}
      </div>

      {/* Popular Routes */}
      {popularRoutes.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-700">Popular City Routes Today</h3></div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 bg-gray-50">{['Route', 'Trips', 'Avg Fare'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50">
              {popularRoutes.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700 font-medium">{r.route}</td>
                  <td className="px-4 py-3 font-bold" style={{ color: '#3B82F6' }}>{r.count}</td>
                  <td className="px-4 py-3 text-gray-800 font-semibold">₹{r.avgFare}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* City Bookings Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100"><p className="text-sm font-semibold text-gray-700">{bookings.length} city bookings total</p></div>
        {bookings.length === 0 ? <div className="p-16 text-center text-gray-400 text-sm">No city bookings found</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 bg-gray-50">{['ID', 'Vehicle', 'Rider', 'Driver', 'Pickup', 'Drop', 'Dist', 'Fare', 'Status', 'Time'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.map((b: any) => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">#{b.id?.slice(-8).toUpperCase()}</td>
                    <td className="px-4 py-3 text-xs px-2 py-1"><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-xs font-medium">{CITY_VEHICLES.find(v => v.slug === (b.service_type?.slug || b.vehicle_type))?.label || 'City Truck'}</span></td>
                    <td className="px-4 py-3 text-gray-700">{b.rider?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{b.driver?.name || 'Unassigned'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-28 truncate">{b.pickup_address?.slice(0, 22) || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-28 truncate">{b.drop_address?.slice(0, 22) || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{b.distance_km ? `${b.distance_km}km` : '—'}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">₹{(b.final_fare || b.estimated_fare || 0).toLocaleString()}</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-full font-medium capitalize" style={{ backgroundColor: `${STATUS_COLORS[b.status || ''] || '#6B7280'}20`, color: STATUS_COLORS[b.status || ''] || '#6B7280' }}>{b.status?.replace('_', ' ') || '—'}</span></td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{b.created_at ? new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="p-4 border-t border-gray-100"><Pagination page={page} total={bookings.length} pageSize={PAGE_SIZE} onChange={setPage} /></div>
      </div>
    </div>
  );
}
