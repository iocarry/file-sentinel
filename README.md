# 🛡️ FileSentinel - Windows File Activity HUD & Installation Forensics

O **FileSentinel** é um HUD de monitoramento de sistema de arquivos em tempo real e auditoria forense para Windows, desenvolvido em **Electron**, inspirado nas ferramentas Sysinternals e no File Shield clássico.

![FileSentinel Banner](icon.png)

---

## ✨ Principais Recursos

1. **Vigilância em Tempo Real (Kernel I/O):** Captura instantânea de arquivos criados, modificados e excluídos com identificação do processo responsável e suporte nativo a discos secundários.
2. **🧪 Modo Auditoria de Instalação (Dossiê Forense para IA):** Gravação sob demanda de tudo o que um instalador executa (executáveis criados, persistência em `Startup`, alterações em `AppData` e arquivos do usuário), gerando um relatório completo com **Prompt estruturado para IA (ChatGPT, Claude, Gemini)** dar o veredito de segurança.
3. **Pop-in Customizado Flutuante (Glassmorphism):** Notificações elegantes de canto de tela sem usar os toasts genéricos do Windows e sem roubar o foco de digitação ou jogos.
4. **Reconhecimento Inteligente de Processos:** Diferencia quando uma ação foi executada pelo usuário (ex: Visualizador de Fotos, Explorer, Bloco de Notas) ou por softwares/instaladores em segundo plano.
5. **🎛️ Alternador de Layout (Expandido / Compacto):** Alterne entre cartões ricos e detalhados ou uma lista compacta de alta densidade com um clique.
6. **⚙️ Menu de Ferramentas Popover:** Acesso rápido a controle de áudio, densidade, presets de disco, whitelist, pausa e exportação CSV.
7. **Filtro Inteligente de Ruído:** Descarta automaticamente arquivos temporários, logs do Windows e caches de streaming em nuvem (Google Drive, Dropbox, OneDrive).
8. **100% Silencioso na System Tray:** Modo *Close-to-Tray*, execução oculta via VBS sem terminal aberto e persistência de configurações em `%APPDATA%\filesentinel\filesentinel-config.json`.

---

## 🚀 Como Executar

### Inicialização Rápida:
- Dê um duplo clique no arquivo **`Iniciar_FileSentinel_Silencioso.vbs`** para abrir o HUD em segundo plano direto na bandeja do relógio.

### Desenvolvimento:
```bash
npm install
npm start
```

---

## 📂 Estrutura do Projeto
- `main.js`: Processo principal, janela frameless, System Tray, gerenciador de pop-ins e IPC.
- `popup.html`: Interface visual dos pop-ins flutuantes.
- `index.html` & `style.css`: Interface HUD dark glassmorphism.
- `renderer.js`: Gerenciador de feed, áudio sintetizado nativo, filtros e gerador de dossiê forense.
- `watcher-engine.js`: Motor reativo de I/O com `fs.watch` recursivo, filtros e heurísticas de auditoria.
- `get-process.ps1`: Identificação instantânea da janela e processo em foco via Win32.

---
🛡️ *Desenvolvido com foco em segurança, leveza e inteligência.*
