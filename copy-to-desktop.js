const fs = require('fs');
const path = require('path');
const os = require('os');

const src = path.join(__dirname, 'dist', 'TurklionLauncher 1.0.0.exe');
const desktopPath = path.join(os.homedir(), 'Desktop');
let dest = path.join(desktopPath, 'TurklionLauncher.exe');

// Check OneDrive Desktop if standard Desktop is not found
if (!fs.existsSync(desktopPath)) {
  const oneDriveDesktop = path.join(os.homedir(), 'OneDrive', 'Desktop');
  if (fs.existsSync(oneDriveDesktop)) {
    dest = path.join(oneDriveDesktop, 'TurklionLauncher.exe');
  }
}

try {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Launcher compiled and successfully copied to Desktop: ${dest}`);
  } else {
    console.error(`Source executable not found at: ${src}`);
  }
} catch (err) {
  console.error(`Failed to copy compiled launcher to Desktop: ${err.message}`);
}
