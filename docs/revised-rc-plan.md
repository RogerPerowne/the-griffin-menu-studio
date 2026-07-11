# Griffin Menu Studio Revised RC Plan

## Product Direction

Remove the global dish catalogue idea entirely.

Replace it with two simpler, safer tools:

1. **Reuse from another menu**
   - When typing or adding a dish, Griffin can suggest matching dishes from existing menus.
   - Choosing one copies selected fields into the current dish.
   - After copying, the dish is independent.
   - No permanent links.
   - No overrides.
   - No propagation.

2. **Find across menus**
   - Search all menus for dish names, descriptions, prices, allergens/tags, notes, section names, or menu names.
   - Replace is an explicit reviewed action.
   - No instant Replace All.
   - The user previews every affected field before applying changes.

This keeps the app understandable: find where something appears, choose what to update, confirm.

## File Model

### Editable Menu Files

Use:

```text
.menu
```

For normal editable menu documents.

A `.menu` file should contain:

- menu content
- sections
- dishes
- prices
- notes
- allergens/tags
- layout settings
- page settings
- typography/spacing
- footer/header settings
- document metadata

These are the files the restaurant opens, edits, saves, and sends around.

## Template Model

### Template Files

Templates should be stored individually as:

```text
.menu
```

Each template is its own file.

Example:

```text
Templates/
  A5 Set Lunch.menu
  A La Carte.menu
  Sunday Roast.menu
  Private Dining.menu
  Buffet.menu
  Wedding Event.menu
```

A template `.menu` file should contain:

- template name
- description
- category
- page size
- section structure
- column structure
- starter placeholder content if useful
- typography/layout defaults
- header/footer defaults
- thumbnail metadata/cache key

Templates should open as "new menu from template", not as the original template file.

Using a template creates a new `.menu` document.

## Storage Locations

Use a Word-like storage model.

### App Data Storage

Store app-owned files in the user's application data folder.

Example Windows structure:

```text
%APPDATA%/Griffin Menu Studio/
  settings.json
  recent-files.json
  recovery/
  thumbnails/
  templates/
    user/
      My Private Dining Layout.menu
    bundled-cache/
```

### Bundled Templates

Bundled Griffin templates ship with the app and are read-only.

They can be copied into the user templates folder if the user chooses "Duplicate Template" or "Save as Template".

### User Templates

User-created templates are individual `.menu` files inside the templates folder.

Users should be able to:

- create template from current menu
- rename user template
- delete user template
- reveal templates folder
- import template
- export/share template

Bundled templates cannot be accidentally deleted.

## Home Workspace

Rename/keep the first workspace as:

```text
Home
```

Home should be the useful app hub.

### Left Navigation

Brand green background.

Text and icons over green must use brand pink.

Items:

```text
Open
New
Templates
Dishes
Settings
```

### Open

Show:

- recent menu files
- live thumbnails
- file path
- last opened date
- open action
- remove from recent action
- open from disk action

### New

Show:

- blank menu
- create from template
- duplicate current menu
- useful starting layouts

### Templates

Show:

- bundled templates
- user templates
- categories
- full-page thumbnails
- Use Template action
- Save Current Menu as Template
- Manage Templates

Template thumbnails should show the full page, blush background, and correct paper ratio.

### Dishes

This is not a catalogue.

Show:

- search across all menus
- copy dish into current menu
- open source menu
- filter by menu/section
- no linked dish behaviour

### Settings

Clickable from Home.

This opens the new Settings workspace/page.

## Settings Page

Add a real Settings page accessible from:

```text
Home > Settings
Help > Settings
File/Menu where appropriate
```

This should not be a tiny modal long term. It should be a proper calm settings page.

### Settings Sections

```text
General
Defaults
Storage
Templates
Export & Print
Recovery
Advanced
```

## Settings: General

Controls:

- default workspace on launch:
  - Home
  - Last used workspace
  - Editor
- reopen last document on launch
- show welcome/home every time
- interface scale if needed
- reset dismissed tips

## Settings: Defaults

Set defaults for new menus:

- default paper size:
  - A4
  - A5
- default header style:
  - title only
  - crest + title
  - full lockup
- default columns
- default description style:
  - beside name
  - below name
- default footer text
- default dietary key
- default blush preview colour
- default layout spacing
- default typography settings

These defaults apply to new menus, not existing documents unless explicitly applied.

## Settings: Storage

Show and allow changing storage locations.

Locations:

- default menu save folder
- templates folder
- autosave/recovery folder
- thumbnail cache folder
- backup folder

Actions:

- Browse/change folder
- Open folder
- Reset to default
- Move existing files where safe
- Warn before changing important locations

Important rule:

Changing storage locations should never silently lose templates, recent files, or recovery files.

## Settings: Templates

Controls:

- bundled template location: read-only
- user template folder
- import template `.menu`
- export selected template
- delete user template
- rebuild template thumbnails
- reset bundled templates

