// ================================================================
// FIREBASE CONFIG - YOUR CONFIG HERE
// ================================================================
const firebaseConfig = {
    apiKey: "AIzaSyDxfTPMySvXDNkAF0-ruIvGhiV23H1GcVs",
    authDomain: "myproject-facd5.firebaseapp.com",
    databaseURL: "https://myproject-facd5-default-rtdb.firebaseio.com",
    projectId: "myproject-facd5",
    storageBucket: "myproject-facd5.firebasestorage.app",
    messagingSenderId: "967008076076",
    appId: "1:967008076076:web:e34160a72525210ba1ec89",
    measurementId: "G-B7EX225NTR"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ================================================================
// DATA
// ================================================================
let products = [];
let cart = [];
let notificationLog = [];
let totalRevenue = 0;
let customerName = 'John Doe';

// ================================================================
// LOAD DATA FROM LOCAL STORAGE
// ================================================================
function loadData() {
    const saved = localStorage.getItem('shopProducts');
    if (saved) {
        products = JSON.parse(saved);
        products.forEach(p => {
            p.expiry = new Date(p.expiry);
            p.addedAt = new Date(p.addedAt);
            p._alerted = {};
        });
    }
    
    const savedRevenue = localStorage.getItem('shopRevenue');
    if (savedRevenue) {
        totalRevenue = parseFloat(savedRevenue);
    }
}

// ================================================================
// SAVE DATA TO LOCAL STORAGE
// ================================================================
function saveData() {
    localStorage.setItem('shopProducts', JSON.stringify(products));
    localStorage.setItem('shopRevenue', totalRevenue.toString());
}

// ================================================================
// SYNC TO CONSUMER APP (Using Firebase)
// ================================================================
function syncToConsumer() {
    const purchasedItems = products.filter(p => p.purchased);
    
    if (purchasedItems.length === 0) {
        showToast('📭', 'Nothing to Sync', 'No purchased items to sync.', 'info');
        return;
    }
    
    // Ask for customer's mobile number
    const mobile = prompt('Enter customer mobile number (10 digits):', '9876543210');
    if (!mobile || mobile.length < 10) {
        showToast('⚠️', 'Mobile Required', 'Please enter a valid mobile number.', 'warning');
        return;
    }
    
    if (!/^\d{10}$/.test(mobile)) {
        showToast('⚠️', 'Invalid Mobile', 'Please enter only 10 digits.', 'warning');
        return;
    }
    
    const fullMobile = '+91' + mobile;
    const userRef = db.ref('users/' + fullMobile);
    
    // Check if user exists
    userRef.once('value').then(snapshot => {
        const userData = snapshot.val();
        
        if (!userData) {
            // Create new user
            userRef.set({
                name: 'User',
                mobile: fullMobile,
                registeredAt: Date.now(),
                pantryItems: {}
            });
        }
        
        // Add purchased items to pantry
        const updates = {};
        purchasedItems.forEach(item => {
            const newItem = {
                id: item.id,
                name: item.name,
                price: item.price || item.basePrice,
                expiry: item.expiry.toISOString(),
                purchaseDate: new Date().toISOString(),
                discount: item.discount || 0,
                syncedFromShop: true,
                isConsumed: false,
                alertSent: {
                    '7d': false,
                    '3d': false,
                    '1d': false,
                    'expired': false
                }
            };
            
            const newItemRef = userRef.child('pantryItems').push();
            updates[newItemRef.key] = newItem;
        });
        
        userRef.child('pantryItems').update(updates).then(() => {
            showToast('✅', 'Synced!', `${purchasedItems.length} items sent to ${fullMobile}`, 'success');
            addLog('success', `🔄 Synced ${purchasedItems.length} items to ${fullMobile}`);
            
            // Mark items as synced
            products.forEach(p => {
                if (p.purchased) {
                    p.synced = true;
                    p.purchased = false;
                }
            });
            saveData();
            updateUI();
        });
    }).catch(error => {
        console.error('Sync error:', error);
        showToast('❌', 'Sync Failed', 'Could not connect to server.', 'danger');
    });
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
        price: price,
        expiry: expiryDate,
        addedAt: new Date(),
        purchased: false,
        synced: false,
        discount: 0,
        _alerted: {}
    };

    products.push(product);
    saveData();
    
    document.getElementById('productPrice').value = (Math.random() * 8 + 2).toFixed(2);
    const nextExpiry = new Date();
    nextExpiry.setMinutes(nextExpiry.getMinutes() + 5 + Math.floor(Math.random() * 6));
    document.getElementById('expiryDateTime').value = nextExpiry.toISOString().slice(0, 16);
    document.getElementById('productName').value = 'Item ' + (products.length + 1);

    showToast('✅', 'Product Added!', `${name} added to inventory.`, 'success');
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
        } else if (minutesLeft <= 3 && minutesLeft > 2.5 && !product._alerted['3min']) {
            product._alerted['3min'] = true;
            showToast('⚠️', '3 Min Warning', `${product.name} - 30% discount applied!`, 'warning');
            addLog('warning', `⚠️ ${product.name} - 3 min warning (30% off)`);
        } else if (minutesLeft <= 1 && minutesLeft > 0.5 && !product._alerted['1min']) {
            product._alerted['1min'] = true;
            showToast('🚨', '1 Min Warning', `${product.name} - 50% discount applied!`, 'danger');
            addLog('danger', `🚨 ${product.name} - 1 min warning (50% off)`);
        }
    }

    if (info.status === 'expired' && !product._alerted['expired']) {
        product._alerted['expired'] = true;
        showToast('💀', 'EXPIRED!', `${product.name} has expired! Remove from shelf.`, 'danger');
        addLog('danger', `💀 ${product.name} - EXPIRED`);
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
    }, 5000);
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
            quantity: 1,
            expiry: product.expiry
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
    
    // Ask for customer mobile number
    const mobile = prompt('Enter customer mobile number (10 digits):', '9876543210');
    
    if (!mobile || mobile.length < 10) {
        showToast('⚠️', 'Mobile Required', 'Please enter a valid mobile number.', 'warning');
        return;
    }
    
    if (!/^\d{10}$/.test(mobile)) {
        showToast('⚠️', 'Invalid Mobile', 'Please enter only 10 digits.', 'warning');
        return;
    }
    
    totalRevenue += total;
    
    cart.forEach(cartItem => {
        const product = products.find(p => p.id === cartItem.id);
        if (product) {
            product.purchased = true;
            product.price = cartItem.price;
            product.discount = cartItem.discount;
        }
    });
    
    saveData();
    showReceipt(cart, total, savings, itemCount, mobile);
    addLog('success', `💰 Sale: $${total.toFixed(2)} (${itemCount} items) for ${mobile}`);
    showToast('✅', 'Sale Complete!', `Total: $${total.toFixed(2)} | Saved: $${savings.toFixed(2)}`, 'success');
    
    // Sync to Firebase
    setTimeout(() => {
        syncToConsumerWithMobile(mobile);
    }, 1000);
    
    cart = [];
    updateUI();
}

