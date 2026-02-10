// ═══════════════════════════════════════════════════════════
// Bondhon Enterprise - Firebase Real-time Integration
// Advanced Sales Tracking & Reporting System
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// IndexedDB (Dexie.js) - Local Cache & Offline Support
// ═══════════════════════════════════════════════════════════

const db = new Dexie("BondhonDB");
db.version(2).stores({
    customers: 'id, name, phone',
    recycleBin: 'id, name',
    transactions: '++autoId, customerId, transactionId, timestamp',
    syncQueue: '++id, action, timestamp'
});

// ═══════════════════════════════════════════════════════════
// Global Variables
// ═══════════════════════════════════════════════════════════

let currentId = null;
let editMode = false;
let deleteTargetId = null;
let deleteType = null;
let sortBy = 'newest';
let allCustomers = [];
let currentLanguage = 'bn';
let isOnline = navigator.onLine;
let isSyncing = false;
let firebaseInitialized = false;

const defaultSettings = { theme: 'light', currency: '৳', language: 'bn' };

// ═══════════════════════════════════════════════════════════
// Firebase Real-time Sync System
// ═══════════════════════════════════════════════════════════

/**
 * Initialize Firebase real-time listeners for customers and transactions
 * Syncs data automatically when changes occur on any device
 */
async function initFirebaseSync() {
    if (!window.firebaseDb) {
        console.error('Firebase not initialized');
        return;
    }
    
    console.log('🔥 Initializing Firebase real-time sync...');
    firebaseInitialized = true;
    
    // Listen for customer changes
    const customersRef = window.firebaseRef(window.firebaseDb, 'customers');
    
    // Listen for new customers added
    window.firebaseOnChildAdded(customersRef, async (snapshot) => {
        const customer = snapshot.val();
        if (customer) {
            customer.id = snapshot.key;
            await db.customers.put(customer);
            console.log('✓ Customer added from Firebase:', customer.name);
            await render();
        }
    });
    
    // Listen for customer updates
    window.firebaseOnChildChanged(customersRef, async (snapshot) => {
        const customer = snapshot.val();
        if (customer) {
            customer.id = snapshot.key;
            await db.customers.put(customer);
            console.log('✓ Customer updated from Firebase:', customer.name);
            await render();
        }
    });
    
    // Listen for customer deletions
    window.firebaseOnChildRemoved(customersRef, async (snapshot) => {
        await db.customers.delete(snapshot.key);
        console.log('✓ Customer removed from Firebase:', snapshot.key);
        await render();
    });
    
    // Listen for recycle bin changes
    const binRef = window.firebaseRef(window.firebaseDb, 'recycleBin');
    
    window.firebaseOnChildAdded(binRef, async (snapshot) => {
        const item = snapshot.val();
        if (item) {
            item.id = snapshot.key;
            await db.recycleBin.put(item);
            console.log('✓ Bin item added from Firebase');
        }
    });
    
    window.firebaseOnChildRemoved(binRef, async (snapshot) => {
        await db.recycleBin.delete(snapshot.key);
        console.log('✓ Bin item removed from Firebase');
    });
    
    // Listen for transaction changes
    const transactionsRef = window.firebaseRef(window.firebaseDb, 'transactions');
    
    window.firebaseOnChildAdded(transactionsRef, async (snapshot) => {
        const transaction = snapshot.val();
        if (transaction) {
            transaction.autoId = snapshot.key;
            await db.transactions.put(transaction);
            console.log('✓ Transaction added from Firebase');
            await render();
        }
    });
    
    window.firebaseOnChildRemoved(transactionsRef, async (snapshot) => {
        await db.transactions.where('transactionId').equals(snapshot.key).delete();
        console.log('✓ Transaction removed from Firebase');
        await render();
    });
    
    console.log('🔥 Firebase real-time sync initialized successfully');
}

/**
 * Save customer to Firebase
 */
async function saveCustomerToFirebase(customer) {
    if (!window.firebaseDb || !isOnline) {
        // Queue for later sync
        await queueForSync('save_customer', customer);
        return;
    }
    
    try {
        const customerRef = window.firebaseRef(window.firebaseDb, `customers/${customer.id}`);
        await window.firebaseSet(customerRef, {
            name: customer.name,
            phone: customer.phone,
            qty: customer.qty || 0,
            bill: customer.bill || 0,
            cash: customer.cash || 0,
            due: customer.due || 0,
            tag: customer.tag || '',
            notes: customer.notes || '',
            createdAt: customer.createdAt || Date.now(),
            lastModified: Date.now()
        });
        console.log('✓ Customer saved to Firebase:', customer.name);
    } catch (error) {
        console.error('Firebase save error:', error);
        await queueForSync('save_customer', customer);
    }
}

/**
 * Delete customer from Firebase
 */
async function deleteCustomerFromFirebase(customerId) {
    if (!window.firebaseDb || !isOnline) {
        await queueForSync('delete_customer', { id: customerId });
        return;
    }
    
    try {
        const customerRef = window.firebaseRef(window.firebaseDb, `customers/${customerId}`);
        await window.firebaseRemove(customerRef);
        console.log('✓ Customer deleted from Firebase:', customerId);
    } catch (error) {
        console.error('Firebase delete error:', error);
        await queueForSync('delete_customer', { id: customerId });
    }
}

/**
 * Save transaction to Firebase
 */
async function saveTransactionToFirebase(transaction) {
    if (!window.firebaseDb || !isOnline) {
        await queueForSync('save_transaction', transaction);
        return;
    }
    
    try {
        const transactionRef = window.firebaseRef(window.firebaseDb, `transactions/${transaction.transactionId}`);
        await window.firebaseSet(transactionRef, {
            customerId: transaction.customerId,
            transactionId: transaction.transactionId,
            type: transaction.type,
            qty: transaction.qty || 0,
            bill: transaction.bill || 0,
            cash: transaction.cash || 0,
            details: transaction.details || '',
            timestamp: transaction.timestamp
        });
        console.log('✓ Transaction saved to Firebase');
    } catch (error) {
        console.error('Firebase transaction save error:', error);
        await queueForSync('save_transaction', transaction);
    }
}

/**
 * Delete transaction from Firebase
 */
async function deleteTransactionFromFirebase(transactionId) {
    if (!window.firebaseDb || !isOnline) {
        await queueForSync('delete_transaction', { transactionId });
        return;
    }
    
    try {
        const transactionRef = window.firebaseRef(window.firebaseDb, `transactions/${transactionId}`);
        await window.firebaseRemove(transactionRef);
        console.log('✓ Transaction deleted from Firebase');
    } catch (error) {
        console.error('Firebase transaction delete error:', error);
        await queueForSync('delete_transaction', { transactionId });
    }
}

/**
 * Move item to recycle bin in Firebase
 */
async function moveToBinFirebase(item) {
    if (!window.firebaseDb || !isOnline) {
        await queueForSync('move_to_bin', item);
        return;
    }
    
    try {
        const binRef = window.firebaseRef(window.firebaseDb, `recycleBin/${item.id}`);
        await window.firebaseSet(binRef, {
            ...item,
            deletedAt: Date.now()
        });
        console.log('✓ Item moved to bin in Firebase');
    } catch (error) {
        console.error('Firebase bin move error:', error);
        await queueForSync('move_to_bin', item);
    }
}

/**
 * Restore item from recycle bin in Firebase
 */
async function restoreFromBinFirebase(itemId) {
    if (!window.firebaseDb || !isOnline) {
        await queueForSync('restore_from_bin', { id: itemId });
        return;
    }
    
    try {
        const binRef = window.firebaseRef(window.firebaseDb, `recycleBin/${itemId}`);
        await window.firebaseRemove(binRef);
        console.log('✓ Item restored from bin in Firebase');
    } catch (error) {
        console.error('Firebase bin restore error:', error);
        await queueForSync('restore_from_bin', { id: itemId });
    }
}

// ═══════════════════════════════════════════════════════════
// Offline Sync Queue Management
// ═══════════════════════════════════════════════════════════

