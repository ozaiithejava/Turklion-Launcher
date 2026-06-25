const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const https = require('https');
const http = require('http');
const url = require('url');
const os = require('os');
const DiscordRPC = require('discord-rpc');

// Check hardware acceleration synchronously before app starts
let hardwareAcceleration = true;
try {
  const configPath = path.join(getCrossPlatformAppData(), '.turklion', 'launcher_config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config.hardware_acceleration === false) {
      hardwareAcceleration = false;
    }
  }
} catch (e) {
  console.error("Error loading config synchronously for hardware acceleration check:", e);
}

if (!hardwareAcceleration) {
  app.disableHardwareAcceleration();
}

let mainWindow;
let resolvedBasePath = null;
let tray = null;
let splashWindow = null;

let rpc = null;
const clientId = '1101635614559977523';
let rpcStartTimestamp = Date.now();

function initDiscordRPC() {
  let discordRpcEnabled = true;
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.discord_rpc_enabled === false) {
        discordRpcEnabled = false;
      }
    }
  } catch (_) {}

  if (!discordRpcEnabled) {
    console.log("Discord RPC is disabled in configuration.");
    return;
  }

  if (rpc) return;

  rpc = new DiscordRPC.Client({ transport: 'ipc' });

  rpc.on('ready', () => {
    console.log('Discord RPC connected');
    let presenceState = 'Giriş Ekranında';
    let presenceDetails = 'Türklion Client oynamaya hazırlanıyor';
    try {
      const configPath = getConfigPath();
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.language === 'en') {
          presenceState = 'On Login Screen';
          presenceDetails = 'Preparing to play Türklion Client';
        }
      }
    } catch (_) {}
    updateDiscordPresence(presenceState, presenceDetails);
  });

  rpc.login({ clientId }).catch(err => {
    console.error('Failed to connect to Discord RPC:', err);
    rpc = null;
  });
}

function updateDiscordPresence(state, details) {
  if (!rpc) return;

  rpc.setActivity({
    details: details,
    state: state,
    startTimestamp: rpcStartTimestamp,
    largeImageKey: 'oig3',
    largeImageText: 'Minecraft 1.8.9',
    smallImageKey: 'logo_white',
    smallImageText: 'Türklion Client',
    instance: false,
    buttons: [
      { label: 'Web Sitesi', url: 'https://turklion.net' },
      { label: 'Discord', url: 'https://turklion.net/discord' }
    ]
  }).catch(err => {
    console.error('Failed to set Discord presence:', err);
  });
}

function shutdownDiscordRPC() {
  if (!rpc) return;
  try {
    rpc.destroy();
  } catch (_) {}
  rpc = null;
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 320,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    roundedCorners: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'src', 'splash.html'));

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'src', 'assets', 'icon.png');
  if (!fs.existsSync(iconPath)) {
    console.error("Tray icon not found at:", iconPath);
    return;
  }

  // Load the icon and resize it for the tray area with high quality
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 24, height: 24, quality: 'best' });
  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Türklion Launcher',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Göster / Gizle',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      }
    },
    {
      label: 'Konsolu Aç',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('switch-tab', 'tab-console');
        }
      }
    },
    {
      label: 'Ayarları Düzenle',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('switch-tab', 'tab-settings');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Çıkış',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Türklion Launcher');
  tray.setContextMenu(contextMenu);

  // Toggle window on double-click
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  // Toggle window on single click
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// ── Cross-Platform AppData Root ──────────────────────────────────────────
// Windows : %APPDATA%\.turklion
// macOS   : ~/Library/Application Support/.turklion
// Linux   : ~/.turklion
function getCrossPlatformAppData() {
  const plat = process.platform;
  if (plat === 'win32')  return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  if (plat === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support');
  return os.homedir(); // Linux: ~/.turklion
}
// ─────────────────────────────────────────────────────────────────────────

// Game Core Files Base Path (resolves where turklion.jar, libraries, assets exist)
function getBasePath() {
  return getAppDataPath();
}

// User AppData Path for config, jre, saves, options.txt
function getAppDataPath() {
  return path.join(getCrossPlatformAppData(), '.turklion');
}

function ensureAppDataDir() {
  const dir = getAppDataPath();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getConfigPath() {
  ensureAppDataDir();
  return path.join(getAppDataPath(), 'launcher_config.json');
}

function getDefaultConfig() {
  let detectedLang = 'tr';
  try {
    const sysLocale = app ? app.getLocale().toLowerCase() : 'tr';
    if (!sysLocale.startsWith('tr')) {
      detectedLang = 'en';
    }
  } catch (_) {}

  return {
    username: "ozaii",
    min_ram: "512M",
    max_ram: "2048M",
    java_path: "java",
    game_dir: "",
    hide_on_launch: true,
    theme: "purple",
    game_width: 854,
    game_height: 480,
    fullscreen: false,
    client_version: "0.0.0",
    jar_version: "0.0.0",
    accounts: ["ozaii"],
    close_behavior: "tray",
    language: detectedLang,
    discord_rpc_enabled: true,
    hardware_acceleration: true,
    force_gpu: false
  };
}

// Fetch Remote Version Manifest from GitHub (supports cache-busting and proxy fallback)
function fetchRemoteVersion() {
  return new Promise((resolve) => {
    const timestamp = Date.now();
    const directUrl = `https://raw.githubusercontent.com/ozaiithejava/Turklion-Client/main/version.json?t=${timestamp}`;
    const proxyUrl = `https://ghproxy.net/https://raw.githubusercontent.com/ozaiithejava/Turklion-Client/main/version.json?t=${timestamp}`;

    function tryFetch(urlToFetch, isFallback = false) {
      https.get(urlToFetch, (res) => {
        if (res.statusCode !== 200) {
          if (!isFallback) {
            console.log(`Direct manifest fetch failed (${res.statusCode}). Trying proxy fallback...`);
            tryFetch(proxyUrl, true);
          } else {
            resolve(null);
          }
          return;
        }
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(rawData);
            resolve(parsed);
          } catch (_) {
            if (!isFallback) {
              console.log("Failed to parse manifest JSON. Trying proxy fallback...");
              tryFetch(proxyUrl, true);
            } else {
              resolve(null);
            }
          }
        });
      }).on('error', (err) => {
        if (!isFallback) {
          console.log(`Direct manifest fetch error: ${err.message}. Trying proxy fallback...`);
          tryFetch(proxyUrl, true);
        } else {
          resolve(null);
        }
      });
    }

    tryFetch(directUrl, false);
  });
}

