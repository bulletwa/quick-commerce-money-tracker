# Claude skills installed for this project (14 Nov 2026)

Installed at user level in `~/.claude/skills/` after a manual review (source from the Snyk article "top Claude skills for UI/UX engineers").
Each repo was cloned shallow into a scratch folder, every SKILL.md and script was read, and risky patterns (network, subprocess, eval, base64,
remote-fetch instructions, prompt-injection wording) were scanned for before copying. Nothing was executed except a read-only query of ui-ux-pro-max.

| Skill (folder) | Source and commit | Content | Review |
|---|---|---|---|
| `frontend-design` | anthropics/skills `1780c5e` | one markdown file | clean |
| `web-design-guidelines` | vercel-labs/agent-skills `1a2c79d` + vercel-labs/web-interface-guidelines `434b7f9` | markdown | **changed**: upstream fetches its rules from GitHub on every run and follows them; the rulebook is now a pinned local `guidelines.md` and the skill says not to fetch it |
| `react-best-practices` (`vercel-react-best-practices`) | vercel-labs/agent-skills `1a2c79d` | 70 markdown rules, MIT | clean (shell commands appear only as examples in rule text) |
| `composition-patterns` | same | markdown | clean |
| `react-native-skills` | same | markdown | clean; not relevant to this web project, harmless |
| `ui-ux-pro-max` | nextlevelbuilder/ui-ux-pro-max-skill `d643997` | Python 3 standard-library search over local CSV/JSON | no network, no subprocess; writes files only with `--persist`; tests and plugin-only files left out; `${CLAUDE_PLUGIN_ROOT}` path replaced by `$HOME/.claude/skills/ui-ux-pro-max` |
| `bencium-controlled-ux-designer` | bencium/bencium-claude-code-design-skill `5de46a3` | markdown | clean; behaviour note: it makes Claude **ask before design decisions** |

**Not installed: AccessLint** (accesslint/claude-marketplace `2e9d733`). Its skills run `npx -y @accesslint/chrome@latest` and `@accesslint/cli@latest` through the shell and its
plugin launches `npx -y @accesslint/mcp@latest` as an MCP server, i.e. freshly downloaded, unpinned code on every use, plus a Chrome with a debugging port. The package looks
legitimate (MIT, one named maintainer, no install scripts) but needs an explicit decision; if installed, pin versions instead of `@latest`.

Remove a skill: delete its folder in `~/.claude/skills/`. Update one: re-clone, re-review the diff, copy over. Start a new Claude Code session after any change.
