const path = require('path');

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

// one @istar-ts/core (goal-controller#171): goal-tree's out/ requires its
// CommonJS build, the UI and the @istar-ts packages import its ESM one; two
// copies hold two of each metamodel (ISTAR_2_0...), so every import gets the first.
// react now depends on actions and gmodel, so they need the same treatment.
const ISTAR_CORE = require.resolve('@istar-ts/core');
const ISTAR_ACTIONS = require.resolve('@istar-ts/actions');
const ISTAR_GMODEL = require.resolve('@istar-ts/gmodel');
const ISTAR_GLSP = require.resolve('@istar-ts/glsp');
const ISTAR_AGENT = require.resolve('@istar-ts/agent');
// @eclipse-glsp/server's own `browser` package.json field (lib/node/index ->
// lib/browser/index) should keep its Node WebSocket launcher (require('net'),
// require('async_hooks'), @istar-ts/glsp/node, out of scope here, #414) out of
// a client bundle, but neither bundler honours it for a nested dependency
// in this monorepo; resolved relative to @istar-ts/glsp's own node_modules,
// since @eclipse-glsp/server isn't hoisted to the UI's.
const ECLIPSE_GLSP_SERVER_BROWSER = require.resolve(
  '@eclipse-glsp/server/browser.js',
  { paths: [path.dirname(ISTAR_GLSP)] },
);

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
      '@istar-ts/actions$': ISTAR_ACTIONS,
      '@istar-ts/gmodel$': ISTAR_GMODEL,
      '@istar-ts/glsp$': ISTAR_GLSP,
      '@istar-ts/agent$': ISTAR_AGENT,
      '@eclipse-glsp/server$': ECLIPSE_GLSP_SERVER_BROWSER,
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
      '@istar-ts/actions': `./${path.relative(__dirname, ISTAR_ACTIONS)}`,
      '@istar-ts/gmodel': `./${path.relative(__dirname, ISTAR_GMODEL)}`,
      '@istar-ts/glsp': `./${path.relative(__dirname, ISTAR_GLSP)}`,
      '@istar-ts/agent': `./${path.relative(__dirname, ISTAR_AGENT)}`,
      '@eclipse-glsp/server': `./${path.relative(__dirname, ECLIPSE_GLSP_SERVER_BROWSER)}`,
      fs: { browser: './services/empty.js' },
      path: { browser: './services/empty.js' },
    },
  },
};

module.exports = nextConfig;
