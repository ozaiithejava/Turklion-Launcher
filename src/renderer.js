// Fetch Electron API from Global Object exposed by preload
const { invoke, onLog, onExit, onJavaProgress, onSwitchTab, onUpdateProgress, onPackDownloadProgress } = window.electronAPI;

// State management
let currentConfig = {
  username: "ozaii",
  min_ram: "512M",
  max_ram: "2048M",
  java_path: "java",
  custom_args: "",
  accounts: ["ozaii"],
  language: "tr",
  close_behavior: "tray",
  discord_rpc_enabled: true,
  hardware_acceleration: true,
  force_gpu: false
};
let savedAccounts = ["ozaii"];
let detectedTotalGb = 8;

// Easter Egg states
let matrixMode = false;
let herobrineActive = false;
let rgbUnlocked = false;
let rgbInterval = null;

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}

function startRgbEffect() {
  if (rgbInterval) clearInterval(rgbInterval);
  let hue = 0;
  rgbInterval = setInterval(() => {
    hue = (hue + 1.5) % 360;
    const color = `hsl(${hue}, 85%, 60%)`;
    const rgb = hslToRgb(hue, 85, 60);
    const glow = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.45)`;
    const root = document.documentElement;
    root.style.setProperty('--accent-purple', color);
    root.style.setProperty('--accent-purple-glow', glow);
  }, 25);
}

function stopRgbEffect() {
  if (rgbInterval) {
    clearInterval(rgbInterval);
    rgbInterval = null;
  }
}

// Translations dictionary
const translations = {
  tr: {
    titlebar_logo: "TÜRKLION LAUNCHER",
    nav_play: "Oyna",
    nav_news: "Duyurular",
    nav_settings: "Ayarlar",
    nav_console: "Konsol",
    nav_website: "Web Sitesi",
    nav_discord: "Discord",
    hero_subtitle: "L A U N C H E R  ·  1.8.9",
    hero_desc: "Yüksek performans, optimize edilmiş gecikme oranları ve gelişmiş mod desteği ile üstün oyun deneyimi.",
    play_username_placeholder: "Oyuncu adı...",
    play_btn: "OYNA",
    play_btn_launching: "BAŞLATILIYOR...",
    game_status_ready: "Oynamaya hazır",
    game_status_launching: "Minecraft 1.8.9 başlatılıyor, lütfen bekleyin...",
    game_status_running: "Oyun şu anda çalışıyor...",
    game_status_exit: "Oyun sonlandırıldı (Kod: {code}). Tekrar oynamaya hazır.",
    news_title: "Son Duyurular & Güncellemeler",
    settings_title: "İstemci Ayarları",
    settings_ram_title: "Bellek (RAM) Ayarları",
    settings_max_ram_label: "Maksimum RAM (Xmx):",
    settings_min_ram_label: "Minimum RAM (Xms):",
    ram_rec_title: "Sistem Bellek Tavsiyesi",
    ram_rec_apply_btn: "Önerilen Ayarları Uygula",
    settings_custom_title: "Özelleştirme & Oyun Ayarları",
    settings_theme_label: "Launcher Renk Teması",
    theme_purple: "Neon Mor (Varsayılan)",
    theme_cyan: "Neon Turkuaz",
    theme_emerald: "Zümrüt Yeşili",
    theme_ruby: "Yakup Kırmızısı",
    theme_amber: "Kehribar Sarısı",
    settings_resolution_label: "Oyun Çözünürlüğü",
    settings_fullscreen_label: "Oyunu Tam Ekran Başlat",
    settings_hide_on_launch_label: "Oyunu Başlatınca Launcher'ı Gizle",
    settings_hide_on_launch_help: "Aktif olduğunda oyun başlarken launcher gizlenir. Kapatırsanız launcher açık kalır ve konsol sekmesinden oyun loglarını görebilirsiniz.",
    settings_save_btn: "Kaydet",
    settings_advanced_title: "Gelişmiş & Sistem Ayarları",
    settings_close_behavior_label: "Kapatma Butonu Davranışı",
    settings_close_behavior_tray: "Sistem Tepsisine Küçült",
    settings_close_behavior_exit: "Uygulamadan Tamamen Çık",
    settings_lang_label: "Launcher Dili / Language",
    settings_discord_rpc_label: "Discord Zengin Varlığı (Rich Presence)",
    settings_hw_acc_label: "Launcher Donanım İvmesi (Hardware Acceleration)",
    settings_hw_acc_help: "Kapatıldığında launcher arayüz performansı düşebilir ancak bazı ekran kartı hatalarını giderir. (Yeniden başlatma gerektirir)",
    settings_force_gpu_label: "Yüksek Performanslı GPU Zorlaması (Force Dedicated GPU)",
    settings_force_gpu_help: "Minecraft'ın entegre grafik birimi yerine harici yüksek performanslı ekran kartı (Nvidia/AMD) üzerinde çalışmasını tetikler.",
    console_title: "Oyun Konsol Günlükleri",
    console_report_btn: "Hata Bildir",
    console_copy_btn: "Kopyala",
    console_clear_btn: "Temizle",
    ram_rec_loading: "Sistem özellikleri analiz ediliyor...",
    ram_rec_failed: "Sistem bellek bilgisi alınamadı.",
    system_settings_loaded: "[Sistem] Ayarlar başarıyla yüklendi.",
    system_settings_saved: "[Sistem] Ayarlar kaydedildi.",
    save_success: "Ayarlar başarıyla kaydedildi!",
    save_error: "Hata: Ayarlar kaydedilemedi!",
    game_launch_error: "Hata: Oyun başlatılamadı!",
    nav_packs: "Paketler",
    packs_title: "PvP Doku Paketleri",
    packs_search_btn: "Ara",
    packs_search_placeholder: "Paket ara... (örn: pvp, faithful, fps)",
    packs_download_btn: "İndir",
    packs_installed_btn: "Yüklendi",
    packs_delete_btn: "Sil",
    packs_downloading_btn: "İndiriliyor..."
  },
  en: {
    titlebar_logo: "TÜRKLION LAUNCHER",
    nav_play: "Play",
    nav_news: "Announcements",
    nav_settings: "Settings",
    nav_console: "Console",
    nav_website: "Website",
    nav_discord: "Discord",
    hero_subtitle: "L A U N C H E R  ·  1.8.9",
    hero_desc: "High performance, optimized latency, and advanced mod support for a superior gaming experience.",
    play_username_placeholder: "Player name...",
    play_btn: "PLAY",
    play_btn_launching: "LAUNCHING...",
    game_status_ready: "Ready to play",
    game_status_launching: "Minecraft 1.8.9 is launching, please wait...",
    game_status_running: "Game is currently running...",
    game_status_exit: "Game terminated (Code: {code}). Ready to play again.",
    news_title: "Latest Announcements & Updates",
    settings_title: "Client Settings",
    settings_ram_title: "Memory (RAM) Settings",
    settings_max_ram_label: "Maximum RAM (Xmx):",
    settings_min_ram_label: "Minimum RAM (Xms):",
    ram_rec_title: "System Memory Recommendation",
    ram_rec_apply_btn: "Apply Recommended Settings",
    settings_custom_title: "Customization & Game Settings",
    settings_theme_label: "Launcher Color Theme",
    theme_purple: "Neon Purple (Default)",
    theme_cyan: "Neon Cyan",
    theme_emerald: "Emerald Green",
    theme_ruby: "Ruby Red",
    theme_amber: "Amber Yellow",
    settings_resolution_label: "Game Resolution",
    settings_fullscreen_label: "Start Game in Fullscreen",
    settings_hide_on_launch_label: "Hide Launcher on Launch",
    settings_hide_on_launch_help: "When active, the launcher hides when the game starts. If disabled, the launcher remains open and you can view game logs in the Console tab.",
    settings_save_btn: "Save",
    settings_advanced_title: "Advanced & System Settings",
    settings_close_behavior_label: "Close Button Behavior",
    settings_close_behavior_tray: "Minimize to System Tray",
    settings_close_behavior_exit: "Exit Application Completely",
    settings_lang_label: "Launcher Language",
    settings_discord_rpc_label: "Discord Rich Presence",
    settings_hw_acc_label: "Launcher Hardware Acceleration",
    settings_hw_acc_help: "Disabling it may lower launcher interface performance but resolves some GPU errors. (Requires restart)",
    settings_force_gpu_label: "Force High-Performance GPU (Force Dedicated GPU)",
    settings_force_gpu_help: "Triggers Minecraft to run on the external high-performance graphics card (Nvidia/AMD) instead of the integrated graphics unit.",
    console_title: "Game Console Logs",
    console_report_btn: "Report Bug",
    console_copy_btn: "Copy",
    console_clear_btn: "Clear",
    ram_rec_loading: "Analyzing system specifications...",
    ram_rec_failed: "Failed to retrieve system memory info.",
    system_settings_loaded: "[System] Settings loaded successfully.",
    system_settings_saved: "[System] Settings saved.",
    save_success: "Settings saved successfully!",
    save_error: "Error: Settings could not be saved!",
    game_launch_error: "Error: Game could not be launched!",
    nav_packs: "Packs",
    packs_title: "PvP Resource Packs",
    packs_search_btn: "Search",
    packs_search_placeholder: "Search packs... (e.g. pvp, faithful, fps)",
    packs_download_btn: "Download",
    packs_installed_btn: "Installed",
    packs_delete_btn: "Delete",
    packs_downloading_btn: "Downloading..."
  }
};

// Translate function
function applyLanguage(lang) {
  const dict = translations[lang] || translations.tr;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (dict[key]) {
      el.setAttribute("placeholder", dict[key]);
    }
  });

  const rgbOpt = document.querySelector('option[value="rgb"]');
  if (rgbOpt) {
    rgbOpt.textContent = lang === 'en' ? "RGB Rainbow Wave (Secret)" : "RGB Gökkuşağı (Gizli)";
  }

  refreshRamRecommendation(lang);
}

// Refresh RAM suggestion dynamically
function refreshRamRecommendation(lang) {
  const descEl = document.getElementById("ram-rec-text");
  if (!descEl) return;
  
  const totalGb = detectedTotalGb;
  let recMax = 4096;
  let recMin = 1536;
  let desc = "";

  if (totalGb <= 4) {
    recMax = 1536;
    recMin = 512;
    desc = lang === 'en' ? 
      `System detected <b>${totalGb} GB RAM</b>. Performance may be affected. Recommended: <b>1.5 GB Xmx / 512 MB Xms</b>.` :
      `Sisteminizde <b>${totalGb} GB RAM</b> tespit edildi. RAM seviyeniz düşük olduğu için oyun performansı etkilenebilir. Tavsiye edilen bellek: <b>1.5 GB Xmx / 512 MB Xms</b>.`;
  } else if (totalGb <= 8) {
    recMax = 3072;
    recMin = 1024;
    desc = lang === 'en' ?
      `System detected <b>${totalGb} GB RAM</b>. Most ideal memory for 1.8.9: <b>3 GB Xmx / 1 GB Xms</b>.` :
      `Sisteminizde <b>${totalGb} GB RAM</b> tespit edildi. 1.8.9 oyun sürümü için en ideal bellek: <b>3 GB Xmx / 1 GB Xms</b>.`;
  } else if (totalGb <= 16) {
    recMax = 4096;
    recMin = 1536;
    desc = lang === 'en' ?
      `System detected <b>${totalGb} GB RAM</b>. Recommended for high performance: <b>4 GB Xmx / 1.5 GB Xms</b>.` :
      `Sisteminizde <b>${totalGb} GB RAM</b> tespit edildi. Yüksek performanslı oyun deneyimi için önerilen bellek: <b>4 GB Xmx / 1.5 GB Xms</b>.`;
  } else {
    recMax = 6144;
    recMin = 2048;
    desc = lang === 'en' ?
      `System detected a great <b>${totalGb} GB RAM</b>. Recommended for modded or high settings: <b>6 GB Xmx / 2 GB Xms</b>.` :
      `Sisteminizde harika bir <b>${totalGb} GB RAM</b> tespit edildi. Modlu veya yüksek ayarlarda oyun oynamak için önerilen bellek: <b>6 GB Xmx / 2 GB Xms</b>.`;
  }

  descEl.innerHTML = desc;
  
  const btnApply = document.getElementById("btn-apply-ram-rec");
  if (btnApply) {
    btnApply.onclick = () => {
      settingsMaxRam.value = recMax;
      maxRamVal.textContent = `${recMax} MB`;
      settingsMinRam.value = recMin;
      minRamVal.textContent = `${recMin} MB`;
      const sys_prefix = lang === 'en' ? "[System]" : "[Sistem]";
      const applied_msg = lang === 'en' ? "Recommended memory settings applied:" : "Önerilen bellek ayarları uygulandı:";
      logToConsole(`${sys_prefix} ${applied_msg} Max ${recMax}MB / Min ${recMin}MB`);
    };
  }
}

// DOM Elements
const playUsernameInput = document.getElementById("play-username");
const btnPlay = document.getElementById("btn-play");
const gameStatusMsg = document.getElementById("game-status-msg");

const settingsMaxRam = document.getElementById("settings-max-ram");
const settingsMinRam = document.getElementById("settings-min-ram");
const maxRamVal = document.getElementById("max-ram-val");
const minRamVal = document.getElementById("min-ram-val");
const settingsJavaPath = document.getElementById("settings-java-path");
const settingsHideOnLaunch = document.getElementById("settings-hide-on-launch");
const settingsTheme = document.getElementById("settings-theme");
const settingsGameWidth = document.getElementById("settings-game-width");
const settingsGameHeight = document.getElementById("settings-game-height");
const settingsFullscreen = document.getElementById("settings-fullscreen");
const btnBrowseJava = document.getElementById("btn-browse-java");
const btnSaveSettings = document.getElementById("btn-save-settings");
const saveStatusMsg = document.getElementById("save-status-msg");

// New DOM Elements
const settingsCloseBehavior = document.getElementById("settings-close-behavior");
const settingsLang = document.getElementById("settings-lang");
const settingsDiscordRpc = document.getElementById("settings-discord-rpc");
const settingsHwAcceleration = document.getElementById("settings-hw-acceleration");
const settingsForceGpu = document.getElementById("settings-force-gpu");

const consoleOutput = document.getElementById("console-output");
const btnClearConsole = document.getElementById("btn-clear-console");
const btnCopyConsole = document.getElementById("btn-copy-console");

// Java progress elements
const downloadProgressContainer = document.getElementById("download-progress-container");
const downloadStatusTxt = document.getElementById("download-status-txt");
const downloadPercentTxt = document.getElementById("download-percent-txt");
const progressBarFill = document.getElementById("progress-bar-fill");

// Initialize application
window.addEventListener("DOMContentLoaded", async () => {
  // Setup Custom Titlebar Controls
  document.getElementById("btn-minimize").addEventListener("click", () => {
    invoke("minimize-window");
  });

  document.getElementById("btn-maximize").addEventListener("click", () => {
    invoke("maximize-window");
  });
  
  document.getElementById("btn-close").addEventListener("click", () => {
    invoke("close-window");
  });

  // Social Links
  document.getElementById("btn-website").addEventListener("click", () => {
    invoke("open-external-url", "https://turklion.net");
  });

  document.getElementById("btn-discord").addEventListener("click", () => {
    invoke("open-external-url", "https://turklion.net/discord");
  });

  settingsTheme.addEventListener("change", (e) => {
    applyTheme(e.target.value);
  });

  // Launch Isometric Background Grid
  initIsometricGrid();

  // Fetch System RAM & Recommendations
  try {
    const totalBytes = await invoke("get-system-ram");
    detectedTotalGb = Math.round(totalBytes / (1024 * 1024 * 1024));
  } catch (err) {
    console.error("System RAM error:", err);
  }
  refreshRamRecommendation(currentConfig.language || "tr");

  // Setup Sidebar Tab Navigation
  const navBtns = document.querySelectorAll(".nav-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTabId = btn.getAttribute("data-tab");
      
      navBtns.forEach(b => b.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));
      
      btn.classList.add("active");
      document.getElementById(targetTabId).classList.add("active");
    });
  });

  // Setup RAM Range Sliders
  settingsMaxRam.addEventListener("input", (e) => {
    maxRamVal.textContent = `${e.target.value} MB`;
  });

  settingsMinRam.addEventListener("input", (e) => {
    minRamVal.textContent = `${e.target.value} MB`;
  });

  // Dynamic Player Avatar Updater
  let avatarTimeout;
  playUsernameInput.addEventListener("input", (e) => {
    clearTimeout(avatarTimeout);
    const username = e.target.value.trim() || "Steve";
    
    // Check for Matrix Easter Egg
    if (username.toLowerCase() === 'matrix') {
      if (!matrixMode) {
        matrixMode = true;
        initMatrixRain();
      }
    } else {
      matrixMode = false;
    }

    avatarTimeout = setTimeout(() => {
      if (herobrineActive) {
        document.getElementById("player-avatar").src = "https://mc-heads.net/avatar/Herobrine/64";
      } else {
        document.getElementById("player-avatar").src = `https://mc-heads.net/avatar/${username}/64`;
      }
    }, 500);
  });

  // Enter key press to quickly register a new account without starting the game
  playUsernameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const currentUsername = playUsernameInput.value.trim();
      if (currentUsername && !savedAccounts.includes(currentUsername)) {
        savedAccounts.push(currentUsername);
        renderAccountsDropdown();
        saveSettings(true);
        logToConsole(`[Hesap] Yeni hesap listeye eklendi: ${currentUsername}`, "system");
      }
    }
  });

  // Browse Java Executable
  if (btnBrowseJava && settingsJavaPath) {
    btnBrowseJava.addEventListener("click", async () => {
      try {
        const selectedPath = await invoke("select-java-path");
        if (selectedPath) {
          settingsJavaPath.value = selectedPath;
        }
      } catch (err) {
        logToConsole(`[Hata] Java seçimi sırasında hata: ${err}`, "error");
      }
    });
  }

  // Save Settings Button
  btnSaveSettings.addEventListener("click", async () => {
    await saveSettings();
  });

  // Language Change Button
  if (settingsLang) {
    settingsLang.addEventListener("change", (e) => {
      applyLanguage(e.target.value);
      loadResourcePacks(); // Refresh pack cards with new language
    });
  }

  // Play Button
  btnPlay.addEventListener("click", async () => {
    await launchGame();
  });

  // Clear Console Button
  btnClearConsole.addEventListener("click", () => {
    consoleOutput.innerHTML = `
      <div class="log-line system">[Sistem] Konsol temizlendi.</div>
    `;
  });

  // Copy Console Button
  btnCopyConsole.addEventListener("click", () => {
    const logLines = Array.from(consoleOutput.querySelectorAll(".log-line"));
    const fullText = logLines.map(line => line.textContent).join("\n");
    
    navigator.clipboard.writeText(fullText).then(() => {
      const originalText = btnCopyConsole.textContent;
      btnCopyConsole.textContent = "Kopyalandı!";
      btnCopyConsole.style.borderColor = "var(--success)";
      btnCopyConsole.style.color = "var(--success)";
      
      setTimeout(() => {
        btnCopyConsole.textContent = originalText;
        btnCopyConsole.style.borderColor = "rgba(255, 255, 255, 0.08)";
        btnCopyConsole.style.color = "var(--text-secondary)";
      }, 2000);
    }).catch(err => {
      console.error("Clipboard copy error:", err);
      alert("Konsol günlükleri kopyalanamadı!");
    });
  });

  // Account Switcher Dropdown toggle
  const btnToggle = document.getElementById("btn-dropdown-toggle");
  const accountList = document.getElementById("account-dropdown-list");
  
  if (btnToggle && accountList) {
    btnToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const isVisible = accountList.style.display === "block";
      accountList.style.display = isVisible ? "none" : "block";
    });
    
    document.addEventListener("click", (e) => {
      if (!accountList.contains(e.target) && e.target !== btnToggle) {
        accountList.style.display = "none";
      }
    });
  }

  // Bug Report button binding
  const btnReportConsole = document.getElementById("btn-report-console");
  if (btnReportConsole) {
    btnReportConsole.addEventListener("click", async () => {
      const logLines = Array.from(consoleOutput.querySelectorAll(".log-line"));
      const last15 = logLines.slice(-15).map(line => line.textContent).join("\n");
      const username = playUsernameInput.value.trim() || "ozaii";
      const maxRam = `${settingsMaxRam.value}M`;
      const osDetails = `${navigator.platform} (${navigator.userAgent})`;
      
      const originalText = btnReportConsole.textContent;
      btnReportConsole.disabled = true;
      btnReportConsole.textContent = "Gönderiliyor...";
      btnReportConsole.style.borderColor = "var(--accent-purple)";
      btnReportConsole.style.color = "var(--accent-purple)";
      
      try {
        const result = await invoke("send-bug-report", {
          username,
          osDetails,
          maxRam,
          logs: last15 || "Konsolda günlük kaydı bulunmuyor."
        });
        
        if (result && result.success) {
          btnReportConsole.textContent = "Gönderildi!";
          btnReportConsole.style.borderColor = "var(--success)";
          btnReportConsole.style.color = "var(--success)";
        } else {
          throw new Error(result ? result.error : "Webhook hatası");
        }
      } catch (err) {
        console.error("Bug report error:", err);
        btnReportConsole.textContent = "Hata Oluştu!";
        btnReportConsole.style.borderColor = "var(--error)";
        btnReportConsole.style.color = "var(--error)";
      }
      
      setTimeout(() => {
        btnReportConsole.disabled = false;
        btnReportConsole.textContent = originalText;
        btnReportConsole.style.borderColor = "rgba(255, 255, 255, 0.08)";
        btnReportConsole.style.color = "var(--text-secondary)";
      }, 3000);
    });
  }

  // Account modal action buttons
  const accountModal = document.getElementById("account-modal");
  const modalInput = document.getElementById("modal-account-name");
  const btnModalCancel = document.getElementById("btn-modal-cancel");
  const btnModalSave = document.getElementById("btn-modal-save");

  if (accountModal && modalInput && btnModalCancel && btnModalSave) {
    btnModalCancel.addEventListener("click", () => {
      accountModal.style.display = "none";
    });

    btnModalSave.addEventListener("click", () => {
      const name = modalInput.value.trim();
      if (name) {
        if (!savedAccounts.includes(name)) {
          savedAccounts.push(name);
          renderAccountsDropdown();
          playUsernameInput.value = name;
          document.getElementById("player-avatar").src = `https://mc-heads.net/avatar/${name}/64`;
          saveSettings(true);
          logToConsole(`[Hesap] Yeni hesap eklendi: ${name}`, "system");
          accountModal.style.display = "none";
        } else {
          alert("Bu hesap zaten kayıtlı!");
        }
      }
    });

    modalInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        btnModalSave.click();
      }
    });
  }

  // Load news list
  loadNews();

  // Load resource packs grid
  loadResourcePacks();

  // Load configuration and status on startup
  await loadConfig();

  // Re-load packs after config loads (to reflect correct language)
  loadResourcePacks();

  // Bind packs search bar
  const packsSearchInput = document.getElementById('packs-search-input');
  const packsSearchBtn = document.getElementById('packs-search-btn');
  if (packsSearchBtn && packsSearchInput) {
    packsSearchBtn.addEventListener('click', () => {
      const query = packsSearchInput.value.trim() || 'pvp';
      loadResourcePacks(query);
    });
    packsSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = packsSearchInput.value.trim() || 'pvp';
        loadResourcePacks(query);
      }
    });
  }

  // Initialize live server status updates
  updateServerStatus();
  setInterval(updateServerStatus, 30000);

  // Bind update retry button
  document.getElementById("btn-update-retry").addEventListener("click", runStartupUpdate);

  // Listen to Java download progress
  onJavaProgress((progress) => {
    const errorContainer = document.getElementById("update-error-container");
    if (errorContainer && errorContainer.style.display === "block") {
      return; // Ignore late events in error state
    }

    const updateOverlay = document.getElementById("update-overlay");
    const isUpdating = !updateOverlay.classList.contains("fade-out");

    if (isUpdating) {
      const title = document.getElementById("update-status-title");
      const detail = document.getElementById("update-status-detail");
      const progressContainer = document.getElementById("update-progress-container");
      const progressBarFill = document.getElementById("update-progress-bar-fill");
      const percentTxt = document.getElementById("update-percent-txt");

      title.textContent = "Java Runtime Kuruluyor";
      progressContainer.style.display = "flex";

      if (progress.status === 'downloading') {
        detail.textContent = progress.msg || "Java indiriliyor...";
        percentTxt.textContent = `${progress.percent}%`;
        progressBarFill.style.width = `${progress.percent}%`;
      } else if (progress.status === 'extracting') {
        detail.textContent = progress.msg || "Java kuruluyor...";
        percentTxt.textContent = "100%";
        progressBarFill.style.width = "100%";
      } else if (progress.status === 'ready') {
        detail.textContent = progress.msg || "Java başarıyla kuruldu!";
        percentTxt.textContent = "100%";
        progressBarFill.style.width = "100%";
      } else if (progress.status === 'error') {
        detail.textContent = `Hata: ${progress.error}`;
        percentTxt.textContent = "0%";
        progressBarFill.style.width = "0%";
      }
    } else {
      downloadProgressContainer.style.display = "flex";
      
      if (progress.status === 'downloading') {
        downloadStatusTxt.textContent = progress.msg || "İndiriliyor...";
        downloadPercentTxt.textContent = `${progress.percent}%`;
        progressBarFill.style.width = `${progress.percent}%`;
      } else if (progress.status === 'extracting') {
        downloadStatusTxt.textContent = progress.msg || "Dosyalar kuruluyor...";
        downloadPercentTxt.textContent = "100%";
        progressBarFill.style.width = "100%";
      } else if (progress.status === 'ready') {
        downloadStatusTxt.textContent = progress.msg || "Kurulum tamamlandı!";
        downloadPercentTxt.textContent = "100%";
        progressBarFill.style.width = "100%";
        setTimeout(() => {
          downloadProgressContainer.style.display = "none";
        }, 2000);
      } else if (progress.status === 'error') {
        downloadStatusTxt.textContent = `Hata: ${progress.error}`;
        downloadPercentTxt.textContent = "0%";
        progressBarFill.style.width = "0%";
        setTimeout(() => {
          downloadProgressContainer.style.display = "none";
        }, 4000);
      }
    }
  });

  // Listen to Update progress
  onUpdateProgress((progress) => {
    const errorContainer = document.getElementById("update-error-container");
    if (errorContainer && errorContainer.style.display === "block") {
      return; // Ignore late events in error state
    }

    const progressContainer = document.getElementById("update-progress-container");
    const progressBarFill = document.getElementById("update-progress-bar-fill");
    const percentTxt = document.getElementById("update-percent-txt");
    const detail = document.getElementById("update-status-detail");

    progressContainer.style.display = "flex";
    
    if (progress.status === 'downloading') {
      detail.textContent = progress.msg || "Dosyalar indiriliyor...";
      percentTxt.textContent = `${progress.percent}%`;
      progressBarFill.style.width = `${progress.percent}%`;
    } else if (progress.status === 'extracting') {
      detail.textContent = progress.msg || "Dosyalar kuruluyor...";
      percentTxt.textContent = `${progress.percent}%`;
      progressBarFill.style.width = `${progress.percent}%`;
    }
  });

  // Listen to game logs from preload bridge
  onLog((logText) => {
    const isError = logText.includes("[HATA]") || logText.toLowerCase().includes("error") || logText.toLowerCase().includes("exception");
    logToConsole(logText, isError ? "error" : "normal");
  });

  // Listen to game exit from preload bridge
  onExit((code) => {
    const lang = currentConfig.language || "tr";
    const dict = translations[lang] || translations.tr;
    logToConsole(dict.game_status_exit.replace("{code}", code), "system");
    
    // Restore Play Button
    btnPlay.disabled = false;
    btnPlay.querySelector(".play-btn-text").textContent = dict.play_btn;
    gameStatusMsg.textContent = dict.game_status_exit.replace("{code}", code);
  });

  // Listen to switch-tab request from main process
  onSwitchTab((tabId) => {
    const btn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
    if (btn) {
      btn.click();
    }
  });

  // 1. Dizzy Avatar double click spin
  const playerAvatarImg = document.getElementById("player-avatar");
  if (playerAvatarImg) {
    playerAvatarImg.addEventListener("dblclick", () => {
      playerAvatarImg.classList.add("dizzy-spin");
      const lang = currentConfig.language || "tr";
      const dizzyMsg = lang === 'en' ? "Steve's head is spinning!" : "Steve'ın başı döndü!";
      gameStatusMsg.textContent = dizzyMsg;
      
      setTimeout(() => {
        playerAvatarImg.classList.remove("dizzy-spin");
        const dict = translations[lang] || translations.tr;
        gameStatusMsg.textContent = dict.game_status_ready;
      }, 1200);
    });
  }

  // 2. Herobrine Logo Click Counter
  let logoClicks = 0;
  let logoClicksTimeout;
  const brandLogo = document.querySelector(".brand-logo-ring");
  if (brandLogo) {
    brandLogo.addEventListener("click", () => {
      logoClicks++;
      clearTimeout(logoClicksTimeout);
      
      if (logoClicks >= 7) {
        logoClicks = 0;
        toggleHerobrineMode();
      } else {
        logoClicksTimeout = setTimeout(() => {
          logoClicks = 0;
        }, 3000);
      }
    });
  }

  // 3. Konami Code Keypress Listener
  const konamiCode = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  let konamiIndex = 0;

  document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === konamiCode[konamiIndex]) {
      konamiIndex++;
      if (konamiIndex === konamiCode.length) {
        unlockRgbTheme();
        konamiIndex = 0;
      }
    } else {
      konamiIndex = 0;
    }
  });

  function unlockRgbTheme() {
    if (rgbUnlocked) return;
    rgbUnlocked = true;
    
    const themeSelect = document.getElementById("settings-theme");
    if (themeSelect) {
      const opt = document.createElement("option");
      opt.value = "rgb";
      const lang = currentConfig.language || "tr";
      opt.textContent = lang === 'en' ? "RGB Rainbow Wave (Secret)" : "RGB Gökkuşağı (Gizli)";
      opt.setAttribute("data-i18n", "theme_rgb");
      themeSelect.appendChild(opt);
      
      themeSelect.value = "rgb";
      applyTheme("rgb");
      
      const unlockMsg = lang === 'en' ?
        "[System] Congratulations! Secret RGB theme unlocked." :
        "[Sistem] Tebrikler! Gizli RGB teması açıldı.";
      logToConsole(unlockMsg, "system");
      saveSettings(true);
    }
  }

  function toggleHerobrineMode() {
    herobrineActive = !herobrineActive;
    
    const body = document.body;
    body.classList.add("glitch-shake");
    setTimeout(() => {
      body.classList.remove("glitch-shake");
    }, 1000);

    const titleText = document.querySelector(".logo-text");
    const avatarImg = document.getElementById("player-avatar");
    const lang = currentConfig.language || "tr";

    if (herobrineActive) {
      if (titleText) titleText.textContent = "TÜRKLION LAUNCHER - HEROBRINE EDITION";
      if (avatarImg) avatarImg.src = "https://mc-heads.net/avatar/Herobrine/64";
      
      // Set crimson red theme
      const root = document.documentElement;
      root.style.setProperty('--accent-purple', '#ef4444');
      root.style.setProperty('--accent-purple-glow', 'rgba(239, 68, 68, 0.4)');
      root.style.setProperty('--accent-cyan', '#b91c1c');
      
      const consoleMsg = lang === 'en' ? 
        "[System] Spooky things are happening... Herobrine mode activated." :
        "[Sistem] Ürpertici şeyler oluyor... Herobrine modu aktif.";
      logToConsole(consoleMsg, "error");
    } else {
      if (titleText) titleText.textContent = "TÜRKLION LAUNCHER";
      const username = playUsernameInput.value.trim() || "Steve";
      if (avatarImg) avatarImg.src = `https://mc-heads.net/avatar/${username}/64`;
      
      // Restore normal theme
      applyTheme(currentConfig.theme || "purple");
      
      const consoleMsg = lang === 'en' ?
        "[System] Herobrine has vanished. Launcher restored." :
        "[Sistem] Herobrine kayboldu. Launcher normale döndü.";
      logToConsole(consoleMsg, "system");
    }
  }

  // Trigger Startup Auto Update
  await runStartupUpdate();
});

