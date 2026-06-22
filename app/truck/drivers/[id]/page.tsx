'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Phone } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://gogobackend-production.up.railway.app';
const TRUCK_CITY_TYPES = ['truck_city_tata_ace', 'truck_city_14ft', 'truck_city_open', 'truck_city_container'];
const TRUCK_OS_TYPES = ['truck_os_14ft', 'truck_os_20ft', 'truck_os_container', 'truck_os_trailer'];
const ALL_TRUCK_TYPES = [...TRUCK_CITY_TYPES, ...TRUCK_OS_TYPES];
const STATUS_COLORS: Record<string, string> = { completed: '#10B981', cancelled: '#EF4444', in_progress: '#3B82F6', accepted: '#F59E0B' };
const VEHICLE_LABEL: Record<string, string> = {
  truck_city_tata_ace: 'Tata Ace', truck_city_14ft: '14ft City', truck_city_open: 'Open Body', truck_city_container: 'Container',
  truck_os_14ft: '14ft OS', truck_os_20ft: '20ft OS', truck_os_container: 'Container OS', truck_os_trailer: 'Trailer',
};

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('truck_admin_token') : ''; }
function authHeaders() { return { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' }; }

export default function TruckDriverDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [driver, setDriver] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [dRes, bRes] = await Promise.all([
        fetch(`${API}/gogoo/drivers/${id}`, { headers: authHeaders() }),
        fetch(`${API}/gogoo/bookings?driver_id=${id}`, { headers: authHeaders() }),
      ]);
      const [dData, bData] = await Promise.all([dRes.json(), bRes.json()]);
      setDriver(dData.data || dData);
      const all = Array.isArray(bData) ? bData : bData.data || bData.bookings || [];
      setBookings(all.filter((b: any) => ALL_TRUCK_TYPES.includes(b.service_type?.slug || b.vehicle_type || '') || b.service_type?.category === 'truck'));
    } catch { /**/ } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function toggleBlock() {
    if (!driver) return;
    await fetch(`${API}/gogoo/drivers/${id}/${driver.is_blocked ? 'unblock' : 'block'}`, { method: 'POST', headers: authHeaders() });
    fetchData();
  }

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-40 bg-white rounded-2xl border border-gray-100" /><div className="h-64 bg-white rounded-2xl border border-gray-100" /></div>;
  if (!driver) return <div className="text-center py-20 text-gray-400"><p className="text-xl mb-2">Driver not found</p><button onClick={() => router.back()} className="text-blue-500 text-sm">Go back</button></div>;

  const today = new Date().toDateString();
  const todayRides = bookings.filter(b => b.created_at && new Date(b.created_at).toDateString() === today);
  const completedRides = bookings.filter(b => b.status === 'completed');
  const cityRides = bookings.filter(b => TRUCK_CITY_TYPES.includes(b.service_type?.slug || b.vehicle_type || ''));
  const osRides = bookings.filter(b => TRUCK_OS_TYPES.includes(b.service_type?.slug || b.vehicle_type || ''));
  const totalEarned = completedRides.reduce((s: number, b: any) => s + (b.final_fare || b.estimated_fare || 0), 0);
  const totalKm = completedRides.reduce((s: number, b: any) => s + (b.distance_km || 0), 0);
  const isCity = TRUCK_CITY_TYPES.includes(driver.vehicle_type || '');

  const DOCS = [
    { key: 'aadhaar', label: 'Aadhaar Card' }, { key: 'pan', label: 'PAN Card' },
    { key: 'driving_license', label: 'Driving License' }, { key: 'vehicle_rc', label: 'Vehicle RC' },
    { key: 'insurance', label: 'Insurance' }, { key: 'pollution', label: 'Pollution Cert' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 transition-colors"><ArrowLeft size={20} /></button>
        <div><h1 className="text-2xl font-bold text-gray-900">{driver.name}</h1><p className="text-sm text-gray-500">Truck Driver Profile</p></div>
        <div className="ml-auto flex gap-2">
          <a href={`tel:${driver.phone}`} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors bg-blue-50 text-blue-600"><Phone size={14} /> Call</a>
          <button onClick={toggleBlock} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${driver.is_blocked ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{driver.is_blocked ? 'Unblock Driver' : 'Block Driver'}</button>
        </div>
      </div>

      {/* Profile Card */}
      <div className="rounded-2xl border border-gray-100 shadow-sm p-6 text-white" style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%)' }}>
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center text-3xl font-bold flex-shrink-0">{driver.name?.charAt(0) || '?'}</div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{driver.name}</h2>
            <p className="text-blue-200 text-sm mt-0.5">⭐ {driver.rating?.toFixed(1) || '—'} · {VEHICLE_LABEL[driver.vehicle_type || ''] || driver.vehicle_type || 'Truck Driver'}</p>
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <span className={`text-xs px-3 py-1 rounded-full font-semibold ${isCity ? 'bg-blue-400/30 text-blue-100' : 'bg-purple-400/30 text-purple-100'}`}>{isCity ? '🏙 City Driver' : '🗺 Outstation Driver'}</span>
              <span className="font-mono text-blue-100 text-sm">{driver.vehicle_number || '—'}</span>
              {driver.is_blocked && <span className="text-xs px-2 py-0.5 bg-red-500/30 text-red-200 rounded-full font-medium">Blocked</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: 'Total Trips', value: driver.total_rides || completedRides.length },
          { label: 'Total KM', value: `${totalKm.toFixed(0)}km` },
          { label: 'Total Earned', value: `₹${totalEarned.toLocaleString()}` },
          { label: 'City Trips', value: cityRides.length },
          { label: 'Outstation', value: osRides.length },
          { label: 'Avg Rating', value: driver.rating?.toFixed(1) || '—' },
        ].map(s => (
          <div key={s.label} className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <p className="text-xs text-blue-700 font-medium">{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: '#3B82F6' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Documents */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Documents</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {DOCS.map(doc => {
            const hasDoc = driver.documents?.[doc.key] || driver[doc.key];
            return (
              <div key={doc.key} className={`rounded-xl p-4 border ${hasDoc ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                <p className="text-sm font-medium text-gray-700">{doc.label}</p>
                <span className={`text-xs mt-1 inline-block ${hasDoc ? 'text-green-600' : 'text-yellow-600'}`}>{hasDoc ? '✅ Uploaded' : '⏳ Pending'}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Financial */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Financials</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Wallet Balance', value: `₹${(driver.wallet_balance || 0).toLocaleString()}`, warn: (driver.wallet_balance || 0) < 0 },
            { label: 'Earnings Today', value: `₹${(driver.earnings_today || 0).toLocaleString()}` },
            { label: 'Total Earned', value: `₹${totalEarned.toLocaleString()}` },
            { label: 'Reg. Fee Paid', value: driver.registration_fee_paid ? '✅ Yes' : '❌ No' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4 border border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`text-xl font-bold mt-1 ${s.warn ? 'text-red-500' : ''}`} style={!s.warn ? { color: '#3B82F6' } : {}}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Truck Ride History */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100"><h3 className="font-semibold text-gray-800">Truck Trip History ({bookings.length})</h3></div>
        {bookings.length === 0 ? <div className="p-12 text-center text-gray-400 text-sm">No truck trips found</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 bg-gray-50">{['ID', 'Type', 'Vehicle', 'Route', 'Distance', 'Fare', 'Driver Earn', 'Status', 'Date'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-50">
                {bookings.slice(0, 50).map((b: any) => {
                  const slug = b.service_type?.slug || b.vehicle_type || '';
                  const isCityB = TRUCK_CITY_TYPES.includes(slug);
                  return (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">#{b.id?.slice(-8).toUpperCase()}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${isCityB ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{isCityB ? '🏙' : '🗺'}</span></td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{VEHICLE_LABEL[slug] || slug}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-32"><p className="truncate">{b.pickup_address?.slice(0, 18) || '—'}</p><p className="text-gray-400 truncate">→ {b.drop_address?.slice(0, 18) || '—'}</p></td>
                      <td className="px-4 py-3 text-gray-600">{b.distance_km ? `${b.distance_km}km` : '—'}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800">₹{(b.final_fare || b.estimated_fare || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-green-600 font-medium">₹{Math.round((b.final_fare || b.estimated_fare || 0) * 0.8).toLocaleString()}</td>
                      <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-full font-medium capitalize" style={{ backgroundColor: `${STATUS_COLORS[b.status || ''] || '#6B7280'}20`, color: STATUS_COLORS[b.status || ''] || '#6B7280' }}>{b.status?.replace('_', ' ') || '—'}</span></td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{b.created_at ? new Date(b.created_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
