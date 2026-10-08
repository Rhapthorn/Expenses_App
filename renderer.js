const { ipcRenderer } = require('electron');

let expenseChart;
let editingId = null;

// --- Window & Theme Controls ---
document.getElementById('min-btn').addEventListener('click', () => ipcRenderer.send('minimize-window'));
document.getElementById('max-btn').addEventListener('click', () => ipcRenderer.send('maximize-window'));
document.getElementById('close-btn').addEventListener('click', () => ipcRenderer.send('close-window'));

const themeBtn = document.getElementById('theme-btn');
let isLightMode = localStorage.getItem('theme') === 'light';

if (isLightMode) document.body.classList.add('light-mode');
themeBtn.innerText = isLightMode ? '🌙' : '☀️';

themeBtn.addEventListener('click', () => {
    isLightMode = !isLightMode;
    document.body.classList.toggle('light-mode', isLightMode);
    localStorage.setItem('theme', isLightMode ? 'light' : 'dark');
    themeBtn.innerText = isLightMode ? '🌙' : '☀️';
});

// --- Salary & Export Controls ---
const salaryInput = document.getElementById('salary');
ipcRenderer.invoke('get-salary').then(salary => salaryInput.value = salary);

salaryInput.addEventListener('change', async (e) => {
    await ipcRenderer.invoke('set-salary', e.target.value);
    loadData(); // Refresh advice box when salary changes
});

document.getElementById('export-btn').addEventListener('click', () => {
    ipcRenderer.invoke('export-excel');
});

// --- CRUD Operations ---
document.getElementById('add-btn').addEventListener('click', async () => {
    const amount = document.getElementById('amount').value;
    const tag = document.getElementById('tag').value;
    const date = document.getElementById('date').value || new Date().toISOString().split('T')[0];

    if (amount && tag) {
        if (editingId) {
            await ipcRenderer.invoke('edit-expense', { id: editingId, amount, tag, date });
            editingId = null;
            document.getElementById('add-btn').innerText = 'Log Expense';
        } else {
            await ipcRenderer.invoke('add-expense', { amount, tag, date });
        }

        document.getElementById('amount').value = '';
        document.getElementById('tag').value = '';
        document.getElementById('date').value = '';

        loadData();
    }
});

async function loadData() {
    const expenses = await ipcRenderer.invoke('get-expenses');
    const salary = parseFloat(salaryInput.value) || 0;

    // 1. Update List
    const list = document.getElementById('expense-list');
    list.innerHTML = '';

    let totalExpenses = 0;

    expenses.forEach(exp => {
        totalExpenses += exp.amount;
        const li = document.createElement('li');

        const textSpan = document.createElement('span');
        textSpan.innerText = `${exp.date} - ${exp.tag}: €${exp.amount}`;

        const btnGroup = document.createElement('div');
        btnGroup.className = 'action-btns';

        const editBtn = document.createElement('button');
        editBtn.innerText = 'Edit';
        editBtn.className = 'edit-btn';
        editBtn.addEventListener('click', () => {
            editingId = exp.id;
            document.getElementById('amount').value = exp.amount;
            document.getElementById('tag').value = exp.tag;
            document.getElementById('date').value = exp.date;
            document.getElementById('add-btn').innerText = 'Update Expense';
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.innerText = 'Delete';
        deleteBtn.className = 'delete-btn';
        deleteBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete this expense?')) {
                await ipcRenderer.invoke('delete-expense', exp.id);
                loadData();
            }
        });

        btnGroup.appendChild(editBtn);
        btnGroup.appendChild(deleteBtn);
        li.appendChild(textSpan);
        li.appendChild(btnGroup);
        list.appendChild(li);
    });

    // 2. Aggregate Data for Chart & Advice
    const totalsByTag = expenses.reduce((acc, curr) => {
        acc[curr.tag] = (acc[curr.tag] || 0) + curr.amount;
        return acc;
    }, {});

    updateChart(Object.keys(totalsByTag), Object.values(totalsByTag));
    updateAdviceBox(totalsByTag, totalExpenses, salary);
}

function updateAdviceBox(totalsByTag, totalExpenses, salary) {
    const adviceBox = document.getElementById('advice-box');

    if (Object.keys(totalsByTag).length === 0) {
        adviceBox.innerText = "Log expenses to get insights.";
        adviceBox.style.color = "var(--text-color)";
        return;
    }

    // Find the highest expense category
    let highestTag = '';
    let highestAmount = 0;
    for (const [tag, amount] of Object.entries(totalsByTag)) {
        if (amount > highestAmount) {
            highestAmount = amount;
            highestTag = tag;
        }
    }

    let remaining = salary - totalExpenses;
    let advice = `Highest spend: €${highestAmount} on ${highestTag}. `;

    if (salary > 0) {
        if (remaining < 0) {
            advice += `⚠️ You are over budget by €${Math.abs(remaining)}! Consider cutting back on ${highestTag}.`;
            adviceBox.style.color = "#f38ba8"; // Red warning
        } else {
            advice += `You have €${remaining} left for the month.`;
            adviceBox.style.color = "var(--accent-color)";
        }
    } else {
        advice += `Set your salary to track your budget.`;
        adviceBox.style.color = "var(--text-color)";
    }

    adviceBox.innerText = advice;
}

function updateChart(labels, data) {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    if (expenseChart) expenseChart.destroy();
    expenseChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Expenses by Tag',
                data: data,
                backgroundColor: '#89b4fa',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// Initial load
loadData();