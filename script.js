// ================================================================
// DATA
// ================================================================
let products = [];
let cart = [];
let notificationLog = [];
let soundEnabled = true;
let chart = null;
let totalRevenue = 0;

// ================================================================
// AUDIO
// ================================================================
function playAlertSound(type = 'danger') {
    if (!soundEnabled) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        if (type === 'danger') {
            oscillator.frequency.value = 800;
            oscillator.type = 'square';
            gainNode.gain.value = 0.15;
            oscillator.start();
            setTimeout(() => oscillator.stop(), 400);
            setTimeout(() => {
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.frequency.value = 600;
                osc2.type = 'square';
                gain2.gain.value = 0.15;
                osc2.start();
                setTimeout(() => osc2.stop(), 400);
            }, 300);
        } else {
            oscillator.frequency.value = 600;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.1;
            oscillator.start();
            setTimeout(() => oscillator.stop(), 300);
        }
    } catch(e) {}
}

function playCashSound() {
    if (!soundEnabled) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 1200;
        osc.type = 'sine';
        gain.gain.value = 0.08;
        osc.start();
        setTimeout(() => osc.stop(), 150);
        setTimeout(() => {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.value = 1500;
            osc2.type = 'sine';
            gain2.gain.value = 0.08;
            osc2.start();
            setTimeout(() => osc2.stop(), 150);
        }, 200);
    } catch(e) {}
}

// ================================================================
// TOGGLE SOUND
// ================================================================
function toggleSound() {
    soundEnabled = !soundEnabled;
    const btn = document.querySelector('.sound-toggle');
    const label = document.getElementById('soundLabel');
    if (soundEnabled) {
        btn.classList.remove('muted');
        label.textContent = 'Sound';
        btn.innerHTML = '<i class="fas fa-volume-up"></i> <span id="soundLabel">Sound</span>';
        showToast('🔊', 'Sound On', 'Audio alerts enabled.', 'info');
    } else {
        btn.classList.add('muted');
        label.textContent = 'Muted';
        btn.innerHTML = '<i class="fas fa-volume-mute"></i> <span id="soundLabel">Muted</span>';
        showToast('🔇', 'Sound Off', 'Audio alerts disabled.', 'info');
    }
}

// ================================================================
// ADD PRODUCT
// ================================================================
function addProduct() {
    const name = document.getElementById('productName').value.trim();
    const price = parseFloat(document.getElementById('productPrice').value);
    const expiryInput = document.getElementById('expiryDateTime').value;

    if (!name || isNaN(price) || price <= 0 || !expiryInput) {
        showToast('⚠️', 'Error', 'Please fill all fields correctly!', 'warning');
        return;
    }

    const expiryDate = new Date(expiryInput);
    if (isNaN(expiryDate.getTime())) {
        showToast('⚠️', 'Error', 'Invalid expiry date!', 'warning');
        return;
    }

    const product = {
        id: Date.now(),
        name: name,
        basePrice: price,
        expiry: expiryDate,
        addedAt: new Date(),
        _alerted: {}
    };

    products.push(product);
    
    document.getElementById('productPrice').value = (Math.random() * 8 + 2).toFixed(2);
    const nextExpiry = new Date();
    nextExpiry.setMinutes(nextExpiry.getMinutes() + 5 + Math.floor(Math.random() * 6));
    document.getElementById('expiryDateTime').value = nextExpiry.toISOString().slice(0, 16);
    document.getElementById('productName').value = 'Item ' + (products.length + 1);

    showToast('✅', 'Product Added!', `${name} added. Expires at ${formatTime(expiryDate)}`, 'success');
    addLog('success', `📦 ${name} added ($${price.toFixed(2)})`);
    
    updateUI();
}

