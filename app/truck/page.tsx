'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://gogobackend-production.up.railway.app';
const TRUCK_CITY_TYPES = ['truck_city_tata_ace', 'truck_city_14ft', 'truck_city_open', 'truck_city_container'];
const TRUCK_OS_TYPES = ['truck_os_14ft', 'truck_os_20ft', 'truck_os_container', 'truck_os_trailer'];
const ALL_TRUCK_TYPES = [...TRUCK_CITY_TYPES, ...TRUCK_OS_TYPES];

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('truck_admin_token') : ''; }
function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }

const isTruckBooking = (b: any) =>
  b?.service_category === 'truck' ||
  b?.service_type?.category === 'truck' ||
  ALL_TRUCK_TYPES.includes(b?.service_slug ?? '') ||
  ALL_TRUCK_TYPES.includes(b?.service_type?.slug ?? '') ||
  ALL_TRUCK_TYPES.includes(b?.vehicle_type ?? '');

const isTruckDriver = (d: any) =>
  ALL_TRUCK_TYPES.includes(d?.vehicle_type ?? '') || d?.vehicle_category === 'truck';

const getTruckSize = (slug: string) => {
  if (!slug) return 'Truck';
  if (slug.includes('tata_ace')) return 'Tata Ace';
  if (slug.includes('14ft')) return '14ft';
  if (slug.includes('20ft')) return '20ft';
  if (slug.includes('open')) return 'Open Body';
  if (slug.includes('container')) return 'Container';
  if (slug.includes('trailer')) return 'Trailer';
  return 'Truck';
};

const STATUS_COLORS: Record<string, string> = {
  completed: '#10B981', cancelled: '#EF4444', in_progress: '#3B82F6',
  accepted: '#F59E0B', searching: '#6B7280',
};

const VEHICLE_GROUPS = [
  { key: 'tata_ace', label: 'Tata Ace', emoji: '🛻', types: ['truck_city_tata_ace'] },
  { key: '14ft', label: '14ft Truck', emoji: '🚛', types: ['truck_city_14ft', 'truck_os_14ft'] },
  { key: '20ft_open', label: '20ft/Open', emoji: '🚚', types: ['truck_city_open', 'truck_os_20ft'] },
  { key: 'container_trailer', label: 'Container/Trailer', emoji: '📦', types: ['truck_city_container', 'truck_os_container', 'truck_os_trailer'] },
];

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color: color || '#3B82F6' }}>{value}</p>
    </div>
  );
}

