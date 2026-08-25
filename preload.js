const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fileShieldAPI', {
  // Eventos em tempo real
  onActivity: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('file-activity', subscription);
    return () => ipcRenderer.removeListener('file-activity', subscription);
  },
  onStatusChange: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('watcher-status', subscription);
    return () => ipcRenderer.removeListener('watcher-status', subscription);
  },
  onSyncOpacity: (callback) => {
    const subscription = (event, level) => callback(level);
    ipcRenderer.on('sync-opacity', subscription);
    return () => ipcRenderer.removeListener('sync-opacity', subscription);
  },
  onSyncSoundSetting: (callback) => {
    const subscription = (event, enabled) => callback(enabled);
    ipcRenderer.on('sync-sound-setting', subscription);
    return () => ipcRenderer.removeListener('sync-sound-setting', subscription);
  },
  onTriggerTogglePause: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('trigger-toggle-pause', subscription);
    return () => ipcRenderer.removeListener('trigger-toggle-pause', subscription);
  },
  onTriggerClearFeed: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('trigger-clear-feed', subscription);
    return () => ipcRenderer.removeListener('trigger-clear-feed', subscription);
  },

  // Ações do Sistema e Explorer
  openPathInExplorer: (fullPath) => ipcRenderer.invoke('open-in-explorer', fullPath),
  copyToClipboard: (text) => ipcRenderer.invoke('copy-clipboard', text),
  exportReport: (options) => ipcRenderer.invoke('export-report', options),

  // Modo Sentinela de Instalação (Auditoria Forense)
  startAuditMode: () => ipcRenderer.invoke('start-audit-mode'),
  stopAuditMode: () => ipcRenderer.invoke('stop-audit-mode'),
  onAuditStatus: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('audit-status', subscription);
    return () => ipcRenderer.removeListener('audit-status', subscription);
  },
  onAuditEvent: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('audit-event', subscription);
    return () => ipcRenderer.removeListener('audit-event', subscription);
  },

  // Controles do Motor e Configurações
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (data) => ipcRenderer.invoke('save-config', data),
  toggleMonitoring: (enabled) => ipcRenderer.invoke('toggle-monitoring', enabled),
  getMonitoredFolders: () => ipcRenderer.invoke('get-monitored-folders'),
  setWatchFolders: (list) => ipcRenderer.invoke('set-watch-folders', list),
  getDefaultFolders: () => ipcRenderer.invoke('get-default-folders'),
  getSystemDrives: () => ipcRenderer.invoke('get-system-drives'),
  addFolderToWatch: () => ipcRenderer.invoke('add-folder-to-watch'),

  // Controles da Janela HUD
  setAlwaysOnTop: (state) => ipcRenderer.invoke('set-always-on-top', state),
  setOpacity: (level) => ipcRenderer.invoke('set-opacity', level),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window')
});
