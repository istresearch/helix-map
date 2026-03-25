import type { MapFeatureCollection } from '@/types/map';

/**
 * Sample GeoJSON features demonstrating all supported feature types:
 * - Points with custom icons and image popups
 * - Polygons with styled fills (e.g., park boundaries)
 * - LineStrings
 */
export const londonLandmarks: MapFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [-0.1276, 51.5074],
      },
      properties: {
        title: 'London',
        description: 'Capital of the United Kingdom',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/London_Skyline_%28125508655%29.jpeg/320px-London_Skyline_%28125508655%29.jpeg',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [-0.1246, 51.5007],
      },
      properties: {
        title: 'Big Ben',
        description: 'The iconic clock tower at the Palace of Westminster',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Clock_Tower_-_Palace_of_Westminster%2C_London_-_May_2007.jpg/220px-Clock_Tower_-_Palace_of_Westminster%2C_London_-_May_2007.jpg',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [-0.0762, 51.5081],
      },
      properties: {
        title: 'Tower of London',
        description: 'Historic castle on the north bank of the Thames',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Tower_of_London_viewed_from_the_River_Thames.jpg/320px-Tower_of_London_viewed_from_the_River_Thames.jpg',
      },
    },
  ],
};

/**
 * Approximate boundary of Hyde Park, London — demonstrates polygon rendering.
 */
export const hydeParkBoundary: MapFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-0.1871, 51.5087],
            [-0.1871, 51.5126],
            [-0.1724, 51.5149],
            [-0.1594, 51.5131],
            [-0.1530, 51.5069],
            [-0.1594, 51.5054],
            [-0.1724, 51.5054],
            [-0.1871, 51.5087],
          ],
        ],
      },
      properties: {
        title: 'Hyde Park',
        description: 'One of London\'s eight Royal Parks, covering 350 acres',
        color: '#2d8a4e',
        fillOpacity: 0.3,
        weight: 2,
      },
    },
  ],
};

/**
 * A walking route along the Thames — demonstrates LineString rendering.
 */
export const thamesWalk: MapFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-0.1246, 51.5007],
          [-0.1190, 51.5035],
          [-0.1100, 51.5060],
          [-0.1020, 51.5065],
          [-0.0900, 51.5070],
          [-0.0762, 51.5081],
        ],
      },
      properties: {
        title: 'Thames Path Walk',
        description: 'Westminster to Tower of London along the Thames',
        color: '#2563eb',
        weight: 4,
      },
    },
  ],
};