// Load configuration
async function loadConfig() {
  try {
    const config = await invoke("get-config");
    currentConfig = config;

    // Load saved accounts
    savedAccounts = config.accounts || ["ozaii"];
    renderAccountsDropdown();

    // Populate UI
    playUsernameInput.value = config.username;
    document.getElementById("player-avatar").src = `https://mc-heads.net/avatar/${config.username || "Steve"}/64`;
    
    // Parse RAM values (removes the 'M' suffix, e.g. "2048M" -> 2048)
    const maxRam = parseInt(config.max_ram.replace("M", "")) || 2048;
    const minRam = parseInt(config.min_ram.replace("M", "")) || 512;
    
    settingsMaxRam.value = maxRam;
    maxRamVal.textContent = `${maxRam} MB`;
    
    settingsMinRam.value = minRam;
    minRamVal.textContent = `${minRam} MB`;

    if (settingsJavaPath) {
      settingsJavaPath.value = config.java_path;
    }
    settingsHideOnLaunch.checked = config.hide_on_launch !== false;
    settingsTheme.value = config.theme || "purple";
    settingsGameWidth.value = config.game_width || 854;
    settingsGameHeight.value = config.game_height || 480;
    settingsFullscreen.checked = !!config.fullscreen;

    // New settings
    if (settingsCloseBehavior) settingsCloseBehavior.value = config.close_behavior || "tray";
    if (settingsLang) settingsLang.value = config.language || "tr";
    if (settingsDiscordRpc) settingsDiscordRpc.checked = config.discord_rpc_enabled !== false;
    if (settingsHwAcceleration) settingsHwAcceleration.checked = config.hardware_acceleration !== false;
    if (settingsForceGpu) settingsForceGpu.checked = !!config.force_gpu;

    // Check for Matrix Mode on startup
    if (config.username && config.username.toLowerCase() === 'matrix') {
      matrixMode = true;
      initMatrixRain();
    }

    // Check if RGB theme was unlocked and saved
    if (config.theme === 'rgb') {
      rgbUnlocked = true;
      const themeSelect = document.getElementById("settings-theme");
      if (themeSelect) {
        const opt = document.createElement("option");
        opt.value = "rgb";
        const lang = config.language || "tr";
        opt.textContent = lang === 'en' ? "RGB Rainbow Wave (Secret)" : "RGB Gökkuşağı (Gizli)";
        opt.setAttribute("data-i18n", "theme_rgb");
        themeSelect.appendChild(opt);
      }
    }

    applyTheme(config.theme || "purple");
    applyLanguage(config.language || "tr");
    
    const lang = config.language || "tr";
    const dict = translations[lang] || translations.tr;
    logToConsole(dict.system_settings_loaded);
  } catch (err) {
    logToConsole(`[Hata] Ayarlar yüklenirken hata: ${err}`, "error");
  }
}

