/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@goal-controller/lib'],
  
  // Configure webpack for native modules like better-sqlite3
  webpack: (config, { isServer }) => {
    config.watchOptions = {
      ...config.watchOptions,
      poll: 1000,
      aggregateTimeout: 300,
    };

    // Externalize native modules on server-side
    if (isServer) {
      config.externals = [...(config.externals || []), 'better-sqlite3'];
    }

    return config;
  },

  // Ensure server-side only modules don't break client builds
  serverExternalPackages: ['better-sqlite3'],
};

module.exports = nextConfig;