## Settings: Export & Print

Controls:

- default export folder
- default PDF filename pattern
- default PNG filename pattern
- print preflight strictness
- always show Export workspace before printing
- remember print copies for current session only
- never persist printer-specific settings unless clearly safe

## Settings: Recovery

Controls:

- autosave enabled
- autosave interval
- show recovery files
- restore recovery file
- clear old recovery files
- crash recovery folder

## Settings: Advanced

Controls:

- clear thumbnail cache
- reset all app preferences
- export app diagnostics
- open app data folder
- validate templates
- validate recent files

## Find Across Menus

Add a new tool/window:

```text
Find across menus
```

Accessible from:

- Home > Dishes
- Edit menu
- Help tool search
- keyboard shortcut later if useful

### Search Fields

User can choose where to search:

- dish names
- descriptions
- prices
- allergens/tags
- notes
- section names
- menu names

### Result View

Example result:

```text
A la carte
Starters - Wild mushroom arancini
Truffle mayonnaise, aged Parmesan
10.50
```

Actions per result:

- open result in editor
- copy dish into current menu
- select for replace

### Replace Flow

Replacement must be field-specific.

Example:

```text
Find: Wild mushroom arancini
Look in: Dish names
Menus: All menus

Replace with: Mushroom and truffle arancini

Change:
[x] Name
[ ] Description
[ ] Price
[ ] Allergens
[ ] Notes
```

### Review Step

Never immediately Replace All.

Show:

```text
6 matches found across 4 menus
4 names will change
2 similar results are not selected
```

Then each change:

```text
Before:
Wild mushroom arancini

After:
Mushroom and truffle arancini
```

User ticks results and confirms once.

Undo should restore all replacements as one action.

## Reuse From Another Menu

Keep the useful autocomplete idea, but without links.

When typing a dish name:

```text
Found on 3 other menus
```

Selecting a match opens a chooser:

```text
Reuse:
[x] Name
[x] Description
[ ] Price
[x] Allergens and tags
[ ] Note
```

After applying, the current dish is ordinary independent content.

No future updates occur automatically.

## Remove Completely

Remove:

- global dish catalogue records
- linked dish state
- product/catalogue IDs
- field override model
- propagated updates
- catalogue management window
- catalogue migrations
- catalogue terminology in Help/UI

Replace wording with:

- Find across menus
- Reuse from another menu
- Copy dish

## Implementation Order

1. Remove catalogue data model and UI wording.
2. Ensure existing menus still open and save cleanly.
3. Add template `.menu` file support.
4. Store user templates individually in the templates folder.
5. Build Home > Settings page.
6. Add storage/defaults settings.
7. Add Find across menus.
8. Add reviewed Replace flow.
9. Add simple reuse suggestions while editing dish names.
10. Rebuild Print workspace from the supplied handoff.
11. Finish PDF and PNG export polish so the output room is production-ready.
12. Final Home/template/recent thumbnail polish.
13. Run tests, typecheck, smoke test, package installer.

## Print And Export Workspace

Use the supplied `griffin-print-workspace-handoff.zip` as the reference for the Print page.

The Export workspace should have separate pages:

- Print
- PDF
- PNG
- Save As

### Print

Build a Word-style backstage print room adapted to Griffin:

- green left navigation
- cream settings column
- large white production preview
- prominent Print button
- copies control
- read-only honest rows for printer, pages, paper, orientation, margins and scaling
- no PDF or PNG buttons on the Print page
- system print dialog, not fake in-app printer controls
- real preflight before enabling/starting print
- print button disabled for overflow/footer collision
- print always reruns preflight before calling Electron
- typed narrow Electron print payload
- no arbitrary Electron print options exposed to the renderer

### PDF

Keep PDF export separate:

- white production preview
- exact paper size
- no editor chrome
- no browser headers or footers
- preflight status
- Export PDF action

### PNG

Keep PNG export separate:

- white production preview
- current page only
- Export PNG action
- no misleading print settings

### Save As

Keep editable document saving separate:

- `.menu` document format
- clear distinction from PDF/PNG exports
- later: template saving as `.menu`

## Testing Needed

Add tests for:

- `.menu` document save/open
- template `.menu` load/save
- user template folder loading
- bundled template protection
- settings defaults
- storage location changes
- find result matching
- field-specific replace
- reviewed replace application
- undo after bulk replace
- copying dish from another menu
- no catalogue-linked state remains

## Acceptance Criteria

The revised system is complete when:

- normal menus save as `.menu`
- templates save individually as `.menu`
- Home has a Settings entry
- Settings can configure defaults and storage locations
- templates load from the templates folder
- existing templates are discoverable and usable
- dishes are independent menu content
- Find across menus works
- Replace across menus requires review and confirmation
- reuse from another menu copies fields only
- no global catalogue terminology remains
- Print workspace follows the supplied Word-style handoff
- PDF and PNG export remain separate, working output pages
- tests and typecheck pass
