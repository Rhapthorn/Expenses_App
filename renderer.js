const { ipcRenderer } = require('electron');

let expenseChart;
let activeFilter = null;
let appSettings = {};

const translations = {
    en: {
        appTitle: "Expense Tracker",
        netSalary: "Net Salary:",
        settings: "Settings",
        exportExcel: "Export to Excel",
        language: "Language",
        onClose: "On Window Close (X)",
        minimizeTray: "Minimize to Tray",
        quitApp: "Quit App",
        currency: "Currency",
        runStartup: "Run on Startup",
        save: "Save",
        cancel: "Cancel",
        savingsGoals: "Savings Goals",
        goalName: "Name (e.g. New GPU)",
        goalTarget: "Target",
        setGoal: "Set Goal",
        amount: "Amount",
        tag: "Tag (e.g. Groceries)",
        recurring: "Recurring Sub",
        logExpense: "Log Expense",
        recentExpenses: "Recent Expenses",
        activeSubs: "Active Subs",
        edit: "Edit",
        delete: "Delete",
        addFunds: "Add Funds"
    },
    el: {
        appTitle: "Διαχείριση Εξόδων",
        netSalary: "Καθαρός Μισθός:",
        settings: "Ρυθμίσεις",
        exportExcel: "Εξαγωγή σε Excel",
        language: "Γλώσσα",
        onClose: "Συμπεριφορά Κλεισίματος (X)",
        minimizeTray: "Ελαχιστοποίηση στο Tray",
        quitApp: "Έξοδος",
        currency: "Νόμισμα",
        runStartup: "Εκκίνηση με τα Windows",
        save: "Αποθήκευση",
        cancel: "Ακύρωση",
        savingsGoals: "Στόχοι Αποταμίευσης",
        goalName: "Όνομα (π.χ. Ταξίδι)",
        goalTarget: "Στόχος",
        setGoal: "Προσθήκη",
        amount: "Ποσό",
        tag: "Κατηγορία (π.χ. Supermarket)",
        recurring: "Μηνιαία Συνδρομή",
        logExpense: "Καταχώρηση",
        recentExpenses: "Πρόσφατα Έξοδα",
        activeSubs: "Ενεργές Συνδρομές",
        edit: "Επεξεργασία",
        delete: "Διαγραφή",
        addFunds: "Προσθήκη"
    }
};

function applyTranslations() {
    const lang = appSettings.language || 'en';
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang][key]) {
            if (el.tagName === 'INPUT') el.placeholder = translations[lang][key];
            else el.innerText = translations[lang][key];
        }
    });

    const listHeader = document.getElementById('expense-list-header');
    const baseHeader = translations[lang]['recentExpenses'];
    listHeader.innerText = activeFilter ? `${baseHeader} (${activeFilter})` : baseHeader;
}

document.getElementById('min-btn').addEventListener('click', () => ipcRenderer.send('minimize-window'));
document.getElementById('max-btn').addEventListener('click', () => ipcRenderer.send('maximize-window'));
document.getElementById('close-btn').addEventListener('click', () => ipcRenderer.send('close-window'));

ipcRenderer.invoke('get-settings').then(settings => {
    appSettings = settings;
    document.getElementById('salary').value = settings.salary || 0;
    applyTranslations();
    loadData();
});

const modal = document.getElementById('settings-modal');
document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('setting-language').value = appSettings.language;
    document.getElementById('setting-close').value = appSettings.closeBehavior;
    document.getElementById('setting-currency').value = appSettings.currency;
    document.getElementById('setting-autolaunch').checked = appSettings.autoLaunch;
    modal.style.display = 'flex';
});

document.getElementById('cancel-settings-btn').addEventListener('click', () => {
    modal.style.display = 'none';
});

document.getElementById('save-settings-btn').addEventListener('click', async () => {
    const newSettings = {
        salary: parseFloat(document.getElementById('salary').value) || 0,
        language: document.getElementById('setting-language').value,
        closeBehavior: document.getElementById('setting-close').value,
        currency: document.getElementById('setting-currency').value,
        autoLaunch: document.getElementById('setting-autolaunch').checked
    };
    await ipcRenderer.invoke('save-settings', newSettings);
    appSettings = newSettings;
    applyTranslations();
    loadData();
    modal.style.display = 'none';
});

