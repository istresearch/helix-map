import type { Feature, FeatureCollection, Geometry } from 'geojson';

/**
 * Extended GeoJSON properties for map features.
 * These properties control how features are rendered on the map.
 */
export interface MapFeatureProperties {
  [key: string]: unknown;
  /** Display title shown in popup header */
  title?: string;
  /** Description text shown in popup body */
  description?: string;
  /** URL of an image to show in the popup on click */
  image?: string;
  /** URL or name of a custom icon for point features */
  icon?: string;
  /** Icon size in pixels [width, height] */
  iconSize?: [number, number];
  /** Fill color for polygons or circle color for points */
  color?: string;
  /** Fill opacity for polygons (0-1) */
  fillOpacity?: number;
  /** Stroke weight in pixels */
  weight?: number;
}

export type MapFeature = Feature<Geometry, MapFeatureProperties>;
export type MapFeatureCollection = FeatureCollection<Geometry, MapFeatureProperties>;

/**
 * Commands that can be sent to the map via postMessage.
 */
export type MapCommand =
  | { type: 'addFeatures'; payload: MapFeatureCollection }
  | { type: 'clearFeatures' }
  | { type: 'fitBounds'; payload: { bounds: [[number, number], [number, number]] } }
  | { type: 'setView'; payload: { center: [number, number]; zoom: number } }
  | { type: 'removeLayer'; payload: { id: string } };

/**
 * Configuration for the map component.
 */
export interface MapConfig {
  center: [number, number];
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  tileUrl?: string;
  tileAttribution?: string;
}

export const DEFAULT_MAP_CONFIG: MapConfig = {
  center: [20, 0],
  zoom: 2,
  minZoom: 2,
  maxZoom: 18,
  tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileAttribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};
