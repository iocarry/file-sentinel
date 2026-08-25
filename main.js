const { app, BrowserWindow, ipcMain, shell, clipboard, dialog, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const WatcherEngine = require('./watcher-engine');

let mainWindow = null;
let popupWindow = null;
let popupTimer = null;
let tray = null;
let watcherEngine = null;

// Caminho de configuração persistente
const configPath = path.join(app.getPath('userData'), 'filesentinel-config.json');
const startupDir = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
const startupShortcut = path.join(startupDir, 'AntigravityFileSentinel.vbs');

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (e) {
    console.error('Erro ao ler config:', e);
  }
  return {
    x: undefined,
    y: undefined,
    width: 440,
    height: 640,
    alwaysOnTop: true,
    opacity: 0.95,
    clickThrough: false,
    autoStart: false,
    showTrayNotifications: true,
    soundEnabled: true,
    whitelist: ['AfterEffects.exe', 'Adobe Premiere Pro.exe', 'Photoshop.exe', 'Code.exe'],
    customFolders: []
  };
}

function saveConfig(data) {
  try {
    const current = loadConfig();
    const merged = { ...current, ...data };
    fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (e) {
    console.error('Erro ao salvar config:', e);
  }
}

function saveBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  saveConfig({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height
  });
}

function isAutoStartActive() {
  try {
    if (fs.existsSync(startupShortcut)) return true;
    const cfg = loadConfig();
    return !!cfg.autoStart;
  } catch (e) {
    return false;
  }
}

function setAutoStartActive(enable) {
  try {
    saveConfig({ autoStart: enable });
    if (enable) {
      const vbsContent = `Set WshShell = CreateObject("WScript.Shell")\r\nWshShell.Run """${path.join(__dirname, 'Iniciar_FileSentinel_Silencioso.vbs')}""", 0, False\r\n`;
      if (!fs.existsSync(startupDir)) {
        fs.mkdirSync(startupDir, { recursive: true });
      }
      fs.writeFileSync(startupShortcut, vbsContent, 'utf-8');
    } else {
      if (fs.existsSync(startupShortcut)) {
        fs.unlinkSync(startupShortcut);
      }
    }
  } catch (e) {
    console.error('Erro ao configurar inicialização com o Windows:', e);
  }
}

function setClickThrough(enable) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  saveConfig({ clickThrough: enable });
  if (enable) {
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    mainWindow.setIgnoreMouseEvents(false);
  }
  createTray();
}

// Criação da Janela de Pop-in Própria e Discreta (Zero Windows Toast)
function createPopupWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { workArea } = primaryDisplay;

  popupWindow = new BrowserWindow({
    width: 360,
    height: 110,
    x: workArea.x + workArea.width - 380,
    y: workArea.y + workArea.height - 120,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false
    }
  });

  popupWindow.loadFile(path.join(__dirname, 'popup.html'));

  popupWindow.on('closed', () => {
    popupWindow = null;
  });
}

function showCustomPopin(data) {
  const config = loadConfig();
  if (config.showTrayNotifications === false) return;

  const procName = (data.process?.Name || '').toLowerCase();
  const isWhitelisted = (config.whitelist || []).some(w => procName.includes(w.toLowerCase()));
  if (isWhitelisted) return;

  if (!popupWindow || popupWindow.isDestroyed()) {
    createPopupWindow();
  }

  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { workArea } = primaryDisplay;
    popupWindow.setPosition(workArea.x + workArea.width - 380, workArea.y + workArea.height - 120);

    popupWindow.webContents.send('render-notification', data);
    popupWindow.showInactive();

    clearTimeout(popupTimer);
    popupTimer = setTimeout(() => {
      if (popupWindow && !popupWindow.isDestroyed()) {
        popupWindow.hide();
      }
    }, 4500);
  } catch (e) {
    console.error('Erro ao exibir pop-in customizado:', e);
  }
}

