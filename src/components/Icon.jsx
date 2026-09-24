/**
 * Plain-text icons — no SVG. Only glyphs that read clearly as text are kept
 * (close, add, arrows, tick); everything else renders nothing, and icon-only
 * buttons fall back to their aria-label (see `button:empty` in theme.css).
 */
const GLYPHS = {
  x: '×',
  plus: '+',
  minus: '−',
  check: '✓',
  menu: '☰',
  'chevron-left': '‹',
  'chevron-right': '›',
  'chevron-down': '▾',
  'arrow-left': '←',
  'arrow-right': '→',
  'arrow-up': '↑',
  'arrow-down': '↓',
};

export default function Icon({ name, size = 18, strokeWidth, className = '', style, ...rest }) {
  const glyph = GLYPHS[name];
  if (!glyph) return null;
  return (
    <span
      className={`icon-glyph ${className}`.trim()}
      style={{ fontSize: Math.round(size * 1.05), minWidth: size, ...style }}
      aria-hidden="true"
      {...rest}
    >
      {glyph}
    </span>
  );
}