// Save configuration
async function saveSettings(silent = false) {
  try {
    const config = {
      ...currentConfig,
      username: playUsernameInput.value.trim() || "ozaii",
      min_ram: `${settingsMinRam.value}M`,
      max_ram: `${settingsMaxRam.value}M`,
      java_path: settingsJavaPath ? settingsJavaPath.value.trim() : (currentConfig.java_path || "java"),
      hide_on_launch: settingsHideOnLaunch.checked,
      theme: settingsTheme.value,
      game_width: parseInt(settingsGameWidth.value) || 854,
      game_height: parseInt(settingsGameHeight.value) || 480,
      fullscreen: settingsFullscreen.checked,
      accounts: savedAccounts,
      // New settings
      close_behavior: settingsCloseBehavior ? settingsCloseBehavior.value : "tray",
      language: settingsLang ? settingsLang.value : "tr",
      discord_rpc_enabled: settingsDiscordRpc ? settingsDiscordRpc.checked : true,
      hardware_acceleration: settingsHwAcceleration ? settingsHwAcceleration.checked : true,
      force_gpu: settingsForceGpu ? settingsForceGpu.checked : false
    };

    const lang = config.language || "tr";
    const dict = translations[lang] || translations.tr;

    await invoke("save-config", config);
    currentConfig = config;

    // Update translations instantly on save
    applyLanguage(lang);

    if (!silent) {
      saveStatusMsg.textContent = dict.save_success;
      saveStatusMsg.className = "save-status-msg success";
      setTimeout(() => {
        saveStatusMsg.textContent = "";
      }, 3000);
      
      logToConsole(dict.system_settings_saved);
    }
  } catch (err) {
    const lang = currentConfig.language || "tr";
    const dict = translations[lang] || translations.tr;
    if (!silent) {
      saveStatusMsg.textContent = dict.save_error;
      saveStatusMsg.className = "save-status-msg error";
    }
    logToConsole(`[Hata] Ayarlar kaydedilirken hata: ${err.message || err}`, "error");
  }
}



