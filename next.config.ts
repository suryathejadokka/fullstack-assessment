import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Amazon uses two different CDN hostnames depending on the product/region
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'm.media-amazon.com',
      },
      {
        protocol: 'https',
        hostname: 'images-na.ssl-images-amazon.com',
      },
    ],
  },
};

export default nextConfig;