// Download File Helper (supports redirect and custom proxy prefix)
function downloadFile(fileUrl, outputPath, progressCallback, proxyPrefix = "") {
  return new Promise((resolve, reject) => {
    function startDownload(currentUrl) {
      // If we are redirecting to GitHub and we have a proxy prefix, inject it!
      if (proxyPrefix && currentUrl.startsWith('https://github.com/')) {
        currentUrl = proxyPrefix + currentUrl;
        console.log(`Using download proxy: ${currentUrl}`);
      }

      const parsedUrl = url.parse(currentUrl);
      const requestModule = parsedUrl.protocol === 'https:' ? https : http;

      const req = requestModule.get(currentUrl, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          startDownload(url.resolve(currentUrl, response.headers.location));
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Sunucu hata kodu döndürdü: ${response.statusCode}`));
          return;
        }

        const totalBytes = parseInt(response.headers['content-length'], 10);
        let downloadedBytes = 0;
        const fileStream = fs.createWriteStream(outputPath);

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          fileStream.write(chunk);
          if (totalBytes && progressCallback) {
            const progress = Math.round((downloadedBytes / totalBytes) * 100);
            progressCallback(progress);
          }
        });

        response.on('end', () => {
          fileStream.end();
          resolve();
        });

        response.on('error', (err) => {
          fileStream.close();
          fs.unlink(outputPath, () => {});
          reject(err);
        });

        fileStream.on('error', (err) => {
          fileStream.close();
          fs.unlink(outputPath, () => {});
          reject(err);
        });

      });

      req.on('error', (err) => {
        reject(err);
      });

      // Set connection timeout (15s)
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error("Bağlantı zaman aşımına uğradı (15s)"));
      });
    }

    startDownload(fileUrl);
  });
}

// Native unzip using PowerShell
function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    const cmd = `powershell.exe -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Arşiv çıkartılamadı: ${stderr || error.message}`));
      } else {
        resolve();
      }
    });
  });
}

// Concatenate multiple files into one
function concatFiles(inputPaths, outputPath) {
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(outputPath);
    let index = 0;
    
    function next() {
      if (index >= inputPaths.length) {
        writeStream.end();
        resolve();
        return;
      }
      const readStream = fs.createReadStream(inputPaths[index]);
      readStream.pipe(writeStream, { end: false });
      readStream.on('end', () => {
        index++;
        next();
      });
      readStream.on('error', (err) => {
        writeStream.end();
        reject(err);
      });
    }
    
    next();
  });
}

// Install JRE structure helper (Windows - .zip)
async function installJava(zipPath, jreDir) {
  const appData = getAppDataPath();
  const tempExtractDir = path.join(appData, 'jre8_temp');
  
  await extractZip(zipPath, tempExtractDir);
  
  const items = fs.readdirSync(tempExtractDir);
  const nestedDirName = items.find(item => fs.statSync(path.join(tempExtractDir, item)).isDirectory());
  
  if (!nestedDirName) {
    throw new Error("Arşivden geçerli bir JRE klasörü bulunamadı.");
  }
  
  const nestedDirPath = path.join(tempExtractDir, nestedDirName);
  
  if (!fs.existsSync(jreDir)) {
    fs.mkdirSync(jreDir, { recursive: true });
  }
  
  const files = fs.readdirSync(nestedDirPath);
  for (const file of files) {
    const src = path.join(nestedDirPath, file);
    const dest = path.join(jreDir, file);
    fs.renameSync(src, dest);
  }
  
  fs.rmSync(tempExtractDir, { recursive: true, force: true });
  fs.rmSync(zipPath, { force: true });
}

// Install JRE structure helper (Linux/macOS - .tar.gz)
async function installJavaTarGz(tarPath, jreDir) {
  const appData = getAppDataPath();
  const tempExtractDir = path.join(appData, 'jre8_temp');

  if (!fs.existsSync(tempExtractDir)) {
    fs.mkdirSync(tempExtractDir, { recursive: true });
  }

  // Use system tar to extract
  await new Promise((resolve, reject) => {
    const tar = spawn('tar', ['-xzf', tarPath, '-C', tempExtractDir]);
    tar.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`tar extraction failed with code ${code}`));
    });
    tar.on('error', reject);
  });

  const items = fs.readdirSync(tempExtractDir);
  const nestedDirName = items.find(item => fs.statSync(path.join(tempExtractDir, item)).isDirectory());

  if (!nestedDirName) {
    throw new Error("tar.gz arşivinden geçerli bir JRE klasörü bulunamadı.");
  }

  const nestedDirPath = path.join(tempExtractDir, nestedDirName);

  if (!fs.existsSync(jreDir)) {
    fs.mkdirSync(jreDir, { recursive: true });
  }

  const files = fs.readdirSync(nestedDirPath);
  for (const file of files) {
    const src = path.join(nestedDirPath, file);
    const dest = path.join(jreDir, file);
    fs.renameSync(src, dest);
  }

  // Make java executable on Unix
  const javaExe = path.join(jreDir, 'bin', 'java');
  if (fs.existsSync(javaExe)) {
    fs.chmodSync(javaExe, 0o755);
  }

  fs.rmSync(tempExtractDir, { recursive: true, force: true });
  fs.rmSync(tarPath, { force: true });
}


// Check if a java path or command works
function isJavaWorking(javaPath) {
  return new Promise((resolve) => {
    exec(`"${javaPath}" -version`, (error, stdout, stderr) => {
      const output = (stdout + stderr).toLowerCase();
      // Java outputs version details to stderr, check for standard keywords
      if (!error && (output.includes('version') || output.includes('openjdk') || output.includes('java'))) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

// Send logs directly to the launcher console tab
function logToLauncherConsole(msg, isError = false) {
  if (mainWindow) {
    mainWindow.webContents.send('game-log', `[Launcher] ${isError ? '[HATA] ' : ''}${msg}`);
  }
}

// Check if a directory exists and is not empty
function isNonEmptyDir(dirPath) {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory() && fs.readdirSync(dirPath).length > 0;
  } catch (_) {
    return false;
  }
}

// Check if a file exists and is not empty
function isNonEmptyFile(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile() && fs.statSync(filePath).size > 0;
  } catch (_) {
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 580,
    frame: false,
    resizable: false,
    transparent: true,
    hasShadow: false,
    roundedCorners: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'Türklion Launcher',
    icon: path.join(__dirname, 'src', 'assets', 'icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      if (splashWindow) {
        splashWindow.close();
      }
      mainWindow.show();
      mainWindow.focus();
    }, 2500);
  });

  mainWindow.on('close', (event) => {
    let closeBehavior = 'tray';
    try {
      const configPath = getConfigPath();
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.close_behavior === 'exit') {
          closeBehavior = 'exit';
        }
      }
    } catch (_) {}

    if (closeBehavior === 'exit') {
      app.isQuitting = true;
      app.quit();
    } else {
      if (!app.isQuitting) {
        event.preventDefault();
        mainWindow.hide();
        
        let balloonTitle = 'Türklion Launcher';
        let balloonContent = 'Launcher arka planda çalışmaya devam ediyor. Kapatmak için sistem tepsisindeki simgeye sağ tıklayıp Çıkış seçeneğini kullanabilirsiniz.';
        try {
          const configPath = getConfigPath();
          if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            if (config.language === 'en') {
              balloonContent = 'Launcher continues to run in the background. To close, right-click the system tray icon and select Exit.';
            }
          }
        } catch (_) {}

        if (!app.hasShownTrayBalloon) {
          if (tray) {
            tray.displayBalloon({
              iconType: 'info',
              title: balloonTitle,
              content: balloonContent
            });
          }
          app.hasShownTrayBalloon = true;
        }
      }
    }
  });
}

app.whenReady().then(() => {
  ensureAppDataDir();
  initDiscordRPC();

  // IPC Handlers
  ipcMain.handle('minimize-window', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.handle('maximize-window', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('close-window', () => {
    app.quit();
  });

  ipcMain.handle('get-server-status', async () => {
    return new Promise((resolve) => {
      https.get('https://api.mcsrvstat.us/3/play.turklion.net', (res) => {
        if (res.statusCode !== 200) {
          resolve({ online: false, error: 'Sunucu yanıt vermedi' });
          return;
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve({
              online: !!json.online,
              players: json.players ? { online: json.players.online || 0, max: json.players.max || 2000 } : { online: 0, max: 2000 },
              motd: json.motd && json.motd.clean ? json.motd.clean.join(' ') : 'Türklion Sunucusu',
              ping: json.debug && typeof json.debug.ping === 'number' ? json.debug.ping : 35
            });
          } catch (_) {
            resolve({ online: false, error: 'JSON ayrıştırılamadı' });
          }
        });
      }).on('error', (err) => {
        resolve({ online: false, error: err.message });
      });
    });
  });

  ipcMain.handle('send-bug-report', async (event, { username, osDetails, maxRam, logs }) => {
    return new Promise((resolve) => {
      const webhookUrl = 'https://webhook.lewisakura.moe/api/webhooks/1516931623944454225/6RTLXMGsKxNArBGWWWjyVF05Vf4v0-nQasFAne22BHOEwNsD9BjclM2KmUMEEF8iaky8';
      const payload = JSON.stringify({
        username: 'Türklion Rapor Botu',
        avatar_url: 'https://raw.githubusercontent.com/ozaiithejava/Turklion-Client/main/icon.png',
        embeds: [{
          title: '⚠️ Yeni Hata & Log Raporu',
          color: 11036407, // Neon Purple
          fields: [
            { name: 'Kullanıcı Adı', value: username || 'Belirtilmemiş', inline: true },
            { name: 'İşletim Sistemi', value: osDetails || 'Belirtilmemiş', inline: true },
            { name: 'Ayrılan Bellek (Xmx)', value: maxRam || 'Belirtilmemiş', inline: true }
          ],
          description: `**Konsol Günlükleri (Son 15 Satır):**\n\`\`\`\n${logs}\n\`\`\``,
          timestamp: new Date().toISOString()
        }]
      });

      const parsedUrl = url.parse(webhookUrl);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: `Webhook error: ${res.statusCode} - ${body}` });
          }
        });
      });

      req.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });

      req.write(payload);
      req.end();
    });
  });

  ipcMain.handle('open-external-url', (event, url) => {
    shell.openExternal(url);
  });

  ipcMain.handle('get-system-ram', () => {
    return os.totalmem();
  });

  ipcMain.handle('get-config', () => {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(content);
      } catch (err) {
        console.error("Config load error:", err);
      }
    }
    return getDefaultConfig();
  });

  ipcMain.handle('save-config', (event, config) => {
    const configPath = getConfigPath();
    try {
      let current = getDefaultConfig();
      if (fs.existsSync(configPath)) {
        try {
          const content = fs.readFileSync(configPath, 'utf-8');
          current = JSON.parse(content);
        } catch (_) {}
      }
      const previousRpcEnabled = current.discord_rpc_enabled !== false;
      const newRpcEnabled = config.discord_rpc_enabled !== false;

      const merged = { ...current, ...config };
      fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8');

      if (previousRpcEnabled !== newRpcEnabled) {
        if (newRpcEnabled) {
          initDiscordRPC();
        } else {
          shutdownDiscordRPC();
        }
      }
      return { success: true };
    } catch (err) {
      console.error("Config save error:", err);
      throw new Error(`Konfigürasyon dosyası kaydedilemedi: ${err.message}`);
    }
  });

  ipcMain.handle('check-game-configured', () => {
    const base = getBasePath();
    const appData = getAppDataPath();
    const jarExists = fs.existsSync(path.join(appData, 'turklion.jar'));
    const nativesExists = fs.existsSync(path.join(base, '1.8.9-natives'));
    const libsExists = fs.existsSync(path.join(base, 'libraries'));
    return jarExists || nativesExists || libsExists;
  });

  ipcMain.handle('select-game-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Oyun Klasörünü (turklion.jar veya libraries içeren klasör) Seçin',
      properties: ['openDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) {
      return '';
    }
    
    const selectedPath = result.filePaths[0];
    const hasJar = fs.existsSync(path.join(selectedPath, 'turklion.jar')) || fs.existsSync(path.join(getAppDataPath(), 'turklion.jar'));
    const hasLibs = fs.existsSync(path.join(selectedPath, 'libraries'));
    const hasNatives = fs.existsSync(path.join(selectedPath, '1.8.9-natives'));

    if (hasJar || hasLibs || hasNatives) {
      const configPath = getConfigPath();
      let config = getDefaultConfig();
      if (fs.existsSync(configPath)) {
        try {
          config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        } catch (_) {}
      }
      config.game_dir = selectedPath;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      
      resolvedBasePath = selectedPath;
      return selectedPath;
    } else {
      throw new Error("Seçilen klasör geçerli bir oyun klasörü değil! Klasörde 'libraries', '1.8.9-natives' veya 'turklion.jar' bulunmalıdır.");
    }
  });

  ipcMain.handle('check-game-status', () => {
    const base = getBasePath();
    const appData = getAppDataPath();
    const jarExists = fs.existsSync(path.join(appData, 'turklion.jar'));
    const nativesExists = fs.existsSync(path.join(base, '1.8.9-natives'));
    const libsExists = fs.existsSync(path.join(base, 'libraries'));
    
    const log4jApi = path.join(base, 'libraries', 'org', 'apache', 'logging', 'log4j', 'log4j-api', '2.0-beta9', 'log4j-api-2.0-beta9.jar');
    const log4jCore = path.join(base, 'libraries', 'org', 'apache', 'logging', 'log4j', 'log4j-core', '2.0-beta9', 'log4j-core-2.0-beta9.jar');
    const log4jExists = fs.existsSync(log4jApi) && fs.existsSync(log4jCore);

    return {
      jar_exists: jarExists,
      natives_exists: nativesExists,
      libs_exists: libsExists,
      log4j_exists: log4jExists
    };
  });

  ipcMain.handle('check-java-installed', async () => {
    const appData = getAppDataPath();
    const javaExeName = process.platform === 'win32' ? 'java.exe' : 'java';
    const localJava = path.join(appData, 'jre8', 'bin', javaExeName);
    return fs.existsSync(localJava);
  });

  ipcMain.handle('download-java', async () => {
    const appData = getAppDataPath();
    const jreDir = path.join(appData, 'jre8');
    
    // ── OS/Arch-Aware Adoptium JRE 8 URL ─────────────────────────────────────
    const plat = process.platform; // 'win32' | 'linux' | 'darwin'
    const arch = process.arch;     // 'x64' | 'arm64' | 'ia32'
    const adoptiumOS   = plat === 'win32' ? 'windows' : plat === 'darwin' ? 'mac' : 'linux';
    const adoptiumArch = arch === 'arm64' ? 'aarch64' : 'x64';
    const isWin        = plat === 'win32';
    const archiveExt   = isWin ? 'zip' : 'tar.gz';
    const javaUrl = `https://api.adoptium.net/v3/binary/latest/8/ga/${adoptiumOS}/${adoptiumArch}/jre/hotspot/normal/eclipse`;
    
    const tempZipName = `jre8_download_${Date.now()}.${archiveExt}`;
    const zipPath = path.join(os.tmpdir(), tempZipName);
    // ─────────────────────────────────────────────────────────────────────────
    
    logToLauncherConsole(`[Stage 2/6] Özel Java JRE 8 indirme işlemi başlatıldı.`);
    logToLauncherConsole(`[Stage 2/6] Geçici indirilecek dosya yolu: ${zipPath}`);
    logToLauncherConsole(`[Stage 2/6] Kurulacak hedef dizin: ${jreDir}`);
    logToLauncherConsole(`[Stage 2/6] Java indirme: ${adoptiumOS} / ${adoptiumArch} (${archiveExt})`);
    const proxies = [
      "", // Direct (fallback to CDN redirect)
      "https://ghp.ci/", // Proxy 1
      "https://github.moeyy.xyz/", // Proxy 2
      "https://ghproxy.net/" // Proxy 3
    ];

    let lastError = null;

    // Clear existing JRE directory if it exists to start fresh
    if (fs.existsSync(jreDir)) {
      try {
        fs.rmSync(jreDir, { recursive: true, force: true });
      } catch (e) {
        console.error("Failed to delete existing JRE dir:", e);
      }
    }

    for (let i = 0; i < proxies.length; i++) {
      const proxy = proxies[i];
      const proxyMsg = proxy ? `(CDN Ağı - Bağlantı ${i})` : "(Doğrudan Bağlantı)";
      
      try {
        console.log(`Java indirme deneniyor: ${proxyMsg}...`);
        
        mainWindow.webContents.send('java-download-progress', { 
          status: 'downloading', 
          percent: 0, 
          msg: `Java indiriliyor ${proxyMsg}...` 
        });
        
        await downloadFile(javaUrl, zipPath, (percent) => {
          mainWindow.webContents.send('java-download-progress', { 
            status: 'downloading', 
            percent, 
            msg: `Java indiriliyor ${proxyMsg}...` 
          });
        }, proxy);

        // Download succeeded! Now extract
        mainWindow.webContents.send('java-download-progress', {
          status: 'extracting', percent: 100,
          msg: "Java JRE 8 kuruluyor..."
        });

        if (isWin) {
          await installJava(zipPath, jreDir);
        } else {
          await installJavaTarGz(zipPath, jreDir);
        }

        mainWindow.webContents.send('java-download-progress', { 
          status: 'ready', 
          percent: 100, 
          msg: "Java başarıyla kuruldu!" 
        });
        
        return { success: true };
      } catch (err) {
        console.error(`Download/extract failed with proxy "${proxy}":`, err);
        lastError = err;
        
        // Clean up temp zip file
        if (fs.existsSync(zipPath)) {
          try { fs.rmSync(zipPath, { force: true }); } catch (_) {}
        }
      }
    }

    mainWindow.webContents.send('java-download-progress', { 
      status: 'error', 
      error: lastError.message 
    });
    
    throw new Error(`Java yüklenemedi: ${lastError.message}`);
  });

  ipcMain.handle('select-java-path', async () => {
    const isWin = process.platform === 'win32';
    const dialogOpts = {
      title: isWin ? 'Java 8 Executable (java.exe) Seç' : 'Java 8 Executable Seç',
      properties: ['openFile']
    };
    if (isWin) {
      dialogOpts.filters = [{ name: 'Java Executable', extensions: ['exe'] }];
    }
    const result = await dialog.showOpenDialog(dialogOpts);
    if (result.canceled || result.filePaths.length === 0) {
      return '';
    }
    return result.filePaths[0];
  });

  ipcMain.handle('auto-update-resources', async (event) => {
    const base = getBasePath();
    const appData = getAppDataPath();
    
    const jarPath = path.join(appData, 'turklion.jar');
    const nativesPath = path.join(base, '1.8.9-natives');
    const libsDir = path.join(base, 'libraries');
    const assetsDir = path.join(base, 'assets');
    const configPath = getConfigPath();

    logToLauncherConsole(`[AutoUpdate] Güncelleme kontrolü başlatıldı...`);
    
    // 1. Fetch remote version manifest from GitHub
    logToLauncherConsole("[Stage 3/6] GitHub sunucusundan sürüm manifestosu (version.json) sorgulanıyor...");
    const remote = await fetchRemoteVersion();
    
    const jarExists = isNonEmptyFile(jarPath);
    const nativesExists = isNonEmptyDir(nativesPath);
    const libsExists = isNonEmptyDir(libsDir);
    const assetsExists = isNonEmptyDir(assetsDir);
    const allFilesExist = jarExists && nativesExists && libsExists && assetsExists;

    if (!remote) {
      if (allFilesExist) {
        logToLauncherConsole("[Stage 3/6] UYARI: Güncelleme sunucusuna bağlanılamadı. Çevrimdışı/Yerel modda devam ediliyor.");
        return { success: true, offline: true };
      } else {
        logToLauncherConsole("[Stage 3/6] HATA: Güncelleme sunucusuna bağlanılamadı ve gerekli oyun dosyaları yerelde bulunamadı!", true);
        return { success: false, error: "İnternet bağlantısı yok ve yerel oyun dosyaları eksik! Lütfen internetinizi kontrol edin." };
      }
    }

    const remoteClientVer = remote.client_version || "1.0.0";
    const remoteJarVer = remote.jar_version || "1.0.0";
    const jarUrl = remote.jar_url || "https://raw.githubusercontent.com/ozaiithejava/Turklion-Client/main/turklion.jar";
    const remoteChunks = remote.client_chunks || ["client_files.zip"];

    logToLauncherConsole(`[Stage 3/6] Sürüm manifestosu başarıyla alındı. Güncel İstemci: ${remoteClientVer}, Güncel Jar: ${remoteJarVer}`);

    // Read local config
    let localConfig = getDefaultConfig();
    if (fs.existsSync(configPath)) {
      try {
        localConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      } catch (_) {}
    }
    const localClientVer = localConfig.client_version || "0.0.0";
    const localJarVer = localConfig.jar_version || "0.0.0";

    // 2. Check and download client package files (libraries, assets, natives)
    let needAssetsDownload = !nativesExists || !libsExists || !assetsExists || (localClientVer !== remoteClientVer);

    if (nativesExists && libsExists && assetsExists && (localClientVer === "0.0.0" || localClientVer === "")) {
      logToLauncherConsole(`[Stage 4/6] Oyun dosyaları zaten mevcut. Sürüm işareti güncelleniyor: ${remoteClientVer}`);
      needAssetsDownload = false;
      localConfig.client_version = remoteClientVer;
      fs.writeFileSync(configPath, JSON.stringify(localConfig, null, 2), 'utf-8');
    }

    if (needAssetsDownload) {
      logToLauncherConsole(`[Stage 4/6] Paket dosyaları eksik veya güncel değil (Yerel: ${localClientVer}, Güncel: ${remoteClientVer}). İndirme başlatılıyor...`);
      const tempChunkPaths = [];
      const zipPath = path.join(os.tmpdir(), `client_files_concat_${Date.now()}.zip`);

      try {
        for (let i = 0; i < remoteChunks.length; i++) {
          const chunkName = remoteChunks[i];
          const chunkPath = path.join(os.tmpdir(), `${chunkName}_temp_${Date.now()}`);
          tempChunkPaths.push(chunkPath);

          logToLauncherConsole(`[Stage 4/6] Paket dosyası bölümü (${i + 1}/${remoteChunks.length}) indiriliyor...`);
          
          event.sender.send('auto-update-progress', { 
            status: 'downloading', 
            percent: 0, 
            msg: `Dosyalar indiriliyor (${i + 1}/${remoteChunks.length})...` 
          });

          const timestamp = Date.now();
          const chunkUrls = [
            `https://raw.githubusercontent.com/ozaiithejava/Turklion-Client/main/${chunkName}?t=${timestamp}`,
            `https://ghproxy.net/https://raw.githubusercontent.com/ozaiithejava/Turklion-Client/main/${chunkName}?t=${timestamp}`
          ];

          let downloadSuccess = false;
          let downloadError = null;

          for (const urlToDownload of chunkUrls) {
            try {
              await downloadFile(urlToDownload, chunkPath, (percent) => {
                event.sender.send('auto-update-progress', { 
                  status: 'downloading', 
                  percent, 
                  msg: `Dosyalar indiriliyor (${i + 1}/${remoteChunks.length})...` 
                });
              });
              downloadSuccess = true;
              break;
            } catch (err) {
              downloadError = err;
            }
          }

          if (!downloadSuccess) {
            throw downloadError || new Error(`Paket dosyası (${chunkName}) indirilemedi.`);
          }
        }

        logToLauncherConsole("[Stage 4/6] Paket bölümleri birleştiriliyor...");
        event.sender.send('auto-update-progress', { 
          status: 'extracting', 
          percent: 50, 
          msg: "Paket dosyaları birleştiriliyor..." 
        });

        await concatFiles(tempChunkPaths, zipPath);

        logToLauncherConsole(`[Stage 4/6] Paket çıkartılıyor: ${base}`);
        event.sender.send('auto-update-progress', { 
          status: 'extracting', 
          percent: 100, 
          msg: "Dosyalar kuruluyor..." 
        });

        await extractZip(zipPath, base);
        
        localConfig.client_version = remoteClientVer;
        fs.writeFileSync(configPath, JSON.stringify(localConfig, null, 2), 'utf-8');

        // Cleanup
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        for (const cp of tempChunkPaths) {
          if (fs.existsSync(cp)) fs.unlinkSync(cp);
        }
      } catch (err) {
        logToLauncherConsole(`[Stage 4/6] HATA: ${err.message}`, true);
        if (fs.existsSync(zipPath)) { try { fs.unlinkSync(zipPath); } catch (_) {} }
        for (const cp of tempChunkPaths) { if (fs.existsSync(cp)) { try { fs.unlinkSync(cp); } catch (_) {} } }
        return { success: false, error: `Dosyalar indirilemedi: ${err.message}` };
      }
    } else {
      logToLauncherConsole(`[Stage 4/6] Tüm kütüphane ve varlık dosyaları güncel (Sürüm: ${localClientVer}).`);
    }

    // 3. Check and download client jar (turklion.jar)
    let needJarDownload = !jarExists || (localJarVer !== remoteJarVer);

    if (jarExists && (localJarVer === "0.0.0" || localJarVer === "")) {
      logToLauncherConsole(`[Stage 5/6] Client jar dosyası zaten mevcut. Sürüm işareti güncelleniyor: ${remoteJarVer}`);
      needJarDownload = false;
      localConfig.jar_version = remoteJarVer;
      fs.writeFileSync(configPath, JSON.stringify(localConfig, null, 2), 'utf-8');
    }

    if (needJarDownload) {
      logToLauncherConsole(`[Stage 5/6] Client jar dosyası güncelleniyor (Sürüm: ${remoteJarVer})...`);
      event.sender.send('auto-update-progress', { 
        status: 'downloading', 
        percent: 0, 
        msg: "Client jar dosyası güncelleniyor..." 
      });

      let jarDownloadSuccess = false;
      let jarDownloadError = null;

      const jarUrls = [
        `${jarUrl}?t=${Date.now()}`,
        `https://ghproxy.net/${jarUrl}?t=${Date.now()}`
      ];

      for (const urlToDownload of jarUrls) {
        try {
          await downloadFile(urlToDownload, jarPath, (percent) => {
            event.sender.send('auto-update-progress', { 
              status: 'downloading', 
              percent, 
              msg: "Client jar dosyası güncelleniyor..." 
            });
          });
          jarDownloadSuccess = true;
          break;
        } catch (err) {
          jarDownloadError = err;
        }
      }

      if (!jarDownloadSuccess) {
        return { success: false, error: `Client jar dosyası güncellenemedi: ${jarDownloadError.message}` };
      }

      localConfig.jar_version = remoteJarVer;
      fs.writeFileSync(configPath, JSON.stringify(localConfig, null, 2), 'utf-8');
    } else {
      logToLauncherConsole(`[Stage 5/6] Client jar dosyası güncel (Sürüm: ${localJarVer}).`);
    }

    logToLauncherConsole(`[AutoUpdate] Tüm güncellemeler tamamlandı ve doğrulandı.`);
    return { success: true };
  });

  ipcMain.handle('launch-game', async (event, config) => {
    const base = getBasePath();
    const appData = getAppDataPath();
    
    const jarPath = path.join(appData, 'turklion.jar');
    // ── OS-specific natives folder ──────────────────────────────────────────
    const nativesFolderName = process.platform === 'darwin' ? '1.8.9-natives-osx'
                            : process.platform === 'linux'  ? '1.8.9-natives-linux'
                            : '1.8.9-natives'; // win32
    const nativesPath = path.join(base, nativesFolderName);
    // ────────────────────────────────────────────────────────────────────
    const libsDir = path.join(base, 'libraries');
    const assetsDir = path.join(base, 'assets');

    logToLauncherConsole(`Aktif Oyun Klasörü (Base): ${base}`);
    logToLauncherConsole(`Aktif Veri Klasörü (AppData): ${appData}`);

    // Quick verification
    if (!fs.existsSync(jarPath) || !fs.existsSync(nativesPath) || !fs.existsSync(libsDir)) {
      throw new Error("Oyun dosyaları eksik! Lütfen launcher'ı yeniden başlatarak güncelleme işlemini tamamlayın.");
    }

    ensureAppDataDir();

    // Clean up temporary files, logs, and crash reports
    try {
      const logsDir = path.join(appData, 'logs');
      const crashDir = path.join(base, 'crash-reports');
      
      if (fs.existsSync(logsDir)) {
        fs.rmSync(logsDir, { recursive: true, force: true });
        fs.mkdirSync(logsDir);
      }
      if (fs.existsSync(crashDir)) {
        fs.rmSync(crashDir, { recursive: true, force: true });
      }
      logToLauncherConsole(`[Sistem] Önbellek ve günlük dosyaları arka planda temizlendi.`);
    } catch (err) {
      console.warn("Cleanup error:", err);
    }

    // Build CP
    let cpParts = [
      jarPath,
      path.join(libsDir, 'org', 'apache', 'logging', 'log4j', 'log4j-api', '2.0-beta9', 'log4j-api-2.0-beta9.jar'),
      path.join(libsDir, 'org', 'apache', 'logging', 'log4j', 'log4j-core', '2.0-beta9', 'log4j-core-2.0-beta9.jar'),
      path.join(libsDir, 'net', 'sf', 'jopt-simple', 'jopt-simple', '4.6', 'jopt-simple-4.6.jar'),
      path.join(libsDir, 'com', 'google', 'guava', 'guava', '17.0', 'guava-17.0.jar'),
      path.join(libsDir, 'com', 'google', 'code', 'gson', 'gson', '2.2.4', 'gson-2.2.4.jar'),
      path.join(libsDir, 'org', 'apache', 'commons', 'commons-lang3', '3.3.2', 'commons-lang3-3.3.2.jar'),
      path.join(libsDir, 'commons-io', 'commons-io', '2.4', 'commons-io-2.4.jar'),
      path.join(libsDir, 'org', 'apache', 'httpcomponents', 'httpclient', '4.3.3', 'httpclient-4.3.3.jar'),
      path.join(libsDir, 'org', 'apache', 'httpcomponents', 'httpcore', '4.3.2', 'httpcore-4.3.2.jar'),
      path.join(libsDir, 'commons-codec', 'commons-codec', '1.9', 'commons-codec-1.9.jar'),
      path.join(libsDir, 'io', 'netty', 'netty-all', '4.0.23.Final', 'netty-all-4.0.23.Final.jar'),
      path.join(libsDir, 'com', 'mojang', 'authlib', '1.5.21', 'authlib-1.5.21.jar'),
      path.join(libsDir, 'commons-logging', 'commons-logging', '1.1.3', 'commons-logging-1.1.3.jar'),
      path.join(libsDir, 'org', 'apache', 'commons', 'commons-compress', '1.8.1', 'commons-compress-1.8.1.jar'),
      path.join(libsDir, 'org', 'lwjgl', 'lwjgl', 'lwjgl', '2.9.4-nightly-20150209', 'lwjgl-2.9.4-nightly-20150209.jar'),
      path.join(libsDir, 'org', 'lwjgl', 'lwjgl', 'lwjgl_util', '2.9.4-nightly-20150209', 'lwjgl_util-2.9.4-nightly-20150209.jar'),
      path.join(libsDir, 'com', 'paulscode', 'codecjorbis', '20101023', 'codecjorbis-20101023.jar'),
      path.join(libsDir, 'com', 'paulscode', 'codecwav', '20101023', 'codecwav-20101023.jar'),
      path.join(libsDir, 'com', 'paulscode', 'libraryjavasound', '20101123', 'libraryjavasound-20101123.jar'),
      path.join(libsDir, 'com', 'paulscode', 'librarylwjglopenal', '20100824', 'librarylwjglopenal-20100824.jar'),
      path.join(libsDir, 'com', 'paulscode', 'soundsystem', '20120107', 'soundsystem-20120107.jar'),
      path.join(libsDir, 'org', 'jcraft', 'jorbis', '0.0.17', 'jorbis-0.0.17.jar'),
      path.join(libsDir, 'com', 'ibm', 'icu', 'icu4j-core-mojang', '51.2', 'icu4j-core-mojang-51.2.jar'),
      path.join(libsDir, 'net', 'java', 'dev', 'jna', 'jna', '3.4.0', 'jna-3.4.0.jar'),
      path.join(libsDir, 'net', 'java', 'dev', 'jna', 'platform', '3.4.0', 'platform-3.4.0.jar'),
      path.join(libsDir, 'net', 'java', 'jinput', 'jinput', '2.0.5', 'jinput-2.0.5.jar'),
      path.join(libsDir, 'net', 'java', 'jutils', 'jutils', '1.0.0', 'jutils-1.0.0.jar'),
    ];

    const twitchPath = path.join(libsDir, 'tv', 'twitch', 'twitch', '6.5', 'twitch-6.5.jar');
    if (fs.existsSync(twitchPath)) {
      cpParts.push(twitchPath);
    }
    const realmsPath = path.join(libsDir, 'com', 'mojang', 'realms', '1.7.59', 'realms-1.7.59.jar');
    if (fs.existsSync(realmsPath)) {
      cpParts.push(realmsPath);
    }

    // ── OS-specific classpath separator (; on Windows, : on Linux/macOS) ────────────
    const cpSep = process.platform === 'win32' ? ';' : ':';
    const cp = cpParts.join(cpSep);
    // ─────────────────────────────────────────────────────────────────────────

    // ── SESSION TOKEN (Launcher-Only Auth) ──────────────────────────────────
    // Generate a cryptographically random token, write to session.lock,
    // and pass it as a JVM property so the client can verify it was
    // launched by this launcher (not run directly).
    const crypto = require('crypto');
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionLockPath = path.join(appData, 'session.lock');
    const sessionPayload = JSON.stringify({
      token: sessionToken,
      expires: Date.now() + 30000,  // 30 saniye geçerli
      launcher: 'TurklionLauncher',
      version: '1.0.0'
    });
    fs.writeFileSync(sessionLockPath, sessionPayload, 'utf8');
    logToLauncherConsole(`[Sistem] Oturum token'ı oluşturuldu ve session.lock dosyasına yazıldı.`);
    // ────────────────────────────────────────────────────────────────────────

    // JVM Args
    const args = [
      '-Dfile.encoding=UTF-8',
      `-Djava.library.path=${nativesPath}`,
      '-Dlog4j.configurationFile=log4j2.xml',
      `-Xms${config.min_ram}`,
      `-Xmx${config.max_ram}`,
      `-Dturklion.token=${sessionToken}`,
      `-Dturklion.appdata=${appData}`
    ];


    if (config.force_gpu) {
      args.push('-Dsun.java2d.d3d=true');
      args.push('-Dsun.java2d.noddraw=true');
      logToLauncherConsole(`[Sistem] Yüksek Performanslı GPU zorlaması aktif (sun.java2d.d3d=true).`);
    }

    args.push('-cp', cp, 'net.minecraft.client.main.Main');

    // Game Args
    args.push(
      '--username', config.username,
      '--version', '1.8.9',
      '--gameDir', appData,
      '--assetsDir', path.join(base, 'assets'),
      '--assetIndex', '1.8',
      '--accessToken', '0',
      '--uuid', '00000000-0000-0000-0000-000000000000',
      '--userType', 'legacy'
    );

    // Custom game resolution
    if (config.fullscreen) {
      args.push('--fullscreen');
    } else {
      if (config.game_width) args.push('--width', String(config.game_width));
      if (config.game_height) args.push('--height', String(config.game_height));
    }

    // Sync launcher language with Minecraft options.txt
    try {
      const optionsPath = path.join(appData, 'options.txt');
      const targetLang = config.language === 'tr' ? 'tr_TR' : 'en_US';
      let optionsContent = '';
      if (fs.existsSync(optionsPath)) {
        optionsContent = fs.readFileSync(optionsPath, 'utf-8');
        if (optionsContent.includes('lang:')) {
          optionsContent = optionsContent.replace(/^lang:.*$/m, `lang:${targetLang}`);
        } else {
          optionsContent += `\nlang:${targetLang}`;
        }
      } else {
        optionsContent = `lang:${targetLang}\n`;
      }
      fs.writeFileSync(optionsPath, optionsContent, 'utf-8');
      logToLauncherConsole(`[Sistem] Oyun dili ${targetLang} olarak senkronize edildi.`);
    } catch (err) {
      console.error("Error writing options.txt:", err);
      logToLauncherConsole(`[Stage 6/6] Oyun dil dosyası güncellenirken hata oluştu: ${err.message}`, true);
    }

    // ── Cross-Platform Java Detection ─────────────────────────────────────
    const isWin   = process.platform === 'win32';
    const isMac   = process.platform === 'darwin';
    const isLinux = process.platform === 'linux';
    const javaExeName = isWin ? 'java.exe' : 'java';
    const localJava = path.join(appData, 'jre8', 'bin', javaExeName);
    let javaExe = fs.existsSync(localJava) ? localJava : 'java'; // fallback to system java
    // ─────────────────────────────────────────────────────────────────────

    const class_comp_msg = config.language === 'en' ? 
      "[Stage 6/6] Classpath compiled. JVM arguments prepared." :
      "[Stage 6/6] Sınıf yolları (classpath) derlendi. JVM argümanları hazırlandı.";
    const java_launch_msg = config.language === 'en' ?
      `[Stage 6/6] Launching Java: ${javaExe}` :
      `[Stage 6/6] Java çalıştırılıyor: ${javaExe}`;
    
    logToLauncherConsole(class_comp_msg);
    logToLauncherConsole(java_launch_msg);
    console.log(`Launching Java: ${javaExe} with args`, args);

    // Shutdown launcher RPC to let game client's RPC take over
    shutdownDiscordRPC();

    const child = spawn(javaExe, args, { cwd: base });

    logToLauncherConsole(`[Stage 6/6] Minecraft 1.8.9 süreci başarıyla başlatıldı (PID: ${child.pid}).`);

    child.stdout.on('data', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('game-log', data.toString().trim());
      }
    });

    child.stderr.on('data', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('game-log', `[HATA] ${data.toString().trim()}`);
      }
    });

    child.on('error', (err) => {
      // Re-initialize launcher RPC on failure
      rpcStartTimestamp = Date.now();
      initDiscordRPC();

      if (mainWindow) {
        mainWindow.webContents.send('game-log', `[HATA] Java başlatılamadı: ${err.message}`);
        mainWindow.webContents.send('game-exit', -1);
      }
    });

    child.on('close', (code) => {
      // Re-initialize launcher RPC since the game closed
      rpcStartTimestamp = Date.now();
      initDiscordRPC();

      if (mainWindow) {
        mainWindow.webContents.send('game-exit', code);
        mainWindow.show();
        mainWindow.focus();
      }
    });

    if (config.hide_on_launch !== false) {
      mainWindow.hide();
    } else {
      mainWindow.webContents.send('switch-tab', 'tab-console');
    }

    return "Oyun başlatıldı!";
  });

  // ============================================================
  // RESOURCE PACK LIBRARY IPC HANDLERS (Modrinth API)
  // ============================================================

  // Ensure resourcepacks directory exists
  const resourcePacksDir = path.join(getAppDataPath(), 'resourcepacks');
  if (!fs.existsSync(resourcePacksDir)) {
    fs.mkdirSync(resourcePacksDir, { recursive: true });
  }

  // Modrinth API helper - GET request that returns parsed JSON
  function modrinthGet(apiPath) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.modrinth.com',
        path: apiPath,
        method: 'GET',
        headers: {
          'User-Agent': 'TurklionLauncher/1.0.0 (turklion.net)',
          'Accept': 'application/json'
        }
      };

      https.get(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Modrinth API JSON parse error'));
          }
        });
      }).on('error', reject);
    });
  }

  // Search Modrinth for 1.8.9 resource packs
  ipcMain.handle('search-resource-packs', async (event, searchQuery) => {
    try {
      const query = encodeURIComponent(searchQuery || 'pvp');
      const facets = encodeURIComponent('[["project_type:resourcepack"],["versions:1.8.9"]]');
      const apiPath = `/v2/search?query=${query}&facets=${facets}&index=relevance&limit=12`;

      const result = await modrinthGet(apiPath);

      if (!result || !result.hits) return [];

      return result.hits.map(hit => ({
        id: hit.project_id,
        slug: hit.slug,
        title: hit.title,
        description: hit.description,
        icon_url: hit.icon_url || '',
        downloads: hit.downloads || 0,
        author: hit.author || '',
        categories: hit.categories || [],
        gallery: hit.gallery || []
      }));
    } catch (err) {
      console.error('Modrinth search error:', err);
      return [];
    }
  });

  // Get download URL for a specific Modrinth project (1.8.9 compatible version)
  ipcMain.handle('get-pack-download-url', async (event, projectId) => {
    try {
      const versionsPath = `/v2/project/${projectId}/version?game_versions=${encodeURIComponent('["1.8.9"]')}`;
      const versions = await modrinthGet(versionsPath);

      if (!versions || versions.length === 0) {
        // Try without version filter as fallback
        const allVersions = await modrinthGet(`/v2/project/${projectId}/version`);
        if (!allVersions || allVersions.length === 0) {
          throw new Error('No versions found');
        }
        const latest = allVersions[0];
        if (!latest.files || latest.files.length === 0) throw new Error('No files in version');
        return {
          url: latest.files[0].url,
          filename: latest.files[0].filename,
          size: latest.files[0].size
        };
      }

      const latest = versions[0];
      if (!latest.files || latest.files.length === 0) throw new Error('No files in version');

      return {
        url: latest.files[0].url,
        filename: latest.files[0].filename,
        size: latest.files[0].size
      };
    } catch (err) {
      console.error('Modrinth version fetch error:', err);
      throw err;
    }
  });

  // Get list of installed pack files
  ipcMain.handle('get-installed-packs', () => {
    try {
      if (!fs.existsSync(resourcePacksDir)) return [];
      return fs.readdirSync(resourcePacksDir).filter(f => f.endsWith('.zip'));
    } catch (err) {
      console.error('Failed to read resourcepacks directory:', err);
      return [];
    }
  });

  // Delete a pack file
  ipcMain.handle('delete-pack', (event, filename) => {
    try {
      const filePath = path.join(resourcePacksDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return { success: true };
      }
      return { success: false, error: 'File not found' };
    } catch (err) {
      console.error('Failed to delete pack:', err);
      throw err;
    }
  });

  // Download a pack file from URL with progress events
  ipcMain.handle('download-pack', async (event, { id, url: packUrl, filename }) => {
    const destPath = path.join(resourcePacksDir, filename);

    return new Promise((resolve, reject) => {
      const doRequest = (reqUrl) => {
        const protocol = reqUrl.startsWith('https') ? https : http;
        
        protocol.get(reqUrl, (response) => {
          // Handle redirects (Modrinth CDN may redirect)
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            doRequest(response.headers.location);
            return;
          }

          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }

          const file = fs.createWriteStream(destPath);
          const totalBytes = parseInt(response.headers['content-length'], 10) || 0;
          let downloadedBytes = 0;

          response.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            const percent = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
            
            if (mainWindow) {
              mainWindow.webContents.send('pack-download-progress', {
                id,
                percent,
                status: 'downloading'
              });
            }
          });

          response.pipe(file);

          file.on('finish', () => {
            file.close(() => {
              if (mainWindow) {
                mainWindow.webContents.send('pack-download-progress', {
                  id,
                  percent: 100,
                  status: 'done'
                });
              }
              resolve({ success: true });
            });
          });

          file.on('error', (err) => {
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
            reject(err);
          });
        }).on('error', (err) => {
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          reject(err);
        });
      };

      doRequest(packUrl);
    });
  });

  createSplashWindow();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSplashWindow();
      createWindow();
      createTray();
    }
  });
});

app.on('window-all-closed', () => {
  shutdownDiscordRPC();
  if (process.platform !== 'darwin') app.quit();
});
