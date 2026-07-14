import L from 'leaflet';

export function createFleetIcon(shape = 'circle', color = '#d93343', size = 22): L.DivIcon {
  const html = fleetMarkerHtml(shape, color, size);
  return L.divIcon({
    html,
    className: 'fleet-marker-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function fleetMarkerHtml(shape: string, color: string, size: number): string {
  const shadow = 'filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35))';
  const border = '2px solid #ffffff';

  switch (shape) {
    case 'triangle':
      return `<div style="width:${size}px;height:${size}px;display:flex;align-items:flex-end;justify-content:center;${shadow}">
        <div style="width:0;height:0;border-left:${size / 2}px solid transparent;border-right:${size / 2}px solid transparent;border-bottom:${size}px solid ${color};"></div>
      </div>`;
    case 'square':
      return `<div style="width:${size}px;height:${size}px;background:${color};border:${border};box-sizing:border-box;${shadow}"></div>`;
    case 'diamond':
      return `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;${shadow}">
        <div style="width:${size * 0.72}px;height:${size * 0.72}px;background:${color};border:${border};transform:rotate(45deg);box-sizing:border-box;"></div>
      </div>`;
    case 'star':
      return `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;${shadow}">
        <svg width="${size}" height="${size}" viewBox="0 0 24 24"><polygon points="12,2 15,9 22,9 17,14 19,22 12,18 5,22 7,14 2,9 9,9" fill="${color}" stroke="#ffffff" stroke-width="1.5"/></svg>
      </div>`;
    case 'hexagon':
      return `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;${shadow}">
        <svg width="${size}" height="${size}" viewBox="0 0 24 24"><polygon points="12,2 20,7 20,17 12,22 4,17 4,7" fill="${color}" stroke="#ffffff" stroke-width="1.5"/></svg>
      </div>`;
    case 'pentagon':
      return `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;${shadow}">
        <svg width="${size}" height="${size}" viewBox="0 0 24 24"><polygon points="12,2 21,9 17,21 7,21 3,9" fill="${color}" stroke="#ffffff" stroke-width="1.5"/></svg>
      </div>`;
    case 'cross':
      return `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;${shadow}">
        <svg width="${size}" height="${size}" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="18" fill="${color}" stroke="#ffffff" stroke-width="1"/><rect x="3" y="9" width="18" height="6" fill="${color}" stroke="#ffffff" stroke-width="1"/></svg>
      </div>`;
    default:
      return `<div style="width:${size}px;height:${size}px;background:${color};border:${border};border-radius:50%;box-sizing:border-box;${shadow}"></div>`;
  }
}
