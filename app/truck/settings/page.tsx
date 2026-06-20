'use client';
import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';

const CITY_VEHICLES = [
  { slug: 'truck_city_tata_ace', label: 'Tata Ace', capacity: '500kg' },
  { slug: 'truck_city_14ft', label: '14ft Truck', capacity: '3 tons' },
  { slug: 'truck_city_open', label: 'Open Body', capacity: '5 tons' },
  { slug: 'truck_city_container', label: 'Container', capacity: '8 tons' },
];
const OS_VEHICLES = [
  { slug: 'truck_os_14ft', label: '14ft OS', capacity: '3 tons' },
  { slug: 'truck_os_20ft', label: '20ft OS', capacity: '5 tons' },
  { slug: 'truck_os_container', label: 'Container OS', capacity: '8 tons' },
  { slug: 'truck_os_trailer', label: 'Trailer', capacity: '20 tons' },
];

const DEFAULT_CITY_PRICING: Record<string, { base: number; per_km: number; min_km: number }> = {
  truck_city_tata_ace: { base: 299, per_km: 18, min_km: 5 },
  truck_city_14ft: { base: 499, per_km: 28, min_km: 5 },
  truck_city_open: { base: 699, per_km: 35, min_km: 5 },
  truck_city_container: { base: 899, per_km: 42, min_km: 5 },
};
const DEFAULT_OS_PRICING: Record<string, { base: number; per_km: number; min_km: number }> = {
  truck_os_14ft: { base: 3000, per_km: 45, min_km: 100 },
  truck_os_20ft: { base: 4500, per_km: 55, min_km: 100 },
  truck_os_container: { base: 6000, per_km: 65, min_km: 100 },
  truck_os_trailer: { base: 10000, per_km: 85, min_km: 200 },
};

type PricingMap = Record<string, { base: number; per_km: number; min_km: number }>;

