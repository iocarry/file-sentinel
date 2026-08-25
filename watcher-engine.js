const fs = require('fs');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');
const { exec } = require('child_process');

class WatcherEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.isMonitoring = false;
    this.watchers = new Map();
    this.recentEventsDebounce = new Map();
    this.debounceMs = 300;
    
    this.userHome = os.homedir();
    
    // Detecta pasta Antigravity dinamicamente (seja em D:, E: ou no diretório atual)
    const possibleAntigravity = ['D:\\Antigravity', 'E:\\Antigravity', path.resolve(__dirname, '..')].find(p => fs.existsSync(p));

    this.defaultFolders = [
      path.join(this.userHome, 'Desktop'),
      path.join(this.userHome, 'Documents'),
      path.join(this.userHome, 'Downloads'),
      path.join(this.userHome, 'Pictures'),
      ...(possibleAntigravity ? [possibleAntigravity] : [])
    ];

    this.foldersToWatch = options.folders || this.defaultFolders;

    this.sensitiveExtensions = new Set([
      '.env', '.key', '.pem', '.cert', '.pfx', '.kdbx', '.wallet',
      '.ps1', '.bat', '.cmd', '.vbs', '.exe', '.dll', '.scr',
      '.docx', '.xlsx', '.pdf', '.psd', '.aep', '.prproj', '.zip', '.rar'
    ]);

    this.noisePatterns = [
      /\\AppData\\Local\\Temp/i,
      /\\AppData\\Local\\Microsoft\\Windows\\INetCache/i,
      /\\AppData\\Local\\Google\\Chrome\\User Data\\.*Cache/i,
      /\\AppData\\Local\\Microsoft\\Edge\\User Data\\.*Cache/i,
      /\\content_cache\\/i,
      /\\\.tmp\.drive/i,
      /\\Google\\DriveFS/i,
      /\\\.dropbox\.cache/i,
      /\\AppData\\Local\\Adobe\\.*Cache/i,
      /\\Adobe\\Common\\Media Cache/i,
      /\\node_modules\\/i,
      /\\\.git\\/i,
      /\\\.gemini\\/i,
      /desktop\.ini$/i,
      /thumbs\.db$/i,
      /~\$[^/\\]+$/i,
      /\.tmp$/i,
      /\.crdownload$/i,
      /\.log$/i,
      /\.etl$/i
    ];

    this.auditSession = null;
    this.savedFoldersBeforeAudit = null;
  }

  startAuditMode() {
    if (this.auditSession) return this.auditSession;

    this.savedFoldersBeforeAudit = [...this.foldersToWatch];

    // Pastas críticas expandidas para vigilância durante a instalação
    const startupFolder = path.join(this.userHome, 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
    const roamingFolder = path.join(this.userHome, 'AppData', 'Roaming');
    const localPrograms = path.join(this.userHome, 'AppData', 'Local', 'Programs');

    const auditTargets = new Set([
      ...this.foldersToWatch,
      startupFolder,
      roamingFolder,
      localPrograms
    ]);

    this.auditSession = {
      startTime: new Date().toISOString(),
      events: [],
      targetFolders: Array.from(auditTargets)
    };

    this.updateFolders(Array.from(auditTargets));
    this.emit('audit-status', { active: true, startTime: this.auditSession.startTime });
    return this.auditSession;
  }

  stopAuditMode() {
    if (!this.auditSession) return null;

    const endTime = new Date().toISOString();
    const sessionResult = {
      startTime: this.auditSession.startTime,
      endTime: endTime,
      events: [...this.auditSession.events],
      createdExecutables: this.auditSession.events.filter(e => e.action === 'CREATE' && ['.exe', '.dll', '.bat', '.cmd', '.ps1', '.vbs', '.scr'].includes(e.extension)),
      startupModifications: this.auditSession.events.filter(e => e.fullPath.toLowerCase().includes('startup')),
      userFilesTouched: this.auditSession.events.filter(e => !e.fullPath.toLowerCase().includes('appdata') && ['.docx', '.xlsx', '.pdf', '.png', '.jpg', '.txt', '.env', '.key'].includes(e.extension))
    };

    this.auditSession = null;
    if (this.savedFoldersBeforeAudit) {
      this.updateFolders(this.savedFoldersBeforeAudit);
      this.savedFoldersBeforeAudit = null;
    }

    this.emit('audit-status', { active: false });
    return sessionResult;
  }

  start() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    for (const folder of this.foldersToWatch) {
      this.watchDirectory(folder);
    }

    this.emit('status', { isMonitoring: true, folders: Array.from(this.watchers.keys()) });
  }

  stop() {
    this.isMonitoring = false;
    for (const [folder, watcher] of this.watchers.entries()) {
      try {
        watcher.close();
      } catch (err) {}
    }
    this.watchers.clear();
    this.emit('status', { isMonitoring: false, folders: [] });
  }

  updateFolders(newFoldersList) {
    this.foldersToWatch = newFoldersList;
    if (this.isMonitoring) {
      for (const [folder, watcher] of this.watchers.entries()) {
        try { watcher.close(); } catch (err) {}
      }
      this.watchers.clear();
      for (const folder of this.foldersToWatch) {
        this.watchDirectory(folder);
      }
      this.emit('status', { isMonitoring: true, folders: Array.from(this.watchers.keys()) });
    }
  }

  watchDirectory(targetPath) {
    if (!fs.existsSync(targetPath)) return;

    try {
      const watcher = fs.watch(targetPath, { recursive: true }, (eventType, filename) => {
        if (!filename || !this.isMonitoring) return;

        // Garante que o caminho sempre inclua a unidade de disco (ex: D:)
        const isFullyQualified = /^[a-zA-Z]:[\\/]/.test(filename) || filename.startsWith('\\\\');
        let fullPath;
        if (isFullyQualified) {
          fullPath = path.normalize(filename);
        } else {
          const cleanRel = filename.replace(/^[\\/]+/, '');
          fullPath = path.normalize(path.join(targetPath, cleanRel));
        }

        this.handleRawEvent(eventType, fullPath);
      });

      watcher.on('error', (err) => {
        console.warn(`[WatcherEngine] Erro no diretório ${targetPath}:`, err.message);
      });

      this.watchers.set(targetPath, watcher);
    } catch (err) {
      console.error(`[WatcherEngine] Falha ao iniciar vigilância em ${targetPath}:`, err.message);
    }
  }

  getFriendlyLocation(dirPath) {
    const norm = path.normalize(dirPath).toLowerCase();
    const desktop = path.normalize(path.join(this.userHome, 'Desktop')).toLowerCase();
    const documents = path.normalize(path.join(this.userHome, 'Documents')).toLowerCase();
    const downloads = path.normalize(path.join(this.userHome, 'Downloads')).toLowerCase();
    const pictures = path.normalize(path.join(this.userHome, 'Pictures')).toLowerCase();

    if (norm === desktop) return 'Área de Trabalho (Desktop)';
    if (norm.startsWith(desktop)) return 'Desktop\\' + path.basename(dirPath);
    if (norm === documents) return 'Documentos';
    if (norm.startsWith(documents)) return 'Documentos\\' + path.basename(dirPath);
    if (norm === downloads) return 'Downloads';
    if (norm.startsWith(downloads)) return 'Downloads\\' + path.basename(dirPath);
    if (norm === pictures) return 'Imagens';
    return path.basename(dirPath) || dirPath;
  }

  handleRawEvent(rawEventType, fullPath) {
    if (this.isNoise(fullPath)) return;

    const now = Date.now();
    const lastEvent = this.recentEventsDebounce.get(fullPath);
    if (lastEvent && (now - lastEvent.time) < 1200) {
      return;
    }

    let exists = false;
    let stats = null;
    let isDirectory = false;
    try {
      if (fs.existsSync(fullPath)) {
        exists = true;
        stats = fs.statSync(fullPath);
        isDirectory = stats.isDirectory();
      }
    } catch (e) {
      exists = false;
    }

    let action = 'MODIFY';
    let alertLevel = 'normal';

    if (!exists) {
      action = 'DELETE';
      alertLevel = 'warning';
    } else if (rawEventType === 'rename') {
      action = 'CREATE';
      alertLevel = 'normal';
    } else {
      action = 'MODIFY';
    }

    const ext = isDirectory ? 'pasta' : (path.extname(fullPath).toLowerCase() || 'arquivo');
    const fileName = path.basename(fullPath);
    const directory = path.dirname(fullPath);
    const friendlyDir = this.getFriendlyLocation(directory);

    if (this.sensitiveExtensions.has(ext)) {
      if (action === 'DELETE') {
        alertLevel = 'suspicious';
      } else if (['.exe', '.bat', '.ps1', '.vbs', '.env', '.key'].includes(ext)) {
        alertLevel = 'warning';
      }
    }

    this.recentEventsDebounce.set(fullPath, { time: now, type: rawEventType });

    if (this.recentEventsDebounce.size > 200) {
      for (const [k, v] of this.recentEventsDebounce.entries()) {
        if (now - v.time > 5000) this.recentEventsDebounce.delete(k);
      }
    }

    this.resolveProcess(fullPath, (processInfo) => {
      const procName = processInfo?.Name || 'Sistema';
      const friendlyApp = processInfo?.friendlyName || procName;
      const itemType = isDirectory ? 'a pasta' : 'o arquivo';
      
      let actionVerb = 'modificou';
      if (action === 'CREATE') actionVerb = 'criou';
      else if (action === 'DELETE') actionVerb = 'excluiu';

      let narrative = '';
      if (processInfo?.isUserAction) {
        narrative = `👤 Você (via ${friendlyApp}) ${actionVerb} ${itemType} "${fileName}" em ${friendlyDir}`;
      } else if (procName.toLowerCase().includes('sistema')) {
        narrative = `⚙️ Sistema Windows ${actionVerb} ${itemType} "${fileName}" em ${friendlyDir}`;
      } else {
        narrative = `⚡ ${procName} ${actionVerb} ${itemType} "${fileName}" em ${friendlyDir}`;
      }

      const payload = {
        id: 'evt_' + Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
        date: new Date().toISOString(),
        action: action,
        alertLevel: alertLevel,
        isDirectory: isDirectory,
        fileName: fileName,
        fullPath: fullPath,
        directory: directory,
        friendlyDir: friendlyDir,
        extension: ext,
        sizeBytes: stats ? stats.size : 0,
        process: processInfo,
        narrative: narrative
      };

      if (this.auditSession) {
        this.auditSession.events.push(payload);
        this.emit('audit-event', payload);
      }

      this.emit('activity', payload);
    });
  }

  isNoise(fullPath) {
    if (!fullPath) return true;
    for (const pattern of this.noisePatterns) {
      if (pattern.test(fullPath)) return true;
    }
    return false;
  }

  getFriendlyAppName(rawName) {
    if (!rawName) return 'Sistema';
    const lower = rawName.toLowerCase();
    if (lower.includes('photos') || lower.includes('dllhost')) return 'Visualizador de Fotos';
    if (lower.includes('explorer')) return 'Windows Explorer';
    if (lower.includes('notepad')) return 'Bloco de Notas';
    if (lower.includes('afterfx') || lower.includes('aftereffects')) return 'Adobe After Effects';
    if (lower.includes('premiere')) return 'Adobe Premiere Pro';
    if (lower.includes('photoshop')) return 'Adobe Photoshop';
    if (lower.includes('code')) return 'VS Code';
    if (lower.includes('chrome')) return 'Google Chrome';
    if (lower.includes('edge') || lower.includes('msedge')) return 'Microsoft Edge';
    if (lower.includes('antigravity')) return 'Antigravity IDE';
    return rawName;
  }

  resolveProcess(targetPath, callback) {
    const scriptPath = path.join(__dirname, 'get-process.ps1');
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`;

    exec(cmd, { timeout: 900 }, (err, stdout) => {
      let proc = { Name: 'Sistema', Pid: 0, Path: '', User: os.userInfo().username || 'Usuário' };
      if (!err && stdout.trim()) {
        try {
          proc = JSON.parse(stdout.trim());
        } catch (e) {}
      }

      const friendlyApp = this.getFriendlyAppName(proc.Name);
      const isUserAction = ['Windows Explorer', 'Visualizador de Fotos', 'Bloco de Notas', 'VS Code', 'Antigravity IDE'].includes(friendlyApp);

      proc.friendlyName = friendlyApp;
      proc.isUserAction = isUserAction;

      callback(proc);
    });
  }
}

module.exports = WatcherEngine;
