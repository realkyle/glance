const { app, BrowserWindow, ipcMain, globalShortcut, desktopCapturer, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const zlib = require('zlib');

const isDev = process.env.NODE_ENV === 'development';

let win;
let tray;
let selectorWin;

// Build a purple circle PNG at runtime — no icon file needed
function crc32(buf) {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = 0xFFFFFFFF;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crcVal = Buffer.alloc(4); crcVal.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcVal]);
}

function buildIconPNG(size) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (1 + size * 4));
  const cx = size / 2 - 0.5, cy = size / 2 - 0.5;
  const outerR = size / 2 - 1;
  const irisR = size * 0.28;
  const pupilR = size * 0.13;
  const glintR = size * 0.07;
  const glintX = cx + size * 0.1, glintY = cy - size * 0.1;
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 4);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const px = row + 1 + x * 4;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const glintDist = Math.sqrt((x - glintX) ** 2 + (y - glintY) ** 2);
      let r = 0, g = 0, b = 0, a = 0;
      if (dist < outerR) { r = 0x8b; g = 0x5c; b = 0xf6; a = 200; } // purple base
      if (dist < irisR)  { r = 0x6d; g = 0x28; b = 0xd9; a = 255; } // darker iris
      if (dist < pupilR) { r = 0x0a; g = 0x05; b = 0x1a; a = 255; } // near-black pupil
      if (glintDist < glintR) { r = 255; g = 255; b = 255; a = 220; } // white glint
      raw[px] = r; raw[px + 1] = g; raw[px + 2] = b; raw[px + 3] = a;
    }
  }
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}

function createTray() {
  const icon = nativeImage.createFromBuffer(buildIconPNG(32));
  tray = new Tray(icon);
  tray.setToolTip('Glance');
  tray.on('click', () => {
    if (win?.isVisible()) { win.hide(); } else { win?.show(); win?.focus(); }
  });
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Glance', click: () => { win?.show(); win?.focus(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuiting = true; app.quit(); } },
  ]));
}

function createWindow() {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: 400,
    height: 560,
    minWidth: 300,
    minHeight: 400,
    x: screenWidth - 420,
    y: 40,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');

  win.webContents.session.setPermissionRequestHandler((_, permission, callback) => {
    callback(permission === 'media');
  });

  win.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      win.hide();
    }
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

async function captureScreen() {
  const { bounds, scaleFactor } = screen.getPrimaryDisplay();
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(bounds.width * scaleFactor),
      height: Math.round(bounds.height * scaleFactor),
    },
  });
  if (!sources.length) throw new Error('No screen sources found');
  return sources[0].thumbnail.toDataURL();
}

async function captureRegion(region) {
  const { bounds, scaleFactor } = screen.getPrimaryDisplay();
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(bounds.width * scaleFactor),
      height: Math.round(bounds.height * scaleFactor),
    },
  });
  if (!sources.length) throw new Error('No screen sources found');
  const cropped = sources[0].thumbnail.crop({
    x: Math.round(region.x * scaleFactor),
    y: Math.round(region.y * scaleFactor),
    width: Math.round(region.width * scaleFactor),
    height: Math.round(region.height * scaleFactor),
  });
  return cropped.toDataURL();
}

function openRegionSelector() {
  win.hide();
  const { bounds } = screen.getPrimaryDisplay();
  selectorWin = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    webPreferences: {
      preload: path.join(__dirname, 'selector-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  selectorWin.setAlwaysOnTop(true, 'screen-saver');
  selectorWin.loadFile(path.join(__dirname, 'selector.html'));
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  globalShortcut.register('CommandOrControl+Shift+Space', async () => {
    if (!win) return;
    try {
      const dataUrl = await captureWithHide();
      win.webContents.send('screenshot', dataUrl);
    } catch (err) {
      win.show();
      win.webContents.send('screenshot-error', err.message);
    }
  });

  globalShortcut.register('CommandOrControl+Shift+D', () => {
    if (!win) return;
    openRegionSelector();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

async function captureWithHide() {
  win.hide();
  await new Promise(r => setTimeout(r, 150));
  const dataUrl = await captureScreen();
  win.show();
  win.focus();
  return dataUrl;
}


ipcMain.handle('capture-screen', async () => {
  return await captureWithHide();
});

ipcMain.on('open-region-selector', () => openRegionSelector());

ipcMain.on('region-selected', async (_, region) => {
  selectorWin?.close();
  selectorWin = null;
  await new Promise(r => setTimeout(r, 120));
  try {
    const dataUrl = await captureRegion(region);
    win.show();
    win.focus();
    win.webContents.send('screenshot', dataUrl);
  } catch (err) {
    win.show();
    win.webContents.send('screenshot-error', err.message);
  }
});

ipcMain.on('region-cancel', () => {
  selectorWin?.close();
  selectorWin = null;
  win.show();
  win.focus();
});

ipcMain.on('close-window', () => win?.hide());

let savedBounds = null;
ipcMain.on('collapse-window', () => {
  savedBounds = win.getBounds();
  win.setMinimumSize(1, 1);
  const collapsedWidth = 220;
  const collapsedHeight = 52;
  win.setBounds({
    x: savedBounds.x + savedBounds.width - collapsedWidth,
    y: savedBounds.y,
    width: collapsedWidth,
    height: collapsedHeight,
  });
});
ipcMain.on('expand-window', () => {
  win.setMinimumSize(300, 400);
  if (savedBounds) win.setBounds(savedBounds);
});

app.on('will-quit', () => globalShortcut.unregisterAll());

app.on('window-all-closed', () => {
  // Don't quit on window close — we live in the tray
});
