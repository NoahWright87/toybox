# What Now?

Not sure which command to run? Use this as your starting point.

Use the AskUserQuestion tool to present the options below. Once the user selects one, read the corresponding command file and follow it as your next set of instructions. Do not load any command files until the user has made their choice — only read the one they pick.

## Options

| Choice | What it does |
|--------|-------------|
| **File ideas and GitHub Issues** | Sort new ideas, feature requests, and open GH Issues into the right TODO spec files |
| **Add detail to TODO items** | Clarify vague TODOs, add effort estimates (XS–XL), and open a PR with proposed spec updates |
| **Implement TODO items** | Pick the easiest open TODO items and implement them |
| **Backfill specs from existing code** | Generate spec files from an existing codebase; mark gaps with `> **TODO:**` for later |
| **Install or update the spec system** | Set up this template in a new repo or pull in upstream updates |

## After the user picks

| Choice | File to read and follow |
|--------|------------------------|
| File ideas and GitHub Issues | `.claude/commands/lib/intake.md` |
| Add detail to TODO items | `.claude/commands/lib/refine.md` |
| Implement TODO items | `.claude/commands/lib/knock-out-todos.md` |
| Backfill specs from existing code | `.claude/commands/lib/spec-backfill.md` |
| Install or update the spec system | `.claude/commands/lib/respec.md` |

Read the file. Follow it exactly. Do not summarize or paraphrase — the command file is the instruction set.
