const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(app.getPath('userData'), 'expenses.json');
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

// Initialize JSON files if they don't exist
if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify([]));
if (!fs.existsSync(settingsPath)) fs.writeFileSync(settingsPath, JSON.stringify({ salary: 0 }));

const readDB = () => JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const writeDB = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

const readSettings = () => JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
const writeSettings = (data) => fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 950,
        height: 700,
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

// --- Data Handlers ---
ipcMain.handle('add-expense', (event, expense) => {
    const expenses = readDB();
    expense.amount = parseFloat(expense.amount);
    expense.id = Date.now();
    expenses.push(expense);
    writeDB(expenses);
    return { success: true };
});

ipcMain.handle('get-expenses', () => {
    const expenses = readDB();
    return expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
});

ipcMain.handle('edit-expense', (event, updatedExpense) => {
    const expenses = readDB();
    const index = expenses.findIndex(e => e.id === updatedExpense.id);
    if (index !== -1) {
        expenses[index] = {
            ...expenses[index],
            amount: parseFloat(updatedExpense.amount),
            tag: updatedExpense.tag,
            date: updatedExpense.date
        };
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

// --- Settings & Export Handlers ---
ipcMain.handle('get-salary', () => readSettings().salary);

ipcMain.handle('set-salary', (event, salary) => {
    const settings = readSettings();
    settings.salary = parseFloat(salary) || 0;
    writeSettings(settings);
    return true;
});

ipcMain.handle('export-excel', async () => {
    const expenses = readDB();
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Expenses to Excel (CSV)',
        defaultPath: 'expenses.csv',
        filters: [{ name: 'Excel CSV', extensions: ['csv'] }]
    });

    if (filePath) {
        const csvHeader = 'Date,Tag,Amount\n';
        const csvRows = expenses.map(e => `${e.date},${e.tag},${e.amount}`).join('\n');
        fs.writeFileSync(filePath, csvHeader + csvRows);
        return true;
    }
    return false;
});

// --- Window Controls ---
ipcMain.on('minimize-window', () => mainWindow.minimize());
ipcMain.on('close-window', () => mainWindow.close());
ipcMain.on('maximize-window', () => {
    if (mainWindow.isMaximized()) mainWindow.restore();
    else mainWindow.maximize();
});