// Estado da Aplicação
const state = {
  isPaused: false,
  isAlwaysOnTop: true,
  soundEnabled: true,
  whitelist: ['AfterEffects.exe', 'Adobe Premiere Pro.exe', 'Photoshop.exe', 'Code.exe'],
  currentFilter: 'all', // 'all', 'CREATE', 'MODIFY', 'DELETE', 'ALERT'
  searchQuery: '',
  events: [],
  monitoredFolders: [],
  systemDrives: [],
  defaultFolders: [],
  maxEvents: 30,
  counts: {
    all: 0,
    CREATE: 0,
    MODIFY: 0,
    DELETE: 0,
    ALERT: 0
  }
};

// Síntese de Áudio Nativa (Web Audio API - Zero Arquivos Externos)
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSound(type = 'normal') {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'alert' || type === 'DELETE') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.15);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.16);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.06);
      gain.gain.setValueAtTime(0.025, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.07);
    }
  } catch (e) {}
}

// Elementos do DOM
const feedContainer = document.getElementById('feed-container');
const emptyState = document.getElementById('empty-state');
const liveIndicator = document.getElementById('live-indicator');
const searchInput = document.getElementById('search-input');
const chips = document.querySelectorAll('.chip');

// Botões de Ação
const btnAudit = document.getElementById('btn-audit');
const auditBanner = document.getElementById('audit-banner');
const auditCounterBadge = document.getElementById('audit-counter-badge');
const btnFinishAudit = document.getElementById('btn-finish-audit');

const btnToolsToggle = document.getElementById('btn-tools-toggle');
const popoverTools = document.getElementById('popover-tools');
const soundStateBadge = document.getElementById('sound-state-badge');
const layoutStateBadge = document.getElementById('layout-state-badge');
const pauseLabel = document.getElementById('pause-label');

const btnSound = document.getElementById('btn-sound');
const iconSoundOn = document.getElementById('icon-sound-on');
const iconSoundOff = document.getElementById('icon-sound-off');
const btnExport = document.getElementById('btn-export');
const btnWhitelist = document.getElementById('btn-whitelist');
const btnPresets = document.getElementById('btn-presets');
const btnViewMode = document.getElementById('btn-view-mode');
const btnPause = document.getElementById('btn-pause');
const iconPause = document.getElementById('icon-pause');
const iconPlay = document.getElementById('icon-play');
const btnPin = document.getElementById('btn-pin');
const btnClear = document.getElementById('btn-clear');
const btnMinimize = document.getElementById('btn-minimize');
const btnClose = document.getElementById('btn-close');

// Modal Dossiê de Auditoria
const modalAudit = document.getElementById('modal-audit');
const btnCloseAuditModal = document.getElementById('btn-close-audit-modal');
const metricExecutables = document.getElementById('metric-executables');
const metricStartup = document.getElementById('metric-startup');
const metricUserFiles = document.getElementById('metric-userfiles');
const dossierTextarea = document.getElementById('dossier-textarea');
const btnCopyDossier = document.getElementById('btn-copy-dossier');
const btnSaveDossier = document.getElementById('btn-save-dossier');
const btnDoneAudit = document.getElementById('btn-done-audit');

// Modal Whitelist
const modalWhitelist = document.getElementById('modal-whitelist');
const btnCloseModal = document.getElementById('btn-close-modal');
const whitelistInput = document.getElementById('whitelist-input');
const btnAddWhitelist = document.getElementById('btn-add-whitelist');
const whitelistListEl = document.getElementById('whitelist-list');

// Modal Presets & Pastas
const modalPresets = document.getElementById('modal-presets');
const btnClosePresets = document.getElementById('btn-close-presets');
const btnPresetEssential = document.getElementById('btn-preset-essential');
const drivesListEl = document.getElementById('drives-list');
const activeFoldersListEl = document.getElementById('active-folders-list');
const btnAddCustomFolder = document.getElementById('btn-add-custom-folder');

