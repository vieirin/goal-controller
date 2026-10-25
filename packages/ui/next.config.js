const path = require('path');

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

// one @istar-ts/core (goal-controller#171): goal-tree's out/ requires its
// CommonJS build, the UI and the @istar-ts packages import its ESM one; two
// copies hold two of each metamodel (ISTAR_2_0...), so every import gets the first
const ISTAR_CORE = require.resolve('@istar-ts/core');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // e2e runs its own dev server under a dedicated distDir (NEXT_DIST_DIR), so it
  // never writes into a running `next dev`'s .next
  distDir: process.env.NEXT_DIST_DIR || '.next',
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  transpilePackages: ['@goal-controller/lib'],
  // the engines import fs/path for their CLI and file logs; never reached in the browser
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@istar-ts/core$': ISTAR_CORE,
    };
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    } else {
      // the goal language server only runs in a browser Web Worker
      config.resolve.alias = {
        ...config.resolve.alias,
        '@goal-controller/goal-language/worker': false,
      };
    }
    return config;
  },
  turbopack: {
    resolveAlias: {
      '@istar-ts/core': `./${path.relative(__dirname, ISTAR_CORE)}`,
      fs: { browser: './services/empty.js' },
      path: { browser: './services/empty.js' },
    },
  },
};

module.exports = nextConfig;