// ================================================================
// PRODUCT STATUS
// ================================================================
function getProductStatus(product) {
    const now = new Date();
    const timeLeft = (product.expiry - now) / 1000;
    const minutesLeft = timeLeft / 60;

    if (timeLeft <= 0) {
        return { status: 'expired', price: 0, discount: 0, timeLeft: 0, label: 'Expired' };
    } else if (minutesLeft <= 1) {
        return { status: 'expiring', price: Math.round((product.basePrice * 0.50) * 100) / 100, discount: 50, timeLeft: timeLeft, label: 'CRITICAL' };
    } else if (minutesLeft <= 3) {
        return { status: 'expiring', price: Math.round((product.basePrice * 0.70) * 100) / 100, discount: 30, timeLeft: timeLeft, label: 'Urgent' };
    } else if (minutesLeft <= 5) {
        return { status: 'expiring', price: Math.round((product.basePrice * 0.85) * 100) / 100, discount: 15, timeLeft: timeLeft, label: 'Soon' };
    } else {
        return { status: 'fresh', price: product.basePrice, discount: 0, timeLeft: timeLeft, label: 'Fresh' };
    }
}

// ================================================================
// CHECK AND TRIGGER ALERTS
// ================================================================
function checkAndTriggerAlerts(product) {
    const info = getProductStatus(product);
    const minutesLeft = info.timeLeft / 60;

    if (info.status !== 'expired') {
        if (minutesLeft <= 5 && minutesLeft > 4.5 && !product._alerted['5min']) {
            product._alerted['5min'] = true;
            showToast('⏰', '5 Min Warning', `${product.name} - 15% discount applied!`, 'warning');
            addLog('warning', `⏰ ${product.name} - 5 min warning (15% off)`);
            playAlertSound('warning');
        } else if (minutesLeft <= 3 && minutesLeft > 2.5 && !product._alerted['3min']) {
            product._alerted['3min'] = true;
            showToast('⚠️', '3 Min Warning', `${product.name} - 30% discount applied!`, 'warning');
            addLog('warning', `⚠️ ${product.name} - 3 min warning (30% off)`);
            playAlertSound('warning');
        } else if (minutesLeft <= 1 && minutesLeft > 0.5 && !product._alerted['1min']) {
            product._alerted['1min'] = true;
            showToast('🚨', '1 Min Warning', `${product.name} - 50% discount applied!`, 'danger');
            addLog('danger', `🚨 ${product.name} - 1 min warning (50% off)`);
            playAlertSound('danger');
        }
    }

    if (info.status === 'expired' && !product._alerted['expired']) {
        product._alerted['expired'] = true;
        showToast('💀', 'EXPIRED!', `${product.name} has expired! Remove from shelf.`, 'danger');
        addLog('danger', `💀 ${product.name} - EXPIRED`);
        playAlertSound('danger');
    }
}

// ================================================================
// FORMAT HELPERS
// ================================================================
function formatTime(date) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatCountdown(seconds) {
    if (seconds <= 0) return '💀 EXPIRED';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
}

// ================================================================
// TOAST
// ================================================================
function showToast(icon, title, msg, type = 'danger') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-title">${icon} ${title}</div>
        <div class="toast-msg">${msg}</div>
        <div class="toast-time">${formatTime(new Date())}</div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s';
        setTimeout(() => toast.remove(), 500);
    }, 6000);
}

// ================================================================
// LOG
// ================================================================
function addLog(type, msg) {
    notificationLog.unshift({ type, msg, time: new Date() });
    if (notificationLog.length > 50) notificationLog.pop();
    renderLog();
}

function renderLog() {
    const container = document.getElementById('logContainer');
    if (notificationLog.length === 0) {
        container.innerHTML = '<div style="color:#999;text-align:center;padding:8px 0;font-size:12px;">No activity yet.</div>';
        return;
    }
    let html = '';
    notificationLog.slice(0, 15).forEach(log => {
        html += `
            <div class="log-item ${log.type}">
                <span class="log-time">${formatTime(log.time)}</span>
                <span class="log-msg">${log.msg}</span>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ================================================================
// CHART
// ================================================================
function updateChart(product) {
    if (!product) return;
    
    const ctx = document.getElementById('priceChart').getContext('2d');
    
    const now = new Date();
    const totalSeconds = Math.max((product.expiry - product.addedAt) / 1000, 60);
    const steps = 15;
    const stepSize = totalSeconds / steps;
    
    let history = [];
    for (let i = 0; i <= steps; i++) {
        const timePoint = new Date(product.addedAt.getTime() + i * stepSize * 1000);
        const status = getProductStatus({ ...product, expiry: timePoint });
        history.push(status.price);
    }
    
    const currentStatus = getProductStatus(product);
    history.push(currentStatus.price);

    if (chart) {
        chart.destroy();
        chart = null;
    }
    
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map((_, i) => i === history.length - 1 ? 'Now' : `${Math.round(i * 100 / history.length)}%`),
            datasets: [{
                label: 'Price ($)',
                data: history,
                borderColor: '#2a5f7a',
                backgroundColor: 'rgba(42, 95, 122, 0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 2,
                pointBackgroundColor: '#1a3a5c'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `$${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toFixed(2);
                        },
                        font: { size: 9 }
                    }
                },
                x: {
                    ticks: { font: { size: 8 }, maxTicksLimit: 5 }
                }
            }
        }
    });
}

