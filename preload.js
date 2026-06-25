const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  onLog: (callback) => ipcRenderer.on('game-log', (event, value) => callback(value)),
  onExit: (callback) => ipcRenderer.on('game-exit', (event, value) => callback(value)),
  onJavaProgress: (callback) => ipcRenderer.on('java-download-progress', (event, value) => callback(value)),
  onSwitchTab: (callback) => ipcRenderer.on('switch-tab', (event, value) => callback(value)),
  onUpdateProgress: (callback) => ipcRenderer.on('auto-update-progress', (event, value) => callback(value)),
  onPackDownloadProgress: (callback) => ipcRenderer.on('pack-download-progress', (event, value) => callback(value))
});
