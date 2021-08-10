const path = require('path');

const { app, BrowserWindow, ipcMain } = require('electron');
const isDev = require('electron-is-dev');

const electronDl = require('electron-dl');
const DecompressZip = require('decompress-zip');
const fs = require('fs');

const rendererPath = app.getAppPath() + "/renderer"
const executablePath = rendererPath + "/unity-renderer-linux"
const versionPath = rendererPath + "/version.json"

electronDl();

let version = null
if (fs.existsSync(versionPath)) {
  const rawData = fs.readFileSync(versionPath);
  const body = JSON.parse(rawData);
  version = body.version;
}

const unzip = (zipFilePath, destinationPath, onCompleted) => {
    const unzipper = new DecompressZip(zipFilePath);

    // Add the error event listener
    unzipper.on('error', function (err) {
        console.log('Caught an error', err);
    });
    
    // Notify when everything is extracted
    unzipper.on('extract', function (log) {
        console.log('Finished extracting', log);
        onCompleted()
    });
    
    // Notify "progress" of the decompressed files
    unzipper.on('progress', function (fileIndex, fileCount) {
        console.log('Extracted file ' + (fileIndex + 1) + ' of ' + fileCount);
    });
    
    // Unzip !
    unzipper.extract({
        path: destinationPath
    });
}

var child = require('child_process').execFile;

ipcMain.on('executeProcess', (event) => {
  child(executablePath, (err, data) => {
    if(err) {
       console.error(err);
       return;
    }
 
    console.log(data.toString());
  });
})

ipcMain.on('getVersion', (event) => {
  event.sender.send("getVersion", version)
})

ipcMain.on('downloadButton', async (event, {url, remoteVersion}) => {
  fs.rmdirSync(rendererPath, { recursive: true });
  const win = BrowserWindow.getFocusedWindow();
  const res = await electronDl.download(win, url, {
    directory: rendererPath,
    onStarted: (item) => {
      console.log("onStarted:", item)
      event.sender.send("downloadStart")
    },
    onProgress: (progress) => {
      console.log("onProgress:", progress)
      event.sender.send("downloadProgress", progress.percent * 100)
    },
    onCompleted: (file) => {
      console.log("onCompleted:", file)
      unzip(file.path, rendererPath, () => {
        fs.unlinkSync(file.path)

        const versionData = { 
          version: remoteVersion
        };
       
        fs.writeFileSync(versionPath, JSON.stringify(versionData));

        event.sender.send("downloadCompleted")
      })
    }
  });
  console.log("Res: ", res)
  console.log("Done!")
});

function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule:true,
      contextIsolation: false,
    },
  });

  win.setMenuBarVisibility(false)

  // and load the index.html of the app.
  // win.loadFile("index.html");
  win.loadURL(
    isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../build/index.html')}`
  );
  // Open the DevTools.
  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});