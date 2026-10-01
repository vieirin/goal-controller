---
description: Deploy the goal-controller UI to Vercel production
---

Deploy the project to Vercel by running the following steps:

1. First, build the library package:
```bash
pnpm run build:lib
```

2. Then deploy the UI to Vercel production:
```bash
cd packages/ui && pnpm vercel --prod
```

If this is the first deployment or you need to link the project, run:
```bash
cd packages/ui && pnpm vercel
```

Make sure you're logged in to Vercel CLI first with `vercel login` if needed.

## Static export notes

The UI is a static Next export (`output: 'export'`). Build writes `packages/ui/out/`.
Vercel Root Directory is `packages/ui` — config lives in `packages/ui/vercel.json`
(`outputDirectory: "out"`).

Env vars (set at build time):

- `NEXT_PUBLIC_BASE_PATH` — URL prefix when not served from `/` (GitHub Pages uses
  `/goal-controller`). Leave empty for Vercel at the domain root.
- `NEXT_PUBLIC_EXAMPLES_REF` — git ref for raw GitHub example URLs (Pages sets this to
  the commit SHA). Defaults to `main` when unset.

GitHub Pages: enable **Pages → Source: GitHub Actions** in the repo settings. The
`.github/workflows/pages.yaml` workflow builds with the base path above and deploys
`packages/ui/out`.
