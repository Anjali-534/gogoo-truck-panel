"use client";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { RefreshCw } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";
const OLA_KEY = process.env.NEXT_PUBLIC_OLA_MAPS_KEY || "";
const STYLE_URL = `https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json?api_key=${OLA_KEY}`;
const CATEGORY = "truck";
const CATEGORY_COLOR = "#3B82F6";
const CATEGORY_EMOJI = "🚛";
const REFRESH_MS = 10000;
const STALE_MS = 2 * 60 * 1000;
const ANIM_MS = 900;

type Driver = {
  id: string; name: string; vehicle_type: string; vehicle_category: string; vehicle_number: string;
  current_lat: number | null; current_lng: number | null; location_updated_at: string | null;
  rating: number; total_rides: number; active_booking_id: string | null;
};
type LiveBooking = {
  id: string; status: string;
  pickup: { lat: number; lng: number; address: string };
  drop: { lat: number; lng: number; address: string };
  rider_name: string; driver_name: string; service_name: string; category: string;
};

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371, dLat = ((bLat - aLat) * Math.PI) / 180, dLng = ((bLng - aLng) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function emptyFC(): GeoJSON.FeatureCollection { return { type: "FeatureCollection", features: [] }; }

function formatAgo(ms: number): string {
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s ago`;
  return `${Math.round(secs / 60)}m ago`;
}

// Server-side proxy — never exposes OLA_MAPS_KEY to the panel, and caches
// by rounded coordinate so repeat clicks on a driver that hasn't moved
// don't re-hit Ola. Called only on marker click, never pre-fetched.
async function fetchAddress(lat: number, lng: number, authToken: string | null): Promise<string> {
  try {
    const res = await axios.get(`${API}/gogoo/geocode/reverse`, {
      headers: { Authorization: `Bearer ${authToken}` },
      params: { lat, lng },
      timeout: 10000,
    });
    return res.data?.address || "";
  } catch {
    return "";
  }
}

export default function MapComponent() {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const driverPrevCoords = useRef<Record<string, [number, number]>>({});
  const animFrameRef = useRef<number | null>(null);
  // Client-side reverse-geocode cache, keyed by driver id — re-clicking the
  // same marker reuses this unless it's moved more than ~100m.
  const driverGeoCache = useRef<Record<string, { address: string; lat: number; lng: number }>>({});

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [bookings, setBookings] = useState<LiveBooking[]>([]);
  const [selected, setSelected] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("truck_admin_token") : "");

  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapDivRef.current,
      style: STYLE_URL,
      center: [77.2090, 28.6139],
      zoom: 11,
      attributionControl: false,
      transformRequest: (url: string) => {
        if (url.includes("api.olamaps.io") && !url.includes("api_key")) {
          return { url: url + (url.includes("?") ? "&" : "?") + `api_key=${OLA_KEY}` };
        }
        return { url };
      },
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    // Ola's own tile responses ship an empty attribution string, so without this
    // MapLibre GL JS falls back to its library-default placeholder ("MapLibre"
    // linking to maplibre.org) instead of real, ToS-required credit. Ola Maps'
    // Platform Terms (Section 16) require attribution to "Ola Maps" linking to
    // openstreetmap.org/copyright (data is ODbL/OpenStreetMap-derived).
    map.addControl(new maplibregl.AttributionControl({
      compact: true,
      customAttribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">Ola Maps</a>',
    }));

    map.on("load", () => {
      map.addSource("drivers", { type: "geojson", data: emptyFC(), cluster: true, clusterMaxZoom: 14, clusterRadius: 50 });
      map.addLayer({
        id: "driver-clusters", type: "circle", source: "drivers", filter: ["has", "point_count"],
        paint: {
          "circle-color": ["step", ["get", "point_count"], "#FDBA74", 10, "#FB923C", 30, "#FF6B2B"],
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 30, 26],
          "circle-stroke-width": 3, "circle-stroke-color": "#fff",
        },
      });
      map.addLayer({
        id: "driver-cluster-count", type: "symbol", source: "drivers", filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 },
        paint: { "text-color": "#fff" },
      });
      map.addLayer({
        id: "driver-points", type: "circle", source: "drivers", filter: ["!", ["has", "point_count"]],
        paint: { "circle-color": ["get", "color"], "circle-radius": 14, "circle-stroke-width": 3, "circle-stroke-color": "#fff" },
      });
      map.addLayer({
        id: "driver-emoji", type: "symbol", source: "drivers", filter: ["!", ["has", "point_count"]],
        layout: { "text-field": ["get", "emoji"], "text-size": 15, "text-allow-overlap": true },
      });

      map.addSource("bookings", { type: "geojson", data: emptyFC() });
      map.addLayer({
        id: "booking-points", type: "circle", source: "bookings",
        paint: { "circle-color": "#FF9800", "circle-radius": 11, "circle-stroke-width": 2, "circle-stroke-color": "#fff" },
      });
      map.addLayer({
        id: "booking-emoji", type: "symbol", source: "bookings",
        layout: { "text-field": "📍", "text-size": 12, "text-allow-overlap": true },
      });

      map.on("click", "driver-clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["driver-clusters"] });
        const clusterId = features[0]?.properties?.cluster_id;
        const source = map.getSource("drivers") as maplibregl.GeoJSONSource;
        if (clusterId == null) return;
        source.getClusterExpansionZoom(clusterId).then((zoom) => {
          const coords = (features[0].geometry as any).coordinates;
          map.easeTo({ center: coords, zoom });
        }).catch(() => {});
      });
      map.on("click", "driver-points", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as any;
        const [lng, lat] = (f.geometry as any).coordinates as [number, number];
        const popup = new maplibregl.Popup({ offset: 16 }).setLngLat([lng, lat]).setHTML(p.popupHtml).addTo(map);

        const cached = driverGeoCache.current[p.id];
        const moved = cached ? haversineKm(cached.lat, cached.lng, lat, lng) > 0.1 : true;
        if (!cached || moved) {
          fetchAddress(lat, lng, token()).then((address) => {
            driverGeoCache.current[p.id] = { address, lat, lng };
            const el = popup.getElement()?.querySelector(`#geo-${p.id}`);
            if (el) el.textContent = address ? `📍 ${address}` : "📍 Location unavailable";
          });
        }
      });
      map.on("click", "booking-points", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        new maplibregl.Popup({ offset: 14 }).setLngLat((f.geometry as any).coordinates).setHTML((f.properties as any).popupHtml).addTo(map);
      });
      map.on("mouseenter", "driver-points", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "driver-points", () => { map.getCanvas().style.cursor = ""; });
      map.on("mouseenter", "booking-points", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "booking-points", () => { map.getCanvas().style.cursor = ""; });

      setMapLoaded(true);
    });

    mapRef.current = map;
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token()}` };
      const [dRes, bRes] = await Promise.all([
        axios.get(`${API}/gogoo/live/drivers`, { headers, params: { category: CATEGORY } }),
        axios.get(`${API}/gogoo/live/bookings`, { headers, params: { category: CATEGORY } }),
      ]);
      setDrivers(dRes.data || []);
      setBookings(bRes.data?.bookings || []);
      setLastUpdate(new Date());
      setLoading(false);
    } catch {}
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const source = map.getSource("drivers") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    const bookingsById: Record<string, LiveBooking> = {};
    bookings.forEach(b => { bookingsById[b.id] = b; });

    const visible = drivers.filter(d => d.current_lat != null && d.current_lng != null);
    const now = Date.now();
    const toCoords: Record<string, [number, number]> = {};
    const propsById: Record<string, any> = {};

    visible.forEach(d => {
      const lng = d.current_lng as number, lat = d.current_lat as number;
      toCoords[d.id] = [lng, lat];
      const stale = d.location_updated_at ? (now - new Date(d.location_updated_at).getTime()) > STALE_MS : true;
      const color = stale ? "#9CA3AF" : CATEGORY_COLOR;

      let etaLine = "";
      if (d.active_booking_id && bookingsById[d.active_booking_id]) {
        const pk = bookingsById[d.active_booking_id].pickup;
        const km = haversineKm(lat, lng, pk.lat, pk.lng);
        etaLine = `<div style="color:#F97316;font-size:11px;margin-top:4px">📍 ~${km < 1 ? Math.round(km * 1000) + " m" : km.toFixed(1) + " km"} to pickup</div>`;
      }

      const cachedGeo = driverGeoCache.current[d.id];
      const hasFreshGeo = cachedGeo && haversineKm(cachedGeo.lat, cachedGeo.lng, lat, lng) <= 0.1;
      const geoLine = hasFreshGeo
        ? `📍 ${cachedGeo!.address || "Location unavailable"}`
        : "📍 Locating…";
      const updatedAgo = d.location_updated_at
        ? `Updated ${formatAgo(now - new Date(d.location_updated_at).getTime())}${stale ? " (STALE)" : ""}`
        : "Updated —";

      const popupHtml = `
        <div style="font-family:system-ui;min-width:170px;padding:4px">
          <div style="font-weight:800;font-size:14px;margin-bottom:4px">${CATEGORY_EMOJI} ${d.name}</div>
          <div style="color:#6B7280;font-size:12px">${d.vehicle_number || "—"} · ${(d.vehicle_type || "").replace(/_/g, " ")}</div>
          <div style="margin-top:6px;display:flex;align-items:center;gap:6px">
            <span style="background:${stale ? "#F3F4F6" : "#DCFCE7"};color:${stale ? "#6B7280" : "#16A34A"};padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">${stale ? "STALE GPS" : "LIVE"}</span>
            <span style="color:#9CA3AF;font-size:12px">⭐ ${Number(d.rating || 0).toFixed(1)}</span>
          </div>
          <div style="color:#6B7280;font-size:11px;margin-top:4px">${d.total_rides} rides</div>
          ${etaLine}
          <div id="geo-${d.id}" style="color:#374151;font-size:12px;margin-top:6px;line-height:1.4">${geoLine}</div>
          <div style="color:#9CA3AF;font-size:10px;margin-top:3px">
            ${lat.toFixed(4)}, ${lng.toFixed(4)} ·
            <a href="#" onclick="navigator.clipboard.writeText('${lat.toFixed(6)},${lng.toFixed(6)}');this.textContent='Copied';setTimeout(()=>{this.textContent='Copy'},1200);return false;" style="color:#9CA3AF;text-decoration:underline;cursor:pointer">Copy</a> ·
            <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener noreferrer" style="color:#FF6B2B;text-decoration:underline">Open in Maps</a>
          </div>
          <div style="color:#9CA3AF;font-size:10px;margin-top:2px">${updatedAgo}</div>
        </div>`;
      propsById[d.id] = { id: d.id, color, emoji: CATEGORY_EMOJI, popupHtml };
    });

    const ids = Object.keys(toCoords);
    const buildFC = (t: number): GeoJSON.FeatureCollection => ({
      type: "FeatureCollection",
      features: ids.map(id => {
        const from = driverPrevCoords.current[id] || toCoords[id];
        const to = toCoords[id];
        const coord: [number, number] = t >= 1 ? to : [lerp(from[0], to[0], t), lerp(from[1], to[1], t)];
        return { type: "Feature", geometry: { type: "Point", coordinates: coord }, properties: propsById[id] };
      }),
    });

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const start = performance.now();
    const step = (now2: number) => {
      const t = Math.min(1, (now2 - start) / ANIM_MS);
      source.setData(buildFC(t));
      if (t < 1) { animFrameRef.current = requestAnimationFrame(step); }
      else { driverPrevCoords.current = toCoords; }
    };
    animFrameRef.current = requestAnimationFrame(step);
  }, [drivers, bookings, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const source = map.getSource("bookings") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    const fc: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: bookings.map(b => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [b.pickup.lng, b.pickup.lat] },
        properties: {
          popupHtml: `
            <div style="font-family:system-ui;min-width:170px;padding:4px">
              <div style="font-weight:800;font-size:13px;margin-bottom:4px">📍 ${b.rider_name || "Rider"}</div>
              <div style="color:#6B7280;font-size:12px">${b.service_name || CATEGORY} · ${b.status.replace(/_/g, " ")}</div>
              <div style="color:#6B7280;font-size:11px;margin-top:4px">${b.pickup.address || ""}</div>
              ${b.driver_name ? `<div style="color:#9CA3AF;font-size:11px;margin-top:4px">Driver: ${b.driver_name}</div>` : ""}
            </div>`,
        },
      })),
    };
    source.setData(fc);
  }, [bookings, mapLoaded]);

  const panTo = (d: Driver) => {
    if (d.current_lat == null || !mapRef.current) return;
    mapRef.current.easeTo({ center: [d.current_lng!, d.current_lat], zoom: 15, duration: 800 });
    setSelected(d);
  };

  const online = drivers.filter(d => d.current_lat != null);
  const idle = online.filter(d => !d.active_booking_id);
  const searching = bookings.filter(b => b.status === "searching");
  const activeRide = bookings.filter(b => b.status !== "searching");

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: "Online Drivers", value: online.length, color: "text-green-600" },
          { label: "Idle", value: idle.length, color: "text-gray-500" },
          { label: "Active Rides", value: activeRide.length, color: "text-orange-600" },
          { label: "Searching", value: searching.length, color: "text-blue-600" },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
            <p className={`text-2xl font-extrabold ${c.color}`}>{c.value}</p>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3 mb-5 flex items-center justify-end gap-3">
        <button onClick={fetchData} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-orange-500 transition font-medium">
          <RefreshCw size={13} />Refresh
        </button>
        {lastUpdate && (
          <p className="text-xs text-gray-400">
            Updated {lastUpdate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        )}
      </div>

      <div className="flex gap-5">
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden relative"
          style={{ height: "calc(100vh - 310px)", minHeight: 500 }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
              <div className="text-center">
                <p className="text-5xl mb-3">🗺</p>
                <p className="text-gray-400 font-medium">Loading map…</p>
              </div>
            </div>
          )}
          <div ref={mapDivRef} style={{ width: "100%", height: "100%" }} />
        </div>

        <div className="flex-shrink-0 flex flex-col gap-3 overflow-y-auto" style={{ width: 260, maxHeight: "calc(100vh - 310px)" }}>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-shrink-0">
            <div className="px-4 py-3 border-b border-gray-100 bg-green-50">
              <p className="text-xs font-bold text-green-700 uppercase tracking-wider">🟢 Online ({online.length})</p>
            </div>
            {online.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-3xl mb-2">🚗</p>
                <p className="text-gray-400 text-sm">No drivers online</p>
              </div>
            ) : online.map(d => (
              <div key={d.id} onClick={() => panTo(d)}
                className={`px-4 py-3 border-b border-gray-50 cursor-pointer transition ${
                  selected?.id === d.id ? "bg-orange-50 border-l-4 border-l-orange-400 pl-3" : "hover:bg-gray-50"
                }`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: CATEGORY_COLOR }}>
                    {d.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 font-semibold text-sm truncate">{d.name}</p>
                    <p className="text-gray-400 text-xs">{d.vehicle_number || "—"}</p>
                  </div>
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${d.active_booking_id ? "bg-orange-500" : "bg-green-500"}`} />
                </div>
                <p className="text-xs mt-1 ml-12">
                  {d.active_booking_id ? <span className="text-orange-500">🚕 On a ride</span> : <span className="text-green-600">📍 Idle</span>}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
