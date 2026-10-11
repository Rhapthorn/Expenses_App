const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const dbPath = path.join(app.getPath('userData'), 'expenses.json');
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
const subsPath = path.join(app.getPath('userData'), 'subs.json');
const goalsPath = path.join(app.getPath('userData'), 'goals.json'); // NEW: Goals database

if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify([]));
if (!fs.existsSync(settingsPath)) fs.writeFileSync(settingsPath, JSON.stringify({ salary: 0 }));
if (!fs.existsSync(subsPath)) fs.writeFileSync(subsPath, JSON.stringify([]));
if (!fs.existsSync(goalsPath)) fs.writeFileSync(goalsPath, JSON.stringify([]));

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
}

app.whenReady().then(() => {
    processSubscriptions();
    createWindow();
});

ipcMain.handle('add-expense', (event, expense) => {
    const expenses = readDB();
    expense.amount = parseFloat(expense.amount);
    expense.id = Date.now();
    expenses.push(expense);
    writeDB(expenses);
    return { success: true };
});

ipcMain.handle('get-expenses', () => {
    return readDB().sort((a, b) => new Date(b.date) - new Date(a.date));
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

// NEW: Goal Handlers
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

ipcMain.handle('get-salary', () => readSettings().salary);

ipcMain.handle('set-salary', (event, salary) => {
    const settings = readSettings();
    settings.salary = parseFloat(salary) || 0;
    writeSettings(settings);
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
            { header: 'Amount (€)', key: 'amount', width: 15 }
        ];

        sheet.getRow(1).font = { bold: true };

        expenses.forEach(e => {
            sheet.addRow({ date: e.date, tag: e.tag, amount: e.amount });
        });

        if (chartImageBase64) {
            const base64Data = chartImageBase64.replace(/^data:image\/png;base64,/, "");
            const imageId = workbook.addImage({
                base64: base64Data,
                extension: 'png',
            });
            sheet.addImage(imageId, {
                tl: { col: 4, row: 1 },
                ext: { width: 600, height: 350 }
            });
        }

        await workbook.xlsx.writeFile(filePath);
        return true;
    }
    return false;
});

ipcMain.on('minimize-window', () => mainWindow.minimize());
ipcMain.on('close-window', () => mainWindow.close());
ipcMain.on('maximize-window', () => {
    if (mainWindow.isMaximized()) mainWindow.restore();
    else mainWindow.maximize();
});