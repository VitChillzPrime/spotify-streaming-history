import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Spotify doesn't accept "localhost" redirect URIs, so local Spotify logins use
  // http://127.0.0.1:3000. Let the dev server serve that address too.
  allowedDevOrigins: ["127.0.0.1"],
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
