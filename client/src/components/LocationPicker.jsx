import { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix default marker icon issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom red pin icon
const pinIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Reverse geocode using Nominatim (free, no API key)
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    return data.display_name || '';
  } catch {
    return '';
  }
}

// Component that handles map click events
function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Component to recenter map
function RecenterMap({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], Math.max(map.getZoom(), 15));
    }
  }, [lat, lng, map]);
  return null;
}

// Draggable marker component
function DraggableMarker({ position, onDragEnd }) {
  const markerRef = useRef(null);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker) {
          const { lat, lng } = marker.getLatLng();
          onDragEnd(lat, lng);
        }
      },
    }),
    [onDragEnd]
  );

  return (
    <Marker
      draggable
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
      icon={pinIcon}
    />
  );
}

export default function LocationPicker({ lat, lng, locationText, onChange }) {
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const defaultCenter = [20.5937, 78.9629]; // India center
  const hasPin = lat && lng;
  const center = hasPin ? [parseFloat(lat), parseFloat(lng)] : defaultCenter;
  const zoom = hasPin ? 15 : 5;

  const handleLocationSelect = async (newLat, newLng) => {
    const roundedLat = parseFloat(newLat.toFixed(6));
    const roundedLng = parseFloat(newLng.toFixed(6));
    onChange({ location_lat: roundedLat, location_lng: roundedLng, location_text: 'Fetching address...' });
    const address = await reverseGeocode(roundedLat, roundedLng);
    onChange({ location_lat: roundedLat, location_lng: roundedLng, location_text: address || `${roundedLat}, ${roundedLng}` });
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    setLoadingGeo(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await handleLocationSelect(pos.coords.latitude, pos.coords.longitude);
        setLoadingGeo(false);
      },
      () => {
        alert('Unable to retrieve your location. Please allow location access.');
        setLoadingGeo(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSearch = async (e) => {
    console.log('LocationPicker: Search form submitted');
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!searchQuery.trim()) return;
    console.log('LocationPicker: Searching for:', searchQuery);
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      if (data.length > 0) {
        const { lat: sLat, lon: sLng, display_name } = data[0];
        const roundedLat = parseFloat(parseFloat(sLat).toFixed(6));
        const roundedLng = parseFloat(parseFloat(sLng).toFixed(6));
        onChange({ location_lat: roundedLat, location_lng: roundedLng, location_text: display_name });
        console.log('LocationPicker: Search successful', { roundedLat, roundedLng, display_name });
      } else {
        alert('Location not found. Try a different search term.');
      }
    } catch {
      alert('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch(e);
    }
  };

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search for a place..."
          className="input-field flex-1"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          className="btn-primary px-3 py-2 text-sm disabled:opacity-50"
        >
          {searching ? '...' : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>}
        </button>
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={loadingGeo}
          className="px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
          title="Use my current location"
        >
          {loadingGeo ? '...' : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>}
        </button>
      </div>

      {/* Map */}
      <div className="rounded-lg overflow-hidden border border-white/[0.08]" style={{ height: '300px' }}>
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onLocationSelect={handleLocationSelect} />
          {hasPin && (
            <>
              <DraggableMarker
                position={[parseFloat(lat), parseFloat(lng)]}
                onDragEnd={handleLocationSelect}
              />
              <RecenterMap lat={parseFloat(lat)} lng={parseFloat(lng)} />
            </>
          )}
        </MapContainer>
      </div>

      <p className="text-xs text-slate-500">
        Click on the map to drop a pin, drag the pin to adjust, or use the search / GPS buttons above.
      </p>

      {/* Selected location display */}
      {hasPin && (
        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="flex items-start gap-2">
            <span className="text-lg mt-0.5">📌</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-200 break-words">{locationText || 'Loading address...'}</p>
              <p className="text-xs text-slate-500 mt-1">
                {lat}, {lng}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChange({ location_lat: '', location_lng: '', location_text: '' })}
              className="text-red-400 hover:text-red-300 text-sm px-2 py-1"
              title="Remove pin"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
