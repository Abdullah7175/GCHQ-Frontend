import L from 'leaflet';

export function createFleetIcon(
  shape = 'circle',
  color = '#d93343',
  size = 22,
  letter?: string,
): L.DivIcon {
  const html = fleetMarkerHtml(shape, color, size, letter);
  return L.divIcon({
    html,
    className: 'fleet-marker-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function letterOverlay(letter: string | undefined, size: number): string {
  if (!letter) return '';
  const text = escapeHtml(letter.toUpperCase().slice(0, 3));
  const fontSize = Math.max(8, Math.round(size * 0.42));
  return `<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${fontSize}px;line-height:1;color:#ffffff;text-shadow:0 1px 2px rgba(0,0,0,0.55);font-family:system-ui,-apple-system,sans-serif;pointer-events:none;letter-spacing:-0.02em">${text}</span>`;
}

function wrapMarker(inner: string, size: number, shadow: string, letter?: string): string {
  return `<div style="position:relative;width:${size}px;height:${size}px;${shadow}">${inner}${letterOverlay(letter, size)}</div>`;
}

function fleetMarkerHtml(shape: string, color: string, size: number, letter?: string): string {
  const shadow = 'filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35))';
  const border = '2px solid #ffffff';

  switch (shape) {
    case 'triangle':
      return wrapMarker(
        `<div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:0;height:0;border-left:${size / 2}px solid transparent;border-right:${size / 2}px solid transparent;border-bottom:${size}px solid ${color};"></div>`,
        size,
        shadow,
        letter,
      );
    case 'square':
      return wrapMarker(
        `<div style="width:100%;height:100%;background:${color};border:${border};box-sizing:border-box;"></div>`,
        size,
        shadow,
        letter,
      );
    case 'diamond':
      return wrapMarker(
        `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
          <div style="width:${size * 0.72}px;height:${size * 0.72}px;background:${color};border:${border};transform:rotate(45deg);box-sizing:border-box;"></div>
        </div>`,
        size,
        shadow,
        letter,
      );
    case 'star':
      return wrapMarker(
        `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><polygon points="12,2 15,9 22,9 17,14 19,22 12,18 5,22 7,14 2,9 9,9" fill="${color}" stroke="#ffffff" stroke-width="1.5"/></svg>`,
        size,
        shadow,
        letter,
      );
    case 'hexagon':
      return wrapMarker(
        `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><polygon points="12,2 20,7 20,17 12,22 4,17 4,7" fill="${color}" stroke="#ffffff" stroke-width="1.5"/></svg>`,
        size,
        shadow,
        letter,
      );
    case 'pentagon':
      return wrapMarker(
        `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><polygon points="12,2 21,9 17,21 7,21 3,9" fill="${color}" stroke="#ffffff" stroke-width="1.5"/></svg>`,
        size,
        shadow,
        letter,
      );
    case 'cross':
      return wrapMarker(
        `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="18" fill="${color}" stroke="#ffffff" stroke-width="1"/><rect x="3" y="9" width="18" height="6" fill="${color}" stroke="#ffffff" stroke-width="1"/></svg>`,
        size,
        shadow,
        letter,
      );
    case 'hospital':
    case 'plus':
      return wrapMarker(
        `<div style="width:100%;height:100%;background:#ffffff;border:2px solid ${color};border-radius:6px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;">
          <svg width="${Math.round(size * 0.72)}" height="${Math.round(size * 0.72)}" viewBox="0 0 24 24">
            <rect x="10" y="4" width="4" height="16" rx="1" fill="${color}"/>
            <rect x="4" y="10" width="16" height="4" rx="1" fill="${color}"/>
          </svg>
        </div>`,
        size,
        shadow,
      );
    default:
      return wrapMarker(
        `<div style="width:100%;height:100%;background:${color};border:${border};border-radius:50%;box-sizing:border-box;"></div>`,
        size,
        shadow,
        letter,
      );
  }
}
