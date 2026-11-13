/**
 * Seahelm Nautical Chart Plotter
 * Canvas-based vector navigation display with high-contrast marine styling,
 * range rings, heading vectors, breadcrumbs, and tile caching.
 */
export class NauticalChart {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.options = options;

    // View state
    this.centerLat = 32.7150;
    this.centerLon = -117.1625;
    this.zoom = 14; // Slippy map zoom level (approx 10-18)
    this.autoCenter = true;

    // Vessel state
    this.vesselLat = 32.7150;
    this.vesselLon = -117.1625;
    this.vesselHeading = 0;
    this.vesselSpeedKnots = 0;

    // Navigation data
    this.trackPoints = [];
    this.waypoints = [];
    this.activeWaypoint = null;

    // Tile cache
    this.tileCache = new Map();
    this.tilesEnabled = true;

    // Pan & interaction
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.pixelRatio = window.devicePixelRatio || 1;

    this.initEvents();
    this.resize();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const width = rect.width || 360;
    const height = rect.height || 420;

    this.pixelRatio = window.devicePixelRatio || 1;
    this.canvas.width = width * this.pixelRatio;
    this.canvas.height = height * this.pixelRatio;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.ctx.scale(this.pixelRatio, this.pixelRatio);
    this.render();
  }

  initEvents() {
    window.addEventListener('resize', () => this.resize());

    // Mouse / Touch Dragging
    const onStart = (clientX, clientY) => {
      this.isDragging = true;
      this.autoCenter = false;
      this.dragStart = { x: clientX, y: clientY };
    };

    const onMove = (clientX, clientY) => {
      if (!this.isDragging) return;
      const dx = clientX - this.dragStart.x;
      const dy = clientY - this.dragStart.y;
      this.dragStart = { x: clientX, y: clientY };

      // Convert pixel delta to lat/lon shift
      const scale = this.getMetersPerPixel();
      const dLon = -dx * scale / (111320 * Math.cos(this.centerLat * Math.PI / 180));
      const dLat = dy * scale / 110540;

      this.centerLat += dLat;
      this.centerLon += dLon;
      this.render();
    };

    const onEnd = () => {
      this.isDragging = false;
    };

    this.canvas.addEventListener('mousedown', e => onStart(e.clientX, e.clientY));
    window.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onEnd);

    this.canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        onStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchmove', e => {
      if (e.touches.length === 1) {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', onEnd);

    // Mouse wheel zoom
    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      if (e.deltaY < 0) {
        this.zoomIn();
      } else {
        this.zoomOut();
      }
    }, { passive: false });
  }

  zoomIn() {
    this.zoom = Math.min(18, this.zoom + 0.5);
    this.render();
  }

  zoomOut() {
    this.zoom = Math.max(9, this.zoom - 0.5);
    this.render();
  }

  centerOnVessel() {
    this.autoCenter = true;
    this.centerLat = this.vesselLat;
    this.centerLon = this.vesselLon;
    this.render();
  }

  updateVessel(lat, lon, heading, speedKnots) {
    this.vesselLat = lat;
    this.vesselLon = lon;
    if (heading !== null && !isNaN(heading)) {
      this.vesselHeading = heading;
    }
    if (speedKnots !== undefined) {
      this.vesselSpeedKnots = speedKnots;
    }

    if (this.autoCenter) {
      this.centerLat = lat;
      this.centerLon = lon;
    }

    this.render();
  }

  setTrackPoints(points) {
    this.trackPoints = points;
    this.render();
  }

  setWaypoints(waypoints, activeId = null) {
    this.waypoints = waypoints;
    this.activeWaypoint = waypoints.find(w => w.id === activeId) || null;
    this.render();
  }

  // --- Coordinate Projection (Web Mercator) ---

  getMetersPerPixel() {
    const earthCircumference = 40075016.686;
    const latRad = this.centerLat * Math.PI / 180;
    return (earthCircumference * Math.cos(latRad)) / Math.pow(2, this.zoom + 8);
  }

  latLonToCanvasPixel(lat, lon) {
    const width = this.canvas.width / this.pixelRatio;
    const height = this.canvas.height / this.pixelRatio;

    const scale = this.getMetersPerPixel();
    const dLonM = (lon - this.centerLon) * (111320 * Math.cos(this.centerLat * Math.PI / 180));
    const dLatM = (lat - this.centerLat) * 110540;

    const x = width / 2 + dLonM / scale;
    const y = height / 2 - dLatM / scale;
    return { x, y };
  }

  // --- Rendering ---

  render() {
    const width = this.canvas.width / this.pixelRatio;
    const height = this.canvas.height / this.pixelRatio;

    // 1. Dark Marine Water Canvas Base
    this.ctx.fillStyle = '#0c1222';
    this.ctx.fillRect(0, 0, width, height);

    // 2. Render OpenStreetMap / Nautical Base Tiles if online
    if (this.tilesEnabled) {
      this.renderTiles();
    }

    // 3. Marine Graticule Grid & Range Rings
    this.renderRangeRings(width, height);

    // 4. Track Breadcrumbs
    this.renderTrack();

    // 5. Waypoints & Course Line
    this.renderWaypoints();

    // 6. Vessel Symbol & Heading Vector
    this.renderVessel(width, height);

    // 7. Nautical Scale Bar
    this.renderScaleBar(width, height);
  }

  renderTiles() {
    // Slippy Map tile calculation
    const zoomInt = Math.floor(this.zoom);
    const tileFrac = Math.pow(2, this.zoom - zoomInt);
    const n = Math.pow(2, zoomInt);

    const centerTileX = ((this.centerLon + 180) / 360) * n;
    const latRad = (this.centerLat * Math.PI) / 180;
    const centerTileY = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

    const width = this.canvas.width / this.pixelRatio;
    const height = this.canvas.height / this.pixelRatio;

    const tileSize = 256 * tileFrac;
    const startTileX = Math.floor(centerTileX - width / (2 * tileSize));
    const endTileX = Math.ceil(centerTileX + width / (2 * tileSize));
    const startTileY = Math.floor(centerTileY - height / (2 * tileSize));
    const endTileY = Math.ceil(centerTileY + height / (2 * tileSize));

    for (let x = startTileX; x <= endTileX; x++) {
      for (let y = startTileY; y <= endTileY; y++) {
        if (y < 0 || y >= n) continue;
        const normX = ((x % n) + n) % n;
        const tileKey = `${zoomInt}/${normX}/${y}`;

        const screenX = width / 2 + (x - centerTileX) * tileSize;
        const screenY = height / 2 + (y - centerTileY) * tileSize;

        if (this.tileCache.has(tileKey)) {
          const img = this.tileCache.get(tileKey);
          if (img.complete && img.naturalWidth > 0) {
            this.ctx.save();
            this.ctx.globalAlpha = 0.65; // High contrast nautical overlay
            this.ctx.drawImage(img, screenX, screenY, tileSize, tileSize);
            this.ctx.restore();
          }
        } else {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = `https://tile.openstreetmap.org/${zoomInt}/${normX}/${y}.png`;
          img.onload = () => {
            this.tileCache.set(tileKey, img);
            this.render();
          };
          this.tileCache.set(tileKey, img);
        }
      }
    }
  }

  renderRangeRings(width, height) {
    const vPos = this.latLonToCanvasPixel(this.vesselLat, this.vesselLon);
    const mPerPx = this.getMetersPerPixel();

    // Range rings at 0.25 NM, 0.5 NM, 1.0 NM, 2.0 NM (1 NM = 1852 meters)
    const ringDistancesNM = [0.25, 0.5, 1.0, 2.0];
    
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 6]);

    ringDistancesNM.forEach(nm => {
      const radiusM = nm * 1852;
      const radiusPx = radiusM / mPerPx;
      if (radiusPx > 15 && radiusPx < Math.max(width, height) * 1.5) {
        this.ctx.beginPath();
        this.ctx.arc(vPos.x, vPos.y, radiusPx, 0, Math.PI * 2);
        this.ctx.stroke();

        // Label
        this.ctx.fillStyle = 'rgba(56, 189, 248, 0.65)';
        this.ctx.font = '10px ui-monospace, monospace';
        this.ctx.fillText(`${nm} NM`, vPos.x + 6, vPos.y - radiusPx + 12);
      }
    });

    this.ctx.restore();
  }

  renderTrack() {
    if (this.trackPoints.length < 2) return;

    this.ctx.save();
    this.ctx.strokeStyle = '#38bdf8';
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.shadowColor = '#38bdf8';
    this.ctx.shadowBlur = 6;

    this.ctx.beginPath();
    let started = false;

    this.trackPoints.forEach(pt => {
      const pos = this.latLonToCanvasPixel(pt.lat, pt.lon);
      if (!started) {
        this.ctx.moveTo(pos.x, pos.y);
        started = true;
      } else {
        this.ctx.lineTo(pos.x, pos.y);
      }
    });

    this.ctx.stroke();
    this.ctx.restore();
  }

  renderWaypoints() {
    this.ctx.save();

    const vPos = this.latLonToCanvasPixel(this.vesselLat, this.vesselLon);

    this.waypoints.forEach(wp => {
      const pos = this.latLonToCanvasPixel(wp.lat, wp.lon);
      const isActive = this.activeWaypoint && this.activeWaypoint.id === wp.id;

      // Active course line from boat to waypoint
      if (isActive) {
        this.ctx.strokeStyle = '#fbbf24';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([6, 6]);
        this.ctx.beginPath();
        this.ctx.moveTo(vPos.x, vPos.y);
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }

      // Waypoint marker
      this.ctx.fillStyle = isActive ? '#fbbf24' : '#a855f7';
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // Waypoint label
      this.ctx.fillStyle = '#f8fafc';
      this.ctx.font = 'bold 11px system-ui, sans-serif';
      this.ctx.fillText(wp.name, pos.x + 10, pos.y + 4);
    });

    this.ctx.restore();
  }

  renderVessel(width, height) {
    const vPos = this.latLonToCanvasPixel(this.vesselLat, this.vesselLon);
    const headingRad = (this.vesselHeading * Math.PI) / 180;

    this.ctx.save();
    this.ctx.translate(vPos.x, vPos.y);

    // Projected course vector (5-minute projected advance line)
    if (this.vesselSpeedKnots > 0.5) {
      const speedMs = this.vesselSpeedKnots / 1.94384;
      const advanceMeters = speedMs * 300; // 5 min
      const advancePx = advanceMeters / this.getMetersPerPixel();

      this.ctx.save();
      this.ctx.rotate(headingRad);
      this.ctx.strokeStyle = '#34d399';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(0, -18);
      this.ctx.lineTo(0, -18 - advancePx);
      this.ctx.stroke();

      // Arrow head
      this.ctx.fillStyle = '#34d399';
      this.ctx.beginPath();
      this.ctx.moveTo(0, -18 - advancePx);
      this.ctx.lineTo(-4, -10 - advancePx);
      this.ctx.lineTo(4, -10 - advancePx);
      this.ctx.fill();
      this.ctx.restore();
    }

    // Small craft vessel silhouette (sharp bow, rounded stern)
    this.ctx.rotate(headingRad);
    this.ctx.fillStyle = '#f43f5e';
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.shadowColor = '#000000';
    this.ctx.shadowBlur = 8;

    this.ctx.beginPath();
    this.ctx.moveTo(0, -18); // Bow
    this.ctx.lineTo(8, 8);   // Starboard quarter
    this.ctx.lineTo(5, 14);  // Starboard stern
    this.ctx.lineTo(-5, 14); // Port stern
    this.ctx.lineTo(-8, 8);  // Port quarter
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // Center pivot dot
    this.ctx.fillStyle = '#ffd56b';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 3, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  renderScaleBar(width, height) {
    const mPerPx = this.getMetersPerPixel();
    const targetPx = 100;
    const targetM = targetPx * mPerPx;
    
    let scaleLabel = '';
    let scalePx = 100;

    if (targetM >= 1852) {
      const nm = Math.round(targetM / 1852);
      scalePx = (nm * 1852) / mPerPx;
      scaleLabel = `${nm} NM`;
    } else {
      const m = Math.round(targetM / 100) * 100;
      scalePx = m / mPerPx;
      scaleLabel = `${m} m`;
    }

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    this.ctx.fillRect(14, height - 34, scalePx + 20, 22);

    this.ctx.strokeStyle = '#f8fafc';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(24, height - 20);
    this.ctx.lineTo(24 + scalePx, height - 20);
    this.ctx.moveTo(24, height - 26);
    this.ctx.lineTo(24, height - 14);
    this.ctx.moveTo(24 + scalePx, height - 26);
    this.ctx.lineTo(24 + scalePx, height - 14);
    this.ctx.stroke();

    this.ctx.fillStyle = '#f8fafc';
    this.ctx.font = '10px ui-monospace, monospace';
    this.ctx.fillText(scaleLabel, 24 + scalePx / 2 - 12, height - 24);
    this.ctx.restore();
  }
}