document.getElementById('salary').addEventListener('change', async (e) => {
    appSettings.salary = parseFloat(e.target.value) || 0;
    await ipcRenderer.invoke('save-settings', appSettings);
    loadData();
});

document.getElementById('export-btn').addEventListener('click', () => {
    let chartImage = null;
    if (expenseChart) chartImage = expenseChart.toBase64Image();
    ipcRenderer.invoke('export-excel', chartImage);
});

document.getElementById('add-goal-btn').addEventListener('click', async () => {
    const name = document.getElementById('goal-name').value;
    const target = parseFloat(document.getElementById('goal-target').value);
    if (name && target > 0) {
        await ipcRenderer.invoke('add-goal', { name, target });
        document.getElementById('goal-name').value = '';
        document.getElementById('goal-target').value = '';
        loadData();
    }
});

async function handleLogExpense() {
    const amount = document.getElementById('amount').value;
    const tag = document.getElementById('tag').value;
    const dateStr = document.getElementById('date').value || new Date().toISOString().split('T')[0];
    const isRecurring = document.getElementById('is-recurring').checked;

    if (amount && tag) {
        await ipcRenderer.invoke('add-expense', { amount, tag, date: dateStr });
        if (isRecurring) {
            const d = new Date(dateStr);
            await ipcRenderer.invoke('add-sub', {
                amount: parseFloat(amount), tag: tag, dayOfMonth: d.getDate(),
                lastProcessedMonth: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            });
        }
        document.getElementById('amount').value = '';
        document.getElementById('tag').value = '';
        document.getElementById('date').value = '';
        document.getElementById('is-recurring').checked = false;
        loadData();
    }
}

document.getElementById('add-btn').addEventListener('click', handleLogExpense);
['amount', 'tag', 'date'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleLogExpense();
    });
});

