'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const API = process.env.NEXT_PUBLIC_API_URL;
const TRUCK_CITY_TYPES = ['truck_city_tata_ace', 'truck_city_14ft', 'truck_city_open', 'truck_city_container'];
const TRUCK_OS_TYPES = ['truck_os_14ft', 'truck_os_20ft', 'truck_os_container', 'truck_os_trailer'];
const ALL_TRUCK_TYPES = [...TRUCK_CITY_TYPES, ...TRUCK_OS_TYPES];
const VEHICLE_LABEL: Record<string, string> = {
  truck_city_tata_ace: 'Tata Ace', truck_city_14ft: '14ft C', truck_city_open: 'Open', truck_city_container: 'Box C',
  truck_os_14ft: '14ft OS', truck_os_20ft: '20ft OS', truck_os_container: 'Box OS', truck_os_trailer: 'Trailer',
};

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('truck_panel_token') : ''; }
function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }

const isTruckBooking = (b: any) =>
  b?.service_type?.category === 'truck' || ALL_TRUCK_TYPES.includes(b?.service_type?.slug ?? '') || ALL_TRUCK_TYPES.includes(b?.vehicle_type ?? '');

const TIME_FILTERS = [{ key: 'today', label: 'Today' }, { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' }];

export default function TruckAnalyticsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('week');

  const fetchData = useCallback(async () => {
    try {
      const [bRes, dRes] = await Promise.all([
        fetch(`${API}/gogoo/bookings`, { headers: authHeaders() }),
        fetch(`${API}/gogoo/drivers`, { headers: authHeaders() }),
      ]);
      const [bData, dData] = await Promise.all([bRes.json(), dRes.json()]);
      const allB = Array.isArray(bData) ? bData : bData.data || bData.bookings || [];
      const allD = Array.isArray(dData) ? dData : dData.data || dData.drivers || [];
      setBookings(allB.filter(isTruckBooking));
      setDrivers(allD.filter((d: any) => ALL_TRUCK_TYPES.includes(d.vehicle_type || '') || d.vehicle_category === 'truck'));
    } catch { /**/ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filterByTime = (bs: any[]) => {
    const now = new Date();
    if (timeFilter === 'today') return bs.filter(b => b.created_at && new Date(b.created_at).toDateString() === now.toDateString());
    if (timeFilter === 'week') { const wa = new Date(now); wa.setDate(wa.getDate() - 7); return bs.filter(b => b.created_at && new Date(b.created_at) >= wa); }
    if (timeFilter === 'month') { const ma = new Date(now); ma.setMonth(ma.getMonth() - 1); return bs.filter(b => b.created_at && new Date(b.created_at) >= ma); }
    return bs;
  };

  const filtered = filterByTime(bookings);
  const days = timeFilter === 'today' ? 24 : 7;

  // Volume trend
  const volumeTrend = Array.from({ length: days }, (_, i) => {
    if (timeFilter === 'today') {
      return { label: `${i}:00`, city: bookings.filter(b => b.created_at && new Date(b.created_at).getHours() === i && new Date(b.created_at).toDateString() === new Date().toDateString() && TRUCK_CITY_TYPES.includes(b.service_type?.slug || b.vehicle_type || '')).length, outstation: bookings.filter(b => b.created_at && new Date(b.created_at).getHours() === i && new Date(b.created_at).toDateString() === new Date().toDateString() && TRUCK_OS_TYPES.includes(b.service_type?.slug || b.vehicle_type || '')).length };
    }
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
    const ds = d.toDateString();
    return {
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      city: bookings.filter(b => b.created_at && new Date(b.created_at).toDateString() === ds && TRUCK_CITY_TYPES.includes(b.service_type?.slug || b.vehicle_type || '')).length,
      outstation: bookings.filter(b => b.created_at && new Date(b.created_at).toDateString() === ds && TRUCK_OS_TYPES.includes(b.service_type?.slug || b.vehicle_type || '')).length,
    };
  });

  // Revenue trend
  const revTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const ds = d.toDateString();
    return {
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      city: bookings.filter(b => b.created_at && new Date(b.created_at).toDateString() === ds && TRUCK_CITY_TYPES.includes(b.service_type?.slug || b.vehicle_type || '') && b.status === 'completed').reduce((s: number, b: any) => s + (b.final_fare || b.estimated_fare || 0), 0),
      outstation: bookings.filter(b => b.created_at && new Date(b.created_at).toDateString() === ds && TRUCK_OS_TYPES.includes(b.service_type?.slug || b.vehicle_type || '') && b.status === 'completed').reduce((s: number, b: any) => s + (b.final_fare || b.estimated_fare || 0), 0),
    };
  });

  // Funnel
  const searching = filtered.filter(b => b.status === 'searching').length;
  const accepted = filtered.filter(b => ['accepted', 'in_progress', 'completed'].includes(b.status || '')).length;
  const completed = filtered.filter(b => b.status === 'completed').length;

  // Peak hours
  const peakHours = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}h`,
    trips: bookings.filter(b => b.created_at && new Date(b.created_at).getHours() === h).length,
  }));

  // Revenue by vehicle type
  const revByVehicle = ALL_TRUCK_TYPES.map(vt => ({
    name: VEHICLE_LABEL[vt] || vt,
    revenue: bookings.filter(b => (b.service_type?.slug || b.vehicle_type || '') === vt && b.status === 'completed').reduce((s: number, b: any) => s + (b.final_fare || b.estimated_fare || 0), 0),
  })).sort((a, b) => b.revenue - a.revenue).filter(v => v.revenue > 0);

  // Avg distance by vehicle
  const avgDistByVehicle = ALL_TRUCK_TYPES.map(vt => {
    const vB = bookings.filter(b => (b.service_type?.slug || b.vehicle_type || '') === vt && b.status === 'completed' && b.distance_km);
    return { name: VEHICLE_LABEL[vt] || vt, avgDist: vB.length ? (vB.reduce((s: number, b: any) => s + (b.distance_km || 0), 0) / vB.length).toFixed(0) : 0 };
  }).filter(v => Number(v.avgDist) > 0);

  // Cancellation by vehicle
  const cancelByVehicle = ALL_TRUCK_TYPES.map(vt => {
    const all = bookings.filter(b => (b.service_type?.slug || b.vehicle_type || '') === vt);
    const cancelled = all.filter(b => b.status === 'cancelled');
    return { name: VEHICLE_LABEL[vt] || vt, rate: all.length ? Math.round((cancelled.length / all.length) * 100) : 0 };
  }).filter(v => v.rate > 0);

  // Top 10 drivers
  const top10 = [...drivers].sort((a, b) => (b.total_rides || 0) - (a.total_rides || 0)).slice(0, 10);
  const maxRides = top10[0]?.total_rides || 1;

  // Rating distribution
  const ratingDist = [5, 4, 3, 2, 1].map(r => ({
    name: `${r}⭐`, value: drivers.filter(d => d.rating && Math.round(d.rating) === r).length,
    color: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#6B7280'][5 - r],
  }));

  // New signups
  const newDrivers = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return { day: d.toLocaleDateString('en-US', { weekday: 'short' }), count: drivers.filter(dr => dr.created_at && new Date(dr.created_at).toDateString() === d.toDateString()).length };
  });

  // City vs OS
  const splitDonut = [
    { name: 'City', value: bookings.filter(b => TRUCK_CITY_TYPES.includes(b.service_type?.slug || b.vehicle_type || '')).length, color: '#3B82F6' },
    { name: 'Outstation', value: bookings.filter(b => TRUCK_OS_TYPES.includes(b.service_type?.slug || b.vehicle_type || '')).length, color: '#8B5CF6' },
  ].filter(d => d.value > 0);

  // Popular pickup zones
  const zoneCounts: Record<string, number> = {};
  bookings.forEach((b: any) => {
    const zone = b.pickup_address?.split(',')[0];
    if (zone) zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
  });
  const popularPickups = Object.entries(zoneCounts).sort(([, a], [, b]) => b - a).slice(0, 5);

  if (loading) return <div className="animate-pulse space-y-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-48 bg-white rounded-2xl border border-gray-100" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Truck Analytics</h1><p className="text-sm text-gray-500 mt-0.5">Deep insights into logistics operations</p></div>
        <div className="flex gap-2">
          {TIME_FILTERS.map(f => (
            <button key={f.key} onClick={() => setTimeFilter(f.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${timeFilter === f.key ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}
              style={timeFilter === f.key ? { backgroundColor: '#3B82F6' } : {}}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section 1 — Volume */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Delivery Volume</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">City vs Outstation Trend</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={volumeTrend}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="city" stroke="#3B82F6" fill="#EFF6FF" strokeWidth={2} />
                <Area type="monotone" dataKey="outstation" stroke="#8B5CF6" fill="#F5F3FF" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Delivery Funnel</h3>
            <div className="space-y-3 mt-4">
              {[
                { label: 'Searched', value: searching + accepted + completed, color: '#6B7280' },
                { label: 'Accepted', value: accepted, color: '#F59E0B' },
                { label: 'Completed', value: completed, color: '#10B981' },
              ].map(f => (
                <div key={f.label}>
                  <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">{f.label}</span><span className="font-semibold">{f.value}</span></div>
                  <div className="w-full bg-gray-100 rounded-full h-2"><div className="h-2 rounded-full" style={{ width: `${Math.min(100, (f.value / (searching + accepted + completed || 1)) * 100)}%`, backgroundColor: f.color }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Peak Delivery Hours</h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={peakHours}>
              <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={2} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="trips" fill="#3B82F6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Section 2 — Revenue */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Revenue</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue: City vs Outstation (Last 7 Days)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revTrend}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString()}`, '']} />
                <Legend />
                <Bar dataKey="city" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="outstation" stackId="a" fill="#8B5CF6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue by Vehicle Size</h3>
            {revByVehicle.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={revByVehicle} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={64} />
                  <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>}
          </div>
        </div>
      </div>

      {/* Section 3 — Logistics Metrics */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Logistics Metrics</h2>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Avg Distance by Vehicle</h3>
            <div className="space-y-2">
              {avgDistByVehicle.slice(0, 6).map(v => (
                <div key={v.name} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-20 truncate">{v.name}</span>
                  <div className="flex-1 bg-blue-100 rounded-full h-2"><div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.min(100, (Number(v.avgDist) / 500) * 100)}%` }} /></div>
                  <span className="text-xs font-semibold text-gray-700 w-14 text-right">{v.avgDist} km</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Cancellation Rate by Vehicle</h3>
            <div className="space-y-2">
              {cancelByVehicle.slice(0, 6).map(v => (
                <div key={v.name} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-20 truncate">{v.name}</span>
                  <div className="flex-1 bg-red-100 rounded-full h-2"><div className="h-2 rounded-full bg-red-400" style={{ width: `${v.rate}%` }} /></div>
                  <span className="text-xs font-semibold text-red-600 w-10 text-right">{v.rate}%</span>
                </div>
              ))}
              {cancelByVehicle.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No cancellations</p>}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Popular Pickup Zones</h3>
            <div className="space-y-2">
              {popularPickups.map(([zone, count]) => (
                <div key={zone} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 truncate max-w-36">📍 {zone}</span>
                  <span className="font-bold" style={{ color: '#3B82F6' }}>{count}</span>
                </div>
              ))}
              {popularPickups.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data yet</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Section 4 — Driver Performance */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Driver Performance</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Top 10 Truck Drivers</h3>
            <div className="space-y-2">
              {top10.map((d: any, i: number) => (
                <div key={d.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold w-4 text-gray-400">#{i + 1}</span>
                  <span className="text-sm text-gray-700 flex-1 truncate">{d.name || '—'}</span>
                  <div className="flex-1 max-w-24 bg-blue-100 rounded-full h-2"><div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.round(((d.total_rides || 0) / maxRides) * 100)}%` }} /></div>
                  <span className="text-xs font-semibold text-gray-600 w-16 text-right">{d.total_rides || 0} trips</span>
                </div>
              ))}
              {top10.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No driver data</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Rating Distribution</h3>
              <div className="flex gap-4">
                <ResponsiveContainer width="50%" height={130}>
                  <PieChart>
                    <Pie data={ratingDist.filter(r => r.value > 0)} cx="50%" cy="50%" outerRadius={55} dataKey="value">
                      {ratingDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5 self-center">
                  {ratingDist.map(r => (
                    <div key={r.name} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                      <span className="text-gray-600">{r.name}</span>
                      <span className="ml-auto font-semibold">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">New Driver Signups</h3>
              <ResponsiveContainer width="100%" height={90}>
                <BarChart data={newDrivers}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Section 5 — Outstation Routes */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Outstation Routes</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">City vs Outstation Split</h3>
            {splitDonut.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={splitDonut} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                    {splitDonut.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>}
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Popular Drop Zones</h3>
            <div className="space-y-2">
              {(() => {
                const dropCounts: Record<string, number> = {};
                bookings.filter(b => TRUCK_OS_TYPES.includes(b.service_type?.slug || b.vehicle_type || '')).forEach((b: any) => {
                  const zone = b.drop_address?.split(',')[0];
                  if (zone) dropCounts[zone] = (dropCounts[zone] || 0) + 1;
                });
                const sorted = Object.entries(dropCounts).sort(([, a], [, b]) => b - a).slice(0, 6);
                return sorted.length > 0 ? sorted.map(([zone, count]) => (
                  <div key={zone} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 truncate max-w-52">🗺 {zone}</span>
                    <span className="font-bold" style={{ color: '#8B5CF6' }}>{count}</span>
                  </div>
                )) : <p className="text-sm text-gray-400 text-center py-4">No outstation data yet</p>;
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