// Startup Auto Update
async function runStartupUpdate() {
  const overlay = document.getElementById("update-overlay");
  const title = document.getElementById("update-status-title");
  const detail = document.getElementById("update-status-detail");
  const progressContainer = document.getElementById("update-progress-container");
  const progressBarFill = document.getElementById("update-progress-bar-fill");
  const percentTxt = document.getElementById("update-percent-txt");
  const errorContainer = document.getElementById("update-error-container");

  title.textContent = "Güncellemeler Denetleniyor";
  detail.textContent = "Sistem ve oyun dosyaları sorgulanıyor...";
  progressContainer.style.display = "none";
  progressBarFill.style.width = "0%";
  percentTxt.textContent = "0%";
  errorContainer.style.display = "none";
  overlay.classList.remove("fade-out");

  try {
    // 1. Check JRE
    const isJavaInstalled = await invoke("check-java-installed");
    if (!isJavaInstalled) {
      title.textContent = "Java Runtime Kuruluyor";
      detail.textContent = "Minecraft 1.8.9 için gerekli Java JRE 8 indiriliyor...";
      progressContainer.style.display = "flex";
      await invoke("download-java");
    }

    // 2. Check & download assets, libraries, jar
    title.textContent = "Oyun Dosyaları Güncelleniyor";
    detail.textContent = "Manifesto sorgulanıyor...";

    const updateResult = await invoke("auto-update-resources");
    if (updateResult.success) {
      title.textContent = "Güncelleme Başarılı";
      detail.textContent = updateResult.offline ? "Çevrimdışı modda başlatıldı, yerel dosyalar yüklendi." : "Tüm dosyalar güncel!";
      progressBarFill.style.width = "100%";
      percentTxt.textContent = "100%";
      await new Promise(r => setTimeout(r, 1500));
      overlay.classList.add("fade-out");
    } else {
      throw new Error(updateResult.error || "Bilinmeyen güncelleme hatası");
    }
  } catch (err) {
    title.textContent = "Güncelleme Başarısız";
    detail.textContent = err.message || err;
    progressContainer.style.display = "none";
    errorContainer.style.display = "block";
  }
}