// Contadores e Rodapé
const countAll = document.getElementById('count-all');
const countCreate = document.getElementById('count-create');
const countModify = document.getElementById('count-modify');
const countDelete = document.getElementById('count-delete');
const countAlert = document.getElementById('count-alert');
const folderCountBadge = document.getElementById('folder-count-badge');
const pausedIndicator = document.getElementById('paused-indicator');
const opacityRange = document.getElementById('opacity-range');
const opacityVal = document.getElementById('opacity-val');
const toastEl = document.getElementById('toast');

// Ícones por Extensão de Arquivo
function getFileIcon(ext) {
  const e = (ext || '').toLowerCase();
  if (['.exe', '.bat', '.ps1', '.cmd', '.vbs'].includes(e)) return '⚡';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(e)) return '🖼️';
  if (['.mp4', '.mov', '.avi', '.mkv'].includes(e)) return '🎬';
  if (['.mp3', '.wav', '.flac', '.aac'].includes(e)) return '🎵';
  if (['.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.md'].includes(e)) return '📄';
  if (['.js', '.ts', '.html', '.css', '.py', '.json', '.jsx'].includes(e)) return '💻';
  if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(e)) return '📦';
  if (['.aep', '.prproj', '.psd', '.ai'].includes(e)) return '🎨';
  if (['.env', '.key', '.pem'].includes(e)) return '🔑';
  return '📁';
}

function isProcessWhitelisted(procName) {
  if (!procName) return false;
  const lower = procName.toLowerCase();
  return state.whitelist.some(w => lower.includes(w.toLowerCase()));
}

// Renderizar um Card de Atividade
function createCardElement(item) {
  const card = document.createElement('div');
  const rawProcessName = item.process?.Name || 'Sistema';
  const processName = item.process?.friendlyName || rawProcessName;
  const isUser = item.process?.isUserAction;
  const whitelisted = isProcessWhitelisted(rawProcessName) || isProcessWhitelisted(processName);

  card.className = `activity-card action-${item.action} alert-${whitelisted ? 'normal' : item.alertLevel}`;
  card.id = item.id;

  const isFolder = item.isDirectory;
  const itemType = isFolder ? 'a pasta' : 'o arquivo';
  let actionVerb = 'modificou';
  if (item.action === 'CREATE') actionVerb = 'criou';
  else if (item.action === 'DELETE') actionVerb = 'excluiu';

  const narrativeText = item.narrative || `${processName} ${actionVerb} ${itemType} "${item.fileName}" em ${item.friendlyDir || item.directory}`;

  const isSuspicious = !whitelisted && (item.alertLevel === 'suspicious' || item.alertLevel === 'warning');
  const badgeClass = isSuspicious ? 'badge-ALERT' : whitelisted ? 'badge-WHITELIST' : `badge-${item.action}`;
  const badgeLabel = isSuspicious && item.action === 'DELETE' ? 'EXCLUSÃO CRÍTICA' : 
                     isSuspicious ? 'ARQUIVO SENSÍVEL' :
                     whitelisted ? 'CONFIÁVEL' :
                     isFolder ? (item.action === 'CREATE' ? 'PASTA CRIADA' : item.action === 'DELETE' ? 'PASTA EXCLUÍDA' : 'PASTA MODIFICADA') :
                     item.action === 'CREATE' ? 'CRIADO' :
                     item.action === 'MODIFY' ? 'MODIFICADO' : 'EXCLUÍDO';

  card.innerHTML = `
    <div class="card-top">
      <span class="badge-tag ${badgeClass}">${badgeLabel}</span>
      <div class="card-meta-right">
        <span class="process-badge" title="Processo: ${processName}">${isUser ? '👤' : '⚡'} ${processName}</span>
        <span class="timestamp">${item.timestamp}</span>
      </div>
    </div>

    <div class="card-narrative" style="font-size:11px; color:#f0f6fc; font-weight:500; padding:2px 0;">
      ${narrativeText}
    </div>
    
    <div class="card-middle">
      <div class="file-icon-box">${isFolder ? '📁' : getFileIcon(item.extension)}</div>
      <div class="file-info">
        <span class="file-name" title="${item.fileName}">${item.fileName}</span>
        <span class="file-path" title="${item.fullPath}">${item.directory}</span>
      </div>
    </div>

    <div class="card-bottom">
      ${!whitelisted ? `<button class="btn-card-action btn-add-trust" data-proc="${processName}">➕ Confiável</button>` : ''}
      <button class="btn-card-action btn-copy-path" data-path="${encodeURIComponent(item.fullPath)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        Copiar
      </button>
      <button class="btn-card-action btn-open-folder" data-path="${encodeURIComponent(item.fullPath)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
        Abrir Pasta
      </button>
    </div>
  `;

  // Event Listeners das Ações do Card
  const btnOpen = card.querySelector('.btn-open-folder');
  btnOpen.addEventListener('click', (e) => {
    e.stopPropagation();
    window.fileShieldAPI.openPathInExplorer(item.fullPath);
    showToast('Abrindo pasta no Explorer...');
  });

  const btnCopy = card.querySelector('.btn-copy-path');
  btnCopy.addEventListener('click', (e) => {
    e.stopPropagation();
    window.fileShieldAPI.copyToClipboard(item.fullPath);
    showToast('Caminho copiado!');
  });

  const btnTrust = card.querySelector('.btn-add-trust');
  if (btnTrust) {
    btnTrust.addEventListener('click', (e) => {
      e.stopPropagation();
      addToWhitelist(rawProcessName);
    });
  }

  return card;
}