// ================================================================
// BILLING / CART FUNCTIONS
// ================================================================
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) {
        showToast('❌', 'Error', 'Product not found!', 'danger');
        return;
    }

    const info = getProductStatus(product);
    if (info.status === 'expired') {
        showToast('🚫', 'Cannot Sell', `${product.name} is EXPIRED!`, 'danger');
        return;
    }

    const existing = cart.find(item => item.id === product.id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            basePrice: product.basePrice,
            price: info.price,
            discount: info.discount,
            quantity: 1
        });
    }

    showToast('🛒', 'Added', `${product.name} added to cart (${info.discount > 0 ? info.discount + '% off' : 'full price'})`, 'success');
    addLog('success', `🛒 ${product.name} added to cart`);
    updateUI();
}

function removeFromCart(index) {
    const item = cart[index];
    if (item.quantity > 1) {
        item.quantity -= 1;
    } else {
        cart.splice(index, 1);
    }
    updateUI();
}

function clearCart() {
    if (cart.length === 0) return;
    cart = [];
    showToast('🗑️', 'Cleared', 'Cart has been cleared.', 'info');
    updateUI();
}

function getCartTotal() {
    let total = 0;
    let savings = 0;
    cart.forEach(item => {
        total += item.price * item.quantity;
        savings += (item.basePrice - item.price) * item.quantity;
    });
    return { total, savings };
}

// ================================================================
// SCAN BARCODE
// ================================================================
function scanBarcode() {
    const input = document.getElementById('barcodeInput');
    const value = input.value.trim().toLowerCase();
    
    if (!value) {
        showToast('⚠️', 'Input Required', 'Enter a product name or barcode.', 'warning');
        return;
    }

    const matches = products.filter(p => 
        p.name.toLowerCase().includes(value) && 
        getProductStatus(p).status !== 'expired'
    );

    if (matches.length === 0) {
        showToast('❌', 'Not Found', `No product matching "${value}"`, 'danger');
        input.value = '';
        return;
    }

    if (matches.length > 1) {
        addToCart(matches[0].id);
        showToast('📋', 'Multiple Matches', `Added "${matches[0].name}"`, 'info');
    } else {
        addToCart(matches[0].id);
    }
    
    input.value = '';
}

// ================================================================
// CHECKOUT
// ================================================================
function checkout() {
    if (cart.length === 0) {
        showToast('⚠️', 'Empty Cart', 'Add some items first!', 'warning');
        return;
    }

    const { total, savings } = getCartTotal();
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    playCashSound();
    totalRevenue += total;
    
    showReceipt(cart, total, savings, itemCount);
    
    addLog('success', `💰 Sale completed: $${total.toFixed(2)} (${itemCount} items, saved $${savings.toFixed(2)})`);
    showToast('✅', 'Sale Complete!', `Total: $${total.toFixed(2)} | Saved: $${savings.toFixed(2)}`, 'success');
    
    cart = [];
    updateUI();
}

// ================================================================
// RECEIPT MODAL
// ================================================================
let lastReceipt = { items: [], total: 0, savings: 0, count: 0 };