/**
 * Queue data for syncing when connection is restored
 */
async function queueForSync(action, data) {
    await db.syncQueue.add({
        action,
        data,
        timestamp: Date.now()
    });
    console.log(`⏳ Queued for sync: ${action}`);
    updateSyncStatus();
}

/**
 * Process sync queue when online
 */
async function processSyncQueue() {
    if (!isOnline || isSyncing || !window.firebaseDb) return;
    
    const queue = await db.syncQueue.toArray();
    if (queue.length === 0) return;
    
    isSyncing = true;
    console.log(`🔄 Processing ${queue.length} queued items...`);
    
    for (const item of queue) {
        try {
            switch (item.action) {
                case 'save_customer':
                    await saveCustomerToFirebase(item.data);
                    break;
                case 'delete_customer':
                    await deleteCustomerFromFirebase(item.data.id);
                    break;
                case 'save_transaction':
                    await saveTransactionToFirebase(item.data);
                    break;
                case 'delete_transaction':
                    await deleteTransactionFromFirebase(item.data.transactionId);
                    break;
                case 'move_to_bin':
                    await moveToBinFirebase(item.data);
                    break;
                case 'restore_from_bin':
                    await restoreFromBinFirebase(item.data.id);
                    break;
            }
            
            // Remove from queue after successful sync
            await db.syncQueue.delete(item.id);
        } catch (error) {
            console.error('Sync queue processing error:', error);
        }
    }
    
    isSyncing = false;
    updateSyncStatus();
    
    const remaining = await db.syncQueue.count();
    if (remaining === 0) {
        showToast(
            currentLanguage === 'bn' ? '✓ সব ডাটা সিঙ্ক হয়ে গেছে' : '✓ All data synced',
            'success'
        );
    }
}

/**
 * Update sync status display
 */
async function updateSyncStatus() {
    const queueSize = await db.syncQueue.count();
    const badge = document.getElementById('notificationBadge');
    
    if (queueSize > 0) {
        if (badge) {
            badge.textContent = queueSize > 9 ? '9+' : queueSize;
            badge.classList.remove('hidden');
        }
        
        if (!isOnline) {
            const statusBadge = document.getElementById('statusBadge');
            if (statusBadge) {
                statusBadge.className = 'status-badge status-offline';
                statusBadge.innerHTML = `<span class="status-dot"></span> <span data-bn="Offline (${queueSize})" data-en="Offline (${queueSize})">Offline (${queueSize})</span>`;
            }
        }
    } else {
        if (badge) {
            badge.classList.add('hidden');
        }
    }
}

// ═══════════════════════════════════════════════════════════
// Settings Management
// ═══════════════════════════════════════════════════════════

function getSettings() {
    try {
        return JSON.parse(localStorage.getItem('bondhon_settings')) || defaultSettings;
    } catch { 
        return defaultSettings; 
    }
}

function saveSettingsObj(s) {
    localStorage.setItem('bondhon_settings', JSON.stringify(s));
}

function getCurrency() {
    return getSettings().currency || '৳';
}

// ═══════════════════════════════════════════════════════════
// Language System
// ═══════════════════════════════════════════════════════════

function toggleLanguage() {
    const settings = getSettings();
    currentLanguage = currentLanguage === 'bn' ? 'en' : 'bn';
    settings.language = currentLanguage;
    saveSettingsObj(settings);
    
    document.documentElement.setAttribute('data-lang', currentLanguage);
    applyLanguage();
    
    vibrate(20);
    showToast(
        currentLanguage === 'bn' ? 'ভাষা পরিবর্তন: বাংলা' : 'Language changed: English',
        'success'
    );
}

function applyLanguage() {
    const lang = currentLanguage;
    
    // Update all elements with data-bn and data-en attributes
    document.querySelectorAll('[data-bn][data-en]').forEach(el => {
        const text = lang === 'bn' ? el.getAttribute('data-bn') : el.getAttribute('data-en');
        if (text) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = text;
            } else if (el.tagName === 'OPTION') {
                el.textContent = text;
            } else {
                el.textContent = text;
            }
        }
    });
    
    // Update placeholders
    document.querySelectorAll('[data-bn-placeholder][data-en-placeholder]').forEach(el => {
        const placeholder = lang === 'bn' 
            ? el.getAttribute('data-bn-placeholder') 
            : el.getAttribute('data-en-placeholder');
        if (placeholder) el.placeholder = placeholder;
    });
}

// ═══════════════════════════════════════════════════════════
// Theme Management
// ═══════════════════════════════════════════════════════════

function applyTheme(theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
}

function toggleTheme() {
    const s = getSettings();
    s.theme = s.theme === 'dark' ? 'light' : 'dark';
    saveSettingsObj(s);
    applyTheme(s.theme);
    updateThemeToggleUI();
    showToast(
        currentLanguage === 'bn' 
            ? (s.theme === 'dark' ? 'ডার্ক মোড চালু' : 'লাইট মোড চালু')
            : (s.theme === 'dark' ? 'Dark mode enabled' : 'Light mode enabled')
    );
}

function updateThemeToggleUI() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    const isDark = getSettings().theme === 'dark';
    btn.classList.toggle('active', isDark);
}

// ═══════════════════════════════════════════════════════════
// Toast Notifications
// ═══════════════════════════════════════════════════════════

function showToast(msg, type = 'success') {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    
    const div = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-emerald-600 text-white' : 
                     type === 'error' ? 'bg-rose-500 text-white' : 
                     'bg-slate-800 text-white';
    div.className = `toast ${bgClass}`;
    div.textContent = msg;
    c.appendChild(div);
    
    setTimeout(() => {
        div.style.animation = 'toast-slide-out 0.3s ease-in forwards';
        setTimeout(() => div.remove(), 300);
    }, 2800);
}

// ═══════════════════════════════════════════════════════════
// Notification System
// ═══════════════════════════════════════════════════════════

function updateNotificationBadge(count) {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;
    
    if (count > 0) {
        badge.textContent = count > 9 ? '9+' : count;
        badge.classList.remove('hidden');
        localStorage.setItem('notificationCount', count.toString());
    } else {
        badge.classList.add('hidden');
        localStorage.setItem('notificationCount', '0');
    }
}

function triggerNotification(message) {
    const currentCount = parseInt(localStorage.getItem('notificationCount') || '0');
    updateNotificationBadge(currentCount + 1);
    showToast(message, 'success');
    vibrate(30);
}

// Setup notification button click handler
document.addEventListener('DOMContentLoaded', async () => {
    const notifBtn = document.getElementById('notificationBtn');
    if (notifBtn) {
        notifBtn.addEventListener('click', async () => {
            updateNotificationBadge(0);
            
            // Show sync status
            const queueSize = await db.syncQueue.count();
            
            let statusMessage = '';
            if (queueSize === 0) {
                statusMessage = currentLanguage === 'bn' 
                    ? '✓ সব ডাটা সিঙ্ক হয়ে গেছে' 
                    : '✓ All data synced';
            } else if (!isOnline) {
                statusMessage = currentLanguage === 'bn' 
                    ? `⚠ অফলাইন: ${queueSize} টি ডাটা সিঙ্ক অপেক্ষায়` 
                    : `⚠ Offline: ${queueSize} items waiting`;
            } else {
                statusMessage = currentLanguage === 'bn' 
                    ? `⏳ ${queueSize} টি ডাটা সিঙ্ক হচ্ছে...` 
                    : `⏳ ${queueSize} items syncing...`;
                
                // Trigger manual sync
                processSyncQueue();
            }
            
            showToast(statusMessage, queueSize === 0 ? 'success' : 'error');
        });
    }
});

// ═══════════════════════════════════════════════════════════
// Modal Management
// ═══════════════════════════════════════════════════════════

function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('modal-visible'), 10);
    
    if (id === 'binModal') renderBin();
    if (id === 'reportModal') renderReport();
    if (id === 'settingsModal') loadSettingsUI();
    
    vibrate(15);
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    
    modal.classList.remove('modal-visible');
    setTimeout(() => modal.classList.add('hidden'), 400);
}

