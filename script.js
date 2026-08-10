// ================================================================
// DATA
// ================================================================
let products = [];
let cart = [];
let notificationLog = [];
let soundEnabled = true;
let chart = null;
let totalRevenue = 0;
let scanner = null;
let scannedData = null;
let scannerMode = 'qr'; // 'qr' or 'barcode'

// ================================================================
// SCANNER FUNCTIONS
// ================================================================

// Open scanner for QR
function openQRScanner() {
    scannerMode = 'qr';
    openScanner('QR Code', 'fa-qrcode', 'Position the QR code in the camera view');
}

// Open scanner for Barcode
function openBarcodeScanner() {
    scannerMode = 'barcode';
    openScanner('Barcode', 'fa-barcode', 'Position the barcode in the camera view');
}

// Open scanner for Name field (barcode)
function openBarcodeScannerForName() {
    scannerMode = 'barcode';
    openScanner('Barcode (Name)', 'fa-barcode', 'Scan barcode to fill product name');
    // Set flag to only update name field
    window._scanOnlyName = true;
}

function openScanner(title, icon, infoText) {
    const modal = document.getElementById('scannerModal');
    document.getElementById('scannerTitle').textContent = `Scan ${title}`;
    document.getElementById('scannerIcon').className = `fas ${icon}`;
    document.getElementById('scannerInfoText').textContent = infoText;
    modal.classList.add('show');
    
    setTimeout(() => {
        startScanner();
    }, 500);
}

function closeScanner() {
    stopScanner();
    document.getElementById('scannerModal').classList.remove('show');
    window._scanOnlyName = false;
}

function startScanner() {
    const readerElement = document.getElementById('scanner-reader');
    
    if (scanner) {
        scanner.clear();
        scanner = null;
    }
    
    try {
        scanner = new Html5Qrcode("scanner-reader");
        
        const config = {
            fps: 15,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
        };
        
        scanner.start(
            { facingMode: "environment" },
            config,
            onScannerSuccess,
            onScannerError
        );
        
        showToast('📷', 'Scanner Started', `Scanning ${scannerMode.toUpperCase()}...`, 'info');
    } catch (err) {
        console.error('Scanner error:', err);
        showToast('⚠️', 'Camera Error', 'Please enter data manually.', 'warning');
        readerElement.innerHTML = `
            <div style="text-align:center;padding:30px 0;color:#888;">
                <i class="fas fa-camera" style="font-size:40px;display:block;margin-bottom:10px;"></i>
                <p>Camera not available. Please use manual entry.</p>
                <button onclick="manualScannerInput()" style="margin-top:10px;padding:8px 20px;background:#1a3a5c;color:white;border:none;border-radius:6px;cursor:pointer;">
                    <i class="fas fa-keyboard"></i> Enter Manually
                </button>
            </div>
        `;
    }
}

function stopScanner() {
    if (scanner) {
        try {
            scanner.stop().then(() => {
                scanner.clear();
                scanner = null;
            }).catch(err => {
                console.error('Stop error:', err);
            });
        } catch(e) {
            console.error('Stop error:', e);
        }
    }
}

function switchScannerMode() {
    if (scannerMode === 'qr') {
        scannerMode = 'barcode';
        document.getElementById('scannerTitle').textContent = 'Scan Barcode';
        document.getElementById('scannerIcon').className = 'fas fa-barcode';
        document.getElementById('scannerInfoText').textContent = 'Position the barcode in the camera view';
    } else {
        scannerMode = 'qr';
        document.getElementById('scannerTitle').textContent = 'Scan QR Code';
        document.getElementById('scannerIcon').className = 'fas fa-qrcode';
        document.getElementById('scannerInfoText').textContent = 'Position the QR code in the camera view';
    }
    
    // Restart scanner with new mode
    stopScanner();
    setTimeout(() => startScanner(), 300);
}

function onScannerSuccess(decodedText, decodedResult) {
    // Parse the scanned data
    try {
        const data = JSON.parse(decodedText);
        scannedData = {
            name: data.name || data.product || 'Unknown Product',
            price: parseFloat(data.price) || parseFloat(data.cost) || 5.00,
            expiryDays: parseInt(data.expiry_days) || parseInt(data.days) || 7,
            barcode: data.barcode || data.sku || decodedText.substring(0, 20),
            raw: decodedText
        };
    } catch (e) {
        // If not JSON, try to parse as CSV
        const parts = decodedText.split(',').map(s => s.trim());
        if (parts.length >= 2) {
            scannedData = {
                name: parts[0] || 'Product',
                price: parseFloat(parts[1]) || 5.00,
                expiryDays: parseInt(parts[2]) || 7,
                barcode: parts[3] || decodedText.substring(0, 20),
                raw: decodedText
            };
        } else {
            // Just use the text
            scannedData = {
                name: decodedText.trim() || 'Product',
                price: 5.00,
                expiryDays: 7,
                barcode: decodedText.substring(0, 20),
                raw: decodedText
            };
        }
    }
    
    // If scanning for name only, just update the name field
    if (window._scanOnlyName) {
        document.getElementById('productName').value = scannedData.name;
        showToast('✅', 'Name Scanned!', `Product: ${scannedData.name}`, 'success');
        closeScanner();
        return;
    }
    
    // Show preview
    showScannerPreview(scannedData);
    
    // Stop scanner after successful scan
    stopScanner();
    
    setTimeout(() => {
        closeScanner();
        showToast('✅', 'Scanned!', `Product: ${scannedData.name}`, 'success');
    }, 800);
}

function onScannerError(error) {
    // Silent fail - just keep scanning
}

function showScannerPreview(data) {
    const preview = document.getElementById('scannerDataPreview');
    document.getElementById('previewName').textContent = data.name;
    document.getElementById('previewPrice').textContent = `$${data.price.toFixed(2)}`;
    document.getElementById('previewBarcode').textContent = data.barcode || 'N/A';
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + data.expiryDays);
    document.getElementById('previewExpiry').textContent = expiryDate.toLocaleDateString();
    
    preview.classList.add('show');
}

function applyScannerData() {
    if (!scannedData) return;
    
    document.getElementById('productName').value = scannedData.name;
    document.getElementById('productPrice').value = scannedData.price.toFixed(2);
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + scannedData.expiryDays);
    document.getElementById('expiryDateTime').value = expiryDate.toISOString().slice(0, 16);
    
    document.getElementById('scannerDataPreview').classList.remove('show');
    
    showToast('📋', 'Applied!', `Data applied to form.`, 'success');
    
    // Auto-add the product
    addProduct();
}

function manualScannerInput() {
    closeScanner();
    const input = prompt('Enter data (Format: Name,Price,ExpiryDays):', 'Milk,4.99,7');
    if (input) {
        const parts = input.split(',').map(s => s.trim());
        const data = {
            name: parts[0] || 'Product',
            price: parseFloat(parts[1]) || 5.00,
            expiryDays: parseInt(parts[2]) || 7,
            barcode: parts[3] || '',
            raw: input
        };
        scannedData = data;
        showScannerPreview(data);
        showToast('📝', 'Manual Entry', `Product: ${data.name}`, 'info');
    }
}

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
// SCAN BARCODE (Billing)
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
            .footer { text-align: center; margin-top: 12px; font-size: 12px
