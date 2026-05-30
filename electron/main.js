const { app, BrowserWindow, ipcMain, globalShortcut, desktopCapturer, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');

const isDev = process.env.NODE_ENV === 'development';

let voiceProcess = null;

const VOICE_SCRIPT = `
Add-Type -AssemblyName System.Speech
$engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$engine.LoadGrammar([System.Speech.Recognition.DictationGrammar]::new())
$engine.SetInputToDefaultAudioDevice()
$engine.InitialSilenceTimeout = [TimeSpan]::FromSeconds(8)

Register-ObjectEvent -InputObject $engine -EventName SpeechHypothesized -SourceIdentifier 'Hyp'
Register-ObjectEvent -InputObject $engine -EventName SpeechRecognized    -SourceIdentifier 'Rec'
Register-ObjectEvent -InputObject $engine -EventName RecognizeCompleted   -SourceIdentifier 'Done'

$engine.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)

$deadline = [DateTime]::Now.AddSeconds(30)
$running = $true
while ($running -and [DateTime]::Now -lt $deadline) {
    $evt = Wait-Event -Timeout 0.05
    if ($evt) {
        Remove-Event -EventIdentifier $evt.EventIdentifier
        switch ($evt.SourceIdentifier) {
            'Hyp'  { [Console]::WriteLine('INTERIM:' + $evt.SourceArgs[1].Result.Text); [Console]::Out.Flush() }
            'Rec'  { [Console]::WriteLine('FINAL:'   + $evt.SourceArgs[1].Result.Text); [Console]::Out.Flush() }
            'Done' { $running = $false }
        }
    }
}
$engine.RecognizeAsyncStop()
[Console]::WriteLine('DONE:'); [Console]::Out.Flush()
`;

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
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 4);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const px = row + 1 + x * 4;
      const dx = x - size / 2 + 0.5, dy = y - size / 2 + 0.5;
      const inside = Math.sqrt(dx * dx + dy * dy) < size / 2 - 0.5;
      raw[px] = inside ? 0x8b : 0;
      raw[px + 1] = inside ? 0x5c : 0;
      raw[px + 2] = inside ? 0xf6 : 0;
      raw[px + 3] = inside ? 255 : 0;
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
    x: screenWidth - 420,
    y: 40,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
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

ipcMain.on('start-voice', (event) => {
  voiceProcess = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', VOICE_SCRIPT]);
  let buf = '';
  voiceProcess.stdout.on('data', (data) => {
    buf += data.toString();
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith('INTERIM:')) event.sender.send('voice-interim', t.slice(8));
      else if (t.startsWith('FINAL:'))   event.sender.send('voice-final',   t.slice(6));
      else if (t.startsWith('DONE:'))    event.sender.send('voice-done');
    }
  });
  voiceProcess.on('close', () => { voiceProcess = null; event.sender.send('voice-done'); });
});

ipcMain.on('cancel-voice', () => {
  voiceProcess?.kill();
  voiceProcess = null;
});

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
ipcMain.on('minimize-window', () => win?.minimize());

app.on('will-quit', () => globalShortcut.unregisterAll());

app.on('window-all-closed', () => {
  // Don't quit on window close — we live in the tray
});