// Launch Minecraft Game
async function launchGame() {
  const currentUsername = playUsernameInput.value.trim() || "ozaii";
  if (!savedAccounts.includes(currentUsername)) {
    savedAccounts.push(currentUsername);
    renderAccountsDropdown();
  }

  // Automatically save current config (with username from play tab)
  await saveSettings(true);

  const lowerUser = currentUsername.toLowerCase();
  const spartaUsers = ["pvparea", "300", "leonidas", "ozaiithejava"];
  
  if (spartaUsers.includes(lowerUser)) {
    const overlay = document.getElementById("sparta-overlay");
    if (overlay) {
      overlay.style.display = "flex";
    }
    applyTheme('bronze');
    const logoRing = document.querySelector(".brand-logo-ring");
    if (logoRing) {
      logoRing.classList.add("sparta-glow");
    }
    setTimeout(async () => {
      if (overlay) overlay.style.display = "none";
      if (logoRing) logoRing.classList.remove("sparta-glow");
      await proceedLaunch(currentUsername);
    }, 2500);
  } else {
    await proceedLaunch(currentUsername);
  }
}

async function proceedLaunch(currentUsername) {
  const lang = currentConfig.language || "tr";
  const dict = translations[lang] || translations.tr;

  // Update UI to Launching State
  btnPlay.disabled = true;
  btnPlay.querySelector(".play-btn-text").textContent = dict.play_btn_launching;

  try {
    const stage1_msg = lang === 'en' ? 
      "[Launcher] [Stage 1/6] Target game directory verified (.turklion AppData)." : 
      "[Launcher] [Stage 1/6] Hedef oyun dizini doğrulandı (.turklion AppData).";
    logToConsole(stage1_msg);

    // 2. Check if Java is installed locally or globally, if not download JRE8 first
    const isJavaInstalled = await invoke("check-java-installed");
    
    if (!isJavaInstalled) {
      const stage2_install = lang === 'en' ?
        "[Launcher] [Stage 2/6] Suitable Java 8 JRE not found. Starting setup..." :
        "[Launcher] [Stage 2/6] Uygun Java 8 JRE bulunamadı. Kurulum başlatılıyor...";
      const stage2_dl_msg = lang === 'en' ? "Downloading Java JRE 8..." : "Java JRE 8 indiriliyor...";
      logToConsole(stage2_install);
      gameStatusMsg.textContent = stage2_dl_msg;
      
      await invoke("download-java");
      
      const stage2_installed = lang === 'en' ?
        "[Launcher] [Stage 2/6] Java JRE 8 successfully installed." :
        "[Launcher] [Stage 2/6] Java JRE 8 başarıyla kuruldu.";
      logToConsole(stage2_installed);
    } else {
      const stage2_ok = lang === 'en' ?
        "[Launcher] [Stage 2/6] Runnable Java 8 environment verified." :
        "[Launcher] [Stage 2/6] Çalışabilir Java 8 ortamı doğrulandı.";
      logToConsole(stage2_ok);
    }

    gameStatusMsg.textContent = dict.game_status_launching;
    const launch_sent = lang === 'en' ?
      "[Launcher] Game launch command sent..." :
      "[Launcher] Oyun başlatma komutu gönderildi...";
    logToConsole(launch_sent);

    const result = await invoke("launch-game", currentConfig);
    const system_prefix = lang === 'en' ? "[System]" : "[Sistem]";
    logToConsole(`${system_prefix} ${result}`);
    gameStatusMsg.textContent = dict.game_status_running;
  } catch (err) {
    // Restore UI if launch fails
    btnPlay.disabled = false;
    btnPlay.querySelector(".play-btn-text").textContent = dict.play_btn;
    gameStatusMsg.textContent = dict.game_launch_error;
    const launch_failed_msg = lang === 'en' ? "Game could not be launched:" : "Oyun başlatılamadı:";
    logToConsole(`[Hata] ${launch_failed_msg} ${err.message || err}`, "error");
    const alert_title = lang === 'en' ? "Error starting game:" : "Oyun başlatılırken hata oluştu:";
    alert(`${alert_title}\n${err.message || err}`);
  }
}

