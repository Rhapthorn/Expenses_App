const { ipcRenderer } = require('electron');

let expenseChart;
let editingId = null;

document.getElementById('min-btn').addEventListener('click', () => ipcRenderer.send('minimize-window'));
document.getElementById('max-btn').addEventListener('click', () => ipcRenderer.send('maximize-window'));
document.getElementById('close-btn').addEventListener('click', () => ipcRenderer.send('close-window'));

const salaryInput = document.getElementById('salary');
ipcRenderer.invoke('get-salary').then(salary => salaryInput.value = salary);

salaryInput.addEventListener('change', async (e) => {
    await ipcRenderer.invoke('set-salary', e.target.value);
    loadData();
});

// UPGRADED: Captures the chart as an image before exporting
document.getElementById('export-btn').addEventListener('click', () => {
    let chartImage = null;
    if (expenseChart) {
        chartImage = expenseChart.toBase64Image(); // Snapshots the canvas
    }
    ipcRenderer.invoke('export-excel', chartImage);
});

document.getElementById('add-btn').addEventListener('click', async () => {
    const amount = document.getElementById('amount').value;
    const tag = document.getElementById('tag').value;
    const dateStr = document.getElementById('date').value || new Date().toISOString().split('T')[0];
    const isRecurring = document.getElementById('is-recurring').checked;

    if (amount && tag) {
        if (editingId) {
            await ipcRenderer.invoke('edit-expense', { id: editingId, amount, tag, date: dateStr });
            editingId = null;
            document.getElementById('add-btn').innerText = 'Log Expense';
            document.getElementById('recurring-wrapper').style.display = 'flex';
        } else {
            await ipcRenderer.invoke('add-expense', { amount, tag, date: dateStr });

            if (isRecurring) {
                const d = new Date(dateStr);
                await ipcRenderer.invoke('add-sub', {
                    amount: parseFloat(amount),
                    tag: tag,
                    dayOfMonth: d.getDate(),
                    lastProcessedMonth: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                });
            }
        }

        document.getElementById('amount').value = '';
        document.getElementById('tag').value = '';
        document.getElementById('date').value = '';
        document.getElementById('is-recurring').checked = false;

        loadData();
    }
});

async function loadData() {
    const expenses = await ipcRenderer.invoke('get-expenses');
    const subs = await ipcRenderer.invoke('get-subs');
    const salary = parseFloat(salaryInput.value) || 0;

    const list = document.getElementById('expense-list');
    list.innerHTML = '';
    let totalExpenses = 0;

    expenses.forEach(exp => {
        totalExpenses += exp.amount;
        const li = document.createElement('li');

        const textSpan = document.createElement('span');
        textSpan.className = 'item-text';
        textSpan.innerText = `${exp.date} - ${exp.tag}: €${exp.amount.toFixed(2)}`;

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
            document.getElementById('recurring-wrapper').style.display = 'none';
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

    const subsList = document.getElementById('subs-list');
    subsList.innerHTML = '';
    subs.forEach(sub => {
        const li = document.createElement('li');

        const textSpan = document.createElement('span');
        textSpan.className = 'item-text';
        textSpan.innerText = `${sub.tag} (€${sub.amount.toFixed(2)}) - Day ${sub.dayOfMonth}`;

        const deleteBtn = document.createElement('button');
        deleteBtn.innerText = 'Cancel';
        deleteBtn.className = 'delete-btn';
        deleteBtn.addEventListener('click', async () => {
            if (confirm(`Cancel recurring ${sub.tag}?`)) {
                await ipcRenderer.invoke('delete-sub', sub.id);
                loadData();
            }
        });

        li.appendChild(textSpan);
        li.appendChild(deleteBtn);
        subsList.appendChild(li);
    });

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

    let highestTag = '';
    let highestAmount = 0;
    for (const [tag, amount] of Object.entries(totalsByTag)) {
        if (amount > highestAmount) {
            highestAmount = amount;
            highestTag = tag;
        }
    }

    let remaining = salary - totalExpenses;
    let advice = `Highest spend: €${highestAmount.toFixed(2)} on ${highestTag}. `;

    if (salary > 0) {
        if (remaining < 0) {
            advice += `⚠️ You are over budget by €${Math.abs(remaining).toFixed(2)}! Consider cutting back on ${highestTag}.`;
            adviceBox.style.color = "#f38ba8";
        } else {
            advice += `You have €${remaining.toFixed(2)} left for the month.`;
            adviceBox.style.color = "var(--accent-color)";
        }
    }
    adviceBox.innerText = advice;
}

// NEW: Predefined color map for categories
const tagColors = {
    'Groceries': '#a6e3a1',     // Green
    'Rent/Mortgage': '#f38ba8', // Red
    'Utilities': '#fab387',     // Peach
    'Transportation': '#89b4fa',// Blue
    'Gaming': '#cba6f7',        // Purple
    'Gym': '#f9e2af',           // Yellow
    'Software': '#94e2d5',      // Teal
    'Healthcare': '#f5c2e7',    // Pink
    'Subscriptions': '#74c7ec', // Light Blue
    'Default': '#89dceb'        // Cyan fallback for custom tags
};

function updateChart(labels, data) {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    if (expenseChart) expenseChart.destroy();

    // Maps the labels dynamically to the colors above
    const bgColors = labels.map(label => tagColors[label] || tagColors['Default']);

    expenseChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Expenses by Tag',
                data: data,
                backgroundColor: bgColors,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false } // Hides the legend since bars are color-coded now
            }
        }
    });
}

loadData();