function showReceipt(items, total, savings, count) {
    lastReceipt = { items, total, savings, count };
    
    const modal = document.getElementById('receiptModal');
    const container = document.getElementById('receiptItems');
    document.getElementById('receiptTime').textContent = formatTime(new Date());
    
    let html = '';
    items.forEach(item => {
        const discountLabel = item.discount > 0 ? ` (${item.discount}% off)` : '';
        html += `
            <div class="receipt-item">
                <span class="item-name">${item.name} x${item.quantity}${discountLabel}</span>
                <span class="item-price">$${(item.price * item.quantity).toFixed(2)}</span>
            </div>
        `;
    });
    container.innerHTML = html;
    
    document.getElementById('receiptTotal').textContent = `$${total.toFixed(2)}`;
    document.getElementById('receiptDiscount').textContent = `$${savings.toFixed(2)} saved`;
    document.getElementById('receiptItemCount').textContent = count;
    
    modal.classList.add('show');
}

function closeReceipt() {
    document.getElementById('receiptModal').classList.remove('show');
}

function printReceipt() {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html><head><title>Receipt</title>
        <style>
            body { font-family: 'Courier New', monospace; padding: 30px; max-width: 350px; margin: 0 auto; }
            .center { text-align: center; }
            .line { border-top: 2px dashed #ddd; margin: 10px 0; }
            .item { display: flex; justify-content: space-between; padding: 3px 0; }
            .total { display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; border-top: 2px solid #000; padding-top: 8px; }
            .discount { color: #d32f2f; }
            .footer { text-align: center; margin-top: 12px; font-size: 12px; color: #888; }
        </style>
        </head><body>
        <div class="center"><h2>SmartShelf</h2>
        <small>${formatTime(new Date())}</small></div>
        <div class="line"></div>
    `);
    
    lastReceipt.items.forEach(item => {
        const discountLabel = item.discount > 0 ? ` (${item.discount}% off)` : '';
        printWindow.document.write(`
            <div class="item">
                <span>${item.name} x${item.quantity}${discountLabel}</span>
                <span>$${(item.price * item.quantity).toFixed(2)}</span>
            </div>
        `);
    });
    
    printWindow.document.write(`
        <div class="line"></div>
        <div class="total">
            <span>TOTAL</span>
            <span>$${lastReceipt.total.toFixed(2)}</span>
        </div>
        <div class="discount" style="text-align:right;font-size:13px;">
            Saved: $${lastReceipt.savings.toFixed(2)}
        </div>
        <div class="footer">
            Items: ${lastReceipt.count} | Thank you!
        </div>
        </body></html>
    `);
    printWindow.document.close(); // Important: Close the document stream first
    printWindow.print();          // Then trigger print
}

// ================================================================
// LIVE CLOCK
// ================================================================
function updateClock() {
    const now = new Date();
    document.getElementById('liveClock').textContent = now.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

// ================================================================
// MAIN UI UPDATE
// ================================================================
function updateUI() {
    const now = new Date();
    let total = products.length;
    let expiringCount = 0;
    let expiredCount = 0;
    let totalSavings = 0;
    let alertList = [];
    let selectedProductForChart = null;

    // --- Update each product ---
    let tableHtml = '';
    products.forEach((p) => {
        checkAndTriggerAlerts(p);
        const info = getProductStatus(p);
        const statusClass = info.status === 'fresh' ? 'status-fresh' :
                           info.status === 'expiring' ? 'status-expiring' : 'status-expired';
        const statusLabel = info.status === 'fresh' ? '✅ Fresh' :
                           info.status === 'expiring' ? `⚠️ ${info.label}` : '❌ Expired';
        
        let rowClass = '';
        if (info.status === 'expired') rowClass = 'expired-row';
        else if (info.status === 'expiring') rowClass = 'expiring-row';

        let priceDisplay = '';
        if (info.status === 'expired') {
            priceDisplay = '<span style="color:#c62828;font-weight:700;">Expired</span>';
            expiredCount++;
        } else if (info.discount > 0) {
            priceDisplay = `<span class="price-original">$${p.basePrice.toFixed(2)}</span>
                           <span class="price-discount">$${info.price.toFixed(2)}</span>
                           <span style="font-size:8px;color:#e65100;font-weight:600;">(-${info.discount}%)</span>`;
            expiringCount++;
            totalSavings += (p.basePrice - info.price);
        } else {
            priceDisplay = `<span class="price-normal">$${info.price.toFixed(2)}</span>`;
        }

        let countdownHtml = '';
        if (info.status === 'expired') {
            countdownHtml = `<span class="countdown-timer expired">💀 EXP</span>`;
        } else if (info.status === 'expiring') {
            countdownHtml = `<span class="countdown-timer warning">⏱️ ${formatCountdown(info.timeLeft)}</span>`;
        } else {
            countdownHtml = `<span style="color:#888;font-size:10px;">${formatCountdown(info.timeLeft)}</span>`;
        }

        const canAdd = info.status !== 'expired';
        tableHtml += `
            <tr class="${rowClass}">
                <td><strong>${p.name}</strong></td>
                <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                <td>${priceDisplay}</td>
                <td>${countdownHtml}</td>
                <td>
                    <button class="add-to-cart-btn" onclick="addToCart(${p.id})" ${!canAdd ? 'disabled' : ''}>
                        <i class="fas fa-cart-plus"></i>
                    </button>
                </td>
            </tr>
        `;

        // Build alert list
        if (info.status === 'expired') {
            alertList.push({
                product: p,
                type: 'danger',
                msg: `<strong>${p.name}</strong> EXPIRED`,
                isDanger: true
            });
        } else if (info.status === 'expiring' && info.discount > 0) {
            alertList.push({
                product: p,
                type: 'warning',
                msg: `<strong>${p.name}</strong> ${info.discount}% off (${formatCountdown(info.timeLeft)})`,
                isDanger: false
            });
        }

        if (!selectedProductForChart && (info.status === 'expiring' || info.status === 'fresh')) {
            selectedProductForChart = p;
        }
    });

    // --- Update table ---
    document.getElementById('productTableBody').innerHTML = tableHtml;

    // --- Quick Add Buttons ---
    const quickBtns = document.getElementById('quickAddBtns');
    const activeProducts = products.filter(p => getProductStatus(p).status !== 'expired');
    let btnHtml = '';
    activeProducts.slice(0, 8).forEach(p => {
        const info = getProductStatus(p);
        const label = info.discount > 0 ? `${p.name} ${info.discount}%` : p.name;
        btnHtml += `<button onclick="addToCart(${p.id})">${label}</button>`;
    });
    quickBtns.innerHTML = btnHtml || '<span style="font-size:11px;color:#888;">No products available</span>';

    // --- Cart ---
    const cartContainer = document.getElementById('cartItems');
    if (cart.length === 0) {
        cartContainer.innerHTML = `
            <div style="color:#999;text-align:center;padding:15px 0;font-size:13px;">
                <i class="fas fa-shopping-cart" style="font-size:24px;display:block;margin-bottom:4px;"></i>
                Cart is empty
            </div>
        `;
    } else {
        let cartHtml = '';
        cart.forEach((item, index) => {
            const discountLabel = item.discount > 0 ? `<span class="item-discount">(-${item.discount}%)</span>` : '';
            cartHtml += `
                <div class="cart-item">
                    <div class="item-info">
                        <span class="item-name">${item.name}</span>
                        ${discountLabel}
                        <span style="font-size:10px;color:#888;">x${item.quantity}</span>
                    </div>
                    <div>
                        <span class="item-price">$${(item.price * item.quantity).toFixed(2)}</span>
                        <button class="remove-item" onclick="removeFromCart(${index})"><i class="fas fa-times"></i></button>
                    </div>
                </div>
            `;
        });
        cartContainer.innerHTML = cartHtml;
    }

    const { total: cartTotal, savings: cartSavings } = getCartTotal();
    document.getElementById('cartTotal').textContent = `$${cartTotal.toFixed(2)}`;
    document.getElementById('cartDiscount').textContent = `$${cartSavings.toFixed(2)} saved`;

    // --- Alerts ---
    const alertsContainer = document.getElementById('alertsContainer');
    if (alertList.length === 0) {
        alertsContainer.innerHTML = `<div class="no-alerts"><i class="fas fa-check-circle"></i> All clear!</div>`;
    } else {
        let alertHtml = '';
        alertList.forEach((alert, idx) => {
            alertHtml += `
                <div class="alert-item ${alert.isDanger ? 'danger' : ''}">
                    <div class="alert-msg">${alert.msg}</div>
                    <button class="alert-action ${alert.isDanger ? 'danger-btn' : ''}" onclick="resolveAlert(${idx})">
                        ${alert.isDanger ? 'Remove' : 'OK'}
                    </button>
                </div>
            `;
        });
        alertsContainer.innerHTML = alertHtml;
    }

    // --- Stats ---
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statExpiring').textContent = expiringCount;
    document.getElementById('statExpired').textContent = expiredCount;
    document.getElementById('statSavings').textContent = `$${totalSavings.toFixed(2)}`;
    document.getElementById('statRevenue').textContent = `$${totalRevenue.toFixed(2)}`;
    document.getElementById('totalCount').textContent = total;
    document.getElementById('cartCount').textContent = cart.length;
    document.getElementById('alertBadge').textContent = alertList.length;

    // --- Chart ---
    if (selectedProductForChart) {
        updateChart(selectedProductForChart);
    } else if (products.length > 0) {
        updateChart(products[0]);
    }
}

// ================================================================
// RESOLVE ALERT
// ================================================================
function resolveAlert(index) {
    let alertList = [];
    products.forEach(p => {
        const info = getProductStatus(p);
        if (info.status === 'expired' || (info.status === 'expiring' && info.discount > 0)) {
            alertList.push(p);
        }
    });

    if (index < 0 || index >= alertList.length) return;
    
    const product = alertList[index];
    const info = getProductStatus(product);
    
    if (info.status === 'expired') {
        products = products.filter(p => p.id !== product.id);
        showToast('🗑️', 'Removed', `${product.name} removed from inventory.`, 'success');
        addLog('success', `🗑️ ${product.name} removed (expired)`);
    } else {
        showToast('👌', 'Acknowledged', `${product.name} acknowledged.`, 'info');
        addLog('info', `👌 ${product.name} acknowledged`);
        product._alerted['shown'] = true;
    }
    
    updateUI();
}

// ================================================================
// SET DEFAULT EXPIRY
// ================================================================
function setDefaultExpiry() {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5 + Math.floor(Math.random() * 5));
    document.getElementById('expiryDateTime').value = now.toISOString().slice(0, 16);
}

// ================================================================
// ADD DEMO PRODUCTS
// ================================================================
function addDemoProducts() {
    const now = new Date();
    
    const demos = [
        { name: 'Fresh Milk', price: 5.00, mins: 6 },
        { name: 'Bread', price: 4.00, mins: 8 },
        { name: 'Cheese', price: 6.00, mins: 3 },
        { name: 'Orange Juice', price: 4.50, mins: 10 },
        { name: 'Yogurt', price: 3.00, mins: 5 },
        { name: 'Eggs', price: 3.50, mins: 7 },
        { name: 'Butter', price: 5.50, mins: 4 },
        { name: 'Chicken', price: 8.00, mins: 9 }
    ];

    demos.forEach((demo, i) => {
        const expiry = new Date(now);
        expiry.setMinutes(expiry.getMinutes() + demo.mins + Math.floor(Math.random() * 2));
        products.push({
            id: Date.now() + i + 1,
            name: demo.name,
            basePrice: demo.price,
            expiry: expiry,
            addedAt: new Date(),
            _alerted: {}
        });
    });

    showToast('🎯', 'Demo Loaded!', '8 demo products added with 3-10 min expiry.', 'success');
    updateUI();
}

// ================================================================
// ENTER KEY FOR BARCODE
// ================================================================
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('barcodeInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            scanBarcode();
        }
    });
});

// ================================================================
// INIT
// ================================================================
function init() {
    setDefaultExpiry();
    updateClock();
    updateUI();
    
    setTimeout(addDemoProducts, 400);
    
    setInterval(() => {
        updateClock();
        updateUI();
    }, 1000);
}

document.addEventListener('DOMContentLoaded', init);