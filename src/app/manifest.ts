import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Annam', short_name: 'Annam', description: 'Nutrition follow-up for clinics and labs',
    start_url: '/', display: 'standalone', background_color: '#F5F8F3', theme_color: '#183D2B',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }]
  };
}