// Filtro de Exibição
function shouldDisplay(item) {
  if (state.currentFilter !== 'all') {
    if (state.currentFilter === 'ALERT') {
      if (item.alertLevel === 'normal' || isProcessWhitelisted(item.process?.Name)) return false;
    } else if (item.action !== state.currentFilter) {
      return false;
    }
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    const matchesName = item.fileName.toLowerCase().includes(q);
    const matchesPath = item.fullPath.toLowerCase().includes(q);
    const matchesProc = (item.process?.Name || '').toLowerCase().includes(q);
    const matchesExt = (item.extension || '').toLowerCase().includes(q);
    if (!matchesName && !matchesPath && !matchesProc && !matchesExt) {
      return false;
    }
  }

  return true;
}

function renderFeed() {
  const visibleEvents = state.events.filter(shouldDisplay);

  if (visibleEvents.length === 0) {
    emptyState.classList.remove('hidden');
    const cards = feedContainer.querySelectorAll('.activity-card');
    cards.forEach(c => c.remove());
  } else {
    emptyState.classList.add('hidden');
    const cards = feedContainer.querySelectorAll('.activity-card');
    cards.forEach(c => c.remove());

    for (const item of visibleEvents) {
      const el = createCardElement(item);
      feedContainer.appendChild(el);
    }
  }
}

function updateCounters() {
  countAll.textContent = state.counts.all;
  countCreate.textContent = state.counts.CREATE;
  countModify.textContent = state.counts.MODIFY;
  countDelete.textContent = state.counts.DELETE;
  countAlert.textContent = state.counts.ALERT;
}

let toastTimeout = null;
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 2200);
}

function togglePauseFeed() {
  state.isPaused = !state.isPaused;
  if (state.isPaused) {
    iconPause.classList.add('hidden');
    iconPlay.classList.remove('hidden');
    pausedIndicator.classList.remove('hidden');
    liveIndicator.style.backgroundColor = '#f59e0b';
    liveIndicator.style.boxShadow = '0 0 8px #f59e0b';
    if (pauseLabel) pauseLabel.textContent = 'Retomar Feed';
    showToast('Feed ao vivo pausado');
  } else {
    iconPause.classList.remove('hidden');
    iconPlay.classList.add('hidden');
    pausedIndicator.classList.add('hidden');
    liveIndicator.style.backgroundColor = '#10b981';
    liveIndicator.style.boxShadow = '0 0 8px #10b981';
    if (pauseLabel) pauseLabel.textContent = 'Pausar Feed';
    showToast('Feed ao vivo retomado');
  }
}