async function loadData() {
    const expenses = await ipcRenderer.invoke('get-expenses');
    const subs = await ipcRenderer.invoke('get-subs');
    const goals = await ipcRenderer.invoke('get-goals');
    const salary = appSettings.salary || 0;
    const sym = appSettings.currency || '€';
    const lang = appSettings.language || 'en';
    const t = translations[lang];

    const list = document.getElementById('expense-list');
    list.innerHTML = '';
    const totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);
    const filteredExpenses = activeFilter ? expenses.filter(e => e.tag === activeFilter) : expenses;

    filteredExpenses.forEach(exp => {
        const li = document.createElement('li');
        const viewDiv = document.createElement('div');
        viewDiv.className = 'item-view';

        const textSpan = document.createElement('span');
        textSpan.className = 'item-text';
        textSpan.innerText = `${exp.date} - ${exp.tag}: ${sym}${exp.amount.toFixed(2)}`;

        const viewBtns = document.createElement('div');
        viewBtns.className = 'action-btns';

        const editBtn = document.createElement('button');
        editBtn.innerText = t.edit;
        editBtn.className = 'edit-btn';

        const deleteBtn = document.createElement('button');
        deleteBtn.innerText = t.delete;
        deleteBtn.className = 'delete-btn';

        deleteBtn.addEventListener('click', async () => {
            if (confirm(lang === 'el' ? 'Είστε βέβαιοι;' : 'Are you sure?')) { await ipcRenderer.invoke('delete-expense', exp.id); loadData(); }
        });

        viewBtns.appendChild(editBtn);
        viewBtns.appendChild(deleteBtn);
        viewDiv.appendChild(textSpan);
        viewDiv.appendChild(viewBtns);

        const editDiv = document.createElement('div');
        editDiv.className = 'item-edit';

        const dateInput = document.createElement('input');
        dateInput.type = 'date'; dateInput.value = exp.date; dateInput.className = 'inline-input';

        const tagInput = document.createElement('input');
        tagInput.type = 'text'; tagInput.value = exp.tag; tagInput.setAttribute('list', 'default-tags'); tagInput.className = 'inline-input';

        const amountInput = document.createElement('input');
        amountInput.type = 'number'; amountInput.value = exp.amount; amountInput.className = 'inline-input';

        const editBtns = document.createElement('div');
        editBtns.className = 'action-btns';

        const saveBtn = document.createElement('button');
        saveBtn.innerText = t.save; saveBtn.className = 'save-btn';

        const cancelBtn = document.createElement('button');
        cancelBtn.innerText = t.cancel; cancelBtn.className = 'delete-btn';

        editBtn.addEventListener('click', () => { viewDiv.style.display = 'none'; editDiv.style.display = 'flex'; });
        cancelBtn.addEventListener('click', () => { viewDiv.style.display = 'flex'; editDiv.style.display = 'none'; });

        saveBtn.addEventListener('click', async () => {
            if (amountInput.value && tagInput.value) {
                await ipcRenderer.invoke('edit-expense', {
                    id: exp.id, amount: parseFloat(amountInput.value), tag: tagInput.value, date: dateInput.value || exp.date
                });
                loadData();
            }
        });

        editBtns.appendChild(saveBtn); editBtns.appendChild(cancelBtn);
        editDiv.appendChild(dateInput); editDiv.appendChild(tagInput); editDiv.appendChild(amountInput); editDiv.appendChild(editBtns);
        li.appendChild(viewDiv); li.appendChild(editDiv); list.appendChild(li);
    });

    const subsList = document.getElementById('subs-list');
    subsList.innerHTML = '';
    subs.forEach(sub => {
        const li = document.createElement('li');
        const wrapper = document.createElement('div');
        wrapper.className = 'item-view';
        const textSpan = document.createElement('span');
        textSpan.className = 'item-text';
        textSpan.innerText = `${sub.tag} (${sym}${sub.amount.toFixed(2)}) - Day ${sub.dayOfMonth}`;

        const deleteBtn = document.createElement('button');
        deleteBtn.innerText = t.cancel;
        deleteBtn.className = 'delete-btn';
        deleteBtn.addEventListener('click', async () => {
            if (confirm(lang === 'el' ? 'Ακύρωση συνδρομής;' : 'Cancel recurring?')) { await ipcRenderer.invoke('delete-sub', sub.id); loadData(); }
        });
        wrapper.appendChild(textSpan); wrapper.appendChild(deleteBtn);
        li.appendChild(wrapper); subsList.appendChild(li);
    });

    const goalsList = document.getElementById('goals-list');
    goalsList.innerHTML = '';
    goals.forEach(goal => {
        const percentage = Math.min((goal.current / goal.target) * 100, 100).toFixed(1);
        const div = document.createElement('div');
        div.className = 'goal-item';

        const info = document.createElement('div');
        info.className = 'goal-info';
        info.innerHTML = `<span>${goal.name}</span><span>${sym}${goal.current.toFixed(2)} / ${sym}${goal.target.toFixed(2)} (${percentage}%)</span>`;

        const track = document.createElement('div');
        track.className = 'progress-track';
        track.innerHTML = `<div class="progress-fill" style="width: ${percentage}%"></div>`;

        const actions = document.createElement('div');
        actions.className = 'action-btns';
        actions.style.marginTop = '6px';
        actions.style.justifyContent = 'flex-end';

        const fundInput = document.createElement('input');
        fundInput.type = 'number'; fundInput.placeholder = `+ ${sym}`; fundInput.className = 'fund-input';

        const fundBtn = document.createElement('button');
        fundBtn.innerText = t.addFunds; fundBtn.className = 'fund-btn';
        fundBtn.addEventListener('click', async () => {
            const amt = parseFloat(fundInput.value);
            if (amt > 0) { await ipcRenderer.invoke('update-goal', { id: goal.id, amountToAdd: amt }); loadData(); }
        });

        const delBtn = document.createElement('button');
        delBtn.innerText = t.delete; delBtn.className = 'delete-btn';
        delBtn.addEventListener('click', async () => {
            if (confirm(lang === 'el' ? 'Διαγραφή;' : 'Delete?')) { await ipcRenderer.invoke('delete-goal', goal.id); loadData(); }
        });

        actions.appendChild(fundInput); actions.appendChild(fundBtn); actions.appendChild(delBtn);
        div.appendChild(info); div.appendChild(track); div.appendChild(actions); goalsList.appendChild(div);
    });

    const totalsByTag = expenses.reduce((acc, curr) => {
        acc[curr.tag] = (acc[curr.tag] || 0) + curr.amount;
        return acc;
    }, {});

    updateChart(Object.keys(totalsByTag), Object.values(totalsByTag));
    updateAdviceBox(totalsByTag, totalExpenses, salary, sym, lang);
}

