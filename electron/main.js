const { app, BrowserWindow, ipcMain, globalShortcut, desktopCapturer, screen } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';

let win;

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

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

async function captureScreen() {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 },
  });
  if (!sources.length) throw new Error('No screen sources found');
  return sources[0].thumbnail.toDataURL();
}

app.whenReady().then(() => {
  createWindow();

  globalShortcut.register('CommandOrControl+Shift+Space', async () => {
    if (!win) return;
    try {
      const dataUrl = await captureScreen();
      win.webContents.send('screenshot', dataUrl);
    } catch (err) {
      win.webContents.send('screenshot-error', err.message);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

ipcMain.handle('capture-screen', async () => {
  return await captureScreen();
});

ipcMain.on('close-window', () => win?.close());
ipcMain.on('minimize-window', () => win?.minimize());

app.on('will-quit', () => globalShortcut.unregisterAll());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