function clearFeed() {
  state.events = [];
  state.counts = { all: 0, CREATE: 0, MODIFY: 0, DELETE: 0, ALERT: 0 };
  updateCounters();
  renderFeed();
  showToast('Feed limpo');
}

// Ingestão de Novo Evento ao Vivo
window.fileShieldAPI.onActivity((data) => {
  if (state.isPaused) return;

  const whitelisted = isProcessWhitelisted(data.process?.Name);

  state.events.unshift(data);
  if (state.events.length > state.maxEvents) {
    state.events.pop();
  }

  state.counts.all++;
  if (state.counts[data.action] !== undefined) {
    state.counts[data.action]++;
  }
  if (!whitelisted && data.alertLevel !== 'normal') {
    state.counts.ALERT++;
  }
  updateCounters();

  if (!whitelisted) {
    if (data.alertLevel !== 'normal' || data.action === 'DELETE') {
      playSound('alert');
    } else {
      playSound('normal');
    }
  }

  if (shouldDisplay(data)) {
    emptyState.classList.add('hidden');
    const cardEl = createCardElement(data);
    feedContainer.insertBefore(cardEl, feedContainer.firstChild);

    const allCards = feedContainer.querySelectorAll('.activity-card');
    if (allCards.length > state.maxEvents) {
      allCards[allCards.length - 1].remove();
    }
  }
});

// Listener de Status do Watcher
window.fileShieldAPI.onStatusChange((status) => {
  if (status.folders) {
    state.monitoredFolders = status.folders;
    folderCountBadge.textContent = `${status.folders.length} Pastas Vigiadas ⚙️`;
    renderActiveFoldersUI();
    renderDrivesUI();
  }
});

// Sincronizações da Bandeja
window.fileShieldAPI.onSyncOpacity((level) => {
  const percent = Math.round(level * 100);
  opacityRange.value = percent;
  opacityVal.textContent = `${percent}%`;
});

window.fileShieldAPI.onSyncSoundSetting((enabled) => {
  setSoundState(enabled);
});

window.fileShieldAPI.onTriggerTogglePause(() => {
  togglePauseFeed();
});

window.fileShieldAPI.onTriggerClearFeed(() => {
  clearFeed();
});

// Gerenciamento de Som
function setSoundState(enabled) {
  state.soundEnabled = enabled;
  btnSound.classList.toggle('active', enabled);
  iconSoundOn.classList.toggle('hidden', !enabled);
  iconSoundOff.classList.toggle('hidden', enabled);
  if (soundStateBadge) {
    soundStateBadge.textContent = enabled ? 'Ligado' : 'Silenciado';
    soundStateBadge.style.color = enabled ? 'var(--accent-cyan)' : 'var(--text-muted)';
  }
  window.fileShieldAPI.saveConfig({ soundEnabled: enabled });
}

btnSound.addEventListener('click', () => {
  setSoundState(!state.soundEnabled);
  showToast(state.soundEnabled ? 'Sons ativados' : 'Sons silenciados');
});

// Abertura do Menu Popover de Ferramentas
btnToolsToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  popoverTools.classList.toggle('hidden');
  btnToolsToggle.classList.toggle('active', !popoverTools.classList.contains('hidden'));
});

document.addEventListener('click', (e) => {
  if (!popoverTools.contains(e.target) && e.target !== btnToolsToggle) {
    popoverTools.classList.add('hidden');
    btnToolsToggle.classList.remove('active');
  }
});

