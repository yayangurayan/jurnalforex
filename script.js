document.addEventListener('DOMContentLoaded', () => {

    // =========================================================================
    // VARIABEL GLOBAL & KONFIGURASI
    // =========================================================================
    const CURRENCY_SYMBOL = "AUC";
    let accountGrowthChart;
    let trades = [];
    let transactions_dw = [];
    let confirmationCallback = null;

    // =========================================================================
    // PEMILIHAN ELEMEN DOM
    // =========================================================================
    const getElement = (id) => document.getElementById(id);
    const querySelector = (selector) => document.querySelector(selector);
    const querySelectorAll = (selector) => document.querySelectorAll(selector);

    const headerTitle = querySelector('.main-header h1');
    const sidebar = getElement('sidebar');
    const mainContent = getElement('main-content');

    // =========================================================================
    // MANAJEMEN DATA (LOCAL STORAGE)
    // =========================================================================
    const getFromStorage = (key) => JSON.parse(localStorage.getItem(key)) || [];
    const saveToStorage = (key, data) => localStorage.setItem(key, JSON.stringify(data));

    // =========================================================================
    // FUNGSI UTILITAS (MODAL, NOTIFIKASI, FORMAT)
    // =========================================================================
    const formatCurrency = (value) => `${parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${CURRENCY_SYMBOL}`;

    const showToast = (message, type = 'success') => {
        const toast = getElement('toast-notification');
        const toastMessage = getElement('toast-message');
        toastMessage.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => { toast.className = 'toast'; }, 3000);
    };

    const openModal = (modalId) => {
        mainContent.classList.add('blurred');
        getElement('modal-overlay').classList.add('active');
        getElement(modalId).classList.add('active');
    };

    const closeModal = () => {
        mainContent.classList.remove('blurred');
        getElement('modal-overlay').classList.remove('active');
        querySelectorAll('.modal.active').forEach(modal => modal.classList.remove('active'));
    };

    const showConfirmation = (title, text, onConfirm) => {
        getElement('confirm-title').textContent = title;
        getElement('confirm-text').textContent = text;
        confirmationCallback = onConfirm;
        openModal('confirm-modal');
    };
    
    // =========================================================================
    // FUNGSI RENDER (MEMPERBARUI TAMPILAN)
    // =========================================================================
    const renderTradesTable = () => {
        const tableBody = getElement('trades-table-body');
        tableBody.innerHTML = (trades.length === 0) 
            ? `<tr><td colspan="7" style="text-align:center;">Belum ada transaksi.</td></tr>`
            : trades.map(trade => `
                <tr>
                    <td>${trade.date}</td>
                    <td>${trade.symbol.toUpperCase()}</td>
                    <td class="${trade.type === 'Buy' ? 'text-success' : 'text-danger'}">${trade.type}</td>
                    <td>${trade.lot}</td>
                    <td class="${trade.pnl >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(trade.pnl)}</td>
                    <td>
                        <button class="action-btn view-trade" data-id="${trade.id}" title="Lihat Detail">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                    <td>
                        <button class="action-btn delete-trade" data-id="${trade.id}" title="Hapus">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>`).join('');
    };

    const renderDwTable = () => {
        const tableBody = getElement('dw-table-body');
        tableBody.innerHTML = (transactions_dw.length === 0)
            ? `<tr><td colspan="4" style="text-align:center;">Belum ada catatan.</td></tr>`
            : transactions_dw.map(t => `
                <tr>
                    <td>${t.date}</td>
                    <td class="${t.type === 'Deposit' ? 'text-success' : 'text-danger'}">${t.type}</td>
                    <td>${formatCurrency(t.amount)}</td>
                    <td><button class="action-btn delete-dw" data-id="${t.id}"><i class="fas fa-trash"></i></button></td>
                </tr>`).join('');
    };
    
    const updateDashboard = () => {
        const netDeposits = transactions_dw.reduce((sum, t) => sum + parseFloat(t.type === 'Deposit' ? t.amount : -t.amount), 0);
        const totalPnl = trades.reduce((sum, trade) => sum + parseFloat(trade.pnl), 0);
        const totalBalance = netDeposits + totalPnl;
        const totalTrades = trades.length;
        const winningTrades = trades.filter(trade => trade.pnl > 0).length;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades * 100) : 0;
        
        getElement('total-balance').textContent = formatCurrency(totalBalance);
        const pnlEl = getElement('total-pnl');
        pnlEl.textContent = formatCurrency(totalPnl);
        pnlEl.className = totalPnl >= 0 ? 'text-success' : 'text-danger';
        getElement('win-rate').textContent = `${winRate.toFixed(1)}%`;
        getElement('total-trades').textContent = totalTrades;
        updateChart(netDeposits);
    };

    const updateChart = (initialBalance) => {
        const sortedData = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
        const labels = ['Saldo Awal'];
        const data = [initialBalance];
        let cumulativeBalance = initialBalance;

        sortedData.forEach(item => {
            labels.push(`${item.symbol} (${item.date})`);
            cumulativeBalance += parseFloat(item.pnl);
            data.push(cumulativeBalance);
        });

        if (accountGrowthChart) accountGrowthChart.destroy();
        
        const ctx = getElement('account-growth-chart').getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 350);
        gradient.addColorStop(0, 'rgba(94, 114, 228, 0.5)');
        gradient.addColorStop(1, 'rgba(94, 114, 228, 0)');

        accountGrowthChart = new Chart(ctx, {
            type: 'line', data: { labels, datasets: [{ label: `Pertumbuhan Akun (${CURRENCY_SYMBOL})`, data, backgroundColor: gradient, borderColor: '#5e72e4', borderWidth: 3, pointBackgroundColor: '#5e72e4', pointBorderColor: '#fff', pointHoverBackgroundColor: '#fff', pointHoverBorderColor: '#5e72e4', pointRadius: 4, pointHoverRadius: 6, tension: 0.2, fill: true }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { callback: (value) => formatCurrency(value) } } }, plugins: { tooltip: { callbacks: { label: (c) => `Saldo: ${formatCurrency(c.parsed.y)}` } } } }
        });
    };
    
    // =========================================================================
    // HANDLER FUNGSI UNTUK EVENT
    // =========================================================================
    const handleAddTrade = (e) => {
        e.preventDefault();
        const form = e.target;
        const pnlType = form['pnl-type'].value;
        const pnlAmount = parseFloat(form['trade-pnl-amount'].value);

        if (isNaN(pnlAmount) || pnlAmount < 0) {
            showToast('Jumlah P/L harus angka positif yang valid.', 'error');
            return;
        }

        const finalPnl = pnlType === 'Loss' ? -pnlAmount : pnlAmount;

        const newTrade = { 
            id: Date.now(), 
            date: form['trade-date'].value, 
            symbol: form['trade-symbol'].value, 
            type: form['trade-type'].value, 
            lot: parseFloat(form['trade-lot'].value), 
            pnl: finalPnl,
            notes_entry: form['trade-notes-entry'].value,
            notes_mistakes: form['trade-notes-mistakes'].value,
        };
        
        trades.push(newTrade);
        saveToStorage('forex_trades', trades);
        updateUI();
        form.reset();
        closeModal();
        showToast('Transaksi berhasil ditambahkan!');
    };

    const handleAddDw = (e) => {
        e.preventDefault();
        const form = e.target;
        transactions_dw.push({ id: Date.now(), date: form['dw-date'].value, type: form['dw-type'].value, amount: parseFloat(form['dw-amount'].value) });
        saveToStorage('forex_dw', transactions_dw);
        updateUI();
        form.reset();
        closeModal();
        showToast('Catatan berhasil ditambahkan!');
    };

    const handleDelete = (e) => {
        const deleteBtn = e.target.closest('.delete-trade, .delete-dw');
        if (!deleteBtn) return;
        
        const id = parseInt(deleteBtn.dataset.id, 10);
        const isTrade = deleteBtn.classList.contains('delete-trade');
        const title = isTrade ? 'Hapus Transaksi' : 'Hapus Catatan';
        
        showConfirmation(title, 'Apakah Anda yakin ingin menghapus item ini?', () => {
            if (isTrade) {
                trades = trades.filter(item => item.id !== id);
                saveToStorage('forex_trades', trades);
            } else {
                transactions_dw = transactions_dw.filter(item => item.id !== id);
                saveToStorage('forex_dw', transactions_dw);
            }
            updateUI();
            closeModal();
            showToast('Item berhasil dihapus.', 'success');
        });
    };

    const handleViewTrade = (e) => {
        const viewBtn = e.target.closest('.view-trade');
        if (!viewBtn) return;
        const id = parseInt(viewBtn.dataset.id, 10);
        const trade = trades.find(t => t.id === id);

        if (!trade) return;

        getElement('view-trade-title').textContent = `Detail: ${trade.symbol.toUpperCase()} (${trade.date})`;
        const body = getElement('view-trade-body');
        body.innerHTML = `
            <div class="detail-grid">
                <strong>Tanggal:</strong> <span>${trade.date}</span>
                <strong>Simbol:</strong> <span>${trade.symbol.toUpperCase()}</span>
                <strong>Tipe:</strong> <span class="${trade.type === 'Buy' ? 'text-success' : 'text-danger'}">${trade.type}</span>
                <strong>Lot:</strong> <span>${trade.lot}</span>
                <strong>P/L:</strong> <span class="${trade.pnl >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(trade.pnl)}</span>
            </div>
            
            <h4>Alasan Entry</h4>
            <pre>${trade.notes_entry || 'Tidak ada catatan.'}</pre>
            
            <h4>Kesalahan / Pelajaran</h4>
            <pre>${trade.notes_mistakes || 'Tidak ada catatan.'}</pre>
        `;
        openModal('view-trade-modal');
    };

    const handleBacktest = (e) => {
        e.preventDefault();
        const keyword = getElement('backtest-reason').value.toLowerCase().trim();
        const resultsWrapper = getElement('backtest-results-wrapper');
        const resultsEl = getElement('backtest-results');

        if (!keyword) {
            showToast('Silakan masukkan kata kunci untuk analisis.', 'error');
            return;
        }

        const filteredTrades = trades.filter(t => t.notes_entry && t.notes_entry.toLowerCase().includes(keyword));
        
        if (filteredTrades.length === 0) {
            resultsEl.innerHTML = `<p>Tidak ditemukan transaksi dengan kata kunci '${keyword}'.</p>`;
        } else {
            const totalTrades = filteredTrades.length;
            const winningTrades = filteredTrades.filter(t => t.pnl > 0).length;
            const totalPnl = filteredTrades.reduce((sum, t) => sum + t.pnl, 0);
            const winRate = (winningTrades / totalTrades * 100).toFixed(1);

            resultsEl.innerHTML = `
                <p>Total Transaksi: <strong>${totalTrades}</strong></p>
                <p>Menang: <strong>${winningTrades}</strong> | Kalah: <strong>${totalTrades - winningTrades}</strong></p>
                <p>Win Rate: <strong>${winRate}%</strong></p>
                <p>Total P/L: <strong class="${totalPnl >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(totalPnl)}</strong></p>
            `;
        }
        resultsWrapper.style.display = 'block';
    };
    
    const handleExport = () => {
        const dataToExport = { trades: getFromStorage('forex_trades'), transactions_dw: getFromStorage('forex_dw') };
        const dataStr = JSON.stringify(dataToExport, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `jurnal-forex-data-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('Data berhasil diekspor!');
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if (!Array.isArray(importedData.trades) || !Array.isArray(importedData.transactions_dw)) {
                    throw new Error('Format file tidak valid.');
                }
                
                showConfirmation('Impor Data', 'Ini akan menimpa semua data saat ini. Lanjutkan?', () => {
                    saveToStorage('forex_trades', importedData.trades);
                    saveToStorage('forex_dw', importedData.transactions_dw);
                    trades = importedData.trades;
                    transactions_dw = importedData.transactions_dw;
                    updateUI();
                    closeModal();
                    showToast('Data berhasil diimpor!');
                    getElement('file-name-display').textContent = 'Tidak ada file dipilih.';
                    getElement('import-file-input').value = '';
                });

            } catch (error) {
                showToast('Gagal membaca file. Pastikan file JSON valid.', 'error');
            }
        };
        reader.readAsText(file);
    };

    // =========================================================================
    // INISIALISASI EVENT LISTENERS
    // =========================================================================
    const setupEventListeners = () => {
        querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href');
                querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
                link.classList.add('active');
                querySelector(targetId).classList.add('active');
                headerTitle.textContent = link.textContent.trim();
                if (window.innerWidth <= 992) sidebar.classList.remove('open');
            });
        });

        getElement('hamburger-btn').addEventListener('click', () => sidebar.classList.toggle('open'));
        getElement('add-trade-btn').addEventListener('click', () => openModal('add-trade-modal'));
        getElement('add-dw-btn').addEventListener('click', () => openModal('add-dw-modal'));
        getElement('modal-overlay').addEventListener('click', closeModal);
        querySelectorAll('.close-modal-btn').forEach(btn => btn.addEventListener('click', closeModal));
        getElement('cancel-btn').addEventListener('click', closeModal);
        getElement('confirm-btn').addEventListener('click', () => { if (confirmationCallback) confirmationCallback(); });

        getElement('add-trade-form').addEventListener('submit', handleAddTrade);
        getElement('add-dw-form').addEventListener('submit', handleAddDw);
        getElement('trades-table-body').addEventListener('click', (e) => {
            handleDelete(e);
            handleViewTrade(e);
        });
        getElement('dw-table-body').addEventListener('click', handleDelete);
        getElement('backtest-form').addEventListener('submit', handleBacktest);
        
        getElement('delete-all-data-btn').addEventListener('click', () => showConfirmation('Hapus Semua Data', 'Anda yakin ingin menghapus semua data secara permanen?', () => {
            localStorage.clear();
            trades = []; transactions_dw = [];
            updateUI(); closeModal(); showToast('Semua data berhasil dihapus.');
        }));
        
        getElement('export-data-btn').addEventListener('click', handleExport);
        getElement('import-data-btn').addEventListener('click', () => getElement('import-file-input').click());
        getElement('import-file-input').addEventListener('change', handleImport);
    };

    // =========================================================================
    // INISIALISASI APLIKASI
    // =========================================================================
    const updateUI = () => {
        renderTradesTable();
        renderDwTable();
        updateDashboard();
    };

    const initializeApp = () => {
        trades = getFromStorage('forex_trades');
        transactions_dw = getFromStorage('forex_dw');
        setupEventListeners();
        updateUI();
        querySelector('.nav-link[href="#dashboard"]').click();
    };

    initializeApp();
});