function createWindow() {
  const config = loadConfig();

  let posX = config.x;
  let posY = config.y;
  if (posX === undefined || posY === undefined) {
    try {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width } = primaryDisplay.workAreaSize;
      posX = width - 460;
      posY = 40;
    } catch (e) {
      posX = 100;
      posY = 100;
    }
  }

  mainWindow = new BrowserWindow({
    x: posX,
    y: posY,
    width: config.width || 440,
    height: config.height || 640,
    minWidth: 360,
    minHeight: 480,
    maxWidth: 650,
    icon: path.join(__dirname, 'icon.png'),
    title: 'FileSentinel',
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: config.alwaysOnTop ?? true,
    skipTaskbar: true,
    opacity: config.opacity !== undefined ? config.opacity : 0.95,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  if (config.clickThrough) {
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
  }

  mainWindow.on('moved', saveBounds);
  mainWindow.on('resized', saveBounds);

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      saveBounds();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createTray();
  createPopupWindow();
}

function createTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }

  const iconPath = path.join(__dirname, 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);

  tray = new Tray(icon);
  tray.setToolTip('FileSentinel (Monitoramento Ativo)');

  const config = loadConfig();

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '🛡️ Abrir / Exibir FileSentinel HUD',
      click: () => {
        showMainWindow();
      }
    },
    {
      label: '👁️ Ocultar HUD (Ficar na Bandeja)',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          saveBounds();
          mainWindow.hide();
        }
      }
    },
    { type: 'separator' },
    {
      label: '🔔 Pop-in Flutuante (ao estar na bandeja)',
      type: 'checkbox',
      checked: config.showTrayNotifications !== false,
      click: (item) => {
        saveConfig({ showTrayNotifications: item.checked });
      }
    },
    {
      label: '🔊 Efeitos Sonoros Sutis',
      type: 'checkbox',
      checked: config.soundEnabled !== false,
      click: (item) => {
        saveConfig({ soundEnabled: item.checked });
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sync-sound-setting', item.checked);
        }
      }
    },
    {
      label: '⏸️ Pausar / Retomar Feed',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('trigger-toggle-pause');
        }
      }
    },
    {
      label: '🧹 Limpar Feed de Atividades',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('trigger-clear-feed');
        }
      }
    },
    { type: 'separator' },
    {
      label: '📌 Fixar Sempre no Topo',
      type: 'checkbox',
      checked: config.alwaysOnTop ?? true,
      click: (item) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.setAlwaysOnTop(item.checked);
          saveConfig({ alwaysOnTop: item.checked });
        }
      }
    },
    {
      label: '👻 Modo Fantasma (Ignorar Cliques)',
      type: 'checkbox',
      checked: config.clickThrough || false,
      click: (item) => {
        setClickThrough(item.checked);
      }
    },
    {
      label: '🎚️ Nível de Transparência',
      submenu: [
        {
          label: '100% (Totalmente Opaco)',
          type: 'radio',
          checked: (config.opacity || 0.95) >= 0.98,
          click: () => setOpacityLevel(1.0)
        },
        {
          label: '85% (Levemente Transparente)',
          type: 'radio',
          checked: (config.opacity || 0.95) >= 0.80 && (config.opacity || 0.95) < 0.98,
          click: () => setOpacityLevel(0.85)
        },
        {
          label: '70% (Vidro Médio)',
          type: 'radio',
          checked: (config.opacity || 0.95) >= 0.65 && (config.opacity || 0.95) < 0.80,
          click: () => setOpacityLevel(0.70)
        },
        {
          label: '50% (Semi-Transparente)',
          type: 'radio',
          checked: (config.opacity || 0.95) >= 0.40 && (config.opacity || 0.95) < 0.65,
          click: () => setOpacityLevel(0.50)
        },
        {
          label: '30% (Super Translúcido)',
          type: 'radio',
          checked: (config.opacity || 0.95) < 0.40,
          click: () => setOpacityLevel(0.30)
        }
      ]
    },
    { type: 'separator' },
    {
      label: '🚀 Iniciar com o Windows',
      type: 'checkbox',
      checked: isAutoStartActive(),
      click: (item) => {
        setAutoStartActive(item.checked);
      }
    },
    {
      label: '🎯 Redefinir Posição na Tela',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const primaryDisplay = screen.getPrimaryDisplay();
          const { width } = primaryDisplay.workAreaSize;
          mainWindow.setPosition(width - 460, 40);
          saveBounds();
          mainWindow.show();
        }
      }
    },
    { type: 'separator' },
    {
      label: '❌ Fechar Totalmente o FileSentinel',
      click: () => {
        app.isQuitting = true;
        saveBounds();
        if (watcherEngine) watcherEngine.stop();
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
        saveBounds();
        mainWindow.hide();
      } else {
        showMainWindow();
      }
    }
  });
}

function setOpacityLevel(level) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setOpacity(level);
    saveConfig({ opacity: level });
    mainWindow.webContents.send('sync-opacity', level);
  }
}

app.whenReady().then(() => {
  createWindow();

  const config = loadConfig();

  watcherEngine = new WatcherEngine({
    folders: config.customFolders && config.customFolders.length > 0 ? config.customFolders : undefined
  });

  watcherEngine.on('activity', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('file-activity', data);

      if (!mainWindow.isVisible() || mainWindow.isMinimized()) {
        showCustomPopin(data);
      }
    } else {
      showCustomPopin(data);
    }
  });

  watcherEngine.on('status', (status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('watcher-status', status);
    }
  });

  watcherEngine.on('audit-status', (status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('audit-status', status);
    }
  });

  watcherEngine.on('audit-event', (eventData) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('audit-event', eventData);
    }
  });

  watcherEngine.start();

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show();
    } else {
      createWindow();
    }
  });
});

function showMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  }
}

// IPC Pop-in Customizado
ipcMain.on('popup-clicked', () => {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.hide();
  }
  showMainWindow();
});

ipcMain.on('dismiss-popup', () => {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.hide();
  }
});

