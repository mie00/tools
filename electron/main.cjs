const { app, BrowserWindow } = require('electron');

// Enable WebGPU & Vulkan, and increase memory limit
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('enable-features', 'Vulkan,DefaultEnableShaderF16');
app.commandLine.appendSwitch(
	'js-flags',
	'--max-old-space-size=8192 --no-enable-pointer-compression'
);

const isDev = !app.isPackaged;

function createWindow() {
	const win = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false
		}
	});

	if (isDev) {
		win.loadURL('http://localhost:5173');
		win.webContents.openDevTools();
	} else {
		win.loadURL('https://tools.mie00.com');
	}
}

app.whenReady().then(createWindow);

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
