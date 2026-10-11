const { ipcRenderer } = require('electron');

let expenseChart;
let activeFilter = null; // NEW: Tracks the currently clicked chart bar

document.getElementById('min-btn').addEventListener('click', () => ipcRenderer.send('minimize-window'));
document.getElementById('max-btn').addEventListener('click', () => ipcRenderer.send('maximize-window'));
document.getElementById('close-btn').addEventListener('click', () => ipcRenderer.send('close-window'));

const salaryInput = document.getElementById('salary');
ipcRenderer.invoke('get-salary').then(salary => salaryInput.value = salary);

salaryInput.addEventListener('change', async (e) => {
    await ipcRenderer.invoke('set-salary', e.target.value);
    loadData();
});

document.getElementById('export-btn').addEventListener('click', () => {
    let chartImage = null;
    if (expenseChart) {
        chartImage = expenseChart.toBase64Image();
    }
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

document.getElementById('add-btn').addEventListener('click', async () => {
    const amount = document.getElementById('amount').value;
    const tag = document.getElementById('tag').value;
    const dateStr = document.getElementById('date').value || new Date().toISOString().split('T')[0];
    const isRecurring = document.getElementById('is-recurring').checked;

    if (amount && tag) {
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
    const goals = await ipcRenderer.invoke('get-goals');
    const salary = parseFloat(salaryInput.value) || 0;

    // 1. Render Expenses with Active Filtering
    const list = document.getElementById('expense-list');
    const listHeader = document.getElementById('expense-list-header');
    list.innerHTML = '';

    // Calculate total across ALL expenses (not just filtered ones) for accurate advice
    const totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);

    // Filter the list if a chart bar was clicked
    const filteredExpenses = activeFilter ? expenses.filter(e => e.tag === activeFilter) : expenses;
    listHeader.innerText = activeFilter ? `Recent Expenses (${activeFilter})` : 'Recent Expenses';

    filteredExpenses.forEach(exp => {
        const li = document.createElement('li');

        const viewDiv = document.createElement('div');
        viewDiv.className = 'item-view';

        const textSpan = document.createElement('span');
        textSpan.className = 'item-text';
        textSpan.innerText = `${exp.date} - ${exp.tag}: €${exp.amount.toFixed(2)}`;

        const viewBtns = document.createElement('div');
        viewBtns.className = 'action-btns';

        const editBtn = document.createElement('button');
        editBtn.innerText = 'Edit';
        editBtn.className = 'edit-btn';

        const deleteBtn = document.createElement('button');
        deleteBtn.innerText = 'Delete';
        deleteBtn.className = 'delete-btn';

        deleteBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete this expense?')) {
                await ipcRenderer.invoke('delete-expense', exp.id);
                loadData();
            }
        });

        viewBtns.appendChild(editBtn);
        viewBtns.appendChild(deleteBtn);
        viewDiv.appendChild(textSpan);
        viewDiv.appendChild(viewBtns);

        const editDiv = document.createElement('div');
        editDiv.className = 'item-edit';

        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.value = exp.date;
        dateInput.className = 'inline-input';

        const tagInput = document.createElement('input');
        tagInput.type = 'text';
        tagInput.value = exp.tag;
        tagInput.setAttribute('list', 'default-tags');
        tagInput.className = 'inline-input';

        const amountInput = document.createElement('input');
        amountInput.type = 'number';
        amountInput.value = exp.amount;
        amountInput.className = 'inline-input';

        const editBtns = document.createElement('div');
        editBtns.className = 'action-btns';

        const saveBtn = document.createElement('button');
        saveBtn.innerText = 'Save';
        saveBtn.className = 'save-btn';

        const cancelBtn = document.createElement('button');
        cancelBtn.innerText = 'Cancel';
        cancelBtn.className = 'delete-btn';

        editBtn.addEventListener('click', () => {
            viewDiv.style.display = 'none';
            editDiv.style.display = 'flex';
        });

        cancelBtn.addEventListener('click', () => {
            viewDiv.style.display = 'flex';
            editDiv.style.display = 'none';
            dateInput.value = exp.date;
            tagInput.value = exp.tag;
            amountInput.value = exp.amount;
        });

        saveBtn.addEventListener('click', async () => {
            if (amountInput.value && tagInput.value) {
                await ipcRenderer.invoke('edit-expense', {
                    id: exp.id,
                    amount: parseFloat(amountInput.value),
                    tag: tagInput.value,
                    date: dateInput.value || exp.date
                });
                loadData();
            }
        });

        editBtns.appendChild(saveBtn);
        editBtns.appendChild(cancelBtn);

        editDiv.appendChild(dateInput);
        editDiv.appendChild(tagInput);
        editDiv.appendChild(amountInput);
        editDiv.appendChild(editBtns);

        li.appendChild(viewDiv);
        li.appendChild(editDiv);
        list.appendChild(li);
    });

    // 2. Render Subscriptions
    const subsList = document.getElementById('subs-list');
    subsList.innerHTML = '';
    subs.forEach(sub => {
        const li = document.createElement('li');
        const wrapper = document.createElement('div');
        wrapper.className = 'item-view';

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

        wrapper.appendChild(textSpan);
        wrapper.appendChild(deleteBtn);
        li.appendChild(wrapper);
        subsList.appendChild(li);
    });

    // 3. Render Goals
    const goalsList = document.getElementById('goals-list');
    goalsList.innerHTML = '';
    goals.forEach(goal => {
        const percentage = Math.min((goal.current / goal.target) * 100, 100).toFixed(1);
        const div = document.createElement('div');
        div.className = 'goal-item';

        const info = document.createElement('div');
        info.className = 'goal-info';
        info.innerHTML = `<span>${goal.name}</span><span>€${goal.current.toFixed(2)} / €${goal.target.toFixed(2)} (${percentage}%)</span>`;

        const track = document.createElement('div');
        track.className = 'progress-track';
        track.innerHTML = `<div class="progress-fill" style="width: ${percentage}%"></div>`;

        const actions = document.createElement('div');
        actions.className = 'action-btns';
        actions.style.marginTop = '6px';
        actions.style.justifyContent = 'flex-end';

        const fundInput = document.createElement('input');
        fundInput.type = 'number';
        fundInput.placeholder = '+ €';
        fundInput.className = 'fund-input';

        const fundBtn = document.createElement('button');
        fundBtn.innerText = 'Add Funds';
        fundBtn.className = 'fund-btn';
        fundBtn.addEventListener('click', async () => {
            const amt = parseFloat(fundInput.value);
            if (amt > 0) {
                await ipcRenderer.invoke('update-goal', { id: goal.id, amountToAdd: amt });
                loadData();
            }
        });

        const delBtn = document.createElement('button');
        delBtn.innerText = 'Delete';
        delBtn.className = 'delete-btn';
        delBtn.addEventListener('click', async () => {
            if (confirm('Delete this goal?')) {
                await ipcRenderer.invoke('delete-goal', goal.id);
                loadData();
            }
        });

        actions.appendChild(fundInput);
        actions.appendChild(fundBtn);
        actions.appendChild(delBtn);

        div.appendChild(info);
        div.appendChild(track);
        div.appendChild(actions);
        goalsList.appendChild(div);
    });

    // 4. Update Chart & Advice
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

const tagColors = {
    'Groceries': '#a6e3a1',
    'Rent/Mortgage': '#f38ba8',
    'Utilities': '#fab387',
    'Transportation': '#89b4fa',
    'Gaming': '#cba6f7',
    'Gym': '#f9e2af',
    'Software': '#94e2d5',
    'Healthcare': '#f5c2e7',
    'Subscriptions': '#74c7ec',
    'Default': '#89dceb'
};

function updateChart(labels, data) {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    if (expenseChart) expenseChart.destroy();

    // Dim unselected bars if a filter is active
    const bgColors = labels.map(label => {
        const baseColor = tagColors[label] || tagColors['Default'];
        if (activeFilter && activeFilter !== label) {
            return baseColor + '40'; // Adds transparency to hex colors
        }
        return baseColor;
    });

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
            layout: {
                padding: { right: 30 }
            },
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: {
                        autoSkip: false,
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            },
            // NEW: Interactivity Handlers
            onClick: (event, elements, chart) => {
                if (elements.length > 0) {
                    const clickedLabel = chart.data.labels[elements[0].index];
                    // Toggle filter off if clicking the same bar, otherwise apply it
                    activeFilter = activeFilter === clickedLabel ? null : clickedLabel;
                } else {
                    // Clicking empty chart space clears the filter
                    activeFilter = null;
                }
                loadData();
            },
            onHover: (event, elements) => {
                // Change cursor to a pointer when hovering over bars
                event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
            }
        }
    });
}

loadData();