export default function TruckSettingsPage() {
  const [cityPricing, setCityPricing] = useState<PricingMap>({ ...DEFAULT_CITY_PRICING });
  const [osPricing, setOsPricing] = useState<PricingMap>({ ...DEFAULT_OS_PRICING });
  const [logistics, setLogistics] = useState({ maxDistanceCity: 80, maxDistanceOS: 2000, helpingHandsAddon: 200, floorAddon: 150, waitingCharge: 2, prohibitedGoods: 'Flammables, Explosives, Chemicals, Live Animals', commissionPct: 20 });
  const [notifications, setNotifications] = useState({ bookingAlerts: true, driverAlerts: true, lowWallet: true, lowWalletThreshold: -500 });
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('city');

  useEffect(() => {
    try {
      const s = localStorage.getItem('truck_settings');
      if (s) {
        const p = JSON.parse(s);
        if (p.cityPricing) setCityPricing(p.cityPricing);
        if (p.osPricing) setOsPricing(p.osPricing);
        if (p.logistics) setLogistics(p.logistics);
        if (p.notifications) setNotifications(p.notifications);
      }
    } catch { /**/ }
  }, []);

  function handleSave() {
    localStorage.setItem('truck_settings', JSON.stringify({ cityPricing, osPricing, logistics, notifications }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function updateCityPrice(slug: string, field: string, value: number) {
    setCityPricing(prev => ({ ...prev, [slug]: { ...prev[slug], [field]: value } }));
  }
  function updateOsPrice(slug: string, field: string, value: number) {
    setOsPricing(prev => ({ ...prev, [slug]: { ...prev[slug], [field]: value } }));
  }

  const TABS = [
    { key: 'city', label: 'City Pricing' },
    { key: 'outstation', label: 'Outstation Pricing' },
    { key: 'logistics', label: 'Logistics Config' },
    { key: 'notifications', label: 'Notifications' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Settings</h1><p className="text-sm text-gray-500 mt-0.5">Truck panel configuration</p></div>
        <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors" style={{ backgroundColor: saved ? '#10B981' : '#3B82F6' }}>
          <Save size={16} />{saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === t.key ? 'text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            style={activeTab === t.key ? { backgroundColor: '#3B82F6' } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* City Pricing */}
      {activeTab === 'city' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Within-city delivery pricing for each vehicle type</p>
          {CITY_VEHICLES.map(v => (
            <div key={v.slug} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="font-semibold text-gray-800">{v.label}</span>
                <span className="text-xs px-2 py-0.5 rounded-lg bg-blue-50 text-blue-600 font-medium">{v.capacity}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { field: 'base', label: 'Base Fare (₹)', help: 'Starting fare for any booking' },
                  { field: 'per_km', label: 'Per KM Rate (₹)', help: 'Charged per km after minimum' },
                  { field: 'min_km', label: 'Min Distance (km)', help: 'Minimum billable distance' },
                ].map(f => (
                  <div key={f.field}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">{f.label}</label>
                    <input type="number" value={cityPricing[v.slug]?.[f.field as keyof typeof DEFAULT_CITY_PRICING['truck_city_tata_ace']] ?? 0}
                      onChange={e => updateCityPrice(v.slug, f.field, Number(e.target.value))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
                    <p className="text-xs text-gray-400 mt-1">{f.help}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-blue-600 mt-3 font-medium bg-blue-50 px-3 py-2 rounded-lg">
                Sample: 10km trip = ₹{cityPricing[v.slug]?.base + (Math.max(0, 10 - cityPricing[v.slug]?.min_km) * cityPricing[v.slug]?.per_km) || 0}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* OS Pricing */}
      {activeTab === 'outstation' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Intercity & long-haul pricing for outstation vehicle types</p>
          {OS_VEHICLES.map(v => (
            <div key={v.slug} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6" style={{ borderLeft: '4px solid #8B5CF6' }}>
              <div className="flex items-center gap-3 mb-4">
                <span className="font-semibold text-gray-800">{v.label}</span>
                <span className="text-xs px-2 py-0.5 rounded-lg bg-purple-50 text-purple-600 font-medium">{v.capacity}</span>
                <span className="text-xs px-2 py-0.5 rounded-lg bg-purple-100 text-purple-700 font-semibold">Outstation</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { field: 'base', label: 'Base Fare (₹)', help: 'Fixed base charge for trip' },
                  { field: 'per_km', label: 'Per KM Rate (₹)', help: 'Rate per km beyond min' },
                  { field: 'min_km', label: 'Min Distance (km)', help: 'Minimum trip distance' },
                ].map(f => (
                  <div key={f.field}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">{f.label}</label>
                    <input type="number" value={osPricing[v.slug]?.[f.field as keyof typeof DEFAULT_OS_PRICING['truck_os_14ft']] ?? 0}
                      onChange={e => updateOsPrice(v.slug, f.field, Number(e.target.value))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-400" />
                    <p className="text-xs text-gray-400 mt-1">{f.help}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs font-medium mt-3 px-3 py-2 rounded-lg" style={{ color: '#8B5CF6', backgroundColor: '#F5F3FF' }}>
                Sample: 300km trip = ₹{osPricing[v.slug]?.base + (Math.max(0, 300 - osPricing[v.slug]?.min_km) * osPricing[v.slug]?.per_km) || 0}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Logistics Config */}
      {activeTab === 'logistics' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Distance Limits</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'maxDistanceCity', label: 'Max City Distance (km)', help: 'Max km allowed for city deliveries' },
                { key: 'maxDistanceOS', label: 'Max Outstation Distance (km)', help: 'Max km for outstation bookings' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{f.label}</label>
                  <input type="number" value={logistics[f.key as keyof typeof logistics] as number}
                    onChange={e => setLogistics(prev => ({ ...prev, [f.key]: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
                  <p className="text-xs text-gray-400 mt-1">{f.help}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Add-on Charges</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { key: 'helpingHandsAddon', label: 'Helping Hands Add-on (₹)', help: 'Extra charge for loading/unloading help' },
                { key: 'floorAddon', label: 'Per Floor Add-on (₹)', help: 'Charge per floor above ground floor' },
                { key: 'waitingCharge', label: 'Waiting Charge (₹/min)', help: 'Charge per minute beyond free wait time' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{f.label}</label>
                  <input type="number" value={logistics[f.key as keyof typeof logistics] as number}
                    onChange={e => setLogistics(prev => ({ ...prev, [f.key]: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
                  <p className="text-xs text-gray-400 mt-1">{f.help}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Commission & Prohibited Goods</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Platform Commission (%)</label>
                <input type="number" value={logistics.commissionPct}
                  onChange={e => setLogistics(prev => ({ ...prev, commissionPct: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
                <p className="text-xs text-gray-400 mt-1">Driver receives {100 - logistics.commissionPct}% of fare</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Prohibited Goods</label>
                <textarea value={logistics.prohibitedGoods}
                  onChange={e => setLogistics(prev => ({ ...prev, prohibitedGoods: e.target.value }))} rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 resize-none" />
                <p className="text-xs text-gray-400 mt-1">Comma-separated list of prohibited item categories</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notifications */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h3 className="font-semibold text-gray-800 mb-2">Alert Settings</h3>
          {[
            { key: 'bookingAlerts', label: 'New Booking Alerts', desc: 'Get alerted when new truck bookings come in' },
            { key: 'driverAlerts', label: 'Driver Status Alerts', desc: 'Notify when drivers go online/offline' },
            { key: 'lowWallet', label: 'Low Wallet Alerts', desc: 'Alert when driver wallet drops below threshold' },
          ].map(n => (
            <div key={n.key} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
              <div><p className="text-sm font-medium text-gray-700">{n.label}</p><p className="text-xs text-gray-400 mt-0.5">{n.desc}</p></div>
              <button onClick={() => setNotifications(prev => ({ ...prev, [n.key]: !prev[n.key as keyof typeof notifications] }))}
                className={`relative w-11 h-6 rounded-full transition-colors ${notifications[n.key as keyof typeof notifications] ? '' : 'bg-gray-200'}`}
                style={notifications[n.key as keyof typeof notifications] ? { backgroundColor: '#3B82F6' } : {}}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifications[n.key as keyof typeof notifications] ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}
          <div className="mt-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Low Wallet Threshold (₹)</label>
            <input type="number" value={notifications.lowWalletThreshold}
              onChange={e => setNotifications(prev => ({ ...prev, lowWalletThreshold: Number(e.target.value) }))}
              className="w-48 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            <p className="text-xs text-gray-400 mt-1">Alert when any driver wallet goes below this amount</p>
          </div>
        </div>
      )}
    </div>
  );
}
