// Pure page-geometry and preflight math. No Electron/DOM dependencies, so it is
// unit-testable and shared between the renderer (live preview) and the main
// process (export preflight). Ported from the original electron/layout-math.js.

export interface Column {
  left: number;
  width: number;
  right: number;
}

export interface ColumnGeometry {
  usableWidth: number;
  columnWidth: number;
  gap: number;
  columns: Column[];
}

export function centredColumns(
  pageWidth: number,
  outerMargin: number,
  columnCount: number,
  gap: number,
): ColumnGeometry {
  const count = Math.max(1, Math.floor(columnCount));
  const usableWidth = pageWidth - outerMargin * 2;
  const totalGap = gap * (count - 1);
  const columnWidth = (usableWidth - totalGap) / count;
  const columns: Column[] = Array.from({ length: count }, (_value, index) => ({
    left: outerMargin + index * (columnWidth + gap),
    width: columnWidth,
    right: outerMargin + index * (columnWidth + gap) + columnWidth,
  }));
  return { usableWidth, columnWidth, gap, columns };
}

export function footerCollision(
  contentBottom: number,
  footerTop: number,
  tolerance = 0.5,
): boolean {
  return contentBottom > footerTop + tolerance;
}

export interface OverflowInput {
  contentBottom: number;
  footerBottom: number;
  pageBottom: number;
  tolerance?: number;
}

export function pageOverflow({
  contentBottom,
  footerBottom,
  pageBottom,
  tolerance = 0.5,
}: OverflowInput): boolean {
  return contentBottom > pageBottom + tolerance || footerBottom > pageBottom + tolerance;
}

export interface BaseGeometry {
  width: number;
  height: number;
}

export interface ZoomGeometry {
  documentWidth: number;
  documentHeight: number;
  visualWidth: number;
  visualHeight: number;
}

export function zoomInvariantGeometry(baseGeometry: BaseGeometry, zoom: number): ZoomGeometry {
  return {
    documentWidth: baseGeometry.width,
    documentHeight: baseGeometry.height,
    visualWidth: baseGeometry.width * zoom,
    visualHeight: baseGeometry.height * zoom,
  };
}

export function dividerLength(contentWidth: number, percent: number): number {
  return contentWidth * (Math.max(0, Math.min(100, percent)) / 100);
}

export interface PreflightBoxes {
  pageWidth: number;
  pageHeight: number;
  fontsPending?: boolean;
  imagesPending?: boolean;
  contentTop: number;
  contentBottom: number;
  headerBottom: number;
  footerTop: number;
  footerBottom: number;
  pageBottom: number;
  clippedElements?: number;
  scale?: number;
  pageCount?: number;
}

export type PreflightWarning =
  | 'invalid-dimensions'
  | 'unresolved-fonts'
  | 'unresolved-images'
  | 'footer-overlap'
  | 'header-overlap'
  | 'content-overflow'
  | 'clipped-elements'
  | 'unsafe-page-scaling';

export interface PreflightResult {
  ok: boolean;
  pageCount: number;
  warnings: PreflightWarning[];
}

export function preflightFromBoxes(boxes: PreflightBoxes): PreflightResult {
  const warnings: PreflightWarning[] = [];
  if (!boxes.pageWidth || !boxes.pageHeight) warnings.push('invalid-dimensions');
  if (boxes.fontsPending) warnings.push('unresolved-fonts');
  if (boxes.imagesPending) warnings.push('unresolved-images');
  if (footerCollision(boxes.contentBottom, boxes.footerTop)) warnings.push('footer-overlap');
  if (boxes.headerBottom > boxes.contentTop) warnings.push('header-overlap');
  if (
    pageOverflow({
      contentBottom: boxes.contentBottom,
      footerBottom: boxes.footerBottom,
      pageBottom: boxes.pageBottom,
    })
  ) {
    warnings.push('content-overflow');
  }
  if ((boxes.clippedElements ?? 0) > 0) warnings.push('clipped-elements');
  if (boxes.scale && boxes.scale !== 1) warnings.push('unsafe-page-scaling');
  return {
    ok: warnings.length === 0,
    pageCount: boxes.pageCount || 1,
    warnings,
  };
}
