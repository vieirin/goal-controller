# piStar (vendored)

The iStar 2.0 modelling tool by João Pimentel and contributors, MIT licence
(see `LICENSE`). Source: https://github.com/jhcp/pistar, `tool/` folder at
commit 974d729 (2026-06-14), without `app/istarcore/test` and
`app/istarcore/website`.

The goal-model workbench embeds `index.html` in an iframe (same origin) and
drives it through piStar's own API: `istar.fileManager.loadModel`,
`istar.fileManager.saveModel`, `istar.graph` events and
`istar.paper.on('change:selection')`. The files here are unmodified.
