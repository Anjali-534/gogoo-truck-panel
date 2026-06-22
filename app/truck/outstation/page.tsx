'use client';
import { useEffect, useState, useCallback } from 'react';
import Pagination from '@/components/Pagination';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://gogobackend-production.up.railway.app';
const TRUCK_OS_TYPES = ['truck_os_14ft', 'truck_os_20ft', 'truck_os_container', 'truck_os_trailer'];
const STATUS_COLORS: Record<string, string> = {
  completed: '#10B981', cancelled: '#EF4444', in_progress: '#8B5CF6', accepted: '#F59E0B', searching: '#6B7280',
};
const PAGE_SIZE = 50;

const OS_VEHICLES = [
  { slug: 'truck_os_14ft', label: '14ft Truck', emoji: '🚛', capacity: '3 tons' },
  { slug: 'truck_os_20ft', label: '20ft Truck', emoji: '🚚', capacity: '5 tons' },
  { slug: 'truck_os_container', label: 'Container', emoji: '📦', capacity: '8 tons' },
  { slug: 'truck_os_trailer', label: 'Trailer', emoji: '🚛', capacity: '20 tons' },
];

const POPULAR_CITIES = ['Mumbai', 'Jaipur', 'Chandigarh', 'Lucknow', 'Agra', 'Pune', 'Hyderabad', 'Kolkata'];

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('truck_admin_token') : ''; }
function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }

