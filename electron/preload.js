const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onScreenshot: (cb) => { ipcRenderer.removeAllListeners('screenshot'); ipcRenderer.on('screenshot', (_, data) => cb(data)); },
  onScreenshotError: (cb) => { ipcRenderer.removeAllListeners('screenshot-error'); ipcRenderer.on('screenshot-error', (_, msg) => cb(msg)); },
  requestScreenshot: () => ipcRenderer.invoke('capture-screen'),
  startVoice: () => ipcRenderer.send('start-voice'),
  cancelVoice: () => ipcRenderer.send('cancel-voice'),
  onVoiceInterim: (cb) => { ipcRenderer.removeAllListeners('voice-interim'); ipcRenderer.on('voice-interim', (_, t) => cb(t)); },
  onVoiceFinal:   (cb) => { ipcRenderer.removeAllListeners('voice-final');   ipcRenderer.on('voice-final',   (_, t) => cb(t)); },
  onVoiceDone:    (cb) => { ipcRenderer.removeAllListeners('voice-done');    ipcRenderer.on('voice-done',    ()     => cb()); },
  openRegionSelector: () => ipcRenderer.send('open-region-selector'),
  closeWindow: () => ipcRenderer.send('close-window'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
});
