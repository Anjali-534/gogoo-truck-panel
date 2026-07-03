"use client";
import dynamic from "next/dynamic";

const MapComponent = dynamic(() => import("./MapComponent"), { ssr: false, loading: () => (
  <div className="flex items-center justify-center h-96">
    <div className="text-center">
      <div className="text-5xl mb-3">🗺</div>
      <p className="text-gray-500 font-medium">Loading map...</p>
    </div>
  </div>
)});

export default function TruckLiveMapPage() {
  return <MapComponent />;
}
