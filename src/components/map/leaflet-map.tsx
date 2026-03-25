import { cn } from '@/lib/utils';
import type {
  MapConfig,
  MapFeatureCollection,
  MapFeatureProperties,
} from '@/types/map';
import { DEFAULT_MAP_CONFIG } from '@/types/map';
import L from 'leaflet';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';

// Fix Leaflet's default icon path resolution in bundled environments
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

export interface LeafletMapHandle {
  addFeatures: (fc: MapFeatureCollection) => void;
  clearFeatures: () => void;
  fitBounds: (bounds: [[number, number], [number, number]]) => void;
  setView: (center: [number, number], zoom: number) => void;
}

interface LeafletMapProps {
  ref?: React.Ref<LeafletMapHandle>;
  config?: Partial<MapConfig>;
  className?: string;
  initialData?: MapFeatureCollection;
}

function buildPopupContent(props: MapFeatureProperties): string {
  const parts: string[] = [];
  if (props.title) {
    parts.push(`<strong>${props.title}</strong>`);
  }
  if (props.description) {
    parts.push(`<p>${props.description}</p>`);
  }
  if (props.image) {
    parts.push(
      `<img src="${props.image}" alt="${props.title ?? 'Feature image'}" loading="lazy" />`,
    );
  }
  return parts.join('');
}

export function LeafletMap({
  ref,
  config: configOverrides,
  className,
  initialData,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);

  const config = { ...DEFAULT_MAP_CONFIG, ...configOverrides };

  const addFeatures = useCallback((fc: MapFeatureCollection) => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;

    const geoJsonLayer = L.geoJSON(fc, {
      pointToLayer: (_feature, latlng) => {
        const props = _feature.properties as MapFeatureProperties;
        if (props?.icon) {
          const size = props.iconSize ?? [25, 41];
          const customIcon = L.icon({
            iconUrl: props.icon,
            iconSize: size,
            iconAnchor: [size[0] / 2, size[1]],
            popupAnchor: [0, -size[1]],
          });
          return L.marker(latlng, { icon: customIcon });
        }
        return L.marker(latlng);
      },
      style: (feature) => {
        const props = (feature?.properties ?? {}) as MapFeatureProperties;
        return {
          color: props.color ?? '#3388ff',
          weight: props.weight ?? 2,
          fillOpacity: props.fillOpacity ?? 0.2,
        };
      },
      onEachFeature: (feature, layer) => {
        const props = (feature.properties ?? {}) as MapFeatureProperties;
        const content = buildPopupContent(props);
        if (content) {
          layer.bindPopup(content);
        }
      },
    });

    geoJsonLayer.addTo(layers);

    // Auto-fit to the new features
    const bounds = geoJsonLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, []);

  const clearFeatures = useCallback(() => {
    layersRef.current?.clearLayers();
  }, []);

  const fitBounds = useCallback(
    (bounds: [[number, number], [number, number]]) => {
      mapRef.current?.fitBounds(bounds, { padding: [40, 40] });
    },
    [],
  );

  const setView = useCallback((center: [number, number], zoom: number) => {
    mapRef.current?.setView(center, zoom);
  }, []);

  useImperativeHandle(ref, () => ({
    addFeatures,
    clearFeatures,
    fitBounds,
    setView,
  }), [addFeatures, clearFeatures, fitBounds, setView]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: config.center,
      zoom: config.zoom,
      minZoom: config.minZoom,
      maxZoom: config.maxZoom,
    });

    L.tileLayer(config.tileUrl!, {
      attribution: config.tileAttribution,
    }).addTo(map);

    const layers = L.layerGroup().addTo(map);

    mapRef.current = map;
    layersRef.current = layers;

    if (initialData) {
      addFeatures(initialData);
    }

    return () => {
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn('h-full w-full', className)}
    />
  );
}
