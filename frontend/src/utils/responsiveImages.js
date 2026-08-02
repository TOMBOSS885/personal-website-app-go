export function parseResponsiveImage(src) {
  if (typeof src !== 'string') return null
  const match = src.match(/^(.*)@responsive-([0-9]+(?:-[0-9]+)*)\.(jpe?g|png|webp)(\?.*)?$/i)
  if (!match) return null

  const [, prefix, widthsValue, extension, query = ''] = match
  const widths = [...new Set(widthsValue.split('-').map(Number))]
    .filter(width => Number.isInteger(width) && width > 0)
    .sort((left, right) => left - right)
  return widths.length > 0 ? { prefix, widths, extension, query } : null
}

export function responsiveImageSourceSet(src) {
  const parsed = parseResponsiveImage(src)
  if (!parsed) return undefined
  return parsed.widths
    .map(width => `${parsed.prefix}@${width}w.${parsed.extension}${parsed.query} ${width}w`)
    .join(', ')
}

export function responsiveImageUrlForWidth(src, targetWidth) {
  const parsed = parseResponsiveImage(src)
  if (!parsed) return src
  const target = Math.max(1, Number(targetWidth) || 1)
  const width = parsed.widths.find(candidate => candidate >= target)
  return width ? `${parsed.prefix}@${width}w.${parsed.extension}${parsed.query}` : src
}