// Gerenciamento de Whitelist
function renderWhitelistUI() {
  whitelistListEl.innerHTML = '';
  if (state.whitelist.length === 0) {
    whitelistListEl.innerHTML = '<span style="font-size:10px; color:var(--text-muted)">Nenhum programa cadastrado.</span>';
    return;
  }

  state.whitelist.forEach((item, index) => {
    const chip = document.createElement('div');
    chip.className = 'whitelist-item';
    chip.innerHTML = `
      <span>⚡ ${item}</span>
      <button class="btn-remove-whitelist" data-index="${index}" title="Remover">✕</button>
    `;

    chip.querySelector('.btn-remove-whitelist').addEventListener('click', () => {
      state.whitelist.splice(index, 1);
      window.fileShieldAPI.saveConfig({ whitelist: state.whitelist });
      renderWhitelistUI();
      renderFeed();
      showToast(`'${item}' removido da lista branca`);
    });

    whitelistListEl.appendChild(chip);
  });
}

function addToWhitelist(name) {
  const clean = (name || '').trim();
  if (!clean) return;
  if (!state.whitelist.some(w => w.toLowerCase() === clean.toLowerCase())) {
    state.whitelist.push(clean);
    window.fileShieldAPI.saveConfig({ whitelist: state.whitelist });
    renderWhitelistUI();
    renderFeed();
    showToast(`'${clean}' adicionado como confiável!`);
  }
}

btnWhitelist.addEventListener('click', () => {
  modalWhitelist.classList.remove('hidden');
  renderWhitelistUI();
});

btnCloseModal.addEventListener('click', () => {
  modalWhitelist.classList.add('hidden');
});

modalWhitelist.addEventListener('click', (e) => {
  if (e.target === modalWhitelist) modalWhitelist.classList.add('hidden');
});

btnAddWhitelist.addEventListener('click', () => {
  const val = whitelistInput.value;
  if (val) {
    addToWhitelist(val);
    whitelistInput.value = '';
  }
});

whitelistInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    btnAddWhitelist.click();
  }
});

// Gerenciamento do Modal de Presets & Discos
function renderDrivesUI() {
  drivesListEl.innerHTML = '';
  if (!state.systemDrives || state.systemDrives.length === 0) return;

  state.systemDrives.forEach((drive) => {
    const isWatched = state.monitoredFolders.some(f => f.toLowerCase() === drive.path.toLowerCase());
    const chip = document.createElement('div');
    chip.className = `drive-chip ${isWatched ? 'active' : ''} ${drive.isSystemDrive ? 'system-drive' : ''}`;
    
    chip.innerHTML = `
      <span>💾 ${drive.letter}:\\</span>
      ${drive.isSystemDrive ? '<span class="sys-badge">Sistema</span>' : ''}
      <span>${isWatched ? '✓' : '+'}</span>
    `;

    chip.addEventListener('click', async () => {
      if (drive.isSystemDrive && !isWatched) {
        showToast('⚠️ C:\\ inteiro não é recomendado pelo alto consumo de CPU!');
      }

      let updated = [...state.monitoredFolders];
      if (isWatched) {
        updated = updated.filter(f => f.toLowerCase() !== drive.path.toLowerCase());
      } else {
        updated.push(drive.path);
      }

      const res = await window.fileShieldAPI.setWatchFolders(updated);
      state.monitoredFolders = res;
      renderDrivesUI();
      renderActiveFoldersUI();
      showToast(isWatched ? `Unidade ${drive.letter}:\\ removida` : `Unidade ${drive.letter}:\\ adicionada à vigilância!`);
    });

    drivesListEl.appendChild(chip);
  });
}

function renderActiveFoldersUI() {
  activeFoldersListEl.innerHTML = '';
  if (state.monitoredFolders.length === 0) {
    activeFoldersListEl.innerHTML = '<span style="font-size:10px; color:var(--text-muted)">Nenhuma pasta ativa.</span>';
    return;
  }

  state.monitoredFolders.forEach((fPath, index) => {
    const row = document.createElement('div');
    row.className = 'folder-item-row';
    row.innerHTML = `
      <span title="${fPath}">📁 ${fPath}</span>
      <button class="btn-remove-folder" data-index="${index}" title="Remover da Vigilância">✕</button>
    `;

    row.querySelector('.btn-remove-folder').addEventListener('click', async () => {
      const updated = state.monitoredFolders.filter((_, i) => i !== index);
      const res = await window.fileShieldAPI.setWatchFolders(updated);
      state.monitoredFolders = res;
      renderActiveFoldersUI();
      renderDrivesUI();
      showToast('Pasta removida da vigilância');
    });

    activeFoldersListEl.appendChild(row);
  });
}

