# Preview, Zoom, Layout And Export Review

Reviewed at committed HEAD `8a104f8`. This was an adversarial read-and-verify
review only; no production source was changed.

## Ranked Flaws

### High — Fit Width does nothing after a manual zoom

**Files:** `src/renderer/commands.ts:319`, `src/renderer/layout-runtime.ts:85-87,90-93`

`setZoom()` deliberately sets `followFit = false`. The Fit Width command calls
`fitPage()`, but `fitPage()` only assigns `zoom = baseZoom` when `followFit` is
true. Consequently, after clicking Zoom In or Actual Size, Fit Width recomputes
`baseZoom` but leaves the on-screen zoom untouched.

**Reproduction / measurement:** in the live 1280x720 browser preview, I moved
an A4 menu to **169%**, clicked **Fit width**, and the `#zoomPct` label remained
**169%**. The expected fit scale at that viewport was about 74%.

**Suggested fix:** make the Fit Width command explicitly re-enable follow-fit
before calling `fitPage()`, or make `fitPage()` accept an explicit force flag.

### High — Zoomed wrapper creates a second, larger transformed footprint

**Files:** `src/renderer/layout-runtime.ts:43-47`, `src/renderer/styles/editor.css:388,544-545`

`applyZoom()` both transforms `#pagewrap` and sets its layout width/height to
the already-scaled page dimensions. The page child correctly appears at one
uniform scale, but the wrapper's own border box is transformed a second time.
At zoom above 100%, that enlarged transparent box becomes scrollable empty
space; it does not match the page's visual bounds.

**Reproduction / measurement:** at **121%** on an A4 page:

- visible page: `964.08 × 1363.50px`
- transformed `#pagewrap`: `1171.51 × 1656.93px`
- scrollable width: `1192px`

The user can scroll roughly 228px beyond the right edge of the visible page.
At 74%, the inverse mismatch is also observable: page width `586.77px`, wrapper
width `433.97px`.

**Suggested fix:** apply the transform to the page itself while sizing an
untransformed wrapper to the scaled dimensions, or keep the wrapper width/height
at the unscaled page box and use a separate scaled stage-spacer. There should be
one visual scaling operation and one matching scroll footprint.

### High — Live overflow calculation is not zoom invariant

**Files:** `src/renderer/layout-runtime.ts:120-135`

`getBoundingClientRect()` values are scaled by preview zoom, but
`getComputedStyle(inner).paddingBottom` is in unscaled CSS pixels. Line 130
subtracts the unscaled padding from a scaled `inner` bottom, which changes the
printable boundary merely by zooming the editor. Footer collision operands are
both rects and scale consistently; the page-overflow boundary does not.

**Reproduction / measurement:** A4 at the live fit scale of **0.739295**:

- bottom padding: `49.1339 CSS px`
- scaled padding: `36.3244 screen px`
- boundary used by code: `1049.736px`
- scale-correct boundary: `1062.545px`
- error: `-12.809px`

This can produce a false "does not fit" warning for a menu close to the lower
limit. At A5/105% the sign reverses (`+1.515px`), allowing slightly more space
than the live scaled geometry represents.

**Suggested fix:** perform live measurements in unscaled page coordinates
(offset/scroll geometry), or multiply CSS padding by the same uniform zoom used
by the rects. Prefer one coordinate system for every `productionInfo` operand.

### High — PNG export captures the scaled display preview, not the canonical page

**Files:** `src/renderer/commands.ts:103-120`, `src/renderer/styles/editor.css:134-135`, `src/main/export-handlers.ts:36-60`

PDF and Print use `#printRoot` after canonical preflight, but PNG switches to
the Export workspace and captures `.export-preview-page .page`. That visible
preview is always `transform: scale(.68)`. The rect sent to Electron is therefore
a screen/DIP rectangle for the 68% presentation preview, not an exact
unscaled production page rectangle. Output resolution depends on the visible
canvas and device scale factor rather than a defined page raster resolution.

**Concrete evidence:** the CSS explicitly applies `.export-preview-page {
transform:scale(.68) }`; the command reads that transformed element's
`getBoundingClientRect()` and passes it to `capturePage()`.

**Suggested fix:** render/capture a dedicated white, unscaled raster page at a
chosen print resolution (for example 300 DPI), or capture an unscaled canonical
page surface. Keep the scaled Export canvas presentation-only.

### Medium — Preflight asset failures are reported as layout failures in command output

**Files:** `src/renderer/views/preview.ts:341-382`, `src/renderer/commands.ts:72-78`

