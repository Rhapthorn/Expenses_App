const { ipcRenderer } = require('electron');

let expenseChart;

document.getElementById('add-btn').addEventListener('click', async () => {
    const amount = document.getElementById('amount').value;
    const tag = document.getElementById('tag').value;
    const date = document.getElementById('date').value || new Date().toISOString().split('T')[0];

    if (amount && tag) {
        await ipcRenderer.invoke('add-expense', { amount, tag, date });
        loadData(); // Refresh UI
    }
});

async function loadData() {
    const expenses = await ipcRenderer.invoke('get-expenses');

    // 1. Update List
    const list = document.getElementById('expense-list');
    list.innerHTML = '';
    expenses.forEach(exp => {
        const li = document.createElement('li');
        li.innerText = `${exp.date} - ${exp.tag}: €${exp.amount}`;
        list.appendChild(li);
    });

    // 2. Process data for Chart (grouping by tag as an example)
    const totalsByTag = expenses.reduce((acc, curr) => {
        acc[curr.tag] = (acc[curr.tag] || 0) + curr.amount;
        return acc;
    }, {});

    updateChart(Object.keys(totalsByTag), Object.values(totalsByTag));
}

function updateChart(labels, data) {
    const ctx = document.getElementById('expenseChart').getContext('2d');

    if (expenseChart) expenseChart.destroy(); // Destroy old chart before re-drawing

    expenseChart = new Chart(ctx, {
        type: 'bar', // or 'line', 'doughnut'
        data: {
            labels: labels,
            datasets: [{
                label: 'Expenses by Tag',
                data: data,
                backgroundColor: '#6366f1',
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

// Custom close button logic for frameless window
document.getElementById('close-btn').addEventListener('click', () => {
    window.close();
});