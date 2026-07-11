const appShellMarkup = String.raw`
<div class="app" id="app" data-tab="edit">
  <header class="top" id="appTop">
    <img class="crest-mark" id="brandLogo" alt="The Griffin" />
    <div class="modepill">
      <button data-cmd="go-home" data-mode="home">Home</button>
      <button data-cmd="go-editor" data-mode="editor" class="on">Editor</button>
      <button data-cmd="go-export" data-mode="export">Export</button>
    </div>
    <span class="sp"></span>
    <span class="savestate" id="saveState" data-state="saved" aria-live="polite" title="Document save state"><span class="savedot"></span><span class="savetext">Saved</span></span>
  </header>

  <nav class="menubar" id="menubar">
    <div class="more topmenu">
      <button class="topmenu-btn" data-act="topmenu"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg><span>File</span></button>
      <div class="pop">
        <button class="mi" data-cmd="new-blank">New Blank Menu</button>
        <button class="mi" data-cmd="new-template">New from Template…</button>
        <button class="mi" data-cmd="new-window">New Window</button>
        <button class="mi" data-cmd="open">Open…</button>
        <hr>
        <button class="mi" data-cmd="save">Save</button>
        <button class="mi" data-cmd="save-as">Save As…</button>
        <button class="mi" data-cmd="save-template">Save Layout as Template…</button>
        <hr>
        <button class="mi" data-cmd="duplicate">Duplicate Menu</button>
        <button class="mi danger" data-cmd="delete-menu">Delete Menu…</button>
        <hr>
        <button class="mi" data-cmd="backup">Back up all menus…</button>
        <button class="mi" data-cmd="restore">Restore from backup…</button>
        <hr>
        <button class="mi" data-cmd="print">Print…</button>
        <button class="mi" data-cmd="export-pdf">Export as PDF…</button>
        <button class="mi" data-cmd="export-png">Export as PNG…</button>
        <hr>
        <button class="mi" data-cmd="settings">Settings…</button>
      </div>
    </div>
    <div class="more topmenu">
      <button class="topmenu-btn" data-act="topmenu"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg><span>Edit</span></button>
      <div class="pop">
        <button class="mi" data-cmd="undo">Undo</button>
        <button class="mi" data-cmd="redo">Redo</button>
        <hr>
        <button class="mi" data-cmd="toggle-finder-panel">Find across Menus…</button>
      </div>
    </div>
    <div class="more topmenu">
      <button class="topmenu-btn" data-act="topmenu"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span>Insert</span></button>
      <div class="pop">
        <button class="mi" data-cmd="insert-section">Add Section</button>
        <button class="mi" data-cmd="insert-dish">Add Dish</button>
        <button class="mi" data-cmd="bulk-add-dishes">Add Dishes in Bulk…</button>
        <button class="mi" data-cmd="insert-rule">Add Divider Rule</button>
        <hr>
        <button class="mi" data-cmd="copy-dish">Copy a Dish from another Menu…</button>
        <button class="mi" data-cmd="toggle-finder-panel">Reuse from another Menu…</button>
      </div>
    </div>
    <div class="more topmenu">
      <button class="topmenu-btn" data-act="topmenu"><svg viewBox="0 0 24 24"><path d="M4 7h16M7 4v6M17 4v6M8 17h8M12 14v6"/></svg><span>Arrange</span></button>
      <div class="pop">
        <button class="mi" data-cmd="arrange-toggle">Arrange Mode</button>
        <hr>
        <button class="mi" data-cmd="align-left">Align Left</button>
        <button class="mi" data-cmd="align-center">Align Centre</button>
        <button class="mi" data-cmd="align-right">Align Right</button>
        <button class="mi" data-cmd="align-top">Align Top</button>
        <button class="mi" data-cmd="align-middle">Align Middle</button>
        <button class="mi" data-cmd="align-bottom">Align Bottom</button>
        <hr>
        <button class="mi" data-cmd="center-page-h">Centre on Page — Across</button>
        <button class="mi" data-cmd="center-page-v">Centre on Page — Down</button>
        <hr>
        <button class="mi" data-cmd="reset-selected-position">Reset Selected Position</button>
        <button class="mi" data-cmd="reset-all-positions">Reset All Positions</button>
      </div>
    </div>
    <div class="more topmenu">
      <button class="topmenu-btn" data-act="topmenu"><svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg><span>View</span></button>
      <div class="pop">
        <button class="mi" data-cmd="zoom-in">Zoom In</button>
        <button class="mi" data-cmd="zoom-out">Zoom Out</button>
        <button class="mi" data-cmd="fit-width">Fit to Width</button>
        <button class="mi" data-cmd="actual-size">Actual Size</button>
        <hr>
        <button class="mi" data-cmd="auto-fit">Shrink to Fit One Page</button>
        <hr>
        <button class="mi" data-cmd="toggle-rail">Menus Column</button>
        <button class="mi" data-cmd="toggle-tipbar">Tips Bar</button>
      </div>
    </div>
    <div class="more topmenu">
      <button class="topmenu-btn" data-act="topmenu"><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4z"/><path d="M4 10h16M10 10v9"/></svg><span>Window</span></button>
      <div class="pop">
        <button class="mi" data-cmd="toggle-menus-panel">Menus</button>
        <button class="mi" data-cmd="toggle-dishes-panel">Dishes</button>
        <button class="mi" data-cmd="toggle-finder-panel">Find &amp; Reuse</button>
        <button class="mi" data-cmd="toggle-colour-panel">Colour</button>
        <button class="mi" data-cmd="toggle-spacing-panel">Spacing &amp; Layout</button>
        <button class="mi" data-cmd="toggle-typography-panel">Typography</button>
        <button class="mi" data-cmd="toggle-dietkey-panel">Dietary Key</button>
        <button class="mi" data-cmd="toggle-arrange-panel">Arrange</button>
        <hr>
        <button class="mi" data-cmd="reset-window-layout">Reset Window Layout</button>
        <button class="mi" data-cmd="new-window">New App Window</button>
      </div>
    </div>
    <div class="more topmenu">
      <button class="topmenu-btn" data-act="topmenu"><svg viewBox="0 0 24 24"><path d="M9 9a3 3 0 1 1 4.7 2.5c-1.1.7-1.7 1.2-1.7 2.5"/><path d="M12 18h.01"/><circle cx="12" cy="12" r="10"/></svg><span>Help</span></button>
      <div class="pop">
        <button class="mi" data-cmd="help-tutorial">Welcome &amp; Quick Tour</button>
        <button class="mi" data-cmd="help-tips">Tips</button>
        <button class="mi" data-cmd="help-shortcuts">Keyboard Shortcuts</button>
        <button class="mi" data-cmd="help-saving">Files &amp; Saving</button>
        <hr>
        <button class="mi" data-cmd="tool-search">Tool Search…</button>
        <hr>
        <button class="mi" data-cmd="about">About Griffin Menu Studio</button>
      </div>
    </div>
    <span class="sp"></span>
    <div class="quickrow">
      <button class="iconb" data-cmd="undo" title="Undo (Ctrl+Z)"><svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg></button>
      <button class="iconb" data-cmd="redo" title="Redo (Ctrl+Y)"><svg viewBox="0 0 24 24"><path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/></svg></button>
      <button class="iconb" data-cmd="save" title="Save (Ctrl+S)"><svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg></button>
      <span class="quick-sep"></span>
      <button class="iconb" data-cmd="print" title="Print (Ctrl+P)"><svg viewBox="0 0 24 24"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/></svg></button>
      <button class="iconb" data-cmd="tool-search" title="Tool Search (Ctrl+K)"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg></button>
    </div>
  </nav>

  <div class="main" id="mainGrid">
    <aside class="rail" id="rail">
      <div class="cap">MENUS</div>
      <div class="rail-scroll" id="railScroll"></div>
      <button class="railnew" id="btnNewMenuRail">+ NEW MENU</button>
    </aside>
    <div class="railHandle" id="railHandle" title="Drag to resize"></div>
    <section class="editor">
      <div class="ed-head">
        <div class="cap">EDIT MENU</div>
        <input class="mname" id="edName" placeholder="Menu name" />
        <div class="ed-meta">
          <span class="pill">Date <input type="date" id="edDate" /></span>
          <span class="pill">Paper <select id="edPaper"><option>A4</option><option>A5</option></select></span>
          <span class="pill">Header <select id="edHeader"><option value="title">Title only</option><option value="crest">Crest + title</option><option value="lockup">Full lockup</option></select></span>
        </div>
      </div>
      <div class="ed-scroll" id="edScroll"></div>
    </section>
    <div class="editorHandle" id="editorHandle" title="Drag to resize Edit Menu"></div>

    <section class="stage">
      <div class="tipbar" id="tipbar" style="display:none">
        <span>Tip - click any text on the menu to edit it right there, or use the panel. Drag the dots to move dishes.</span>
        <span class="sp"></span>
        <button class="iconb" id="tipClose" title="Dismiss tip" aria-label="Dismiss tip"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>
      <div class="stage-bar">
        <span class="lbl" id="stPaper"></span>
        <span class="warnchip" id="warnChip"><strong id="warnText">Doesn't fit on one page</strong><button id="btnAutoFit">Shrink to fit</button></span>
        <button class="chiplink" id="btnResetFit" style="display:none">Reset sizing</button>
        <span class="sp"></span>
        <button class="abtn" id="btnMove" title="Drag titles, logos, lines and text freely on the page"><svg viewBox="0 0 24 24"><path d="M12 2v20M2 12h20M12 2 9 5m3-3 3 3M12 22l-3-3m3 3 3-3M2 12l3-3m-3 3 3 3M22 12l-3-3m3 3-3 3"/></svg>Arrange</button>
      </div>
      <div class="stage-body">
        <canvas class="ruler ruler-top" id="rulerTop" aria-hidden="true"></canvas>
        <div class="ruler-corner" aria-hidden="true"></div>
        <div class="stage-scroll" id="stageScroll"><div class="pagewrap" id="pagewrap"></div></div>
        <canvas class="ruler ruler-right" id="rulerRight" aria-hidden="true"></canvas>
      </div>
      <div class="stage-zoombar" role="toolbar" aria-label="Preview zoom">
        <button class="zoomb wide" data-cmd="fit-width" title="Fit the page to the window width">Fit width</button>
        <button class="zoomb wide" data-cmd="actual-size" title="Show the page at 100%">Actual size</button>
        <span class="sp"></span>
        <button class="zoomb icon" data-cmd="zoom-out" title="Zoom out" aria-label="Zoom out"><svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button>
        <input type="range" class="zoom-slider" id="zoomSlider" min="20" max="300" step="1" value="100" title="Zoom" aria-label="Zoom level">
        <button class="zoomb icon" data-cmd="zoom-in" title="Zoom in" aria-label="Zoom in"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
        <button class="zoomb zoompct" id="zoomPct" data-cmd="actual-size" title="Current zoom — click for 100%">100%</button>
      </div>
    </section>
  </div>

  <div id="homeWorkspace" class="workspace"></div>
  <div id="exportWorkspace" class="workspace"></div>
</div>

<div class="tabbar" id="tabbar">
  <button data-t="menus"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>MENUS</button>
  <button data-t="edit" class="on"><svg viewBox="0 0 24 24"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>EDIT</button>
  <button data-t="view"><svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>PREVIEW</button>
</div>

<div class="overlay" id="ovTpl">
  <div class="modal">
    <div class="mo-h"><h2>NEW MENU - CHOOSE A LAYOUT</h2><button class="iconb" data-close title="Close" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
    <div class="mo-b"><div class="tpl-grid" id="tplGrid"></div></div>
    <div class="mo-f">
      <input class="newname" id="newMenuName" placeholder="Menu name, e.g. Valentine's Menu" />
      <button class="abtn primary" id="btnCreateMenu">Create menu</button>
    </div>
  </div>
</div>

<div class="overlay" id="ovDish">
  <div class="modal" style="max-width:560px">
    <div class="mo-h"><h2>COPY A DISH</h2><button class="iconb" data-close title="Close" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
    <div class="mo-b">
      <input class="searchin" id="dishSearch" placeholder="Search every dish on every menu..." />
      <div class="dishpick" id="dishPick"></div>
    </div>
  </div>
</div>

<input type="file" id="fileRestore" accept=".json" style="display:none" />
<div id="printRoot"></div>
`;

export function mountAppShell(): void {
  const root = document.getElementById('appRoot');
  if (!root) throw new Error('#appRoot not found');
  root.innerHTML = appShellMarkup;
}