// IPC Handlers
ipcMain.handle('open-in-explorer', async (event, targetPath) => {
  if (!targetPath) return false;
  try {
    let normPath = path.normalize(targetPath);

    // Se o caminho começar com \ mas não tiver letra de unidade, tenta resolver com o drive atual ou D:
    if (!/^[a-zA-Z]:[\\/]/.test(normPath) && !normPath.startsWith('\\\\')) {
      const currentDrive = path.parse(process.cwd()).root || 'C:\\';
      const cleanRel = normPath.replace(/^[\\/]+/, '');
      const possiblePath1 = path.join(currentDrive, cleanRel);
      const possiblePath2 = path.join('D:\\', cleanRel);
      
      if (fs.existsSync(possiblePath1)) {
        normPath = possiblePath1;
      } else if (fs.existsSync(possiblePath2)) {
        normPath = possiblePath2;
      } else {
        normPath = path.resolve(normPath);
      }
    }

    if (fs.existsSync(normPath)) {
      const stats = fs.statSync(normPath);
      if (stats.isDirectory()) {
        await shell.openPath(normPath);
      } else {
        shell.showItemInFolder(normPath);
      }
      return true;
    } else {
      // Se o arquivo foi excluído ou temporário, abre a pasta pai onde ele ficava
      const parentDir = path.dirname(normPath);
      if (fs.existsSync(parentDir)) {
        await shell.openPath(parentDir);
        return true;
      }
    }
  } catch (err) {
    try {
      const fallbackDir = path.dirname(targetPath);
      if (fs.existsSync(fallbackDir)) {
        exec(`explorer.exe "${fallbackDir}"`);
        return true;
      }
    } catch (e) {}
  }
  return false;
});

ipcMain.handle('copy-clipboard', async (event, text) => {
  if (text) {
    clipboard.writeText(text);
    return true;
  }
  return false;
});

ipcMain.handle('toggle-monitoring', async (event, enabled) => {
  if (!watcherEngine) return false;
  if (enabled) {
    watcherEngine.start();
  } else {
    watcherEngine.stop();
  }
  return watcherEngine.isMonitoring;
});

ipcMain.handle('get-monitored-folders', async () => {
  if (!watcherEngine) return [];
  return watcherEngine.foldersToWatch;
});

ipcMain.handle('add-folder-to-watch', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'multiSelections']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    for (const folder of result.filePaths) {
      if (!watcherEngine.foldersToWatch.includes(folder)) {
        watcherEngine.foldersToWatch.push(folder);
        if (watcherEngine.isMonitoring) {
          watcherEngine.watchDirectory(folder);
        }
      }
    }
    saveConfig({ customFolders: watcherEngine.foldersToWatch });
    return watcherEngine.foldersToWatch;
  }
  return null;
});

ipcMain.handle('get-system-drives', async () => {
  const letters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const available = [];
  for (const l of letters) {
    const drivePath = `${l}:\\`;
    try {
      if (fs.existsSync(drivePath)) {
        available.push({
          letter: l,
          path: drivePath,
          isSystemDrive: l.toUpperCase() === 'C'
        });
      }
    } catch (e) {}
  }
  return available;
});

ipcMain.handle('set-watch-folders', async (event, folderList) => {
  if (!watcherEngine) return [];
  watcherEngine.updateFolders(folderList);
  saveConfig({ customFolders: folderList });
  return watcherEngine.foldersToWatch;
});

ipcMain.handle('get-default-folders', async () => {
  if (!watcherEngine) return [];
  return watcherEngine.defaultFolders;
});

ipcMain.handle('start-audit-mode', async () => {
  if (!watcherEngine) return null;
  return watcherEngine.startAuditMode();
});

ipcMain.handle('stop-audit-mode', async () => {
  if (!watcherEngine) return null;
  return watcherEngine.stopAuditMode();
});

ipcMain.handle('get-config', async () => {
  return loadConfig();
});

ipcMain.handle('save-config', async (event, partialData) => {
  saveConfig(partialData);
  return loadConfig();
});

ipcMain.handle('export-report', async (event, { content, defaultName, extension }) => {
  if (!mainWindow) return false;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar Relatório de Atividades',
    defaultPath: defaultName || `FileSentinel_Relatorio_${new Date().toISOString().slice(0,10)}.${extension || 'csv'}`,
    filters: [
      { name: 'Planilha CSV', extensions: ['csv'] },
      { name: 'Documento de Texto', extensions: ['txt'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return result.filePath;
  }
  return null;
});

ipcMain.handle('set-always-on-top', async (event, state) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(state);
    saveConfig({ alwaysOnTop: state });
    createTray();
    return mainWindow.isAlwaysOnTop();
  }
  return false;
});

ipcMain.handle('set-opacity', async (event, level) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const clamped = Math.max(0.2, Math.min(1.0, level));
    mainWindow.setOpacity(clamped);
    saveConfig({ opacity: clamped });
    createTray();
    return clamped;
  }
  return 1.0;
});

ipcMain.handle('hide-window', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    saveBounds();
    mainWindow.hide();
  }
});

ipcMain.handle('minimize-window', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
});

ipcMain.handle('close-window', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    saveBounds();
    mainWindow.hide();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  saveBounds();
  if (watcherEngine) watcherEngine.stop();
});

app.on('window-all-closed', () => {
  // Mantém ativo na bandeja
});
