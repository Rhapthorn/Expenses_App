[README.md](https://github.com/user-attachments/files/33709073/README.md)
# 💰 Electron Personal Expense Tracker

A modern, high-performance, and lightweight desktop expense tracking application built with **Electron**, **JavaScript**, and **Chart.js**. Designed for power users who want local data privacy, quick shortcut access, and comprehensive financial tracking.

---

## ✨ Key Features

* **⚡ Global Keyboard Shortcut (`Ctrl + Shift + E`)**: Instantly bring the expense tracker to the foreground from anywhere in your operating system—whether you're gaming, coding, or browsing.  
* **📊 Interactive Data Visualization**: Dynamic bar charts broken down by category tags. Click any bar to filter your recent expenses instantly, or hover to inspect.  
* **🎯 Savings Goals & Wishlists**: Set targets (e.g., hardware upgrades, travel funds) and manually allocate spare funds via clean, animated progress bars.  
* **🔄 Recurring Subscriptions**: Automatically logs your recurring monthly bills on startup based on scheduled billing days.  
* **📝 Inline Editing**: Edit your expenses, dates, and amounts directly in the list view without messing with the top input bar.  
* **📈 Professional Excel Export**: Instantly export your financial logs to an `.xlsx` spreadsheet complete with an embedded snapshot of your live expense chart.  
* **🌐 Internationalization (English / Ελληνικά)**: Fully localized UI supporting both English and Greek.  
* **🗂️ System Tray Integration**: Run silently in the background and minimize to your system tray instead of closing.  
* **🔒 100% Local Privacy**: All data (`expenses.json`, `settings.json`, `subs.json`, `goals.json`) is stored securely and offline inside your local app data directory.

---

## 🛠️ Tech Stack

* **Core**: Node.js, Electron  
* **Frontend**: HTML5, CSS3, JavaScript (Vanilla)  
* **Charting**: Chart.js  
* **Data Management**: ExcelJS (`exceljs`)

---

## 🚀 Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation & Local Development

1. Clone the repository:  
     
   git clone https\://github.com/your-username/your-repo-name.git  
     
   cd your-repo-name  
     
2. Install dependencies:  
     
   npm install  
     
3. Run the application in development mode:  
     
   npm start

---

## 📦 Building & Packaging (.exe)

To bundle the application into a standalone Windows installer (`.exe`), run:

npm run build

Once complete, your installer and unpacked build outputs will be available in the `dist/` directory.

---

## ⚙️ Settings & Configuration

You can open the **Settings Panel** inside the app (`⚙️ Settings`) to configure:

* **Language**: Toggle seamlessly between English and Greek.  
* **Window Close Behavior**: Choose whether clicking the `X` button quits the app or minimizes it to the Windows system tray.  
* **Currency**: Switch your financial symbols dynamically (`€`, `$`, `£`).  
* **Run on Startup**: Toggle automatic background launch with Windows.

---

## 📜 License

This project is open-source and available under the [MIT License](http://LICENSE).
