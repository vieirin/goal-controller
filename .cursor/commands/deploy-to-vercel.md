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