// Log message to Console Tab
function logToConsole(message, type = "normal") {
  const line = document.createElement("div");
  line.classList.add("log-line");
  if (type === "system") line.classList.add("system");
  if (type === "error") line.classList.add("error");
  
  line.textContent = message;
  
  consoleOutput.appendChild(line);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

// Recolor the app dynamically using CSS Custom Properties
function applyTheme(themeName) {
  stopRgbEffect();
  const root = document.documentElement;
  if (themeName === 'cyan') {
    root.style.setProperty('--accent-purple', '#06b6d4');
    root.style.setProperty('--accent-purple-glow', 'rgba(6, 182, 212, 0.4)');
    root.style.setProperty('--accent-cyan', '#d946ef');
  } else if (themeName === 'emerald') {
    root.style.setProperty('--accent-purple', '#10b981');
    root.style.setProperty('--accent-purple-glow', 'rgba(16, 185, 129, 0.4)');
    root.style.setProperty('--accent-cyan', '#06b6d4');
  } else if (themeName === 'ruby') {
    root.style.setProperty('--accent-purple', '#f43f5e');
    root.style.setProperty('--accent-purple-glow', 'rgba(244, 63, 94, 0.4)');
    root.style.setProperty('--accent-cyan', '#ec4899');
  } else if (themeName === 'amber') {
    root.style.setProperty('--accent-purple', '#f59e0b');
    root.style.setProperty('--accent-purple-glow', 'rgba(245, 158, 11, 0.4)');
    root.style.setProperty('--accent-cyan', '#ec4899');
  } else if (themeName === 'bronze') {
    root.style.setProperty('--accent-purple', '#d97706'); // Gold/Bronze
    root.style.setProperty('--accent-purple-glow', 'rgba(217, 119, 6, 0.4)');
    root.style.setProperty('--accent-cyan', '#ffc107');
  } else if (themeName === 'rgb') {
    startRgbEffect();
  } else {
    // Default purple
    root.style.setProperty('--accent-purple', '#a855f7');
    root.style.setProperty('--accent-purple-glow', 'rgba(168, 85, 247, 0.4)');
    root.style.setProperty('--accent-cyan', '#06b6d4');
  }
}

// Matrix rain state variables
let matrixDrops = [];
let matrixFontSize = 14;
let columns = 0;

function initMatrixRain() {
  const canvas = document.getElementById('iso-grid-canvas');
  if (!canvas) return;
  const w = canvas.width = window.innerWidth;
  columns = Math.floor(w / matrixFontSize);
  matrixDrops = [];
  for (let i = 0; i < columns; i++) {
    matrixDrops[i] = Math.random() * -100;
  }
}

// 3D Isometric Neon Grid Animation on Canvas
function initIsometricGrid() {
  const canvas = document.getElementById('iso-grid-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    if (matrixMode) {
      columns = Math.floor(width / matrixFontSize);
      matrixDrops = [];
      for (let i = 0; i < columns; i++) {
        matrixDrops[i] = Math.random() * -100;
      }
    }
  });

  let waveOffset = 0;

  function draw() {
    if (matrixMode) {
      ctx.fillStyle = 'rgba(7, 9, 14, 0.08)';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = herobrineActive ? '#ef4444' : '#0f0';
      ctx.font = matrixFontSize + 'px monospace';

      for (let i = 0; i < matrixDrops.length; i++) {
        const char = String.fromCharCode(0x30A0 + Math.random() * 96);
        const x = i * matrixFontSize;
        const y = matrixDrops[i] * matrixFontSize;

        ctx.fillText(char, x, y);

        if (y > height && Math.random() > 0.975) {
          matrixDrops[i] = 0;
        }
        matrixDrops[i]++;
      }
      requestAnimationFrame(draw);
      return;
    }

    ctx.clearRect(0, 0, width, height);

    const styles = getComputedStyle(document.documentElement);
    let primaryColor = styles.getPropertyValue('--accent-purple').trim() || '#a855f7';
    if (herobrineActive) {
      primaryColor = '#ef4444';
    }

    ctx.lineWidth = 1.2;

    const gridSize = 40;
    const isoAngle = Math.PI / 6; // 30 degrees

    ctx.save();
    ctx.translate(width / 2, height / 2 - 120);

    waveOffset += 0.35;

    const range = 24;
    for (let x = -range; x <= range; x++) {
      ctx.beginPath();
      for (let y = -range; y <= range; y++) {
        const screenX = (x - y) * Math.cos(isoAngle) * gridSize;
        const screenY = (x + y) * Math.sin(isoAngle) * gridSize;

        const dist = Math.sqrt(x*x + y*y);
        const wave = Math.sin(dist * 0.3 - waveOffset * 0.08) * 8;

        if (y === -range) {
          ctx.moveTo(screenX, screenY + wave);
        } else {
          ctx.lineTo(screenX, screenY + wave);
        }
      }
      ctx.strokeStyle = fadeColor(primaryColor, 0.035);
      ctx.stroke();
    }

    for (let y = -range; y <= range; y++) {
      ctx.beginPath();
      for (let x = -range; x <= range; x++) {
        const screenX = (x - y) * Math.cos(isoAngle) * gridSize;
        const screenY = (x + y) * Math.sin(isoAngle) * gridSize;

        const dist = Math.sqrt(x*x + y*y);
        const wave = Math.sin(dist * 0.3 - waveOffset * 0.08) * 8;

        if (x === -range) {
          ctx.moveTo(screenX, screenY + wave);
        } else {
          ctx.lineTo(screenX, screenY + wave);
        }
      }
      ctx.strokeStyle = fadeColor(primaryColor, 0.035);
      ctx.stroke();
    }

    ctx.restore();
    requestAnimationFrame(draw);
  }

  function fadeColor(hex, alpha) {
    if (hex.startsWith('#')) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return hex;
  }

  draw();
}

