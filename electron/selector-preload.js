const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('selectorAPI', {
  sendRegion: (region) => ipcRenderer.send('region-selected', region),
  cancel: () => ipcRenderer.send('region-cancel'),
});
