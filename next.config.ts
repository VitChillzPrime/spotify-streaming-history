import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Cover art and artist photos come from Spotify's CDNs. They're rendered unoptimized,
    // so the browser fetches them directly rather than through a server.
    remotePatterns: [
      { protocol: "https", hostname: "*.spotifycdn.com", pathname: "/image/**" },
      { protocol: "https", hostname: "i.scdn.co", pathname: "/image/**" },
      { protocol: "https", hostname: "mosaic.scdn.co", pathname: "/**" },
    ],
  },
};

export default nextConfig;