// Update play.turklion.net online status
async function updateServerStatus() {
  const statusCapsule = document.getElementById("server-status-capsule");
  const statusDot = document.getElementById("server-status-dot");
  const statusText = document.getElementById("server-status-text");
  
  if (!statusCapsule || !statusDot || !statusText) return;
  
  const lang = currentConfig.language || "tr";
  
  try {
    const status = await invoke("get-server-status");
    if (status && status.online) {
      const active_players_label = lang === 'en' ? "Active Players" : "Aktif Oyuncu";
      statusDot.className = "status-dot online pulsing";
      statusText.textContent = `play.turklion.net | ${active_players_label}: ${status.players.online}/${status.players.max} (${status.ping}ms)`;
    } else {
      statusDot.className = "status-dot offline";
      statusText.textContent = lang === 'en' ? "play.turklion.net | Server Offline" : "play.turklion.net | Sunucu Çevrimdışı";
    }
  } catch (err) {
    statusDot.className = "status-dot offline";
    statusText.textContent = lang === 'en' ? "play.turklion.net | Status could not be retrieved" : "play.turklion.net | Durum alınamadı";
  }
}

// Render dynamic saved accounts list
function renderAccountsDropdown() {
  const list = document.getElementById("account-dropdown-list");
  if (!list) return;
  
  list.innerHTML = "";
  
  savedAccounts.forEach(username => {
    const item = document.createElement("div");
    item.className = "account-item";
    
    const left = document.createElement("div");
    left.className = "account-item-left";
    
    const avatar = document.createElement("img");
    avatar.className = "account-avatar";
    avatar.src = `https://mc-heads.net/avatar/${username}/24`;
    avatar.alt = username;
    
    const nameSpan = document.createElement("span");
    nameSpan.className = "account-username";
    nameSpan.textContent = username;
    
    left.appendChild(avatar);
    left.appendChild(nameSpan);
    
    const removeBtn = document.createElement("button");
    removeBtn.className = "btn-remove-account";
    removeBtn.innerHTML = "×";
    removeBtn.title = "Hesabı Kaldır";
    
    removeBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      savedAccounts = savedAccounts.filter(acc => acc !== username);
      if (savedAccounts.length === 0) {
        savedAccounts = ["ozaii"];
      }
      renderAccountsDropdown();
      
      try {
        await invoke("save-config", { accounts: savedAccounts });
      } catch (err) {
        console.error("Failed to save config accounts list:", err);
      }
    });
    
    item.addEventListener("click", () => {
      playUsernameInput.value = username;
      document.getElementById("player-avatar").src = `https://mc-heads.net/avatar/${username}/64`;
      list.style.display = "none";
      saveSettings(true);
    });
    
    item.appendChild(left);
    item.appendChild(removeBtn);
    list.appendChild(item);
  });

  // Add special "Yeni Hesap Ekle" button at the bottom of dropdown
  const addBtn = document.createElement("div");
  addBtn.className = "account-item add-account-item";
  addBtn.style.borderTop = "1px solid rgba(255, 255, 255, 0.05)";
  addBtn.style.color = "var(--accent-purple)";
  addBtn.style.fontWeight = "600";
  addBtn.style.justifyContent = "center";
  addBtn.innerHTML = "<span>+ Yeni Hesap Ekle</span>";
  
  addBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    list.style.display = "none";
    
    // Open custom account modal dialog
    const modal = document.getElementById("account-modal");
    const input = document.getElementById("modal-account-name");
    if (modal && input) {
      modal.style.display = "flex";
      input.value = "";
      input.focus();
    }
  });
  list.appendChild(addBtn);
}

// Load announcements in News tab
function loadNews() {
  const newsGrid = document.getElementById("news-grid");
  const newsOverlay = document.getElementById("news-overlay");
  if (!newsGrid) return;
  
  const newsData = [
    {
      title: "Türklion Sezon 3 Başlıyor!",
      tag: "announcement",
      tagName: "Duyuru",
      body: "Büyük gün geldi! Türklion Sunucusu Sezon 3 aktif edildi. Yepyeni oyun modları, sıfırlanmış klan savaşları ve muhteşem ödüllü turnuvalar sizi bekliyor. Hemen oyunu başlatın ve spartan arenasında yerinizi alın!",
      date: "18 Haziran 2026",
      image: "./assets/news_season3.jpg"
    },
    {
      title: "İstemci Performans Güncellemesi v1.2",
      tag: "update",
      tagName: "Güncelleme",
      body: "İstemcimizde FPS optimizasyonları ve bellek sızıntısı gidermeleri yapıldı. OptiFine entegrasyonu güncellendi, oyun içi chunk yükleme hızları %25 artırıldı. Düşük sistemlerde donma sorunları tamamen çözüldü.",
      date: "15 Haziran 2026",
      image: "./assets/news_performance.jpg"
    },
    {
      title: "Yaz Etkinliği & %30 Mağaza İndirimi",
      tag: "event",
      tagName: "Etkinlik",
      body: "Yaz aylarına özel dev mağaza indirimi başladı! Tüm kozmetik paketlerinde, pelerinlerde ve vip üyeliklerde geçerli %30 indirimi kaçırmayın. Ayrıca oyun içerisinde her gün spartan kasası anahtarı hediye!",
      date: "12 Haziran 2026",
      image: "./assets/news_summer.jpg"
    },
    {
      title: "Spartan Anti-Cheat Aktif Edildi!",
      tag: "announcement",
      tagName: "Güvenlik",
      body: "Türklion sunucularında adil bir oyun deneyimi için gelişmiş Spartan Anti-Cheat koruması aktif edildi. Hile girişimleri anında engellenecek ve kalıcı olarak uzaklaştırılacaktır. Temiz oyun, adil mücadele!",
      date: "10 Haziran 2026",
      image: "./assets/news_anticheat.jpg"
    }
  ];
  
  newsGrid.innerHTML = "";
  
  newsData.forEach(item => {
    const card = document.createElement("div");
    card.className = "news-card";
    
    card.innerHTML = `
      <div style="overflow: hidden; width: 100%; height: 100px; position: relative; flex-shrink: 0;">
        <img class="news-card-banner" src="${item.image}" alt="${item.title}" />
      </div>
      <div class="news-card-content">
        <div class="news-card-header">
          <div class="news-card-title">${item.title}</div>
          <span class="news-card-tag ${item.tag}">${item.tagName}</span>
        </div>
        <div class="news-card-body">
          ${item.body}
        </div>
        <div class="news-card-footer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>${item.date}</span>
        </div>
      </div>
    `;
    
    // Wire up expansion click logic
    card.addEventListener("click", () => {
      if (newsOverlay) {
        // Render the expanded card dynamic content directly inside the overlay container
        newsOverlay.innerHTML = `
          <div class="news-card expanded">
            <div class="news-close-btn">&times;</div>
            <div style="overflow: hidden; width: 100%; height: 200px; position: relative; flex-shrink: 0;">
              <img class="news-card-banner" src="${item.image}" alt="${item.title}" />
            </div>
            <div class="news-card-content">
              <div class="news-card-header">
                <div class="news-card-title">${item.title}</div>
                <span class="news-card-tag ${item.tag}">${item.tagName}</span>
              </div>
              <div class="news-card-body">
                ${item.body}
              </div>
              <div class="news-card-footer">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span>${item.date}</span>
              </div>
            </div>
          </div>
        `;
        
        newsOverlay.classList.add("active");
        
        // Wire up inner close button click
        const closeBtn = newsOverlay.querySelector(".news-close-btn");
        if (closeBtn) {
          closeBtn.addEventListener("click", (el) => {
            el.stopPropagation();
            newsOverlay.classList.remove("active");
            newsOverlay.innerHTML = "";
          });
        }
      }
    });
    
  newsGrid.appendChild(card);
  });
  
  // Wire up overlay click to close expanded card if clicking directly on the backdrop
  if (newsOverlay) {
    newsOverlay.addEventListener("click", (e) => {
      if (e.target === newsOverlay) {
        newsOverlay.classList.remove("active");
        newsOverlay.innerHTML = "";
      }
    });
  }
}

