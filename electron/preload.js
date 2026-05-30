const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onScreenshot: (cb) => ipcRenderer.on('screenshot', (_, data) => cb(data)),
  onScreenshotError: (cb) => ipcRenderer.on('screenshot-error', (_, msg) => cb(msg)),
  requestScreenshot: () => ipcRenderer.invoke('capture-screen'),
  openRegionSelector: () => ipcRenderer.send('open-region-selector'),
  closeWindow: () => ipcRenderer.send('close-window'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
});
