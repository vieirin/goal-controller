# piStar (vendored)

The iStar 2.0 modelling tool by João Pimentel and contributors, MIT licence
(see `LICENSE`). Source: https://github.com/jhcp/pistar, `tool/` folder at
commit 974d729 (2026-06-14), without `app/istarcore/test` and
`app/istarcore/website`.

The goal-model workbench embeds `index.html` in an iframe (same origin) and
drives it through piStar's own API: `istar.fileManager.loadModel`,
`istar.fileManager.saveModel`, `istar.graph` events and
`istar.paper.on('change:selection')`. The files here are unmodified.

## Bundled libraries

`LICENSE` covers piStar only. This repository is ISC. The libraries below are
unmodified copies shipped inside the piStar bundle, each under its own licence.
Versions are the ones named in the files that `index.html` loads.

| Library | Version | Licence |
| --- | --- | --- |
| jscolor | 2.0.5 | GPLv3 for open-source use, or the JSColor Commercial License |
| JointJS | 3.4.4 | MPL-2.0 |
| Backbone | 1.4.0 | MIT |
| Bootstrap | 3.3.7 | MIT (its CSS also includes normalize.css 3.0.3, MIT) |
| X-editable | 1.5.1 | MIT (the same file embeds bootstrap-datepicker, Apache-2.0) |
| jQuery | 3.3.1 | MIT |
| Lodash | 4.17.21 | MIT |
| bootbox | 5.0.0 | MIT |
| d3-collection | 1.0.7 | BSD-3-Clause |
| d3-dispatch | 1.0.6 | BSD-3-Clause |
| d3-quadtree | 1.0.7 | BSD-3-Clause |
| d3-timer | 1.0.10 | BSD-3-Clause |
| d3-force | 1.2.1 | BSD-3-Clause |

jscolor is the only GPLv3 component. Its open-source terms are stricter than
this repository's ISC licence. JointJS is MPL-2.0, which applies to the JointJS
files themselves.