btnPresets.addEventListener('click', () => {
  modalPresets.classList.remove('hidden');
  renderDrivesUI();
  renderActiveFoldersUI();
});

folderCountBadge.addEventListener('click', () => {
  modalPresets.classList.remove('hidden');
  renderDrivesUI();
  renderActiveFoldersUI();
});

btnClosePresets.addEventListener('click', () => {
  modalPresets.classList.add('hidden');
});

modalPresets.addEventListener('click', (e) => {
  if (e.target === modalPresets) modalPresets.classList.add('hidden');
});

// Botão de Aplicar Modo Essencial
btnPresetEssential.addEventListener('click', async () => {
  const defaults = await window.fileShieldAPI.getDefaultFolders();
  if (defaults && defaults.length > 0) {
    const res = await window.fileShieldAPI.setWatchFolders(defaults);
    state.monitoredFolders = res;
    renderDrivesUI();
    renderActiveFoldersUI();
    showToast('Modo Essencial (Pastas do Usuário) aplicado!');
  }
});

btnAddCustomFolder.addEventListener('click', async () => {
  const updated = await window.fileShieldAPI.addFolderToWatch();
  if (updated) {
    state.monitoredFolders = updated;
    renderActiveFoldersUI();
    renderDrivesUI();
    showToast('Nova pasta adicionada!');
  }
});

// Modo Sentinela de Instalação (Auditoria Forense para IA)
let auditEventsCount = 0;

btnAudit.addEventListener('click', async () => {
  if (!auditBanner.classList.contains('hidden')) {
    showToast('Auditoria já está em andamento! Conclua para gerar o dossiê.');
    return;
  }
  const session = await window.fileShieldAPI.startAuditMode();
  if (session) {
    auditEventsCount = 0;
    auditBanner.classList.remove('hidden');
    btnAudit.classList.add('active');
    auditCounterBadge.textContent = '0 eventos capturados';
    playSound('normal');
    showToast('🧪 Modo Auditoria de Instalação ATIVADO! Pode executar o instalador.');
  }
});

btnFinishAudit.addEventListener('click', async () => {
  const result = await window.fileShieldAPI.stopAuditMode();
  if (result) {
    auditBanner.classList.add('hidden');
    btnAudit.classList.remove('active');
    
    // Atualiza contadores do Modal
    metricExecutables.textContent = result.createdExecutables ? result.createdExecutables.length : 0;
    metricStartup.textContent = result.startupModifications ? result.startupModifications.length : 0;
    metricUserFiles.textContent = result.userFilesTouched ? result.userFilesTouched.length : 0;

    // Gera texto estruturado com Prompt para IA
    const dossierText = generateForensicDossierText(result);
    dossierTextarea.value = dossierText;

    modalAudit.classList.remove('hidden');
    playSound('alert');
    showToast('Dossiê Forense de Instalação gerado com sucesso!');
  }
});

window.fileShieldAPI.onAuditStatus((status) => {
  if (status.active) {
    auditBanner.classList.remove('hidden');
    btnAudit.classList.add('active');
  } else {
    auditBanner.classList.add('hidden');
    btnAudit.classList.remove('active');
  }
});

window.fileShieldAPI.onAuditEvent((ev) => {
  auditEventsCount++;
  auditCounterBadge.textContent = `${auditEventsCount} evento(s) capturados`;
});

