# agent-factory

One orchestrator Claude session (fable or opus) spawns worker Claude sessions (sonnet or haiku) as cmux tabs in its own workspace, picking the model, effort, role and worktree per task. Workers are named sessions, so the orchestrator talks to them with SendMessage and they report back the same way. Needs cmux.app (its `cmux` CLI is on the PATH) and Claude Code.

## Install

```sh
ln -sf "$PWD/scripts/agent-factory/agent-factory" ~/.local/bin/agent-factory
```

Workers and the orchestrator look in [graphify](https://github.com/Graphify-Labs/graphify)'s knowledge graph before grepping:

```sh
uv tool install graphifyy    # or: pipx install graphifyy; needs Python 3.10+
graphify .                   # once, at the repo root; writes graphify-out/
graphify . --update          # after pulling: re-extracts only changed files
```

`graphify-out/` (graph.json, graph.html, GRAPH_REPORT.md, obsidian/, wiki/, cache/) is per machine and gitignored.

## Use

```sh
agent-factory up          # a tab "orchestrator" in the current cmux workspace running claude -n goal-controller-orchestrator --model fable --effort medium (-W: its own workspace)
```

From then on the orchestrator drives the factory itself, from its Bash tool:

```sh
agent-factory spawn s1  -r scout -T "where is X read?"            # haiku, low, read-only, one-shot: claude -p; the tab closes itself
agent-factory result s1                                            # its answer (ends with "done")
agent-factory spawn red -w -b red/fix-123 -e low -t /tmp/red.md    # sonnet builder in its own worktree from origin/main; the file is its first prompt
agent-factory spawn big -m opus -w -b big/api-removal -t /tmp/big.md   # opus, effort high implied: abstract / cross-package work only
agent-factory spawn rv  -r reviewer -T "review PR 311 for correctness"  # sonnet, medium, read-only
agent-factory spawn p1  -P -T "…"     # as a split beside the orchestrator instead of a tab; -W: a separate workspace (sidebar entry)
agent-factory spawn ui1 -r scout -c -T "…"   # -c: this one gets Claude in Chrome (workers start without it)
agent-factory list                    # name, role, model, alive, context size, workspace, branch, dir
agent-factory peek red                # last 40 lines of red's screen
agent-factory send red -T "also run the ui tests"   # paste + submit, when SendMessage isn't available
agent-factory kill red -W             # close the tab; remove the worktree if clean
agent-factory down -W                 # every worker of this project
```

## Cost

Defaults are the cheapest rung per role: scout = haiku, low, read-only, one-shot; builder = sonnet, medium, auto permission mode; reviewer = sonnet, medium, read-only; the orchestrator runs in auto mode as well (`-p MODE` overrides); `-m opus` implies `-e high`; the orchestrator runs fable at medium. `roles/orchestrator.md` has the ladder the orchestrator climbs (a fact → scout; known shape → sonnet low; unknown shape or one failure → sonnet medium; abstract or cross-cutting or two failures → opus high) and the habits that keep context small: scouts size a change before a builder starts, briefs carry pointers not content, reports are short, escalate instead of re-correcting, respawn a builder from a handoff once its context passes ~150k, and read papers and screens as text.

Every turn re-sends the whole session, so context size times turns is what costs; `agent-factory list` shows each session's current prompt size (CTX, read from its transcript, which the factory finds through the `--session-id` it assigns). Sessions also start lean: `--strict-mcp-config --no-chrome`, and a generated `~/.config/agent-factory/worker-settings.json` (passed with `--settings`) that turns off every user plugin except those shipping only hooks or LSP servers (no prompt cost; the repo enables `typescript-lsp` in `.claude/settings.json`). On one setup that took a session from 64 tools, 4 MCP servers and 88 skills to 25 tools, none and 14. `-c` keeps the browser (and MCP) for one worker; `AGENT_FACTORY_LEAN=0` launches sessions with your full setup.

## How it runs

Each worker gets `~/.config/agent-factory/state/NAME/` with its session id (`session`), its brief (`brief.md`, the session's first prompt, with a factory footer naming the worker, its directory, and the orchestrator to report to), a launcher (`run.sh`, what the cmux tab runs), and for one-shot workers the answer (`result.md`). Roles are system-prompt files in `roles/` appended with `--append-system-prompt-file`. A new worktree may show Claude Code's "trust this folder" prompt once; `agent-factory peek NAME` shows it and `agent-factory send NAME -T ""` is not needed: the orchestrator answers it with `cmux send-key --workspace <ref> Enter` after moving to "Yes".