// ================================================================
// SYNC TO CONSUMER WITH MOBILE
// ================================================================
function syncToConsumerWithMobile(mobile) {
    const purchasedItems = products.filter(p => p.purchased);
    
    if (purchasedItems.length === 0) {
        return;
    }
    
    const fullMobile = '+91' + mobile;
    const userRef = db.ref('users/' + fullMobile);
    
    userRef.once('value').then(snapshot => {
        const userData = snapshot.val();
        
        if (!userData) {
            userRef.set({
                name: 'User',
                mobile: fullMobile,
                registeredAt: Date.now(),
                pantryItems: {}
            });
        }
        
        const updates = {};
        purchasedItems.forEach(item => {
            const newItem = {
                id: item.id,
                name: item.name,
                price: item.price || item.basePrice,
                expiry: item.expiry.toISOString(),
                purchaseDate: new Date().toISOString(),
                discount: item.discount || 0,
                syncedFromShop: true,
                isConsumed: false,
                alertSent: {
                    '7d': false,
                    '3d': false,
                    '1d': false,
                    'expired': false
                }
            };
            
            const newItemRef = userRef.child('pantryItems').push();
            updates[newItemRef.key] = newItem;
        });
        
        userRef.child('pantryItems').update(updates).then(() => {
            document.getElementById('syncStatusReceipt').textContent = `✅ Synced to ${fullMobile}`;
            
            products.forEach(p => {
                if (p.purchased) {
                    p.synced = true;
                    p.purchased = false;
                }
            });
            saveData();
            updateUI();
        });
    }).catch(error => {
        console.error('Sync error:', error);
    });
}

