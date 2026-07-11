# Griffin Menu Studio — Feature Board

A standalone tracker, **separate from the app**. Open `index.html` in a browser
(double-click it, or serve the folder). It works offline for the board; the
version timeline needs internet to read GitHub.

## What it does

- **Version timeline** — pulls every release from GitHub
  (`RogerPerowne/the-griffin-menu-studio`) and lays them out newest-first, showing
  the features/fixes shipped in each.
- **Board** — roadmap items grouped by status (Building / Planned / Ideas / Bugs /
  Want next). You can ⭐ *want*, set priority, add comments/bug notes, and add new
  ideas or bugs. Everything you do is saved in the browser automatically.
- **Export / Import** — "Export" downloads `griffin-board.json`. Save it into this
  folder (or send it to me) and I can read your flags, comments and priorities and
  act on them. "Import" loads a `griffin-board.json` back.

## Feature codes (how the timeline knows what shipped)

Each release note ends with an HTML comment the timeline parses (invisible to
readers of the release/app):

```
<!-- griffin-features: [
  {"t":"Dockable panels","a":"panels","k":"feature"},
  {"t":"Section menu no longer clipped","a":"editor","k":"fix"}
] -->
```

- `t` = title, `a` = area (`panels`|`typography`|`booklet`|`updates`|`editor`|`filing`|`brand`), `k` = `feature` | `fix`.

Releases without the comment still appear on the timeline using their title/notes.
`npm run release` reminds you to include the block.
