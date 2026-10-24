# iPhone Duo Porting Skill

An agent skill that helps developers port iOS apps to the foldable **iPhone Duo** and adopt its iOS 27.1 APIs: the hinge, reserved regions (the fold and the cameras), `ArrangementView`, toolbars on the side of the screen, the two front cameras, and content on the outer display.

**Docs and API reference:** https://kushagragitter.github.io/iphone-duo-porting-skill/

It is written for coding agents such as Claude Code, but it reads fine as a checklist for people too.

## What it covers

1. **Audit:** `rg` searches that find code that breaks on Duo, such as `UIScreen.main`, orientation and device-type checks, custom bars, and camera direction assumptions.
2. **Fix resizing:** Apple's replacement patterns, with before and after code.
3. **Side toolbars:** ordering, icon and title rules, overflow, compression and opting out.
4. **Layout around the fold:** `ArrangementView` / `UIArrangementViewController` and `reservedRegions(kind:)`.
5. **Hinge API:** `onHingeChange` (SwiftUI) and `UIHingeInteraction` (UIKit), with a wrapper for apps that support older iOS versions and patterns that work.
6. **Cameras and the outer display:** `AVCaptureDeviceDirectionCoordinator`, mirroring, and `CameraCaptureAccessory` scene accessories.
7. **Testing and shipping:** test checklist for the Xcode 27.1 Device Hub, and the "Made for iPhone Duo" badge.

## Install

You need Node.js 16 or newer.

```bash
npx github:KushagraGitter/iphone-duo-porting-skill
```

This installs the skill to `~/.claude/skills/iphone-duo-porting`, so Claude Code can use it in every project. Run the same command again to update.

| Option | What it does |
|---|---|
| `--project` | Installs into `./.claude/skills`, for the current repo only. Commit that folder to share the skill with your team. |
| `--dir <path>` | Installs into any skills folder, for other agents. Example: `--dir ~/.codex/skills` |
| `--uninstall` | Removes the skill. Combine with `--project` or `--dir` to remove it from that folder. |
| `--help` | Shows all options. |

```bash
# This project only
npx github:KushagraGitter/iphone-duo-porting-skill --project

# Remove it
npx github:KushagraGitter/iphone-duo-porting-skill --uninstall
```

**Using the skills CLI:** the repo follows the standard `skills/<name>/SKILL.md` layout, so [`npx skills`](https://github.com/vercel-labs/skills) works too. It can also install into other agents:

```bash
npx skills add KushagraGitter/iphone-duo-porting-skill
```

**Manually:**

```bash
git clone https://github.com/KushagraGitter/iphone-duo-porting-skill.git
mkdir -p ~/.claude/skills
cp -r iphone-duo-porting-skill/skills/iphone-duo-porting ~/.claude/skills/
```

Then ask something like *"Port this app to iPhone Duo"* or *"Add a fold-to-scrub control using the hinge."*

## Sources and accuracy

The content comes from Apple's iPhone Duo documentation, Human Interface Guidelines, Tech Talks 111461–111466, and the Q&A from Apple's iPhone Duo group labs (October 2026). Items marked **VERIFY** in the skill are points where sources disagree or that rest on a third-party write-up. Check those against the Xcode 27.1 SDK headers before relying on them.

This project is not affiliated with Apple. iPhone is a trademark of Apple Inc.

## Contributing

Pull requests are welcome, especially ones that resolve a **VERIFY** item with a link to Apple's docs or SDK headers.