// ============================================================
// PVP RESOURCE PACK LIBRARY & DOWNLOADER (Modrinth API)
// ============================================================

let cachedPacks = []; // Cache search results
let downloadingPacks = new Set();

// Format download count (e.g. 1234567 -> "1.2M")
function formatDownloads(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

async function loadResourcePacks(searchQuery) {
  const packsGrid = document.getElementById('packs-grid');
  if (!packsGrid) return;

  const lang = currentConfig.language || 'tr';
  const dict = translations[lang] || translations.tr;

  // Show loading state
  if (cachedPacks.length === 0 || searchQuery !== undefined) {
    packsGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 0; color: var(--text-secondary);">
        <div style="font-size: 1.5rem; margin-bottom: 8px; animation: pulse-glow 1.5s infinite;">⏳</div>
        <div>${lang === 'en' ? 'Loading packs from Modrinth...' : 'Modrinth\'ten paketler yükleniyor...'}</div>
      </div>
    `;
  }

  // Fetch packs from Modrinth API
  try {
    const query = searchQuery !== undefined ? searchQuery : 'pvp';
    const packs = await invoke('search-resource-packs', query);
    if (packs && packs.length > 0) {
      cachedPacks = packs;
    }
  } catch (err) {
    console.error('Failed to search packs:', err);
    if (cachedPacks.length === 0) {
      packsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 0; color: var(--text-secondary);">
          <div style="font-size: 1.5rem; margin-bottom: 8px;">⚠️</div>
          <div>${lang === 'en' ? 'Failed to load packs. Check your internet connection.' : 'Paketler yüklenemedi. İnternet bağlantınızı kontrol edin.'}</div>
        </div>
      `;
      return;
    }
  }

  // Get installed packs
  let installedFiles = [];
  try {
    installedFiles = await invoke('get-installed-packs');
  } catch (err) {
    console.error('Failed to get installed packs:', err);
  }

  packsGrid.innerHTML = '';

  cachedPacks.forEach(pack => {
    const isDownloading = downloadingPacks.has(pack.id);

    const card = document.createElement('div');
    card.className = 'pack-card';
    card.id = `pack-card-${pack.id}`;

    // Build icon/banner area
    const iconHtml = pack.icon_url
      ? `<img class="pack-card-banner" src="${pack.icon_url}" alt="${pack.title}" style="object-fit: contain; background: rgba(0,0,0,0.3); padding: 16px;" onerror="this.style.display='none'" />`
      : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(168,85,247,0.1), rgba(6,182,212,0.1)); font-size: 2.5rem;">📦</div>`;

    // Download count badge
    const dlCountStr = formatDownloads(pack.downloads);
    const dlLabel = lang === 'en' ? 'downloads' : 'indirme';

    // Check if any installed file might match (we'll store the filename we used to download)
    const packStorageKey = `modrinth_pack_${pack.id}`;
    const storedFilename = localStorage.getItem(packStorageKey);
    const isInstalled = storedFilename && installedFiles.includes(storedFilename);

    card.innerHTML = `
      <div style="overflow: hidden; width: 100%; height: 120px; position: relative; flex-shrink: 0;">
        ${iconHtml}
        <div style="position: absolute; bottom: 6px; right: 6px; background: rgba(0,0,0,0.7); padding: 3px 8px; border-radius: 4px; font-size: 0.7rem; color: var(--text-secondary); backdrop-filter: blur(4px);">
          ⬇ ${dlCountStr} ${dlLabel}
        </div>
      </div>
      <div class="pack-card-content">
        <div class="pack-card-header">
          <div class="pack-card-title">${pack.title}</div>
          <span class="pack-card-tag">1.8.9</span>
        </div>
        <div class="pack-card-desc">${pack.description}</div>
        <div class="pack-card-footer">
          ${isDownloading ? `
            <button class="pack-btn download" disabled>${dict.packs_downloading_btn}</button>
            <div class="pack-progress-container" style="display: block;" id="pack-progress-${pack.id}">
              <div class="pack-progress-fill" id="pack-progress-fill-${pack.id}" style="width: 0%;"></div>
            </div>
          ` : isInstalled ? `
            <button class="pack-btn delete" data-action="delete">${dict.packs_delete_btn}</button>
          ` : `
            <button class="pack-btn download" data-action="download">${dict.packs_download_btn}</button>
            <div class="pack-progress-container" id="pack-progress-${pack.id}">
              <div class="pack-progress-fill" id="pack-progress-fill-${pack.id}" style="width: 0%;"></div>
            </div>
          `}
        </div>
      </div>
    `;

    // Bind action button
    const btn = card.querySelector('.pack-btn');
    if (btn && !isDownloading) {
      if (isInstalled && storedFilename) {
        // Delete
        btn.addEventListener('click', async () => {
          try {
            await invoke('delete-pack', storedFilename);
            localStorage.removeItem(packStorageKey);
            const sysPrefix = lang === 'en' ? '[System]' : '[Sistem]';
            const delMsg = lang === 'en' ? `Resource pack deleted: ${storedFilename}` : `Doku paketi silindi: ${storedFilename}`;
            logToConsole(`${sysPrefix} ${delMsg}`, 'system');
            loadResourcePacks();
          } catch (err) {
            logToConsole(`[Hata] Paket silinemedi: ${err}`, 'error');
          }
        });
      } else {
        // Download
        btn.addEventListener('click', async () => {
          if (downloadingPacks.has(pack.id)) return;
          downloadingPacks.add(pack.id);

          btn.disabled = true;
          btn.textContent = dict.packs_downloading_btn;
          const progressContainer = card.querySelector('.pack-progress-container');
          if (progressContainer) progressContainer.style.display = 'block';

          try {
            const sysPrefix = lang === 'en' ? '[System]' : '[Sistem]';

            // Step 1: Get download URL from Modrinth API
            const resolveMsg = lang === 'en' ? `Resolving download for: ${pack.title}` : `İndirme adresi çözülüyor: ${pack.title}`;
            logToConsole(`${sysPrefix} ${resolveMsg}`, 'system');

            const dlInfo = await invoke('get-pack-download-url', pack.id);

            // Step 2: Download the file
            const startMsg = lang === 'en' ? `Downloading: ${dlInfo.filename}` : `İndiriliyor: ${dlInfo.filename}`;
            logToConsole(`${sysPrefix} ${startMsg}`, 'system');

            await invoke('download-pack', { id: pack.id, url: dlInfo.url, filename: dlInfo.filename });

            // Store filename so we can detect it as installed
            localStorage.setItem(packStorageKey, dlInfo.filename);

            const doneMsg = lang === 'en' ? `Resource pack installed: ${dlInfo.filename}` : `Doku paketi yüklendi: ${dlInfo.filename}`;
            logToConsole(`${sysPrefix} ${doneMsg}`, 'system');
          } catch (err) {
            logToConsole(`[Hata] Paket indirilemedi: ${err}`, 'error');
          } finally {
            downloadingPacks.delete(pack.id);
            loadResourcePacks();
          }
        });
      }
    }

    packsGrid.appendChild(card);
  });
}

// Listen to pack download progress events from main process
if (typeof onPackDownloadProgress === 'function') {
  onPackDownloadProgress((data) => {
    if (!data || !data.id) return;

    const progressFill = document.getElementById(`pack-progress-fill-${data.id}`);
    const progressContainer = document.getElementById(`pack-progress-${data.id}`);

    if (progressFill) {
      progressFill.style.width = `${data.percent || 0}%`;
    }
    if (progressContainer) {
      progressContainer.style.display = 'block';
    }

    if (data.status === 'done') {
      setTimeout(() => {
        if (progressContainer) progressContainer.style.display = 'none';
      }, 800);
    }
  });
}

