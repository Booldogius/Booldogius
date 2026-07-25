(() => {
  "use strict";

  const canvas = document.getElementById("field");
  const ctx = canvas.getContext("2d");
  const distReadout = document.getElementById("distReadout");

  // --- camera state ---------------------------------------------------
  // camera.x   = world-space x-coordinate at the centre of the screen
  // camera.zoom = pixels-per-world-unit for the ground layer
  const camera = { x: 0, zoom: 1 };
  const ZOOM_MIN = 0.4;
  const ZOOM_MAX = 4;

  // the horizon layer scrolls at a fraction of ground speed and totally
  // ignores zoom, which is what keeps the distant F's from ever
  // "arriving" no matter how far or how close you look.
  const FAR_PARALLAX = 0.12;
  const CLOUD_PARALLAX = 0.035; // slower than the horizon — clouds are further still

  let dpr = Math.max(1, window.devicePixelRatio || 1);
  let W = 0, H = 0; // css pixels

  function resize() {
    dpr = Math.max(1, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  // --- deterministic pseudo-random -------------------------------------
  function hash(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  }
  function hash2(a, b) {
    return hash(a * 13.37 + b * 91.13);
  }

  const horizonY = () => H * 0.56;

  // --- sky ---------------------------------------------------------------
  function drawSky() {
    const hY = horizonY();
    const grad = ctx.createLinearGradient(0, 0, 0, hY);
    grad.addColorStop(0, "#6fb8e6");
    grad.addColorStop(0.55, "#a9d8ef");
    grad.addColorStop(1, "#e9f1e2");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, hY);

    // a tired, low sun. nothing to see here.
    const sunX = W * 0.78 - camera.x * 0.02;
    const sunY = hY * 0.3;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 70);
    sunGrad.addColorStop(0, "rgba(255,250,224,0.9)");
    sunGrad.addColorStop(1, "rgba(255,250,224,0)");
    ctx.fillStyle = sunGrad;
    ctx.fillRect(sunX - 90, sunY - 90, 180, 180);
    ctx.beginPath();
    ctx.fillStyle = "#fdf6de";
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- wispy clouds, drifting far slower than anything on the ground -------
  function drawClouds() {
    const hY = horizonY();
    const spacing = 240;
    const camX = camera.x * CLOUD_PARALLAX;
    const leftIdx = Math.floor((camX - W / 2) / spacing) - 1;
    const rightIdx = Math.ceil((camX + W / 2) / spacing) + 1;

    ctx.save();
    ctx.filter = "blur(6px)";
    for (let i = leftIdx; i <= rightIdx; i++) {
      const exists = hash2(i, 20.1) > 0.25;
      if (!exists) continue;
      const worldX = i * spacing + (hash2(i, 21.2) - 0.5) * spacing * 0.5;
      const screenX = W / 2 + (worldX - camX);
      if (screenX < -220 || screenX > W + 220) continue;

      const baseY = hY * (0.1 + hash2(i, 22.3) * 0.5);
      const puffs = 3 + Math.floor(hash2(i, 23.4) * 3);
      const widthScale = 60 + hash2(i, 24.5) * 70;
      const alpha = 0.32 + hash2(i, 25.6) * 0.22;

      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      for (let p = 0; p < puffs; p++) {
        const px = screenX + (p - puffs / 2) * widthScale * 0.55 + (hash2(i, 30 + p) - 0.5) * 20;
        const py = baseY + (hash2(i, 40 + p) - 0.5) * 10;
        const rw = widthScale * (0.5 + hash2(i, 50 + p) * 0.5);
        const rh = rw * 0.28;
        ctx.beginPath();
        ctx.ellipse(px, py, rw, rh, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // --- distant, permanently-out-of-reach F's -----------------------------
  function drawHorizonFs() {
    const hY = horizonY();
    const spacing = 220; // in "horizon units" — deliberately not tied to zoom
    const farCam = camera.x * FAR_PARALLAX;

    const leftIdx = Math.floor((farCam - W / 2) / spacing) - 1;
    const rightIdx = Math.ceil((farCam + W / 2) / spacing) + 1;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.filter = "blur(1.1px)";

    for (let i = leftIdx; i <= rightIdx; i++) {
      const exists = hash2(i, 5.2) > 0.62; // sparse
      if (!exists) continue;
      const worldX = i * spacing + (hash2(i, 1.1) - 0.5) * spacing * 0.5;
      const screenX = W / 2 + (worldX - farCam);
      if (screenX < -80 || screenX > W + 80) continue;

      const bob = (hash2(i, 2.2) - 0.5) * 18;
      const screenY = hY - 6 - bob * 0.2 + hash2(i, 3.3) * 6;
      const size = 11 + hash2(i, 4.4) * 5;
      const alpha = 0.28 + hash2(i, 6.6) * 0.18;

      ctx.font = `700 ${size}px Georgia, "Times New Roman", serif`;
      ctx.fillStyle = `rgba(90, 76, 54, ${alpha})`;
      ctx.fillText("F*cks", screenX, screenY);
    }
    ctx.restore();
  }

  // --- ground --------------------------------------------------------------
  function worldRange() {
    const halfWidth = W / 2 / camera.zoom;
    return [camera.x - halfWidth, camera.x + halfWidth];
  }
  function worldToScreenX(wx) {
    return W / 2 + (wx - camera.x) * camera.zoom;
  }

  function drawGround() {
    const hY = horizonY();
    const grad = ctx.createLinearGradient(0, hY, 0, H);
    grad.addColorStop(0, "#c7a468");
    grad.addColorStop(1, "#9c7a45");
    ctx.fillStyle = grad;
    ctx.fillRect(0, hY, W, H - hY);
  }

  function drawDirtTexture() {
    const hY = horizonY();
    const [wLeft, wRight] = worldRange();
    const spacing = 55;
    const startI = Math.floor(wLeft / spacing) - 1;
    const endI = Math.ceil(wRight / spacing) + 1;

    // rows walk down the ground band; further rows (near horizon) are
    // sparser & smaller to fake depth, closer rows are chunkier.
    const rows = 9;
    for (let r = 0; r < rows; r++) {
      const t = r / (rows - 1); // 0 near horizon -> 1 near camera
      const rowY = hY + (H - hY) * (t * t) + 4;
      const speckleSize = 1 + t * 3.2 * camera.zoom;
      const alpha = 0.12 + t * 0.14;

      for (let i = startI; i <= endI; i++) {
        const jitter = hash2(i, r * 7.7);
        if (jitter > 0.55) continue; // keep it sparse, it's barren after all
        const wx = i * spacing + (hash2(i, r * 3.3) - 0.5) * spacing;
        const sx = worldToScreenX(wx) + (hash2(i, r * 9.1) - 0.5) * 14;
        if (sx < -10 || sx > W + 10) continue;
        const sy = rowY + (hash2(i, r * 5.5) - 0.5) * 10;

        ctx.beginPath();
        ctx.fillStyle = `rgba(70, 52, 28, ${alpha})`;
        ctx.ellipse(sx, sy, speckleSize, speckleSize * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawStone(sx, sy, scale) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.fillStyle = "#8b8577";
    ctx.ellipse(0, 0, 13, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = "#a9a291";
    ctx.ellipse(-3, -3, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.ellipse(0, 9, 13, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlant(sx, sy, scale, seed) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(scale, scale);
    ctx.lineCap = "round";
    const blades = 5 + Math.floor(hash(seed) * 3);
    for (let b = 0; b < blades; b++) {
      const a = (b / blades - 0.5) * 1.4 + (hash(seed + b) - 0.5) * 0.2;
      const len = 16 + hash(seed + b * 2) * 10;
      ctx.strokeStyle = hash(seed + b * 3) > 0.5 ? "#7a6a34" : "#a99a4e";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.quadraticCurveTo(Math.sin(a) * len * 0.5, -len * 0.5, Math.sin(a) * len, -len);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.ellipse(0, 4, 10, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCrack(sx, sy, scale, seed) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(scale, scale);
    ctx.strokeStyle = "rgba(60, 42, 20, 0.35)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    let x = 0, y = 0;
    ctx.moveTo(x, y);
    const segs = 3 + Math.floor(hash(seed) * 3);
    for (let s = 0; s < segs; s++) {
      x += (hash(seed + s) - 0.5) * 16;
      y += (hash(seed + s + 9) - 0.3) * 10;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawProps() {
    const hY = horizonY();
    const [wLeft, wRight] = worldRange();
    const spacing = 230;
    const startI = Math.floor(wLeft / spacing) - 1;
    const endI = Math.ceil(wRight / spacing) + 1;

    for (let i = startI; i <= endI; i++) {
      const roll = hash2(i, 100.1);
      if (roll > 0.45) continue; // barren means mostly empty

      const wx = i * spacing + (hash2(i, 101.2) - 0.5) * spacing * 0.7;
      const sx = worldToScreenX(wx);
      if (sx < -60 || sx > W + 60) continue;

      // depth: how close to the camera along the ground band (0 far, 1 near)
      const depth = 0.25 + hash2(i, 102.3) * 0.75;
      const sy = hY + (H - hY) * depth;
      const scale = (0.5 + depth * 1.3) * camera.zoom;

      const kind = hash2(i, 103.4);
      if (kind < 0.4) drawStone(sx, sy, scale);
      else if (kind < 0.75) drawPlant(sx, sy, scale, i * 17.3);
      else drawCrack(sx, sy, scale, i * 5.9);
    }
  }

  // --- HUD -----------------------------------------------------------------
  let lastHudUpdate = 0;
  function updateHud(now) {
    if (now - lastHudUpdate < 120) return;
    lastHudUpdate = now;
    // Zeno's-paradox distance readout: it shrinks the further you travel,
    // but only ever creeps toward a floor it can never quite touch.
    const travelled = Math.abs(camera.x);
    const metres = Math.round(42 + 9441 / (1 + travelled * 0.0025));
    distReadout.textContent = metres.toLocaleString() + " m";
  }

  // --- render loop -----------------------------------------------------------
  function render(now) {
    ctx.clearRect(0, 0, W, H);
    drawSky();
    drawClouds();
    drawHorizonFs();
    drawGround();
    drawDirtTexture();
    drawProps();
    updateHud(now || 0);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  // --- input: drag to pan -----------------------------------------------------
  const pointers = new Map();
  let dragging = false;
  let lastDragX = 0, lastDragY = 0;
  let pinchStartDist = 0, pinchStartZoom = 1;

  function clampZoom(z) {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  }

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragging = true;
      lastDragX = e.clientX;
      lastDragY = e.clientY;
      canvas.classList.add("grabbing");
    } else if (pointers.size === 2) {
      dragging = false;
      const pts = [...pointers.values()];
      pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStartZoom = camera.zoom;
    }
  });

  window.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinchStartDist > 0) {
        camera.zoom = clampZoom(pinchStartZoom * (dist / pinchStartDist));
      }
      return;
    }

    if (dragging && pointers.size === 1) {
      const dx = e.clientX - lastDragX;
      camera.x -= dx / camera.zoom;
      lastDragX = e.clientX;
      lastDragY = e.clientY;
    }
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      dragging = false;
      canvas.classList.remove("grabbing");
    } else if (pointers.size === 1) {
      dragging = true;
      const [remaining] = pointers.values();
      lastDragX = remaining.x;
      lastDragY = remaining.y;
    }
  }
  window.addEventListener("pointerup", endPointer);
  window.addEventListener("pointercancel", endPointer);

  // --- input: wheel (vertical = zoom, horizontal = pan) --------------------
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        camera.x += e.deltaX / camera.zoom;
      } else {
        const factor = Math.exp(-e.deltaY * 0.001);
        camera.zoom = clampZoom(camera.zoom * factor);
      }
    },
    { passive: false }
  );

  // --- input: keyboard -------------------------------------------------------
  const PAN_STEP = 60;
  window.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowLeft":
        camera.x -= PAN_STEP / camera.zoom;
        break;
      case "ArrowRight":
        camera.x += PAN_STEP / camera.zoom;
        break;
      case "ArrowUp":
      case "+":
      case "=":
        camera.zoom = clampZoom(camera.zoom * 1.15);
        break;
      case "ArrowDown":
      case "-":
        camera.zoom = clampZoom(camera.zoom / 1.15);
        break;
      default:
        return;
    }
    e.preventDefault();
  });

  // --- on-screen buttons (mobile fallback) ------------------------------------
  document.getElementById("controls").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    switch (btn.dataset.action) {
      case "pan-left":
        camera.x -= PAN_STEP * 2 / camera.zoom;
        break;
      case "pan-right":
        camera.x += PAN_STEP * 2 / camera.zoom;
        break;
      case "zoom-in":
        camera.zoom = clampZoom(camera.zoom * 1.25);
        break;
      case "zoom-out":
        camera.zoom = clampZoom(camera.zoom / 1.25);
        break;
    }
  });

  // --- info modal ------------------------------------------------------------
  const infoModal = document.getElementById("infoModal");
  const openInfo = () => {
    infoModal.classList.remove("hidden");
    infoModal.setAttribute("aria-hidden", "false");
  };
  const closeInfo = () => {
    infoModal.classList.add("hidden");
    infoModal.setAttribute("aria-hidden", "true");
  };
  document.getElementById("infoButton").addEventListener("click", openInfo);
  document.getElementById("infoModalClose").addEventListener("click", closeInfo);
  infoModal.addEventListener("click", (e) => {
    if (e.target === infoModal) closeInfo();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !infoModal.classList.contains("hidden")) closeInfo();
  });
})();