// Global event listener for clicking outside modal content
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) {
        const modal = e.target.closest('.modal-overlay');
        if (modal && modal.id) {
            closeModal(modal.id);
        }
    }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const visibleModal = document.querySelector('.modal-overlay.modal-visible');
        if (visibleModal && visibleModal.id) {
            closeModal(visibleModal.id);
        }
    }
});

// ═══════════════════════════════════════════════════════════
// Haptic Feedback (Vibration)
// ═══════════════════════════════════════════════════════════

function vibrate(ms = 20) {
    if ('vibrate' in navigator) {
        navigator.vibrate(ms);
    }
}

// ═══════════════════════════════════════════════════════════
// Customer Management Functions
// ═══════════════════════════════════════════════════════════

function openAddCustomer() {
    editMode = false;
    currentId = null;
    document.getElementById('name').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('custTag').value = '';
    document.getElementById('custNotes').value = '';
    document.getElementById('customerModalTitle').textContent = currentLanguage === 'bn' ? 'নতুন কাস্টমার' : 'New Customer';
    openModal('customerModal');
    vibrate(20);
}

async function saveCustomer() {
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const tag = document.getElementById('custTag').value;
    const notes = document.getElementById('custNotes').value.trim();
    
    if (!name) {
        showToast(currentLanguage === 'bn' ? 'নাম লিখুন!' : 'Enter name!', 'error');
        return;
    }
    
    const customer = {
        id: editMode ? currentId : Date.now().toString(),
        name,
        phone,
        qty: 0,
        bill: 0,
        cash: 0,
        due: 0,
        tag,
        notes,
        createdAt: editMode ? (await db.customers.get(currentId))?.createdAt : Date.now(),
        lastModified: Date.now()
    };
    
    if (editMode) {
        const existing = await db.customers.get(currentId);
        customer.qty = existing.qty;
        customer.bill = existing.bill;
        customer.cash = existing.cash;
        customer.due = existing.due;
    }
    
    await db.customers.put(customer);
    await saveCustomerToFirebase(customer);
    
    showToast(
        editMode 
            ? (currentLanguage === 'bn' ? 'আপডেট সফল!' : 'Updated successfully!')
            : (currentLanguage === 'bn' ? 'কাস্টমার যুক্ত হয়েছে!' : 'Customer added!'),
        'success'
    );
    
    closeModal('customerModal');
    await render();
    vibrate(30);
}

async function editCustomer(id) {
    const c = await db.customers.get(id);
    if (!c) return;
    
    editMode = true;
    currentId = id;
    document.getElementById('name').value = c.name;
    document.getElementById('phone').value = c.phone || '';
    document.getElementById('custTag').value = c.tag || '';
    document.getElementById('custNotes').value = c.notes || '';
    document.getElementById('customerModalTitle').textContent = currentLanguage === 'bn' ? 'কাস্টমার এডিট' : 'Edit Customer';
    openModal('customerModal');
}

async function confirmDelete(id, type = 'customer') {
    deleteTargetId = id;
    deleteType = type;
    
    const message = currentLanguage === 'bn' 
        ? `মুছে ফেলবেন?` 
        : `Delete this ${type}?`;
    
    if (confirm(message)) {
        if (type === 'customer') {
            await deleteCustomer(id);
        } else if (type === 'transaction') {
            await deleteTransaction(id);
        }
    }
}

async function deleteCustomer(id) {
    const customer = await db.customers.get(id);
    if (!customer) return;
    
    // Move to recycle bin
    await db.recycleBin.put({
        ...customer,
        deletedAt: Date.now(),
        type: 'customer'
    });
    
    // Move transactions to bin
    const transactions = await db.transactions.where('customerId').equals(id).toArray();
    for (const trans of transactions) {
        await db.recycleBin.put({
            ...trans,
            deletedAt: Date.now(),
            type: 'transaction'
        });
        await db.transactions.delete(trans.autoId);
    }
    
    await db.customers.delete(id);
    await deleteCustomerFromFirebase(id);
    await moveToBinFirebase(customer);
    
    showToast(
        currentLanguage === 'bn' ? 'রিসাইকেল বিনে স্থানান্তরিত' : 'Moved to recycle bin',
        'success'
    );
    
    await render();
    vibrate(40);
}

// ═══════════════════════════════════════════════════════════
// Advanced Transaction Management System
// Multiple Sales per Customer with Unique IDs
// ═══════════════════════════════════════════════════════════

/**
 * Add a new transaction (sell) for a customer
 * Each transaction has a unique ID and timestamp
 */
async function addTransaction(customerId, type = 'sell') {
    const c = await db.customers.get(customerId);
    if (!c) return;
    
    const qtyInput = prompt(currentLanguage === 'bn' ? 'সুপারি পরিমাণ:' : 'Quantity:', '0');
    if (!qtyInput) return;
    const qty = parseFloat(qtyInput) || 0;
    
    const billInput = prompt(currentLanguage === 'bn' ? 'বিল:' : 'Bill:', '0');
    if (!billInput) return;
    const bill = parseFloat(billInput) || 0;
    
    const cashInput = prompt(currentLanguage === 'bn' ? 'জমা:' : 'Paid:', '0');
    if (!cashInput) return;
    const cash = parseFloat(cashInput) || 0;
    
    const details = prompt(currentLanguage === 'bn' ? 'বিস্তারিত (ঐচ্ছিক):' : 'Details (optional):', '') || '';
    
    // Create unique transaction
    const transaction = {
        transactionId: `${customerId}_${Date.now()}`,
        customerId: customerId,
        type: type,
        qty: qty,
        bill: bill,
        cash: cash,
        due: bill - cash,
        details: details,
        timestamp: Date.now()
    };
    
    // Save transaction to IndexedDB
    await db.transactions.add(transaction);
    
    // Save to Firebase
    await saveTransactionToFirebase(transaction);
    
    // Update customer totals
    c.qty = (c.qty || 0) + qty;
    c.bill = (c.bill || 0) + bill;
    c.cash = (c.cash || 0) + cash;
    c.due = c.bill - c.cash;
    c.lastModified = Date.now();
    
    await db.customers.put(c);
    await saveCustomerToFirebase(c);
    
    showToast(
        currentLanguage === 'bn' ? 'লেনদেন যুক্ত হয়েছে!' : 'Transaction added!',
        'success'
    );
    
    await render();
    vibrate(30);
}

/**
 * Delete a specific transaction
 */
async function deleteTransaction(transactionId) {
    const transactions = await db.transactions.where('transactionId').equals(transactionId).toArray();
    if (transactions.length === 0) return;
    
    const transaction = transactions[0];
    const customerId = transaction.customerId;
    
    // Remove transaction
    await db.transactions.delete(transaction.autoId);
    await deleteTransactionFromFirebase(transactionId);
    
    // Update customer totals
    const customer = await db.customers.get(customerId);
    if (customer) {
        customer.qty = (customer.qty || 0) - (transaction.qty || 0);
        customer.bill = (customer.bill || 0) - (transaction.bill || 0);
        customer.cash = (customer.cash || 0) - (transaction.cash || 0);
        customer.due = customer.bill - customer.cash;
        customer.lastModified = Date.now();
        
        await db.customers.put(customer);
        await saveCustomerToFirebase(customer);
    }
    
    showToast(
        currentLanguage === 'bn' ? 'লেনদেন মুছে ফেলা হয়েছে' : 'Transaction deleted',
        'success'
    );
    
    await render();
    
    // Refresh detail modal if open
    const detailModal = document.getElementById('detailModal');
    if (detailModal && !detailModal.classList.contains('hidden')) {
        await viewDetails(customerId);
    }
}

/**
 * Print receipt for individual transaction
 */