export default function OutstationPage() {
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
      setBookings(allB.filter((b: any) => TRUCK_OS_TYPES.includes(b.service_type?.slug || b.vehicle_type || '') || (b.service_type?.slug || '').includes('os')));
      setDrivers(allD.filter((d: any) => TRUCK_OS_TYPES.includes(d.vehicle_type || '')));
    } catch { /**/ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const today = new Date().toDateString();
  const todayB = bookings.filter(b => b.created_at && new Date(b.created_at).toDateString() === today);
  const completed = bookings.filter(b => b.status === 'completed');
  const totalRevenue = todayB.filter(b => b.status === 'completed').reduce((s: number, b: any) => s + (b.final_fare || b.estimated_fare || 0), 0);

  const avgDist = completed.length
    ? (completed.reduce((s: number, b: any) => s + (b.distance_km || 0), 0) / completed.length).toFixed(0)
    : '0';
  const avgFare = completed.length
    ? Math.round(completed.reduce((s: number, b: any) => s + (b.final_fare || b.estimated_fare || 0), 0) / completed.length)
    : 0;
  const avgFarePerKm = Number(avgDist) > 0 ? (avgFare / Number(avgDist)).toFixed(1) : '0';
  const longestTrip = completed.sort((a: any, b: any) => (b.distance_km || 0) - (a.distance_km || 0))[0];

  // Vehicle stats
  const vehicleStats = OS_VEHICLES.map(v => {
    const vB = bookings.filter(b => (b.service_type?.slug || b.vehicle_type || '') === v.slug);
    const todayVB = todayB.filter(b => (b.service_type?.slug || b.vehicle_type || '') === v.slug);
    const online = drivers.filter(d => d.vehicle_type === v.slug && (d.is_online));
    const rev = todayVB.filter(b => b.status === 'completed').reduce((s: number, b: any) => s + (b.final_fare || b.estimated_fare || 0), 0);
    return { ...v, rides: todayVB.length, total: vB.length, revenue: rev, driversOnline: online.length };
  });

  // Popular destinations
  const destCounts: Record<string, { count: number; fares: number[] }> = {};
  bookings.forEach((b: any) => {
    POPULAR_CITIES.forEach(city => {
      if (b.drop_address?.includes(city)) {
        if (!destCounts[city]) destCounts[city] = { count: 0, fares: [] };
        destCounts[city].count++;
        if (b.final_fare || b.estimated_fare) destCounts[city].fares.push(b.final_fare || b.estimated_fare || 0);
      }
    });
  });
  const routes = Object.entries(destCounts)
    .sort(([, a], [, b]) => b.count - a.count).slice(0, 5)
    .map(([city, data]) => ({
      route: `Delhi → ${city}`,
      trips: data.count,
      avgFare: data.fares.length ? Math.round(data.fares.reduce((s, f) => s + f, 0) / data.fares.length) : 0,
    }));

  const paginated = bookings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) return <div className="animate-pulse space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-40 bg-white rounded-2xl border border-gray-100" />)}</div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Outstation Deliveries</h1><p className="text-sm text-gray-500 mt-0.5">Intercity & long-haul truck trips</p></div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Trips Today', value: todayB.length, color: '#8B5CF6' },
          { label: 'Revenue Today', value: `₹${totalRevenue.toLocaleString()}`, color: '#8B5CF6' },
          { label: 'Avg Distance', value: `${avgDist} km` },
          { label: 'Avg Fare/km', value: `₹${avgFarePerKm}` },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-xl font-bold mt-1" style={{ color: s.color || '#8B5CF6' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Long haul metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border-l-4 border border-gray-100 shadow-sm" style={{ borderLeftColor: '#8B5CF6' }}>
          <p className="text-xs text-gray-400 mb-1">Avg Fare (per trip)</p>
          <p className="text-2xl font-bold" style={{ color: '#8B5CF6' }}>₹{avgFare.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border-l-4 border border-gray-100 shadow-sm" style={{ borderLeftColor: '#8B5CF6' }}>
          <p className="text-xs text-gray-400 mb-1">Longest Trip</p>
          <p className="text-2xl font-bold" style={{ color: '#8B5CF6' }}>{longestTrip?.distance_km || 0} km</p>
          {longestTrip && <p className="text-xs text-gray-400 mt-0.5 truncate">{longestTrip.pickup_address?.split(',')[0]} → {longestTrip.drop_address?.split(',')[0]}</p>}
        </div>
        <div className="bg-white rounded-2xl p-5 border-l-4 border border-gray-100 shadow-sm" style={{ borderLeftColor: '#8B5CF6' }}>
          <p className="text-xs text-gray-400 mb-1">Total OS Trips</p>
          <p className="text-2xl font-bold" style={{ color: '#8B5CF6' }}>{bookings.length}</p>
        </div>
      </div>

      {/* Vehicle Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {vehicleStats.map(v => (
          <div key={v.slug} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{v.emoji}</span>
              <div><p className="font-bold text-sm text-gray-900">{v.label}</p><p className="text-xs text-gray-400">{v.capacity}</p></div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm"><span className="text-gray-500">Today</span><span className="font-bold" style={{ color: '#8B5CF6' }}>{v.rides}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Total</span><span className="text-gray-700">{v.total}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Revenue</span><span className="font-semibold text-gray-800">₹{v.revenue.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Online</span><span className="text-green-600 font-medium">{v.driversOnline}</span></div>
            </div>
          </div>
        ))}
      </div>

      {/* Popular Routes */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-700">Popular Outstation Routes</h3></div>
        {routes.length === 0 ? <div className="p-8 text-center text-gray-400 text-sm">No route data available yet</div> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 bg-gray-50">{['Route', 'Total Trips', 'Avg Fare'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50">
              {routes.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700 font-medium">🗺 {r.route}</td>
                  <td className="px-4 py-3 font-bold" style={{ color: '#8B5CF6' }}>{r.trips}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">₹{r.avgFare.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100"><p className="text-sm font-semibold text-gray-700">{bookings.length} outstation bookings</p></div>
        {bookings.length === 0 ? <div className="p-16 text-center text-gray-400 text-sm">No outstation bookings found</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 bg-gray-50">{['ID', 'Vehicle', 'Rider', 'Driver', 'From', 'To', 'Distance', 'Fare', 'Status', 'Date'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.map((b: any) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">#{b.id?.slice(-8).toUpperCase()}</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-lg font-medium bg-purple-50 text-purple-700">{OS_VEHICLES.find(v => v.slug === (b.service_type?.slug || b.vehicle_type))?.label || 'OS Truck'}</span></td>
                    <td className="px-4 py-3 text-gray-700">{(b.rider_name || b.rider?.name) || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{(b.driver_name || b.driver?.name) || 'Unassigned'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-28 truncate">{b.pickup_address?.slice(0, 20) || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-28 truncate">{b.drop_address?.slice(0, 20) || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{b.distance_km ? `${b.distance_km} km` : '—'}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">₹{(b.final_fare || b.estimated_fare || 0).toLocaleString()}</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-full font-medium capitalize" style={{ backgroundColor: `${STATUS_COLORS[b.status || ''] || '#6B7280'}20`, color: STATUS_COLORS[b.status || ''] || '#6B7280' }}>{b.status?.replace('_', ' ') || '—'}</span></td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{b.created_at ? new Date(b.created_at).toLocaleDateString() : '—'}</td>
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