// ================================================================
// RECEIPT MODAL
// ================================================================
let lastReceipt = { items: [], total: 0, savings: 0, count: 0 };

function showReceipt(items, total, savings, count, mobile) {
    lastReceipt = { items, total, savings, count };
    
    const modal = document.getElementById('receiptModal');
    const container = document.getElementById('receiptItems');
    document.getElementById('receiptTime').textContent = formatTime(new Date());
    document.getElementById('syncStatusReceipt').textContent = `✅ Syncing to +91${mobile}...`;
    
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
    printWindow.document.close();
    printWindow.print();
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

        const canAdd = info.status !== 'expired' && !p.purchased;
        tableHtml += `
            <tr class="${rowClass}">
                <td><strong>${p.name}</strong> ${p.purchased ? '🔄' : ''}</td>
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
    });

    document.getElementById('productTableBody').innerHTML = tableHtml;

    // Quick Add Buttons
    const quickBtns = document.getElementById('quickAddBtns');
    const activeProducts = products.filter(p => getProductStatus(p).status !== 'expired' && !p.purchased);
    let btnHtml = '';
    activeProducts.slice(0, 8).forEach(p => {
        const info = getProductStatus(p);
        const label = info.discount > 0 ? `${p.name} ${info.discount}%` : p.name;
        btnHtml += `<button onclick="addToCart(${p.id})">${label}</button>`;
    });
    quickBtns.innerHTML = btnHtml || '<span style="font-size:11px;color:#888;">No products available</span>';

    // Cart
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

    // Alerts
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

    // Stats
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statExpiring').textContent = expiringCount;
    document.getElementById('statExpired').textContent = expiredCount;
    document.getElementById('statSavings').textContent = `$${totalSavings.toFixed(2)}`;
    document.getElementById('statRevenue').textContent = `$${totalRevenue.toFixed(2)}`;
    document.getElementById('totalCount').textContent = total;
    document.getElementById('cartCount').textContent = cart.length;
    document.getElementById('alertBadge').textContent = alertList.length;
    
    const pendingItems = products.filter(p => p.purchased && !p.synced);
    document.getElementById('syncStatusText').textContent = pendingItems.length > 0 ? 
        `🔄 ${pendingItems.length} items pending sync` : 
        '✅ Synced with Consumer App';
    document.getElementById('syncDot').className = `dot ${pendingItems.length > 0 ? 'offline' : 'online'}`;
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
        saveData();
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
            price: demo.price,
            expiry: expiry,
            addedAt: new Date(),
            purchased: false,
            synced: false,
            discount: 0,
            _alerted: {}
        });
    });

    saveData();
    showToast('🎯', 'Demo Loaded!', '8 demo products added to shop inventory.', 'success');
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
    loadData();
    setDefaultExpiry();
    updateClock();
    updateUI();
    
    if (products.length === 0) {
        setTimeout(addDemoProducts, 300);
    }
    
    setInterval(() => {
        updateClock();
        updateUI();
    }, 1000);
}

document.addEventListener('DOMContentLoaded', init);

// ================================================================
// BARCODE SCANNER FUNCTIONS
// ================================================================

let barcodeScanner = null;
let scannedData = null;

function openBarcodeScanner() {
    const modal = document.getElementById('barcodeScannerModal');
    modal.style.display = 'flex';
    
    setTimeout(() => {
        startBarcodeScanner();
    }, 500);
}

function closeBarcodeScanner() {
    stopBarcodeScanner();
    document.getElementById('barcodeScannerModal').style.display = 'none';
}

function startBarcodeScanner() {
    const readerElement = document.getElementById('barcode-reader');
    
    if (barcodeScanner) {
        barcodeScanner.clear();
        barcodeScanner = null;
    }
    
    try {
        barcodeScanner = new Html5Qrcode("barcode-reader");
        
        const config = {
            fps: 15,
            qrbox: { width: 300, height: 150 },
            aspectRatio: 2.0
        };
        
        barcodeScanner.start(
            { facingMode: "environment" },
            config,
            onBarcodeSuccess,
            onBarcodeError
        );
        
        showToast('📷', 'Scanner Started', 'Scanning barcode...', 'info');
    } catch (err) {
        console.error('Scanner error:', err);
        showToast('⚠️', 'Camera Error', 'Please enter data manually.', 'warning');
        readerElement.innerHTML = `
            <div style="text-align:center;padding:30px 0;color:#888;">
                <i class="fas fa-camera" style="font-size:40px;display:block;margin-bottom:10px;"></i>
                <p>Camera not available. Use manual entry.</p>
            </div>
        `;
    }
}

function stopBarcodeScanner() {
    if (barcodeScanner) {
        try {
            barcodeScanner.stop().then(() => {
                barcodeScanner.clear();
                barcodeScanner = null;
            }).catch(err => console.error('Stop error:', err));
        } catch(e) {
            console.error('Stop error:', e);
        }
    }
}

function onBarcodeSuccess(decodedText, decodedResult) {
    // Parse the barcode data (you can customize this)
    // Example: "Milk,4.99,7" or JSON format
    try {
        // Try JSON first
        const data = JSON.parse(decodedText);
        scannedData = {
            name: data.name || data.product || 'Product',
            price: parseFloat(data.price) || parseFloat(data.cost) || 5.00,
            expiryDays: parseInt(data.expiry_days) || parseInt(data.days) || 7
        };
    } catch (e) {
        // Try CSV format: "Name,Price,ExpiryDays"
        const parts = decodedText.split(',').map(s => s.trim());
        if (parts.length >= 2) {
            scannedData = {
                name: parts[0] || 'Product',
                price: parseFloat(parts[1]) || 5.00,
                expiryDays: parseInt(parts[2]) || 7
            };
        } else {
            // Just use the text as name
            scannedData = {
                name: decodedText.trim() || 'Product',
                price: 5.00,
                expiryDays: 7
            };
        }
    }
    
    // Show preview
    showScannedPreview(scannedData);
    
    // Stop scanner
    stopBarcodeScanner();
    closeBarcodeScanner();
    
    showToast('✅', 'Scanned!', `Product: ${scannedData.name}`, 'success');
}

function onBarcodeError(error) {
    // Silent fail - just keep scanning
}

function showScannedPreview(data) {
    const preview = document.getElementById('scannedDataPreview');
    document.getElementById('scannedName').textContent = data.name;
    document.getElementById('scannedPrice').textContent = `$${data.price.toFixed(2)}`;
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + data.expiryDays);
    document.getElementById('scannedExpiry').textContent = expiryDate.toLocaleDateString();
    
    preview.style.display = 'block';
}

function applyScannedData() {
    if (!scannedData) return;
    
    document.getElementById('productName').value = scannedData.name;
    document.getElementById('productPrice').value = scannedData.price.toFixed(2);
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + scannedData.expiryDays);
    document.getElementById('expiryDateTime').value = expiryDate.toISOString().slice(0, 16);
    
    clearScannedData();
    showToast('📋', 'Applied!', 'Scanned data applied to form.', 'success');
}

function clearScannedData() {
    document.getElementById('scannedDataPreview').style.display = 'none';
    scannedData = null;
}

function manualBarcodeInput() {
    closeBarcodeScanner();
    const input = prompt('Enter barcode data (Format: Name,Price,ExpiryDays):', 'Milk,4.99,7');
    if (input) {
        const parts = input.split(',').map(s => s.trim());
        scannedData = {
            name: parts[0] || 'Product',
            price: parseFloat(parts[1]) || 5.00,
            expiryDays: parseInt(parts[2]) || 7
        };
        showScannedPreview(scannedData);
        showToast('📝', 'Manual Entry', `Product: ${scannedData.name}`, 'info');
    }
}
