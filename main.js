const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

// Initialize SQLite Database
const db = new Database('expenses.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL,
    tag TEXT,
    date TEXT DEFAULT CURRENT_DATE
  )
`);

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 600,
        frame: false, // Frameless for a custom, modern look
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false // Keeping it simple for local dev; consider preload scripts for production
        }
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

// IPC Handlers for frontend communication
ipcMain.handle('add-expense', (event, expense) => {
    const stmt = db.prepare('INSERT INTO expenses (amount, tag, date) VALUES (?, ?, ?)');
    stmt.run(expense.amount, expense.tag, expense.date);
    return { success: true };
});

ipcMain.handle('get-expenses', () => {
    const stmt = db.prepare('SELECT * FROM expenses ORDER BY date DESC');
    return stmt.all();
});