export default function TruckOverviewPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
      setDrivers(allD.filter(isTruckDriver));
    } catch { /**/ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 10000);
    return () => clearInterval(t);
  }, [fetchData]);

  const today = new Date().toDateString();
  const todayB = bookings.filter(b => b.created_at && new Date(b.created_at).toDateString() === today);
  const completed = todayB.filter(b => b.status === 'completed');
  const inProgress = todayB.filter(b => ['in_progress', 'accepted'].includes(b.status));
  const cityB = todayB.filter(b => TRUCK_CITY_TYPES.includes(b.service_type?.slug || b.vehicle_type || ''));
  const osB = todayB.filter(b => TRUCK_OS_TYPES.includes(b.service_type?.slug || b.vehicle_type || ''));
  const revenue = completed.reduce((s: number, b: any) => s + (b.final_fare || b.estimated_fare || 0), 0);
  const onlineDrivers = drivers.filter(d => d.is_online);

  // City card stats
  const cityCompleted = cityB.filter(b => b.status === 'completed');
  const cityRevenue = cityCompleted.reduce((s: number, b: any) => s + (b.final_fare || b.estimated_fare || 0), 0);
  const cityAvgFare = cityCompleted.length ? Math.round(cityRevenue / cityCompleted.length) : 0;

  // OS card stats
  const osCompleted = osB.filter(b => b.status === 'completed');
  const osRevenue = osCompleted.reduce((s: number, b: any) => s + (b.final_fare || b.estimated_fare || 0), 0);
  const osAvgFare = osCompleted.length ? Math.round(osRevenue / osCompleted.length) : 0;

  // Vehicle group stats
  const totalVehicleCount = todayB.length || 1;
  const vGroupStats = VEHICLE_GROUPS.map(g => ({
    ...g,
    count: todayB.filter(b => g.types.includes(b.service_type?.slug || b.vehicle_type || '')).length,
    revenue: todayB.filter(b => g.types.includes(b.service_type?.slug || b.vehicle_type || '') && b.status === 'completed')
      .reduce((s: number, b: any) => s + (b.final_fare || b.estimated_fare || 0), 0),
    driversOnline: drivers.filter(d => g.types.includes(d.vehicle_type || '') && (d.is_online)).length,
  }));

  // Hourly
  const hourlyData = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}:00`,
    deliveries: todayB.filter(b => b.created_at && new Date(b.created_at).getHours() === h).length,
  }));

  // City vs OS pie
  const splitPie = [
    { name: 'City', value: cityB.length, color: '#3B82F6' },
    { name: 'Outstation', value: osB.length, color: '#8B5CF6' },
  ].filter(d => d.value > 0);

  // Revenue last 7 days
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const ds = d.toDateString();
    return {
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      revenue: bookings.filter(b => b.created_at && new Date(b.created_at).toDateString() === ds && b.status === 'completed')
        .reduce((s: number, b: any) => s + (b.final_fare || b.estimated_fare || 0), 0),
    };
  });

  // Vehicle size pie
  const sizePie = VEHICLE_GROUPS.map((g, i) => ({
    name: g.label,
    value: todayB.filter(b => g.types.includes(b.service_type?.slug || b.vehicle_type || '')).length,
    color: ['#BFDBFE', '#60A5FA', '#3B82F6', '#1D4ED8'][i],
  })).filter(d => d.value > 0);

  // Recent 10
  const recentBookings = [...bookings]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 10);

  // Top 5 drivers
  const topDrivers = [...drivers].sort((a, b) => (b.rides_today || 0) - (a.rides_today || 0)).slice(0, 5);

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-6 gap-4">{Array(6).fill(0).map((_, i) => <div key={i} className="bg-white rounded-2xl h-28 border border-gray-100" />)}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Truck Operations Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">Live logistics data — auto-refreshes every 10s</p>
      </div>

      {/* Row 1 — Live Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon="🚛" label="Active Trips" value={inProgress.length} />
        <StatCard icon="👤" label="Drivers Online" value={onlineDrivers.length} />
        <StatCard icon="📦" label="Deliveries Today" value={todayB.length} />
        <StatCard icon="₹" label="Revenue Today" value={`₹${revenue.toLocaleString()}`} />
        <StatCard icon="🏙" label="City Deliveries" value={cityB.length} color="#3B82F6" />
        <StatCard icon="🗺" label="Outstation Trips" value={osB.length} color="#8B5CF6" />
      </div>

      {/* Row 2 — City vs Outstation */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border-l-4 border border-gray-100 shadow-sm" style={{ borderLeftColor: '#3B82F6' }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🏙</span>
            <h3 className="font-bold text-gray-900 text-lg">City Delivery</h3>
            <span className="ml-auto text-xs px-2 py-1 rounded-full font-medium bg-blue-50 text-blue-700">Blue</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div><p className="text-xs text-gray-500">Today</p><p className="text-2xl font-bold" style={{ color: '#3B82F6' }}>{cityB.length}</p><p className="text-xs text-gray-400">bookings</p></div>
            <div><p className="text-xs text-gray-500">Revenue</p><p className="text-2xl font-bold" style={{ color: '#3B82F6' }}>₹{cityRevenue.toLocaleString()}</p></div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs mb-3">
            {['tata_ace', '14ft', 'open', 'container'].map((type, i) => {
              const cnt = todayB.filter(b => (b.service_type?.slug || b.vehicle_type || '').includes(type)).length;
              return <div key={type} className="bg-blue-50 rounded-lg p-2"><p className="font-bold text-blue-700">{cnt}</p><p className="text-gray-500">{['Ace', '14ft', 'Open', 'Box'][i]}</p></div>;
            })}
          </div>
          <div className="flex gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
            <span>Avg fare: <strong className="text-gray-800">₹{cityAvgFare}</strong></span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border-l-4 border border-gray-100 shadow-sm" style={{ borderLeftColor: '#8B5CF6' }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🗺</span>
            <h3 className="font-bold text-gray-900 text-lg">Outstation</h3>
            <span className="ml-auto text-xs px-2 py-1 rounded-full font-medium bg-purple-50 text-purple-700">Purple</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div><p className="text-xs text-gray-500">Today</p><p className="text-2xl font-bold" style={{ color: '#8B5CF6' }}>{osB.length}</p><p className="text-xs text-gray-400">trips</p></div>
            <div><p className="text-xs text-gray-500">Revenue</p><p className="text-2xl font-bold" style={{ color: '#8B5CF6' }}>₹{osRevenue.toLocaleString()}</p></div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs mb-3">
            {['14ft', '20ft', 'container', 'trailer'].map((type, i) => {
              const cnt = todayB.filter(b => TRUCK_OS_TYPES.includes(b.service_type?.slug || b.vehicle_type || '') && (b.service_type?.slug || b.vehicle_type || '').includes(type)).length;
              return <div key={type} className="bg-purple-50 rounded-lg p-2"><p className="font-bold text-purple-700">{cnt}</p><p className="text-gray-500">{['14ft', '20ft', 'Box', 'TRL'][i]}</p></div>;
            })}
          </div>
          <div className="flex gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
            <span>Avg fare: <strong className="text-gray-800">₹{osAvgFare}</strong></span>
          </div>
        </div>
      </div>

      {/* Row 3 — Vehicle Size Breakdown */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {vGroupStats.map((v, i) => (
          <div key={v.key} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-2"><span className="text-2xl">{v.emoji}</span><span className="text-sm font-semibold text-gray-700">{v.label}</span></div>
            <p className="text-3xl font-bold" style={{ color: '#3B82F6' }}>{v.count}</p>
            <p className="text-xs text-gray-500 mb-3">rides today · ₹{v.revenue.toLocaleString()}</p>
            <div className="w-full bg-blue-100 rounded-full h-1.5">
              <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.round((v.count / totalVehicleCount) * 100)}%`, backgroundColor: ['#BFDBFE', '#60A5FA', '#3B82F6', '#1D4ED8'][i] }} />
            </div>
            <p className="text-xs text-gray-400 mt-1">{Math.round((v.count / totalVehicleCount) * 100)}% of total</p>
          </div>
        ))}
      </div>

      {/* Row 4 — Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Deliveries Today by Hour</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={hourlyData}>
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={3} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="deliveries" stroke="#3B82F6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="xl:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">City vs Outstation</h3>
          {splitPie.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={splitPie} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {splitPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>}
        </div>
      </div>

      {/* Row 5 — Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue Last 7 Days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={last7}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="xl:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Vehicle Size Distribution</h3>
          {sizePie.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={sizePie} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {sizePie.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>}
        </div>
      </div>

      {/* Row 6 — Recent Bookings */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-700">Recent Truck Bookings</h3></div>
        {recentBookings.length === 0 ? <div className="p-12 text-center text-gray-400 text-sm">No truck bookings yet</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['ID', 'Type', 'Vehicle', 'Rider', 'Driver', 'Route', 'Distance', 'Fare', 'Status', 'Time'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentBookings.map((b: any) => {
                  const slug = b.service_type?.slug || b.vehicle_type || '';
                  const isCity = TRUCK_CITY_TYPES.includes(slug) || slug.includes('city');
                  return (
                    <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">#{b.id?.slice(-6).toUpperCase()}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${isCity ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{isCity ? '🏙 City' : '🗺 OS'}</span></td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{getTruckSize(slug)}</td>
                      <td className="px-4 py-3 text-gray-700">{(b.rider_name || b.rider?.name) || '—'}</td>
                      <td className="px-4 py-3 text-gray-700">{(b.driver_name || b.driver?.name) || 'Unassigned'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-28 truncate">{b.pickup_address?.slice(0, 18) || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{b.distance_km ? `${b.distance_km}km` : '—'}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800">₹{(b.final_fare || b.estimated_fare || 0).toLocaleString()}</td>
                      <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-full font-medium capitalize" style={{ backgroundColor: `${STATUS_COLORS[b.status || ''] || '#6B7280'}20`, color: STATUS_COLORS[b.status || ''] || '#6B7280' }}>{b.status?.replace('_', ' ') || 'unknown'}</span></td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{b.created_at ? new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Row 7 — Top Drivers */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-700">Top Performing Truck Drivers</h3></div>
        {topDrivers.length === 0 ? <div className="p-12 text-center text-gray-400 text-sm">No drivers found</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Rank', 'Driver', 'Vehicle', 'Trips Today', 'Revenue', 'Rating'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topDrivers.map((d: any, i: number) => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3"><span className="font-bold text-lg" style={{ color: i === 0 ? '#3B82F6' : '#6B7280' }}>#{i + 1}</span></td>
                    <td className="px-4 py-3 font-medium text-gray-800">{d.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{getTruckSize(d.vehicle_type || '')}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: '#3B82F6' }}>{d.rides_today || 0}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">₹{(d.earnings_today || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">⭐ {d.rating?.toFixed(1) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
