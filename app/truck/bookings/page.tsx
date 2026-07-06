'use client';
import { useEffect, useState, useCallback } from 'react';
import { X, Phone, XCircle } from 'lucide-react';
import Pagination from '@/components/Pagination';
import OlaMap, { decodePolyline, OlaMarker } from '@/components/OlaMap';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://gogobackend-production.up.railway.app';
const TRUCK_CITY_TYPES = ['truck_city_tata_ace', 'truck_city_14ft', 'truck_city_open', 'truck_city_container'];
const TRUCK_OS_TYPES = ['truck_os_14ft', 'truck_os_20ft', 'truck_os_container', 'truck_os_trailer'];
const ALL_TRUCK_TYPES = [...TRUCK_CITY_TYPES, ...TRUCK_OS_TYPES];
const STATUS_COLORS: Record<string, string> = {
  completed: '#10B981', cancelled: '#EF4444', in_progress: '#3B82F6', accepted: '#F59E0B', searching: '#6B7280', scheduled: '#0EA5E9',
};
const PAGE_SIZE = 50;

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('truck_admin_token') : ''; }
function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }

const isTruckBooking = (b: any) =>
  b?.service_category === 'truck' ||
  b?.service_type?.category === 'truck' ||
  ALL_TRUCK_TYPES.includes(b?.service_slug ?? '') ||
  ALL_TRUCK_TYPES.includes(b?.service_type?.slug ?? '') ||
  ALL_TRUCK_TYPES.includes(b?.vehicle_type ?? '');

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