function printTransactionReceipt(transactionId) {
    db.transactions.where('transactionId').equals(transactionId).toArray().then(async transactions => {
        if (transactions.length === 0) return;
        
        const transaction = transactions[0];
        const customer = await db.customers.get(transaction.customerId);
        if (!customer) return;
        
        const cur = getCurrency();
        const date = new Date(transaction.timestamp);
        const dateStr = date.toLocaleDateString('bn-BD');
        const timeStr = date.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });
        
        const receiptHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Receipt - ${customer.name}</title>
                <style>
                    @media print {
                        body {
                            font-family: 'Courier New', monospace;
                            margin: 20px;
                            background: white;
                        }
                        .receipt {
                            max-width: 400px;
                            margin: 0 auto;
                            padding: 20px;
                            border: 2px solid #000;
                        }
                        .header {
                            text-align: center;
                            border-bottom: 2px solid #000;
                            padding-bottom: 10px;
                            margin-bottom: 15px;
                        }
                        .header h1 {
                            margin: 0;
                            font-size: 22px;
                        }
                        .header p {
                            margin: 5px 0;
                            font-size: 12px;
                        }
                        .row {
                            display: flex;
                            justify-content: space-between;
                            margin: 8px 0;
                            font-size: 14px;
                        }
                        .separator {
                            border-top: 1px dashed #000;
                            margin: 10px 0;
                        }
                        .total {
                            font-weight: bold;
                            font-size: 16px;
                            margin-top: 15px;
                        }
                        .footer {
                            text-align: center;
                            margin-top: 20px;
                            font-size: 12px;
                            border-top: 2px solid #000;
                            padding-top: 10px;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="receipt">
                    <div class="header">
                        <h1>🌿 Bondhon Enterprise</h1>
                        <p>ক্রেডিট ম্যানেজমেন্ট সিস্টেম</p>
                    </div>
                    
                    <div class="row">
                        <span>তারিখ:</span>
                        <span>${dateStr}</span>
                    </div>
                    <div class="row">
                        <span>সময়:</span>
                        <span>${timeStr}</span>
                    </div>
                    
                    <div class="separator"></div>
                    
                    <div class="row">
                        <span>কাস্টমার:</span>
                        <span><strong>${customer.name}</strong></span>
                    </div>
                    ${customer.phone ? `<div class="row"><span>মোবাইল:</span><span>${customer.phone}</span></div>` : ''}
                    
                    <div class="separator"></div>
                    
                    <div class="row">
                        <span>সুপারি পরিমাণ:</span>
                        <span>${transaction.qty || 0} পিস</span>
                    </div>
                    <div class="row">
                        <span>বিল:</span>
                        <span>${cur}${(transaction.bill || 0).toLocaleString('bn-BD')}</span>
                    </div>
                    <div class="row">
                        <span>জমা:</span>
                        <span>${cur}${(transaction.cash || 0).toLocaleString('bn-BD')}</span>
                    </div>
                    
                    <div class="separator"></div>
                    
                    <div class="row total">
                        <span>বাকি:</span>
                        <span>${cur}${(transaction.due || 0).toLocaleString('bn-BD')}</span>
                    </div>
                    
                    ${transaction.details ? `
                    <div class="separator"></div>
                    <div class="row">
                        <span>বিস্তারিত:</span>
                        <span>${transaction.details}</span>
                    </div>
                    ` : ''}
                    
                    <div class="footer">
                        <p>ধন্যবাদ!</p>
                        <p>রসিদ নং: ${transactionId.substring(0, 12)}</p>
                    </div>
                </div>
                
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(() => window.close(), 500);
                    }
                </script>
            </body>
            </html>
        `;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(receiptHTML);
        printWindow.document.close();
    });
}

/**
 * Generate comprehensive customer report with all transactions
 */
async function generateFullCustomerReport(customerId) {
    const customer = await db.customers.get(customerId);
    if (!customer) return;
    
    const transactions = await db.transactions
        .where('customerId')
        .equals(customerId)
        .toArray();
    
    transactions.sort((a, b) => b.timestamp - a.timestamp);
    
    const cur = getCurrency();
    
    let transactionRows = '';
    let runningBalance = 0;
    
    // Process transactions in chronological order for running balance
    const chronological = [...transactions].reverse();
    for (const trans of chronological) {
        const date = new Date(trans.timestamp);
        const dateStr = date.toLocaleDateString('bn-BD');
        const timeStr = date.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });
        
        runningBalance += (trans.bill || 0) - (trans.cash || 0);
        
        transactionRows = `
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${dateStr}<br><small>${timeStr}</small></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${trans.details || '-'}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${trans.qty || 0}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${cur}${(trans.bill || 0).toLocaleString('bn-BD')}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${cur}${(trans.cash || 0).toLocaleString('bn-BD')}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${cur}${runningBalance.toLocaleString('bn-BD')}</td>
            </tr>
        ` + transactionRows;
    }
    
    const reportHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Full Report - ${customer.name}</title>
            <style>
                @media print {
                    body {
                        font-family: 'Arial', sans-serif;
                        margin: 20px;
                        background: white;
                        color: #000;
                    }
                    .report-container {
                        max-width: 900px;
                        margin: 0 auto;
                    }
                    .report-header {
                        text-align: center;
                        border-bottom: 3px solid #0d9488;
                        padding-bottom: 20px;
                        margin-bottom: 30px;
                    }
                    .report-header h1 {
                        margin: 0;
                        color: #0d9488;
                        font-size: 28px;
                    }
                    .report-header p {
                        margin: 5px 0;
                        color: #666;
                    }
                    .customer-info {
                        background: #f0fdfa;
                        padding: 15px;
                        border-radius: 8px;
                        margin-bottom: 20px;
                        border: 2px solid #0d9488;
                    }
                    .customer-info h2 {
                        margin: 0 0 10px 0;
                        color: #0d9488;
                    }
                    .summary-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 15px;
                        margin-bottom: 30px;
                    }
                    .summary-card {
                        background: white;
                        border: 2px solid #e2e8f0;
                        border-radius: 8px;
                        padding: 15px;
                        text-align: center;
                    }
                    .summary-card h3 {
                        margin: 0;
                        font-size: 12px;
                        color: #64748b;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .summary-card p {
                        margin: 10px 0 0 0;
                        font-size: 24px;
                        font-weight: bold;
                        color: #0d9488;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    th {
                        background: #0d9488;
                        color: white;
                        padding: 12px 8px;
                        text-align: left;
                        font-weight: bold;
                    }
                    td {
                        padding: 8px;
                        border: 1px solid #ddd;
                    }
                    tr:nth-child(even) {
                        background: #f8fafc;
                    }
                    .report-footer {
                        margin-top: 30px;
                        text-align: center;
                        border-top: 2px solid #e2e8f0;
                        padding-top: 20px;
                        color: #64748b;
                    }
                }
            </style>
        </head>
        <body>
            <div class="report-container">
                <div class="report-header">
                    <h1>🌿 Bondhon Enterprise</h1>
                    <p>সম্পূর্ণ কাস্টমার রিপোর্ট</p>
                    <p><small>তৈরি: ${new Date().toLocaleDateString('bn-BD')}</small></p>
                </div>
                
                <div class="customer-info">
                    <h2>${customer.name}</h2>
                    ${customer.phone ? `<p><strong>মোবাইল:</strong> ${customer.phone}</p>` : ''}
                    ${customer.tag ? `<p><strong>ট্যাগ:</strong> ${customer.tag}</p>` : ''}
                    ${customer.notes ? `<p><strong>নোট:</strong> ${customer.notes}</p>` : ''}
                </div>
                
                <div class="summary-grid">
                    <div class="summary-card">
                        <h3>মোট সুপারি</h3>
                        <p>${(customer.qty || 0).toLocaleString('bn-BD')}</p>
                    </div>
                    <div class="summary-card">
                        <h3>মোট বিল</h3>
                        <p>${cur}${(customer.bill || 0).toLocaleString('bn-BD')}</p>
                    </div>
                    <div class="summary-card">
                        <h3>মোট জমা</h3>
                        <p>${cur}${(customer.cash || 0).toLocaleString('bn-BD')}</p>
                    </div>
                    <div class="summary-card">
                        <h3>বর্তমান বাকি</h3>
                        <p style="color: #dc2626;">${cur}${(customer.due || 0).toLocaleString('bn-BD')}</p>
                    </div>
                </div>
                
                <h3 style="margin-bottom: 10px; color: #0d9488;">লেনদেনের বিস্তারিত ইতিহাস</h3>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 15%;">তারিখ/সময়</th>
                            <th style="width: 25%;">বিস্তারিত</th>
                            <th style="width: 10%; text-align: center;">পরিমাণ</th>
                            <th style="width: 15%; text-align: right;">বিল</th>
                            <th style="width: 15%; text-align: right;">জমা</th>
                            <th style="width: 20%; text-align: right;">ব্যালেন্স</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transactionRows || '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #94a3b8;">কোন লেনদেন নেই</td></tr>'}
                    </tbody>
                </table>
                
                <div class="report-footer">
                    <p>মোট লেনদেন: ${transactions.length} টি</p>
                    <p><small>Bondhon Enterprise - ক্রেডিট ম্যানেজমেন্ট সিস্টেম</small></p>
                </div>
            </div>
            
            <script>
                window.onload = function() {
                    window.print();
                }
            </script>
        </body>
        </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(reportHTML);
    printWindow.document.close();
}

// ═══════════════════════════════════════════════════════════
// Customer Details View with Transaction History
// ═══════════════════════════════════════════════════════════

async function viewDetails(id) {
    const c = await db.customers.get(id);
    if (!c) return;
    
    // Get all transactions for this customer
    const transactions = await db.transactions
        .where('customerId')
        .equals(id)
        .toArray();
    
    // Sort by timestamp (newest first)
    transactions.sort((a, b) => b.timestamp - a.timestamp);
    
    const cur = getCurrency();
    const modal = document.getElementById('detailModal');
    
    // Build transaction history HTML
    let transactionsHTML = '';
    if (transactions.length > 0) {
        transactionsHTML = transactions.map(trans => {
            const date = new Date(trans.timestamp);
            const dateStr = date.toLocaleDateString('bn-BD');
            const timeStr = date.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });
            
            return `
                <div class="transaction-item" style="background: var(--bg-card); border-radius: 12px; padding: 16px; margin-bottom: 12px; border: 1px solid var(--border);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                        <div>
                            <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">${dateStr} • ${timeStr}</p>
                            ${trans.details ? `<p style="font-size: 14px; color: var(--text-primary); font-weight: 600;">${trans.details}</p>` : ''}
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button onclick="printTransactionReceipt('${trans.transactionId}')" class="btn-icon" title="${currentLanguage === 'bn' ? 'প্রিন্ট' : 'Print'}" style="width: 36px; height: 36px; border-radius: 8px; background: var(--primary-ultra-light); color: var(--primary); border: none; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                                <i class="fas fa-print"></i>
                            </button>
                            <button onclick="confirmDelete('${trans.transactionId}', 'transaction')" class="btn-icon" title="${currentLanguage === 'bn' ? 'মুছুন' : 'Delete'}" style="width: 36px; height: 36px; border-radius: 8px; background: rgba(220, 38, 38, 0.1); color: #dc2626; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                        <div>
                            <p style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">${currentLanguage === 'bn' ? 'পরিমাণ' : 'Qty'}</p>
                            <p style="font-size: 16px; font-weight: 700; color: var(--text-primary);">${trans.qty || 0}</p>
                        </div>
                        <div>
                            <p style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">${currentLanguage === 'bn' ? 'বিল' : 'Bill'}</p>
                            <p style="font-size: 16px; font-weight: 700; color: var(--primary);">${cur}${(trans.bill || 0).toLocaleString('bn-BD')}</p>
                        </div>
                        <div>
                            <p style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">${currentLanguage === 'bn' ? 'জমা' : 'Paid'}</p>
                            <p style="font-size: 16px; font-weight: 700; color: var(--success);">${cur}${(trans.cash || 0).toLocaleString('bn-BD')}</p>
                        </div>
                    </div>
                    ${trans.due !== 0 ? `
                        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size: 12px; color: var(--text-secondary);">${currentLanguage === 'bn' ? 'বাকি' : 'Due'}</span>
                                <span style="font-size: 16px; font-weight: 800; color: var(--danger);">${cur}${(trans.due || 0).toLocaleString('bn-BD')}</span>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    } else {
        transactionsHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                <i class="fas fa-receipt" style="font-size: 48px; opacity: 0.3; margin-bottom: 16px;"></i>
                <p>${currentLanguage === 'bn' ? 'কোন লেনদেন নেই' : 'No transactions yet'}</p>
            </div>
        `;
    }
    
    modal.innerHTML = `
        <div class="modal-backdrop" onclick="closeModal('detailModal')"></div>
        <div class="modal-sheet modal-sheet-tall" style="max-width: 600px;">
            <div class="modal-handle"></div>
            <div class="modal-header" style="border-bottom: 2px solid var(--border); padding-bottom: 16px; margin-bottom: 20px;">
                <div>
                    <h3 class="modal-title">${c.name}</h3>
                    ${c.phone ? `<p style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;"><i class="fas fa-phone"></i> ${c.phone}</p>` : ''}
                    ${c.tag ? `<span class="tag tag-${c.tag.toLowerCase()}" style="margin-top: 8px; display: inline-block;">${c.tag}</span>` : ''}
                </div>
                <button onclick="closeModal('detailModal')" class="modal-close">&times;</button>
            </div>
            
            <!-- Summary Cards -->
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px;">
                <div style="background: linear-gradient(135deg, var(--primary), var(--primary-dark)); border-radius: 16px; padding: 16px; color: white;">
                    <p style="font-size: 11px; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">${currentLanguage === 'bn' ? 'মোট বিল' : 'Total Bill'}</p>
                    <p style="font-size: 22px; font-weight: 900;">${cur}${(c.bill || 0).toLocaleString('bn-BD')}</p>
                </div>
                <div style="background: linear-gradient(135deg, var(--success), var(--success-light)); border-radius: 16px; padding: 16px; color: white;">
                    <p style="font-size: 11px; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">${currentLanguage === 'bn' ? 'মোট জমা' : 'Total Paid'}</p>
                    <p style="font-size: 22px; font-weight: 900;">${cur}${(c.cash || 0).toLocaleString('bn-BD')}</p>
                </div>
                <div style="background: linear-gradient(135deg, var(--danger), var(--danger-light)); border-radius: 16px; padding: 16px; color: white;">
                    <p style="font-size: 11px; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">${currentLanguage === 'bn' ? 'বাকি' : 'Due'}</p>
                    <p style="font-size: 22px; font-weight: 900;">${cur}${(c.due || 0).toLocaleString('bn-BD')}</p>
                </div>
                <div style="background: linear-gradient(135deg, var(--accent), var(--accent-light)); border-radius: 16px; padding: 16px; color: white;">
                    <p style="font-size: 11px; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">${currentLanguage === 'bn' ? 'সুপারি' : 'Quantity'}</p>
                    <p style="font-size: 22px; font-weight: 900;">${(c.qty || 0).toLocaleString('bn-BD')}</p>
                </div>
            </div>
            
            <!-- Action Buttons -->
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px;">
                <button onclick="addTransaction('${id}')" class="btn-primary" style="padding: 14px; font-size: 14px;">
                    <i class="fas fa-plus-circle"></i> ${currentLanguage === 'bn' ? 'নতুন বিক্রয়' : 'New Sale'}
                </button>
                <button onclick="generateFullCustomerReport('${id}')" class="btn-secondary" style="padding: 14px; font-size: 14px; background: var(--primary-ultra-light); color: var(--primary); border-color: var(--primary-light);">
                    <i class="fas fa-file-alt"></i> ${currentLanguage === 'bn' ? 'সম্পূর্ণ রিপোর্ট' : 'Full Report'}
                </button>
            </div>
            
            <!-- Transaction History -->
            <div style="margin-bottom: 20px;">
                <h4 style="font-size: 14px; font-weight: 800; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px;">
                    <i class="fas fa-history"></i> ${currentLanguage === 'bn' ? 'লেনদেনের ইতিহাস' : 'Transaction History'} (${transactions.length})
                </h4>
                <div style="max-height: 400px; overflow-y: auto;">
                    ${transactionsHTML}
                </div>
            </div>
            
            <!-- Bottom Actions -->
            <div style="display: flex; gap: 10px; padding-top: 16px; border-top: 2px solid var(--border);">
                <button onclick="editCustomer('${id}')" class="btn-secondary" style="flex: 1;">
                    <i class="fas fa-edit"></i> ${currentLanguage === 'bn' ? 'এডিট' : 'Edit'}
                </button>
                <button onclick="confirmDelete('${id}')" class="btn-secondary" style="flex: 1; background: rgba(220, 38, 38, 0.1); color: var(--danger); border-color: rgba(220, 38, 38, 0.3);">
                    <i class="fas fa-trash"></i> ${currentLanguage === 'bn' ? 'মুছুন' : 'Delete'}
                </button>
            </div>
        </div>
    `;
    
    openModal('detailModal');
}

// ═══════════════════════════════════════════════════════════
// Render & Display Functions
// ═══════════════════════════════════════════════════════════

async function render() {
    const customers = await db.customers.toArray();
    allCustomers = customers;
    
    applySort();
    
    const cur = getCurrency();
    const tbody = document.getElementById('customerTable');
    
    if (customers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 60px 20px;">
                    <div class="empty-icon"><i class="fas fa-users"></i></div>
                    <p class="empty-text" data-bn="কোন কাস্টমার নেই" data-en="No customers">কোন কাস্টমার নেই</p>
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = customers.map(c => `
            <tr class="customer-row" onclick="viewDetails('${c.id}')">
                <td style="padding: 18px 20px;">
                    <div style="display: flex; align-items: center; gap: 14px;">
                        <div class="customer-avatar">
                            ${c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h4 class="customer-name">
                                ${c.name}
                                ${c.tag ? `<span class="tag tag-${c.tag.toLowerCase()}">${c.tag}</span>` : ''}
                            </h4>
                            ${c.phone ? `<p class="customer-phone">${c.phone}</p>` : ''}
                        </div>
                    </div>
                </td>
                <td style="text-align: right; padding: 18px 20px;">
                    <div class="customer-qty">${(c.qty || 0).toLocaleString('bn-BD')}</div>
                </td>
                <td style="text-align: right; padding: 18px 20px;">
                    <div class="customer-due ${c.due > 0 ? 'customer-due-active' : ''}">${cur}${(c.due || 0).toLocaleString('bn-BD')}</div>
                </td>
            </tr>
        `).join('');
    }
    
    // Update stats
    const totalCust = customers.length;
    const totalQty = customers.reduce((sum, c) => sum + (c.qty || 0), 0);
    const totalBill = customers.reduce((sum, c) => sum + (c.bill || 0), 0);
    const totalCash = customers.reduce((sum, c) => sum + (c.cash || 0), 0);
    const totalDue = customers.reduce((sum, c) => sum + (c.due || 0), 0);
    
    document.getElementById('totalCust').textContent = totalCust.toLocaleString('bn-BD');
    document.getElementById('totalQty').textContent = totalQty.toLocaleString('bn-BD');
    document.getElementById('totalDue').textContent = `${cur}${totalDue.toLocaleString('bn-BD')}`;
    document.getElementById('totalCash').textContent = `${cur}${totalCash.toLocaleString('bn-BD')}`;
    
    applyLanguage();
}

// ═══════════════════════════════════════════════════════════
// Sorting Functions
// ═══════════════════════════════════════════════════════════

function applySort() {
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortBy = sortSelect.value;
    }
    
    if (sortBy === 'newest') {
        allCustomers.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } else if (sortBy === 'oldest') {
        allCustomers.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    } else if (sortBy === 'name') {
        allCustomers.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'dueHigh') {
        allCustomers.sort((a, b) => (b.due || 0) - (a.due || 0));
    } else if (sortBy === 'dueLow') {
        allCustomers.sort((a, b) => (a.due || 0) - (b.due || 0));
    }
}

// ═══════════════════════════════════════════════════════════
// Export Functions
// ═══════════════════════════════════════════════════════════

function toggleExportMenu() {
    const menu = document.getElementById('exportMenu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

// Close export menu when clicking outside
document.addEventListener('click', (e) => {
    const menu = document.getElementById('exportMenu');
    const btn = e.target.closest('.dropdown-wrap');
    if (menu && !menu.classList.contains('hidden') && !btn) {
        menu.classList.add('hidden');
    }
});

async function exportCSV() {
    const customers = await db.customers.toArray();
    if (customers.length === 0) {
        showToast(currentLanguage === 'bn' ? 'কোন ডাটা নেই!' : 'No data!', 'error');
        return;
    }
    
    const headers = ['Name', 'Phone', 'Quantity', 'Bill', 'Cash', 'Due', 'Tag', 'Notes'];
    const rows = customers.map(c => [
        c.name,
        c.phone || '',
        c.qty || 0,
        c.bill || 0,
        c.cash || 0,
        c.due || 0,
        c.tag || '',
        c.notes || ''
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bondhon_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast(currentLanguage === 'bn' ? 'CSV এক্সপোর্ট সফল!' : 'CSV exported!', 'success');
    toggleExportMenu();
}

async function exportJSON() {
    const customers = await db.customers.toArray();
    const bin = await db.recycleBin.toArray();
    
    if (customers.length === 0 && bin.length === 0) {
        showToast(currentLanguage === 'bn' ? 'কোন ডাটা নেই!' : 'No data!', 'error');
        return;
    }
    
    const data = { customers, bin };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bondhon_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast(currentLanguage === 'bn' ? 'JSON এক্সপোর্ট সফল!' : 'JSON exported!', 'success');
    toggleExportMenu();
}

async function printReport() {
    const customers = await db.customers.toArray();
    if (customers.length === 0) {
        showToast(currentLanguage === 'bn' ? 'কোন ডাটা নেই!' : 'No data!', 'error');
        return;
    }
    
    const cur = getCurrency();
    const totalQty = customers.reduce((sum, c) => sum + (c.qty || 0), 0);
    const totalBill = customers.reduce((sum, c) => sum + (c.bill || 0), 0);
    const totalCash = customers.reduce((sum, c) => sum + (c.cash || 0), 0);
    const totalDue = customers.reduce((sum, c) => sum + (c.due || 0), 0);
    
    const printContent = `
        <html>
        <head><title>Bondhon Report</title></head>
        <body style="font-family: Arial; padding: 20px;">
            <h1 style="text-align: center; color: #0d9488;">🌿 Bondhon Enterprise</h1>
            <h3 style="text-align: center; color: #666;">Customer Report</h3>
            <p style="text-align: center; color: #999;">Generated: ${new Date().toLocaleDateString('en-GB')}</p>
            <hr style="border: 2px solid #0d9488; margin: 20px 0;">
            
            <div style="display: flex; justify-content: space-around; margin: 30px 0;">
                <div style="text-align: center;">
                    <h4 style="color: #666;">Total Quantity</h4>
                    <p style="font-size: 24px; font-weight: bold; color: #0d9488;">${totalQty.toLocaleString()}</p>
                </div>
                <div style="text-align: center;">
                    <h4 style="color: #666;">Total Bill</h4>
                    <p style="font-size: 24px; font-weight: bold; color: #0d9488;">${cur}${totalBill.toLocaleString()}</p>
                </div>
                <div style="text-align: center;">
                    <h4 style="color: #666;">Total Paid</h4>
                    <p style="font-size: 24px; font-weight: bold; color: #059669;">${cur}${totalCash.toLocaleString()}</p>
                </div>
                <div style="text-align: center;">
                    <h4 style="color: #666;">Total Due</h4>
                    <p style="font-size: 24px; font-weight: bold; color: #dc2626;">${cur}${totalDue.toLocaleString()}</p>
                </div>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 30px;">
                <thead>
                    <tr style="background: #0d9488; color: white;">
                        <th style="padding: 12px; text-align: left;">Customer</th>
                        <th style="padding: 12px; text-align: right;">Qty</th>
                        <th style="padding: 12px; text-align: right;">Bill</th>
                        <th style="padding: 12px; text-align: right;">Paid</th>
                        <th style="padding: 12px; text-align: right;">Due</th>
                    </tr>
                </thead>
                <tbody>
                    ${customers.map((c, i) => `
                        <tr style="border-bottom: 1px solid #ddd; ${i % 2 === 0 ? 'background: #f9f9f9;' : ''}">
                            <td style="padding: 10px;">${c.name}${c.phone ? ` (${c.phone})` : ''}</td>
                            <td style="padding: 10px; text-align: right;">${(c.qty || 0).toLocaleString()}</td>
                            <td style="padding: 10px; text-align: right;">${cur}${(c.bill || 0).toLocaleString()}</td>
                            <td style="padding: 10px; text-align: right;">${cur}${(c.cash || 0).toLocaleString()}</td>
                            <td style="padding: 10px; text-align: right; font-weight: bold; color: ${c.due > 0 ? '#dc2626' : '#059669'};">${cur}${(c.due || 0).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <p style="text-align: center; margin-top: 40px; color: #999;">
                <small>Bondhon Enterprise - Credit Management System</small>
            </p>
        </body>
        </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
    
    toggleExportMenu();
}

// ═══════════════════════════════════════════════════════════
// Recycle Bin Functions
// ═══════════════════════════════════════════════════════════

async function renderBin() {
    const items = await db.recycleBin.toArray();
    const tbody = document.getElementById('binTable');
    const cur = getCurrency();
    
    if (items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; padding: 60px 20px;">
                    <div class="empty-icon"><i class="fas fa-trash"></i></div>
                    <p class="empty-text" data-bn="বিন খালি" data-en="Bin is empty">বিন খালি</p>
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = items.map(item => `
            <tr class="bin-row">
                <td style="padding: 18px 20px;">
                    <h4 style="font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">${item.name}</h4>
                    <p style="font-size: 12px; color: var(--text-secondary);">
                        ${new Date(item.deletedAt).toLocaleDateString('bn-BD')}
                    </p>
                </td>
                <td style="text-align: right; padding: 18px 20px;">
                    <button onclick="restoreItem('${item.id}')" class="btn-icon" style="background: var(--primary-ultra-light); color: var(--primary); padding: 10px 16px; border-radius: 10px; border: none; font-weight: 700; cursor: pointer;">
                        <i class="fas fa-undo"></i> ${currentLanguage === 'bn' ? 'পুনরুদ্ধার' : 'Restore'}
                    </button>
                </td>
            </tr>
        `).join('');
    }
    
    applyLanguage();
}

async function restoreItem(id) {
    const item = await db.recycleBin.get(id);
    if (!item) return;
    
    if (item.type === 'customer') {
        // Restore customer
        const { deletedAt, type, ...customer } = item;
        await db.customers.put(customer);
        await saveCustomerToFirebase(customer);
        await db.recycleBin.delete(id);
        await restoreFromBinFirebase(id);
        
        showToast(
            currentLanguage === 'bn' ? 'কাস্টমার পুনরুদ্ধার হয়েছে!' : 'Customer restored!',
            'success'
        );
    } else if (item.type === 'transaction') {
        // Restore transaction
        const { deletedAt, type, ...transaction } = item;
        await db.transactions.add(transaction);
        await saveTransactionToFirebase(transaction);
        await db.recycleBin.delete(id);
        
        showToast(
            currentLanguage === 'bn' ? 'লেনদেন পুনরুদ্ধার হয়েছে!' : 'Transaction restored!',
            'success'
        );
    }
    
    await render();
    await renderBin();
    vibrate(30);
}

// ═══════════════════════════════════════════════════════════
// Report Generation
// ═══════════════════════════════════════════════════════════

async function renderReport() {
    const customers = await db.customers.toArray();
    const container = document.getElementById('reportContent');
    const cur = getCurrency();
    
    if (customers.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div class="empty-icon"><i class="fas fa-chart-bar"></i></div>
                <p class="empty-text">No data available</p>
            </div>
        `;
        return;
    }
    
    const totalCust = customers.length;
    const totalBill = customers.reduce((sum, c) => sum + (c.bill || 0), 0);
    const totalCash = customers.reduce((sum, c) => sum + (c.cash || 0), 0);
    const totalDue = customers.reduce((sum, c) => sum + (c.due || 0), 0);
    const totalQty = customers.reduce((sum, c) => sum + (c.qty || 0), 0);
    
    const withDue = customers.filter(c => c.due > 0).sort((a, b) => b.due - a.due);
    
    // Calculate today's sales
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTransactions = await db.transactions
        .filter(t => t.timestamp >= today.getTime())
        .toArray();
    
    const todayBill = todayTransactions.reduce((sum, t) => sum + (t.bill || 0), 0);
    const todayCash = todayTransactions.reduce((sum, t) => sum + (t.cash || 0), 0);
    
    // Week trend
    const weekData = [];
    for (let i = 6; i >= 0; i--) {
        const day = new Date();
        day.setDate(day.getDate() - i);
        day.setHours(0, 0, 0, 0);
        const nextDay = new Date(day);
        nextDay.setDate(nextDay.getDate() + 1);
        
        const dayTransactions = await db.transactions
            .filter(t => t.timestamp >= day.getTime() && t.timestamp < nextDay.getTime())
            .toArray();
        
        const dayBill = dayTransactions.reduce((sum, t) => sum + (t.bill || 0), 0);
        
        weekData.push({
            label: day.toLocaleDateString('bn-BD', { weekday: 'short' }),
            bill: dayBill
        });
    }
    
    const maxDay = Math.max(...weekData.map(d => d.bill), 1);
    
    const labels = currentLanguage === 'bn'
        ? {
            todaySales: "আজকের বিক্রয়",
            paid: 'জমা',
            hasDue: 'বাকি আছে',
            people: 'জন',
            weeklyTrend: 'সাপ্তাহিক ট্রেন্ড',
            summary: 'সারসংক্ষেপ',
            totalDue: 'মোট বাকি',
            totalPaid: 'মোট জমা',
            totalQty: 'মোট সুপারি',
            pieces: 'পিস',
            dueList: 'বাকি আছে যাদের',
            noDue: 'কেউ বাকি নেই'
        }
        : {
            todaySales: "Today's Sales",
            paid: 'Paid',
            hasDue: 'Has Due',
            people: 'customers',
            weeklyTrend: 'Weekly Trend',
            summary: 'Summary',
            totalDue: 'Total Due',
            totalPaid: 'Total Paid',
            totalQty: 'Total Quantity',
            pieces: 'pcs',
            dueList: 'Customers with Due',
            noDue: 'No due amounts'
        };

    container.innerHTML = `
        <div class="grid grid-cols-2 gap-3 mb-6">
            <div class="stat-card">
                <p class="stat-label">${labels.todaySales}</p>
                <p class="text-xl font-black text-slate-800">${cur}${todayBill.toLocaleString('bn-BD')}</p>
                <p class="text-xs text-slate-400 mt-1">${labels.paid}: ${cur}${todayCash.toLocaleString('bn-BD')}</p>
            </div>
            <div class="stat-card">
                <p class="stat-label">${labels.hasDue}</p>
                <p class="text-xl font-black text-rose-600">${withDue.length} ${labels.people}</p>
            </div>
        </div>
        <div class="mb-6">
            <h4 class="text-xs font-black text-slate-500 uppercase mb-3">${labels.weeklyTrend}</h4>
            <div class="flex gap-2 items-end" style="height:80px">
                ${weekData.map(w => `
                    <div class="flex-1 flex flex-col items-center gap-1">
                        <div class="chart-bar w-full" style="min-height:40px">
                            <div class="chart-bar-fill" style="width:${(w.bill / maxDay) * 100}%"></div>
                        </div>
                        <span class="text-[10px] font-bold text-slate-500">${w.label}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="bg-slate-100/50 p-4 rounded-2xl mb-6">
            <h4 class="text-xs font-black text-slate-500 uppercase mb-3">${labels.summary}</h4>
            <p class="text-slate-700">${labels.totalDue}: <strong>${cur}${totalDue.toLocaleString('bn-BD')}</strong></p>
            <p class="text-slate-700">${labels.totalPaid}: <strong>${cur}${totalCash.toLocaleString('bn-BD')}</strong></p>
            <p class="text-slate-700">${labels.totalQty}: <strong>${totalQty.toLocaleString('bn-BD')} ${labels.pieces}</strong></p>
        </div>
        <div>
            <h4 class="text-xs font-black text-slate-500 uppercase mb-3">${labels.dueList}</h4>
            ${withDue.length === 0 ? `<p class="text-slate-400 py-6 text-center">${labels.noDue}</p>` :
        withDue.slice(0, 15).map(c => `
                <div class="flex justify-between items-center p-3 bg-white rounded-xl mb-2 border border-slate-100">
                    <span class="font-bold text-slate-700">${c.name}</span>
                    <span class="font-black text-rose-500">${cur}${c.due.toLocaleString('bn-BD')}</span>
                </div>
            `).join('')}
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════
// Settings
// ═══════════════════════════════════════════════════════════

function loadSettingsUI() {
    const s = getSettings();
    document.getElementById('currencySymbol').value = s.currency || '৳';
    updateThemeToggleUI();
}

function saveSettings() {
    const cur = document.getElementById('currencySymbol').value.trim() || '৳';
    const s = getSettings();
    s.currency = cur;
    saveSettingsObj(s);
    showToast(
        currentLanguage === 'bn' ? "সেটিংস সেভ হয়েছে!" : "Settings saved!",
        'success'
    );
    closeModal('settingsModal');
    render();
}

async function handleImport(e) {
    const f = e.target.files[0];
    if (!f) return;
    
    try {
        const text = await f.text();
        const data = JSON.parse(text);
        
        if (data.customers && Array.isArray(data.customers)) {
            await db.customers.clear();
            await db.customers.bulkPut(data.customers);
            
            // Sync to Firebase
            for (const customer of data.customers) {
                await saveCustomerToFirebase(customer);
            }
            
            if (data.bin && Array.isArray(data.bin)) {
                await db.recycleBin.clear();
                await db.recycleBin.bulkPut(data.bin);
            }
            
            showToast(
                currentLanguage === 'bn' ? "ডাটা ইম্পোর্ট সফল!" : "Data imported successfully!",
                'success'
            );
            render();
            
            if (!document.getElementById('binModal').classList.contains('hidden')) renderBin();
        } else {
            showToast(
                currentLanguage === 'bn' ? "ভুল ফরম্যাট!" : "Invalid format!",
                "error"
            );
        }
    } catch (err) {
        console.error("Import error:", err);
        showToast(
            currentLanguage === 'bn' ? "ইম্পোর্টে ত্রুটি!" : "Import error!",
            "error"
        );
    }
    e.target.value = '';
}

// ═══════════════════════════════════════════════════════════
// Search & Filter
// ═══════════════════════════════════════════════════════════

function filterTable() {
    const q = document.getElementById('search').value.toLowerCase();
    document.querySelectorAll('#customerTable tr').forEach(r => {
        if (r.querySelector('.empty-icon')) return;
        r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
}

// ═══════════════════════════════════════════════════════════
// Voice Input
// ═══════════════════════════════════════════════════════════

function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showToast(
            currentLanguage === 'bn' ? "ভয়েস সাপোর্ট করে না" : "Voice not supported",
            "error"
        );
        return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.lang = currentLanguage === 'bn' ? 'bn-BD' : 'en-US';
    
    recognition.onstart = () => {
        vibrate(20);
        document.getElementById('search').placeholder = currentLanguage === 'bn' 
            ? "বলুন, শুনছি..." 
            : "Listening...";
    };
    
    recognition.onresult = (e) => {
        document.getElementById('search').value = e.results[0][0].transcript;
        filterTable();
        document.getElementById('search').placeholder = currentLanguage === 'bn' 
            ? "কাস্টমার খুঁজুন..." 
            : "Search customers...";
    };
    
    recognition.onerror = () => {
        document.getElementById('search').placeholder = currentLanguage === 'bn' 
            ? "কাস্টমার খুঁজুন..." 
            : "Search customers...";
    };
    
    recognition.start();
}

// ═══════════════════════════════════════════════════════════
// Online/Offline Status Management
// ═══════════════════════════════════════════════════════════

function updateOnlineStatus() {
    isOnline = navigator.onLine;
    const statusBadge = document.getElementById('statusBadge');
    
    if (isOnline) {
        if (statusBadge) {
            statusBadge.className = 'status-badge status-online';
            statusBadge.innerHTML = '<span class="status-dot"></span> <span data-bn="Online" data-en="Online">Online</span>';
        }
        // Process sync queue when coming online
        processSyncQueue();
    } else {
        if (statusBadge) {
            statusBadge.className = 'status-badge status-offline';
            statusBadge.innerHTML = '<span class="status-dot"></span> <span data-bn="Offline" data-en="Offline">Offline</span>';
        }
    }
    
    applyLanguage();
}

// Listen for online/offline events
window.addEventListener('online', () => {
    isOnline = true;
    updateOnlineStatus();
    showToast(
        currentLanguage === 'bn' ? '✓ অনলাইন - সিঙ্ক শুরু হচ্ছে...' : '✓ Online - Starting sync...',
        'success'
    );
});

window.addEventListener('offline', () => {
    isOnline = false;
    updateOnlineStatus();
    showToast(
        currentLanguage === 'bn' ? '⚠ অফলাইন মোড' : '⚠ Offline mode',
        'error'
    );
});

// ═══════════════════════════════════════════════════════════
// Data Migration (for existing users)
// ═══════════════════════════════════════════════════════════

async function migrateData() {
    // Check if we need to upgrade the database for transactions
    const version = await db.verno;
    console.log('Database version:', version);
    
    // Migrate existing customers to Firebase if not already synced
    const customers = await db.customers.toArray();
    if (customers.length > 0 && window.firebaseDb) {
        console.log('Checking for migration...');
        // This will be handled by the sync queue on first load
    }
}

// ═══════════════════════════════════════════════════════════
// Input Auto-Scroll
// ═══════════════════════════════════════════════════════════

function setupInputScroll() {
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('focus', () => {
            setTimeout(() => input.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
        });
    });
}

function scrollTopSmooth() {
    window.scrollTo({top: 0, behavior: 'smooth'});
}

// ═══════════════════════════════════════════════════════════
// Initialization
// ═══════════════════════════════════════════════════════════

window.onload = async function () {
    console.log('🚀 Bondhon Enterprise Loading...');
    
    // Migrate data if needed
    await migrateData();
    
    // Load settings
    const settings = getSettings();
    currentLanguage = settings.language || 'bn';
    
    // Apply theme and language
    applyTheme(settings.theme);
    updateThemeToggleUI();
    applyLanguage();
    
    // Render data
    await render();
    updateOnlineStatus();
    setupInputScroll();
    
    // Initialize Firebase real-time sync
    // Wait for Firebase to be available
    const waitForFirebase = setInterval(() => {
        if (window.firebaseDb) {
            clearInterval(waitForFirebase);
            initFirebaseSync();
            
            // Process any queued items
            processSyncQueue();
        }
    }, 100);
    
    // Timeout after 5 seconds
    setTimeout(() => {
        clearInterval(waitForFirebase);
        if (!window.firebaseDb) {
            console.warn('⚠ Firebase not initialized - running in offline mode');
            showToast(
                currentLanguage === 'bn' 
                    ? '⚠ অফলাইন মোড - ডাটা শুধুমাত্র লোকাল ডিভাইসে সেভ হবে' 
                    : '⚠ Offline mode - Data saved locally only',
                'error'
            );
        }
    }, 5000);
    
    // Update sync status periodically
    setInterval(updateSyncStatus, 5000);
    
    console.log('✓ Bondhon Enterprise Ready!');
};

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    // Nothing to clean up
});