function generateForensicDossierText(session) {
  const startStr = session.startTime ? new Date(session.startTime).toLocaleString('pt-BR') : 'N/A';
  const endStr = session.endTime ? new Date(session.endTime).toLocaleString('pt-BR') : 'N/A';
  const totalEvents = session.events ? session.events.length : 0;
  const execs = session.createdExecutables || [];
  const startups = session.startupModifications || [];
  const userFiles = session.userFilesTouched || [];

  let text = `======================================================================\n`;
  text += `🛡️ DOSSIÊ DE AUDITORIA FORENSE DE INSTALAÇÃO (FileSentinel)\n`;
  text += `======================================================================\n\n`;
  text += `📋 METADADOS DA SESSÃO:\n`;
  text += `- Início da Instalação: ${startStr}\n`;
  text += `- Conclusão da Instalação: ${endStr}\n`;
  text += `- Total de Eventos de Disco Gravados: ${totalEvents}\n`;
  text += `- Novos Executáveis/Scripts Criados: ${execs.length}\n`;
  text += `- Modificações na Inicialização (Startup): ${startups.length}\n`;
  text += `- Arquivos Pessoais do Usuário Tocados: ${userFiles.length}\n\n`;

  text += `======================================================================\n`;
  text += `🤖 PROMPT PRONTO PARA ANÁLISE COM INTELIGÊNCIA ARTIFICIAL:\n`;
  text += `(Copie e cole este prompt no ChatGPT, Claude, Gemini ou Antigravity)\n`;
  text += `======================================================================\n\n`;
  text += `Você é um Especialista Sênior em Cibersegurança, Engenharia Reversa e Análise Forense de Malware no Windows.\n`;
  text += `Analise o log forense abaixo capturado pelo FileSentinel durante a instalação de um software no Windows:\n\n`;
  text += `PERGUNTAS DE ANÁLISE:\n`;
  text += `1. Há algum indício de comportamento malicioso, spyware, minerador oculto ou trojan?\n`;
  text += `2. Foram criados arquivos suspeitos ou mecanismos de persistência indevidos (ex: Startup, chaves ocultas, AppData)?\n`;
  text += `3. O instalador tentou ler, modificar ou deletar pastas pessoais do usuário que não faziam sentido para a instalação?\n`;
  text += `4. Qual o seu Veredito de Segurança final? (Classifique em: SEGURO, SUSPEITO ou PERIGOSO) e justifique detalhadamente.\n\n`;
  text += `--- LOG FORENSE DETALHADO DOS EVENTOS ---\n`;

  if (totalEvents === 0) {
    text += `(Nenhum arquivo foi criado ou modificado durante o período monitorado)\n`;
  } else {
    session.events.forEach((ev, idx) => {
      const proc = ev.process?.Name || 'Processo';
      text += `[${idx + 1}] [${ev.timestamp}] [${ev.action}] (${proc}) -> ${ev.fullPath}\n`;
    });
  }

  text += `\n======================================================================\n`;
  text += `FIM DO DOSSIÊ FORENSE - FileSentinel\n`;
  text += `======================================================================\n`;
  return text;
}

btnCopyDossier.addEventListener('click', () => {
  if (dossierTextarea.value) {
    window.fileShieldAPI.copyToClipboard(dossierTextarea.value);
    showToast('📋 Dossiê copiado! Cole no Gemini, Claude ou ChatGPT.');
  }
});

btnSaveDossier.addEventListener('click', async () => {
  if (!dossierTextarea.value) return;
  const savedPath = await window.fileShieldAPI.exportReport({
    content: dossierTextarea.value,
    defaultName: `FileSentinel_Dossie_Instalacao_${new Date().toISOString().slice(0,10)}.txt`,
    extension: 'txt'
  });
  if (savedPath) {
    showToast('Dossiê salvo em arquivo com sucesso!');
  }
});

btnCloseAuditModal.addEventListener('click', () => {
  modalAudit.classList.add('hidden');
});

btnDoneAudit.addEventListener('click', () => {
  modalAudit.classList.add('hidden');
});

modalAudit.addEventListener('click', (e) => {
  if (e.target === modalAudit) modalAudit.classList.add('hidden');
});