export default function TruckBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('today');
  const [selected, setSelected] = useState<any>(null);
  const [cancelling, setCancelling] = useState(false);
  const [selectedGeo, setSelectedGeo] = useState<{
    pickup: { lat: number; lng: number }; drop: { lat: number; lng: number };
    driver?: { lat: number; lng: number };
  } | null>(null);
  const [routeLine, setRouteLine] = useState<[number, number][] | undefined>(undefined);

  useEffect(() => {
    if (!selected) { setSelectedGeo(null); setRouteLine(undefined); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/gogoo/bookings/${selected.id}`, { headers: authHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data?.pickup || !data?.drop) return;
        setSelectedGeo({ pickup: data.pickup, drop: data.drop, driver: data.driver?.lat != null ? data.driver : undefined });
        try {
          const rRes = await fetch(`${API}/gogoo/route?from=${data.pickup.lat},${data.pickup.lng}&to=${data.drop.lat},${data.drop.lng}`, { headers: authHeaders() });
          const rData = await rRes.json();
          if (!cancelled && rData?.polyline) setRouteLine(decodePolyline(rData.polyline));
        } catch {}
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [selected]);

  const cancelBooking = async (bookingId: string) => {
    if (!confirm('Cancel this booking?')) return;
    setCancelling(true);
    try {
      const res = await fetch(`${API}/gogoo/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', cancelled_by: 'admin' }),
      });
      if (res.ok) {
        setSelected(null);
        fetchData();
      } else {
        alert('Failed to cancel booking');
      }
    } catch {
      alert('Failed to cancel booking');
    } finally {
      setCancelling(false);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API}/gogoo/bookings`, { headers: authHeaders() });
      const data = await res.json();
      const all = Array.isArray(data) ? data : data.data || data.bookings || [];
      setBookings(all.filter(isTruckBooking));
    } catch { /**/ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = bookings.filter(b => {
    const now = new Date();
    const created = b.created_at ? new Date(b.created_at) : null;
    if (dateFilter === 'today' && created?.toDateString() !== now.toDateString()) return false;
    if (dateFilter === 'week') { const wa = new Date(now); wa.setDate(wa.getDate() - 7); if (!created || created < wa) return false; }
    if (dateFilter === 'month') { const ma = new Date(now); ma.setMonth(ma.getMonth() - 1); if (!created || created < ma) return false; }
    const slug = b.service_type?.slug || b.vehicle_type || '';
    if (typeFilter === 'city' && !TRUCK_CITY_TYPES.includes(slug) && !slug.includes('city')) return false;
    if (typeFilter === 'outstation' && !TRUCK_OS_TYPES.includes(slug) && !slug.includes('os')) return false;
    if (vehicleFilter !== 'all' && !slug.includes(vehicleFilter)) return false;
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return b.id?.toLowerCase().includes(q) || (b.rider_name || b.rider?.name)?.toLowerCase().includes(q) || (b.driver_name || b.driver?.name)?.toLowerCase().includes(q) || b.pickup_address?.toLowerCase().includes(q);
    }
    return true;
  });

  const today = new Date().toDateString();
  const todayB = bookings.filter(b => b.created_at && new Date(b.created_at).toDateString() === today);
  const todayCity = todayB.filter(b => TRUCK_CITY_TYPES.includes(b.service_type?.slug || b.vehicle_type || ''));
  const todayOS = todayB.filter(b => TRUCK_OS_TYPES.includes(b.service_type?.slug || b.vehicle_type || ''));
  const todayCompleted = todayB.filter(b => b.status === 'completed');
  const todayRevenue = todayCompleted.reduce((s: number, b: any) => s + (b.final_fare || b.estimated_fare || 0), 0);
  const avgDist = todayCompleted.length ? (todayCompleted.reduce((s: number, b: any) => s + (b.distance_km || 0), 0) / todayCompleted.length).toFixed(1) : '0';

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-20 bg-white rounded-2xl border border-gray-100" /><div className="h-96 bg-white rounded-2xl border border-gray-100" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Truck Bookings</h1><p className="text-sm text-gray-500 mt-0.5">All truck & logistics bookings</p></div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          { label: 'Total Today', value: todayB.length },
          { label: 'City', value: todayCity.length, color: '#3B82F6' },
          { label: 'Outstation', value: todayOS.length, color: '#8B5CF6' },
          { label: 'Completed', value: todayCompleted.length, color: '#10B981' },
          { label: 'Revenue Today', value: `₹${todayRevenue.toLocaleString()}` },
          { label: 'Avg Distance', value: `${avgDist}km` },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-xl font-bold mt-1" style={{ color: s.color || '#3B82F6' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search ID, rider, driver, address..." className="flex-1 min-w-48 px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400" />
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400">
            <option value="all">All Types</option>
            <option value="city">City Delivery</option>
            <option value="outstation">Outstation</option>
          </select>
          <select value={vehicleFilter} onChange={e => { setVehicleFilter(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400">
            <option value="all">All Vehicles</option>
            <option value="tata_ace">Tata Ace</option>
            <option value="14ft">14ft Truck</option>
            <option value="20ft">20ft Truck</option>
            <option value="open">Open Body</option>
            <option value="container">Container</option>
            <option value="trailer">Trailer</option>
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400">
            <option value="all">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="searching">Searching</option>
            <option value="accepted">Accepted</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={dateFilter} onChange={e => { setDateFilter(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400">
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100"><p className="text-sm text-gray-500">{filtered.length} bookings</p></div>
        {filtered.length === 0 ? <div className="p-16 text-center text-gray-400 text-sm">No bookings found</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Booking ID', 'Type', 'Vehicle', 'Rider', 'Driver', 'Pickup', 'Drop', 'Dist', 'Fare', 'Status', 'Time', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.map((b: any) => {
                  const slug = b.service_type?.slug || b.vehicle_type || '';
                  const isCity = TRUCK_CITY_TYPES.includes(slug) || slug.includes('city');
                  return (
                    <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">#{b.id?.slice(-8).toUpperCase()}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${isCity ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{isCity ? '🏙 City' : '🗺 OS'}</span></td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{getTruckSize(slug)}</td>
                      <td className="px-4 py-3"><p className="font-medium text-gray-800">{(b.rider_name || b.rider?.name) || '—'}</p><p className="text-xs text-gray-400">{(b.rider_phone || b.rider?.phone) || ''}</p></td>
                      <td className="px-4 py-3"><p className="font-medium text-gray-800">{(b.driver_name || b.driver?.name) || 'Unassigned'}</p><p className="text-xs text-gray-400">{(b.vehicle_number || b.driver?.vehicle_number) || ''}</p></td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-28 truncate">{b.pickup_address?.slice(0, 22) || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-28 truncate">{b.drop_address?.slice(0, 22) || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{b.distance_km ? `${b.distance_km}km` : '—'}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800">₹{(b.final_fare || b.estimated_fare || 0).toLocaleString()}</td>
                      <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-full font-medium capitalize" style={{ backgroundColor: `${STATUS_COLORS[b.status || ''] || '#6B7280'}20`, color: STATUS_COLORS[b.status || ''] || '#6B7280' }}>{b.status?.replace('_', ' ') || 'unknown'}</span></td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{b.created_at ? new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td className="px-4 py-3"><button onClick={() => setSelected(b)} className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors" style={{ backgroundColor: '#EFF6FF', color: '#3B82F6' }}>View</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="p-4 border-t border-gray-100">
          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>

      {/* Detail Panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setSelected(null)} />
          <div className="w-[420px] bg-white h-full overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="font-bold text-gray-900">Truck Booking #{selected.id?.slice(-8).toUpperCase()}</h2>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-5">
              {(() => {
                const slug = selected.service_type?.slug || selected.vehicle_type || '';
                const isCity = TRUCK_CITY_TYPES.includes(slug) || slug.includes('city');
                return (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div><p className="text-xs text-gray-400 mb-1">Type</p><span className={`text-sm px-2 py-1 rounded-full font-medium ${isCity ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{isCity ? '🏙 City Delivery' : '🗺 Outstation'}</span></div>
                      <div><p className="text-xs text-gray-400 mb-1">Vehicle</p><p className="font-semibold">{getTruckSize(slug)}</p></div>
                    </div>
                    <div><p className="text-xs text-gray-400 mb-1">Status</p><span className="text-sm px-3 py-1 rounded-full font-medium capitalize" style={{ backgroundColor: `${STATUS_COLORS[selected.status || ''] || '#6B7280'}20`, color: STATUS_COLORS[selected.status || ''] || '#6B7280' }}>{selected.status?.replace('_', ' ') || 'unknown'}</span></div>
                    {selected.is_scheduled && selected.scheduled_at && (
                      <div className="border-t border-gray-100 pt-4">
                        <p className="text-xs text-gray-400 mb-1">Scheduled Pickup</p>
                        <p className="font-semibold" style={{ color: '#0EA5E9' }}>
                          {new Date(selected.scheduled_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {selected.status === 'scheduled' && (
                          <p className="text-xs text-gray-400 mt-1">Not yet dispatched — driver matching starts ~15 min before pickup</p>
                        )}
                      </div>
                    )}
                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-xs text-gray-400 mb-2">Route</p>
                      <p className="text-sm text-gray-700">📍 <strong>Pickup:</strong> {selected.pickup_address || '—'}</p>
                      <p className="text-sm text-gray-500 mt-1">📍 <strong>Drop:</strong> {selected.drop_address || '—'}</p>
                      {selected.distance_km && <p className="text-sm text-gray-500 mt-1">📏 Distance: <strong>{selected.distance_km} km</strong></p>}
                      {selectedGeo && (
                        <div className="mt-3">
                          <OlaMap
                            className="w-full h-56 rounded-xl overflow-hidden"
                            fitToMarkers
                            route={routeLine || [[selectedGeo.pickup.lng, selectedGeo.pickup.lat], [selectedGeo.drop.lng, selectedGeo.drop.lat]]}
                            markers={[
                              { lng: selectedGeo.pickup.lng, lat: selectedGeo.pickup.lat, color: '#10B981', label: 'P', popup: '<b>Pickup</b>' },
                              { lng: selectedGeo.drop.lng, lat: selectedGeo.drop.lat, color: '#3B82F6', label: 'D', popup: '<b>Drop</b>' },
                              ...(selectedGeo.driver ? [{ lng: selectedGeo.driver.lng, lat: selectedGeo.driver.lat, color: '#FF6B2B', label: '🚛', popup: '<b>Driver</b>' } as OlaMarker] : []),
                            ]}
                          />
                        </div>
                      )}
                    </div>
                    {(selected.receiver_name || selected.receiver_phone || selected.notes) && (
                      <div className="border-t border-gray-100 pt-4">
                        <p className="text-xs text-gray-400 mb-2">Goods Information</p>
                        {selected.receiver_name && <p className="text-sm text-gray-700">Receiver: <strong>{selected.receiver_name}</strong></p>}
                        {selected.receiver_phone && <p className="text-sm text-gray-500 mt-1">Phone: {selected.receiver_phone}</p>}
                        {selected.notes && <p className="text-sm text-gray-500 mt-1">Notes: {selected.notes}</p>}
                      </div>
                    )}
                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-xs text-gray-400 mb-2">Fare Breakdown</p>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-sm"><span className="text-gray-500">Estimated</span><span>₹{selected.estimated_fare || 0}</span></div>
                        <div className="flex justify-between text-sm font-semibold"><span className="text-gray-700">Final Fare</span><span style={{ color: '#3B82F6' }}>₹{selected.final_fare || selected.estimated_fare || 0}</span></div>
                        <div className="border-t border-gray-100 pt-1">
                          <div className="flex justify-between text-xs text-gray-400"><span>gogoo Commission (20%)</span><span>₹{Math.round((selected.final_fare || selected.estimated_fare || 0) * 0.2)}</span></div>
                          <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>Driver Earnings (80%)</span><span>₹{Math.round((selected.final_fare || selected.estimated_fare || 0) * 0.8)}</span></div>
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-xs text-gray-400 mb-2">Rider</p>
                      <p className="font-medium">{selected.rider?.name || '—'}</p>
                      {selected.rider?.phone && <a href={`tel:${selected.rider.phone}`} className="flex items-center gap-1 text-xs text-blue-500 mt-1"><Phone size={12} /> {selected.rider.phone}</a>}
                    </div>
                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-xs text-gray-400 mb-2">Driver</p>
                      <p className="font-medium">{selected.driver?.name || 'Unassigned'}</p>
                      {selected.driver?.phone && <a href={`tel:${selected.driver.phone}`} className="flex items-center gap-1 text-xs text-blue-500 mt-1"><Phone size={12} /> {selected.driver.phone}</a>}
                      {selected.driver?.vehicle_number && <p className="text-xs text-gray-500 mt-1">{selected.driver.vehicle_number}</p>}
                    </div>
                    <div className="border-t border-gray-100 pt-4"><p className="text-xs text-gray-400 mb-1">OTP</p><div className="flex items-center gap-2"><span className="font-mono font-bold text-lg">{selected.otp || '—'}</span><span className="text-xs">{selected.otp_verified ? '✅ Verified' : '⏳ Pending'}</span></div></div>
                    {selected.status !== 'cancelled' && selected.status !== 'completed' && (
                      <div className="border-t border-gray-100 pt-4">
                        <button
                          onClick={() => cancelBooking(selected.id)}
                          disabled={cancelling}
                          className="w-full py-2.5 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-60"
                        >
                          <XCircle size={16} />
                          {cancelling ? 'Cancelling...' : 'Cancel Booking'}
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
