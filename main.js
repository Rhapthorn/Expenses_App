const { app, BrowserWindow, ipcMain, dialog, globalShortcut, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'expenses.json');
const settingsPath = path.join(userDataPath, 'settings.json');
const subsPath = path.join(userDataPath, 'subs.json');
const goalsPath = path.join(userDataPath, 'goals.json');
const iconPath = path.join(userDataPath, 'tray-icon.png'); // Physical file for the tray icon

const defaultSettings = {
    salary: 0,
    language: 'en',
    closeBehavior: 'tray', // 'tray' or 'quit'
    currency: '€',
    autoLaunch: false
};

if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify([]));
if (!fs.existsSync(subsPath)) fs.writeFileSync(subsPath, JSON.stringify([]));
if (!fs.existsSync(goalsPath)) fs.writeFileSync(goalsPath, JSON.stringify([]));

// Safely merge existing settings with the new default settings
let currentSettings = defaultSettings;
if (fs.existsSync(settingsPath)) {
    currentSettings = { ...defaultSettings, ...JSON.parse(fs.readFileSync(settingsPath, 'utf8')) };
}
fs.writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 2));

const readDB = () => JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const writeDB = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
const readSettings = () => JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
const writeSettings = (data) => fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));
const readSubs = () => JSON.parse(fs.readFileSync(subsPath, 'utf8'));
const writeSubs = (data) => fs.writeFileSync(subsPath, JSON.stringify(data, null, 2));
const readGoals = () => JSON.parse(fs.readFileSync(goalsPath, 'utf8'));
const writeGoals = (data) => fs.writeFileSync(goalsPath, JSON.stringify(data, null, 2));

function processSubscriptions() {
    const subs = readSubs();
    const expenses = readDB();
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentDay = now.getDate();
    let updated = false;

    subs.forEach(sub => {
        if (sub.lastProcessedMonth !== currentMonth && currentDay >= sub.dayOfMonth) {
            expenses.push({
                id: Date.now() + Math.random(),
                amount: sub.amount,
                tag: sub.tag,
                date: now.toISOString().split('T')[0]
            });
            sub.lastProcessedMonth = currentMonth;
            updated = true;
        }
    });

    if (updated) {
        writeSubs(subs);
        writeDB(expenses);
    }
}

let mainWindow;
let tray = null;
let isQuitting = false;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1050,
        height: 700,
        minWidth: 850,
        minHeight: 550,
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    mainWindow.loadFile('index.html');

    mainWindow.on('close', (event) => {
        const settings = readSettings();
        if (settings.closeBehavior === 'tray' && !isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    globalShortcut.register('CommandOrControl+Shift+E', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

function createTray() {
    // Generate a physical blue square icon file if it doesn't exist
    if (!fs.existsSync(iconPath)) {
        const iconBase64 = "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA6SURBVDhPY3z//z9DEYyNoRoYGhoaGBkZGVH4jFg1gACwGkYDGA1gNIDRANxgADb2kZGRkZGRkZGBEQBrQxkzyM86vAAAAABJRU5ErkJggg==";
        fs.writeFileSync(iconPath, Buffer.from(iconBase64, 'base64'));
    }

    const trayIcon = nativeImage.createFromPath(iconPath);
    tray = new Tray(trayIcon);

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show Expense Tracker', click: () => mainWindow.show() },
        { type: 'separator' },
        { label: 'Quit', click: () => { isQuitting = true; app.quit(); } }
    ]);

    tray.setToolTip('Expense Tracker');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        mainWindow.show();
        mainWindow.focus();
    });
}

app.whenReady().then(() => {
    processSubscriptions();
    createWindow();
    createTray();
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

ipcMain.on('close-window', () => {
    const settings = readSettings();
    if (settings.closeBehavior === 'quit') {
        isQuitting = true;
        app.quit();
    } else {
        mainWindow.hide();
    }
});
ipcMain.on('minimize-window', () => mainWindow.minimize());
ipcMain.on('maximize-window', () => {
    if (mainWindow.isMaximized()) mainWindow.restore();
    else mainWindow.maximize();
});

// Settings Handlers
ipcMain.handle('get-settings', () => readSettings());

ipcMain.handle('save-settings', (event, newSettings) => {
    const settings = { ...readSettings(), ...newSettings };
    writeSettings(settings);

    // OS-level startup configuration
    app.setLoginItemSettings({
        openAtLogin: settings.autoLaunch,
        path: app.getPath('exe')
    });

    return true;
});

// CRUD Handlers
ipcMain.handle('add-expense', (event, expense) => {
    const expenses = readDB();
    expense.amount = parseFloat(expense.amount);
    expense.id = Date.now();
    expenses.push(expense);
    writeDB(expenses);
    return { success: true };
});
ipcMain.handle('get-expenses', () => readDB().sort((a, b) => new Date(b.date) - new Date(a.date)));
ipcMain.handle('edit-expense', (event, updatedExpense) => {
    const expenses = readDB();
    const index = expenses.findIndex(e => e.id === updatedExpense.id);
    if (index !== -1) {
        expenses[index] = { ...expenses[index], amount: parseFloat(updatedExpense.amount), tag: updatedExpense.tag, date: updatedExpense.date };
        writeDB(expenses);
    }
    return { success: true };
});
ipcMain.handle('delete-expense', (event, id) => {
    let expenses = readDB();
    expenses = expenses.filter(e => e.id !== id);
    writeDB(expenses);
    return { success: true };
});
ipcMain.handle('add-sub', (event, sub) => {
    const subs = readSubs();
    sub.id = Date.now();
    subs.push(sub);
    writeSubs(subs);
    return true;
});
ipcMain.handle('get-subs', () => readSubs());
ipcMain.handle('delete-sub', (event, id) => {
    let subs = readSubs();
    subs = subs.filter(s => s.id !== id);
    writeSubs(subs);
    return true;
});
ipcMain.handle('add-goal', (event, goal) => {
    const goals = readGoals();
    goal.id = Date.now();
    goal.current = 0;
    goals.push(goal);
    writeGoals(goals);
    return true;
});
ipcMain.handle('get-goals', () => readGoals());
ipcMain.handle('update-goal', (event, { id, amountToAdd }) => {
    const goals = readGoals();
    const index = goals.findIndex(g => g.id === id);
    if (index !== -1) {
        goals[index].current += parseFloat(amountToAdd);
        writeGoals(goals);
    }
    return true;
});
ipcMain.handle('delete-goal', (event, id) => {
    let goals = readGoals();
    goals = goals.filter(g => g.id !== id);
    writeGoals(goals);
    return true;
});

ipcMain.handle('export-excel', async (event, chartImageBase64) => {
    const expenses = readDB();
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Expenses to Excel',
        defaultPath: 'expenses.xlsx',
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
    });

    if (filePath) {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Expenses');
        sheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Tag', key: 'tag', width: 25 },
            { header: 'Amount', key: 'amount', width: 15 }
        ];
        sheet.getRow(1).font = { bold: true };
        expenses.forEach(e => { sheet.addRow({ date: e.date, tag: e.tag, amount: e.amount }); });

        if (chartImageBase64) {
            const base64Data = chartImageBase64.replace(/^data:image\/png;base64,/, "");
            const imageId = workbook.addImage({ base64: base64Data, extension: 'png' });
            sheet.addImage(imageId, { tl: { col: 4, row: 1 }, ext: { width: 600, height: 350 } });
        }
        await workbook.xlsx.writeFile(filePath);
        return true;
    }
    return false;
});