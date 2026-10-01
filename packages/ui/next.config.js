/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@goal-controller/lib'],
  // the engines import fs/path for their CLI and file logs; never reached in the browser
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
  turbopack: {
    resolveAlias: {
      fs: { browser: './services/empty.js' },
      path: { browser: './services/empty.js' },
    },
  },
};

module.exports = nextConfig;
