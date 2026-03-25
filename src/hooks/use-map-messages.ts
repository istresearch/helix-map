import type { LeafletMapHandle } from '@/components/map';
import type { MapCommand, MapFeatureCollection } from '@/types/map';
import { useEffect } from 'react';

/**
 * Hook that listens for postMessage commands from a parent window
 * and dispatches them to the map component via its imperative handle.
 *
 * Supported message types:
 * - addFeatures: Add a GeoJSON FeatureCollection to the map
 * - clearFeatures: Remove all features from the map
 * - fitBounds: Fit the map view to the given bounds
 * - setView: Set the map center and zoom level
 * - removeLayer: Remove a specific layer by ID (reserved for future use)
 */
export function useMapMessages(
  mapHandle: LeafletMapHandle | null,
  allowedOrigins?: string[],
) {
  useEffect(() => {
    if (!mapHandle) return;

    function handleMessage(event: MessageEvent<MapCommand>) {
      // Validate origin if restrictions are specified
      if (allowedOrigins && allowedOrigins.length > 0) {
        if (!allowedOrigins.includes(event.origin)) return;
      }

      const command = event.data;
      if (!command || typeof command.type !== 'string') return;

      switch (command.type) {
        case 'addFeatures':
          mapHandle!.addFeatures(command.payload as MapFeatureCollection);
          break;
        case 'clearFeatures':
          mapHandle!.clearFeatures();
          break;
        case 'fitBounds':
          mapHandle!.fitBounds(command.payload.bounds);
          break;
        case 'setView':
          mapHandle!.setView(command.payload.center, command.payload.zoom);
          break;
        case 'removeLayer':
          // Reserved for future use
          break;
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [mapHandle, allowedOrigins]);
}
