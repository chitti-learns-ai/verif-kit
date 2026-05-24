# Installing Verif-Kit into a repo

Verif-Kit installs the "copy-the-engine" way (like `specify init`): agent + skill go
to the agent command surface (`.claude/`), templates + scripts + framework go to a
Verif-Kit-owned engine dir, and one per-project config file holds your specifics.

## Quick install

```bash
# from the target repo root
node <path-to>/verif-kit/install.mjs        # one cross-platform installer (needs Node ≥ 18)
```

The installer:

1. copies `verif-kit/agents/verification-engineer.md` → `.claude/agents/`
2. copies `verif-kit/skills/verif-kit/` → `.claude/skills/`
3. copies `verif-kit/templates/*` → `.verif-kit/templates/` (or `.specify/templates/` if spec-kit is present)
4. copies `verif-kit/scripts/{powershell,bash}/*` → `.verif-kit/scripts/`
5. copies `verif-kit/framework/<lang>/*` → `.verif-kit/framework/`
6. writes `verif-kit.config.json` from `verif-kit.config.example.json` **if absent** (then you edit it)
7. writes `.verif-kit/verif-kit.json` (manifest: version + file SHA-256s, for tamper/version tracking)

The installer deliberately does **not** edit any YAML. If you use spec-kit and want
the `after_implement` hook, add it by hand (see Integration, below).

## Configure (the one place project specifics live)

Edit `verif-kit.config.json` (see `verif-kit.config.example.json` for the full
schema): your `commands` (how to run fast checks / a single quarantine test /
full verify / mutation / e2e), `paths` (quarantine + promoted-tests dirs),
`riskTiers` (coverage/mutation floors + which lenses are required), and the
`security` / `onlineResearch` / `independence` toggles. The agent and skill read
this instead of hard-coding anything — that is what makes them portable.

## Use

```
/verif-kit <module>     # after implementing non-trivial logic
```

It runs plan-gate-then-execute, persists progress in on-disk ticking checklists
(`specs/<feature>/verification/<module>.{contract,vplan,verification-tasks}.md`),
and resumes from the first unchecked box if interrupted. Ask "where are we?" and
run `vk-check-prerequisites` for a one-shot JSON status.

## Integration with Spec-Kit (two seams, different cadence)

Verif-Kit is complementary to spec-kit: spec-kit asks "did we build what we wrote
down?"; Verif-Kit asks "is it actually correct, judged independently?"

**Seam 1 — `after_implement` hook (per-increment nudge).** Add this by hand to the
target repo's `.specify/extensions.yml`:

```yaml
hooks:
  after_implement:
    - extension: verif-kit
      command: verif-kit        # spec-kit maps dots→hyphens → /verif-kit
      enabled: true
      optional: true                 # nudge by default; set false to force for P0/P1
      prompt: Run independent verification on the modules just implemented?
      description: Independent coverage-driven IV&V on non-trivial logic
      condition: null
```

Because every `speckit-*/SKILL.md` already scans `after_<phase>` hooks, this needs
**zero changes to spec-kit core** — `/speckit-implement` will surface (or
auto-run, if `optional: false`) `/verif-kit` at the end of implementation.

**Seam 2 — `Phase Z` task (feature-completion gate).** Append to the project's
`tasks-template.md` so `/speckit-tasks` emits a verification task into every
`tasks.md` and `/speckit-implement` ticks it like any other task:

```markdown
## Phase Z: Verification gate
- [ ] TZZZ Run `/verif-kit` on each non-trivial logic module added/changed; resolve discrepancies; promote accepted independent tests. (Mandatory for P0/P1.)
```

**Recommended:** ship both — Seam 1 is the reminder, Seam 2 is the requirement.
They don't conflict (the hook no-ops if the Phase Z task already ran).

**Same session vs separate session:** default to the in-session fresh subagent
(strong independence via the no-read rule + audit, low cost). For P0 modules or
published-evidence runs, set `independence.escalateToSeparateSessionForTiers` so
the verifier runs as a separate session whose only interface is the on-disk
contract/spec in and quarantine tests/report out — a config switch, not a rewrite.
