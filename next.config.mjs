/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.pokemon-card.com',
        port: '',
        pathname: '/assets/images/card_images/large/**',
      },
    ],
  },
};

export default nextConfig;