// Exportação de Relatório CSV
btnExport.addEventListener('click', async () => {
  if (state.events.length === 0) {
    showToast('Nenhum evento no feed para exportar.');
    return;
  }

  let csv = 'Data,Hora,Acao,Alerta,Processo,PID,Arquivo,Extensao,Pasta\n';
  for (const ev of state.events) {
    const safeProc = (ev.process?.Name || 'Processo').replace(/,/g, ' ');
    const safeName = (ev.fileName || '').replace(/,/g, ' ');
    const safeDir = (ev.directory || '').replace(/,/g, ' ');
    csv += `"${ev.date ? ev.date.slice(0,10) : ''}","${ev.timestamp}","${ev.action}","${ev.alertLevel}","${safeProc}","${ev.process?.Pid || 0}","${safeName}","${ev.extension}","${safeDir}"\n`;
  }

  const savedPath = await window.fileShieldAPI.exportReport({
    content: csv,
    defaultName: `FileSentinel_Logs_${new Date().toISOString().slice(0,10)}.csv`,
    extension: 'csv'
  });

  if (savedPath) {
    showToast('Relatório exportado com sucesso!');
  }
});

// Interações da Interface
searchInput.addEventListener('input', (e) => {
  state.searchQuery = e.target.value.trim();
  renderFeed();
});

chips.forEach(chip => {
  chip.addEventListener('click', () => {
    chips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.currentFilter = chip.dataset.filter;
    renderFeed();
  });
});

btnViewMode.addEventListener('click', () => {
  const isCurrentlyCompact = document.querySelector('.hud-container').classList.contains('compact-mode');
  setViewMode(!isCurrentlyCompact);
});

function setViewMode(isCompact) {
  const container = document.querySelector('.hud-container');
  container.classList.toggle('compact-mode', isCompact);
  if (layoutStateBadge) {
    layoutStateBadge.textContent = isCompact ? 'Compacto' : 'Expandido';
  }
  window.fileShieldAPI.saveConfig({ isCompactMode: isCompact });
  showToast(isCompact ? 'Modo Compacto ativado' : 'Modo Expandido ativado');
}

btnPause.addEventListener('click', togglePauseFeed);
btnClear.addEventListener('click', clearFeed);

btnPin.addEventListener('click', async () => {
  state.isAlwaysOnTop = !state.isAlwaysOnTop;
  const isTop = await window.fileShieldAPI.setAlwaysOnTop(state.isAlwaysOnTop);
  btnPin.classList.toggle('active', isTop);
  showToast(isTop ? 'Sempre no Topo ativado' : 'Sempre no Topo desativado');
});

opacityRange.addEventListener('input', (e) => {
  const val = parseInt(e.target.value, 10);
  opacityVal.textContent = `${val}%`;
  window.fileShieldAPI.setOpacity(val / 100);
});

btnMinimize.addEventListener('click', () => {
  window.fileShieldAPI.minimizeWindow();
});

btnClose.addEventListener('click', () => {
  window.fileShieldAPI.closeWindow();
});

// Inicialização com carregamento das preferências salvas
(async function init() {
  const config = await window.fileShieldAPI.getConfig();
  if (config) {
    state.isAlwaysOnTop = config.alwaysOnTop ?? true;
    btnPin.classList.toggle('active', state.isAlwaysOnTop);

    const savedOpacity = config.opacity !== undefined ? config.opacity : 0.95;
    const percent = Math.round(savedOpacity * 100);
    opacityRange.value = percent;
    opacityVal.textContent = `${percent}%`;

    if (config.soundEnabled !== undefined) {
      setSoundState(config.soundEnabled);
    }

    if (config.whitelist && Array.isArray(config.whitelist)) {
      state.whitelist = config.whitelist;
    }

    if (config.isCompactMode !== undefined) {
      setViewMode(config.isCompactMode);
    }
  }

  state.systemDrives = await window.fileShieldAPI.getSystemDrives();
  state.defaultFolders = await window.fileShieldAPI.getDefaultFolders();
  const folders = await window.fileShieldAPI.getMonitoredFolders();
  if (folders && folders.length > 0) {
    state.monitoredFolders = folders;
    folderCountBadge.textContent = `${folders.length} Pastas Vigiadas ⚙️`;
  }
})();
