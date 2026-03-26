import { LeafletMap, type LeafletMapHandle } from '@/components/map';
import {
  hydeParkBoundary,
  londonLandmarks,
  thamesWalk,
} from '@/data/sample-features';
import { useMapMessages } from '@/hooks';
import { useMcpContext } from '@/mcp-app';
import type { MapFeatureCollection } from '@/types/map';
import { MapPin, Route, Shapes, Trash2 } from 'lucide-react';
import { useCallback, useRef, useState, useEffect } from 'react';

function App() {
  const mapRef = useRef<LeafletMapHandle>(null);
  const [mapHandle, setMapHandle] = useState<LeafletMapHandle | null>(null);
  const {
    isMcpApp,
    location: initialLocation,
    mapFeatures: initialMapFeatures,
    clearExisting,
  } = useMcpContext();
  const [geocodeQuery, setGeocodeQuery] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Listen for postMessage commands from parent iframe
  useMapMessages(mapHandle);

  // In MCP mode, auto-geocode the provided location on mount
  useEffect(() => {
    if (!isMcpApp || !mapRef.current) return;

    if (clearExisting) {
      mapRef.current.clearFeatures();
    }

    if (initialMapFeatures?.features?.length) {
      mapRef.current.addFeatures(initialMapFeatures);
      return;
    }

    if (initialLocation) {
      setGeocodeQuery(initialLocation);
      performGeocode(initialLocation);
    }
  }, [isMcpApp, initialLocation, initialMapFeatures, clearExisting]);

  // Capture the ref once the map mounts
  const handleMapRef = useCallback((node: LeafletMapHandle | null) => {
    (mapRef as React.MutableRefObject<LeafletMapHandle | null>).current = node;
    setMapHandle(node);
  }, []);

  const handleAddLandmarks = () => {
    mapRef.current?.addFeatures(londonLandmarks);
  };

  const handleAddPark = () => {
    mapRef.current?.addFeatures(hydeParkBoundary);
  };

  const handleAddRoute = () => {
    mapRef.current?.addFeatures(thamesWalk);
  };

  const handleClear = () => {
    mapRef.current?.clearFeatures();
  };

  const performGeocode = async (query: string) => {
    if (!query.trim()) return;
    setIsGeocoding(true);

    try {
      const params = new URLSearchParams({
        q: query,
        format: 'geojson',
        polygon_geojson: '1',
        limit: '1',
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        {
          headers: { 'User-Agent': 'helix-map-demo/1.0' },
        },
      );

      const data = (await response.json()) as MapFeatureCollection;

      if (data.features.length > 0) {
        // Enrich with a title from the display_name
        const feature = data.features[0];
        const displayName =
          (feature.properties?.['display_name'] as string) ?? query;
        feature.properties = {
          ...feature.properties,
          title: displayName.split(',')[0],
          description: displayName,
          color: '#e11d48',
        };

        mapRef.current?.addFeatures({
          type: 'FeatureCollection',
          features: [feature],
        });
      }
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleGeocode = async () => {
    await performGeocode(geocodeQuery);
  };

  return (
    <div className='flex h-screen w-screen flex-col'>
      {/* Toolbar - only show in standalone mode */}
      {!isMcpApp && (
        <div className='flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--card)] px-4 py-2'>
          <span className='mr-2 text-sm font-medium text-[var(--muted-foreground)]'>
            Demo Controls:
          </span>

          <button
            onClick={handleAddLandmarks}
            className='inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] hover:opacity-90'
          >
            <MapPin className='size-3.5' />
            Landmarks
          </button>

          <button
            onClick={handleAddPark}
            className='inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] hover:opacity-90'
          >
            <Shapes className='size-3.5' />
            Hyde Park
          </button>

          <button
            onClick={handleAddRoute}
            className='inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] hover:opacity-90'
          >
            <Route className='size-3.5' />
            Thames Walk
          </button>

          <button
            onClick={handleClear}
            className='inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)]'
          >
            <Trash2 className='size-3.5' />
            Clear
          </button>

          <div className='mx-2 h-6 w-px bg-[var(--border)]' />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleGeocode();
            }}
            className='flex items-center gap-2'
          >
            <input
              type='text'
              value={geocodeQuery}
              onChange={(e) => setGeocodeQuery(e.target.value)}
              placeholder='Geocode: "Central Park" or "Paris"'
              className='h-8 w-64 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-xs placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]'
            />
            <button
              type='submit'
              disabled={isGeocoding}
              className='inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50'
            >
              {isGeocoding ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>
      )}

      {/* Map */}
      <div className='flex-1'>
        <LeafletMap ref={handleMapRef} enableDraw={!isMcpApp} />
      </div>
    </div>
  );
}

export default App;