`preparePrintDOM()` correctly distinguishes `fonts` and `images`, but
`preflightBlocked()` only special-cases `footer`; font/image timeout failures
get the misleading "does not fit on one page" message. The Export workspace
does display the correct asset-specific status, so this affects direct
PDF/PNG/Print command paths.

**Suggested fix:** surface `fonts` and `images` as retryable asset-loading
errors in `preflightBlocked()`.

### Medium — Fit calculation hard-codes desktop padding and under-fits mobile

**Files:** `src/renderer/layout-runtime.ts:82`, `src/renderer/styles/editor.css:388,478-479`

The calculation subtracts a fixed 40px from `stageScroll.clientWidth`, which
matches the 20px desktop left/right padding. The mobile media rule changes
padding to `10px 12px 14px`, yet the subtraction remains 40px. On mobile this
needlessly leaves about 14px of width unused and reports a smaller fit percent.

**Suggested fix:** read horizontal padding from computed style, or compare the
available content box directly with the page's untransformed width.

### Low — Rulers redraw synchronously for every scroll event

**Files:** `src/renderer/views/preview.ts:431`, `src/renderer/layout-runtime.ts:58-75`

Every scroll event reads two rects and writes four CSS custom properties. The
operation is modest, but it is unthrottled and can generate avoidable layout
work during high-frequency trackpad scrolls.

**Suggested fix:** coalesce ruler updates into one `requestAnimationFrame`.

## Correct / Working Well

- The zoom percentage represents the actual visual page scale, not an
  unreported fit-relative value. Measured A4 values were 74%, 100% and 121%,
  matching the transform matrix and rendered page width.
- A4 and A5 ruler scale calculations are correct at the measured zooms. The
  implementation derives centimetres from the rendered page rect, so changing
  menu typography (`--sc`/`--dn`) does not alter ruler scale because the paper
  box is fixed.
- Ruler origin sign and scroll tracking work. After scrolling a 121% A4 preview
  by `(400,300)`, page offset relative to the stage was `(-380,-280)` and ruler
  origins were exactly `(-380px,-280px)`.
- Page aspect ratio is uniformly preserved: A4 measured `793.69 × 1122.52px`
  at 100% and `586.77 × 829.87px` at 74%, both approximately the A-series
  ratio. Zoom only changes visual scale; it does not mutate menu state.
- Arrange drag and alignment convert screen deltas through `getZoom()`, and
  `renderMenuHTML()` applies stored `pos` values in both editable and export
  modes. Positions remain unscaled document coordinates and carry into output.
- PDF setup is structurally sound: canonical preflight builds `#printRoot`,
  waits for fonts/images, injects `@page` A4/A5 sizes with zero margins, and
  Electron uses `preferCSSPageSize`, no headers/footers, zero margins and
  micrometre page dimensions (`210000×297000` / `148000×210000`). Print reruns
  preflight immediately beforehand. The visible ruler/zoom DOM is not part of
  PDF or Print output.

## Measurements

Environment: local Vite preview in the Codex in-app browser, viewport
`1280×720`, `devicePixelRatio = 1`, Windows OS scaling not exposed by this
browser surface. The developer preview ran from `http://localhost:5173`.

| Menu / zoom | Page px | Transform | Ruler px/cm | Result |
| --- | --- | --- | --- | --- |
| A4 fit, 74% | 586.77 × 829.87 | 0.739295 | 27.9414 | Correct cm scale |
| A4 actual, 100% | 793.69 × 1122.52 | 1.000000 | approx. 37.8 | Correct physical visual ratio |
| A4 manual, 121% | 964.08 × 1363.50 | 1.214680 | 45.9086 | Correct cm scale; oversized wrapper footprint |
| A5 fit, 105% | 587.38 × 833.44 | 1.050090 | 39.6877 | Correct cm scale |

I could not empirically produce PDFs/PNGs from the browser preview because it
does not expose Electron's preload/native save dialog bridge. Therefore PDF
page-box and repeat-byte claims were reviewed statically, not measured from an
output file. Windows 125/150/200% display scaling likewise remains a manual
desktop-Electron QA item.

## Open Questions / Decisions

1. Should Fit Width always restore automatic follow-fit? The control name and
   user expectation say yes; that is the basis for the High finding above.
2. Should the percentage continue to mean physical visual scale (recommended),
   or should the UI additionally explain fit mode? The current number is honest
   and should not be changed to a relative value.
3. Should rulers remain tick-only, or display centimetre labels? Tick-only is
   restrained but less useful for precise arrangement.
4. What output resolution should PNG promise: screen snapshot, 150 DPI, 300
   DPI, or a user-selectable value? A defined raster contract is needed before
   calling it print-quality.
