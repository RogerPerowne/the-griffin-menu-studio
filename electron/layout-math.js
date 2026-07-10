function centredColumns(pageWidth, outerMargin, columnCount, gap) {
  const count = Math.max(1, Math.floor(columnCount));
  const usableWidth = pageWidth - outerMargin * 2;
  const totalGap = gap * (count - 1);
  const columnWidth = (usableWidth - totalGap) / count;
  const columns = Array.from({ length: count }, (_value, index) => ({
    left: outerMargin + index * (columnWidth + gap),
    width: columnWidth,
    right: outerMargin + index * (columnWidth + gap) + columnWidth
  }));
  return { usableWidth, columnWidth, gap, columns };
}

function footerCollision(contentBottom, footerTop, tolerance = 0.5) {
  return contentBottom > footerTop + tolerance;
}

function pageOverflow({ contentBottom, footerBottom, pageBottom, tolerance = 0.5 }) {
  return contentBottom > pageBottom + tolerance || footerBottom > pageBottom + tolerance;
}

function zoomInvariantGeometry(baseGeometry, zoom) {
  return {
    documentWidth: baseGeometry.width,
    documentHeight: baseGeometry.height,
    visualWidth: baseGeometry.width * zoom,
    visualHeight: baseGeometry.height * zoom
  };
}

function dividerLength(contentWidth, percent) {
  return contentWidth * (Math.max(0, Math.min(100, percent)) / 100);
}

function preflightFromBoxes(boxes) {
  const warnings = [];
  if (!boxes.pageWidth || !boxes.pageHeight) warnings.push('invalid-dimensions');
  if (boxes.fontsPending) warnings.push('unresolved-fonts');
  if (boxes.imagesPending) warnings.push('unresolved-images');
  if (footerCollision(boxes.contentBottom, boxes.footerTop)) warnings.push('footer-overlap');
  if (boxes.headerBottom > boxes.contentTop) warnings.push('header-overlap');
  if (pageOverflow({
    contentBottom: boxes.contentBottom,
    footerBottom: boxes.footerBottom,
    pageBottom: boxes.pageBottom
  })) warnings.push('content-overflow');
  if (boxes.clippedElements > 0) warnings.push('clipped-elements');
  if (boxes.scale && boxes.scale !== 1) warnings.push('unsafe-page-scaling');
  return {
    ok: warnings.length === 0,
    pageCount: boxes.pageCount || 1,
    warnings
  };
}

module.exports = {
  centredColumns,
  dividerLength,
  footerCollision,
  pageOverflow,
  preflightFromBoxes,
  zoomInvariantGeometry
};