function updateAdviceBox(totalsByTag, totalExpenses, salary, sym, lang) {
    const adviceBox = document.getElementById('advice-box');
    if (Object.keys(totalsByTag).length === 0) {
        adviceBox.innerText = lang === 'el' ? "Καταχωρήστε έξοδα για ανάλυση." : "Log expenses to get insights.";
        adviceBox.style.color = "var(--text-color)";
        return;
    }

    let highestTag = '';
    let highestAmount = 0;
    for (const [tag, amount] of Object.entries(totalsByTag)) {
        if (amount > highestAmount) { highestAmount = amount; highestTag = tag; }
    }

    let remaining = salary - totalExpenses;
    let advice = lang === 'el'
        ? `Υψηλότερο έξοδο: ${sym}${highestAmount.toFixed(2)} (${highestTag}). `
        : `Highest spend: ${sym}${highestAmount.toFixed(2)} on ${highestTag}. `;

    if (salary > 0) {
        if (remaining < 0) {
            advice += lang === 'el'
                ? `⚠️ Είστε εκτός προϋπολογισμού κατά ${sym}${Math.abs(remaining).toFixed(2)}!`
                : `⚠️ You are over budget by ${sym}${Math.abs(remaining).toFixed(2)}!`;
            adviceBox.style.color = "#f38ba8";
        } else {
            advice += lang === 'el'
                ? `Διαθέσιμο υπόλοιπο: ${sym}${remaining.toFixed(2)}.`
                : `You have ${sym}${remaining.toFixed(2)} left.`;
            adviceBox.style.color = "var(--accent-color)";
        }
    }
    adviceBox.innerText = advice;
}

const tagColors = {
    // Greek Tags (Active)
    'Supermarket': '#a6e3a1',
    'Ενοίκιο/Δάνειο': '#f38ba8',
    'Λογαριασμοί': '#fab387',
    'Μετακινήσεις': '#89b4fa',
    'Φαγητό Έξω': '#f9e2af',
    'Gaming': '#cba6f7',
    'Υλικό PC': '#94e2d5',
    'Λογισμικό': '#74c7ec',
    'Υγεία': '#f5c2e7',
    'Συνδρομές': '#b4befe',
    'Ταξίδια': '#f2cdcd',
    'Διασκέδαση': '#cdd6f4',
    'Δώρα': '#f5e0dc',
    'Ρούχα': '#bac2de',

    // Legacy English Tags (Kept specifically so your older chart data retains its colors)
    'Groceries': '#a6e3a1',
    'Rent/Mortgage': '#f38ba8',
    'Utilities': '#fab387',
    'Transportation': '#89b4fa',
    'Software': '#94e2d5',
    'Subscriptions': '#74c7ec',

    'Default': '#89dceb'
};

function updateChart(labels, data) {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    if (expenseChart) expenseChart.destroy();

    const bgColors = labels.map(label => {
        const baseColor = tagColors[label] || tagColors['Default'];
        return (activeFilter && activeFilter !== label) ? baseColor + '40' : baseColor;
    });

    expenseChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: 'Amount', data: data, backgroundColor: bgColors, borderRadius: 4 }] },
        options: {
            responsive: true, maintainAspectRatio: false, layout: { padding: { right: 30 } },
            plugins: { legend: { display: false } },
            scales: { x: { ticks: { autoSkip: false, maxRotation: 45, minRotation: 45 } } },
            onClick: (event, elements, chart) => {
                if (elements.length > 0) {
                    const clickedLabel = chart.data.labels[elements[0].index];
                    activeFilter = activeFilter === clickedLabel ? null : clickedLabel;
                } else activeFilter = null;
                loadData();
            },
            onHover: (event, elements) => { event.native.target.style.cursor = elements.length ? 'pointer' : 'default'; }
        }
    });
}