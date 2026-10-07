const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Store the JSON file securely in the user's AppData directory
const dbPath = path.join(app.getPath('userData'), 'expenses.json');

// Initialize the file if it doesn't exist
if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify([]));
}

// Helper functions to read and write to the JSON file
const readDB = () => JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const writeDB = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 600,
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

// IPC Handlers: Replicating the exact same behavior as SQLite
ipcMain.handle('add-expense', (event, expense) => {
    const expenses = readDB();

    // Force amount to be a number and add a unique ID
    expense.amount = parseFloat(expense.amount);
    expense.id = Date.now();

    expenses.push(expense);
    writeDB(expenses);
    return { success: true };
});

ipcMain.handle('get-expenses', () => {
    const expenses = readDB();
    // Sort by date descending (newest first)
    return expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
});