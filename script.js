const SHEET_URL = "https://script.google.com/macros/s/AKfycbwCLJTE0243PM8WYJym0N35aAYbss4-yMBsB4eooHcE5p7cmr55vgZT6MONLtePMRsKbA/exec";

const db = new Dexie("BondhonDB");
db.version(1).stores({
    customers: 'id, name, phone',
    recycleBin: 'id, name',
    syncQueue: '++id, action'
});

let currentId = null;
let editMode = false;
let deleteTargetId = null;
let deleteType = null;
let sortBy = 'newest';
let allCustomers = [];
let currentLanguage = 'bn';

const defaultSettings = { theme: 'light', currency: '৳', language: 'bn' };

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
        // Click handler: clear notifications and show sync status
        notifBtn.addEventListener('click', async () => {
            updateNotificationBadge(0);
            
            // Show sync status
            const syncStatus = await getSyncStatus();
            
            let statusMessage = '';
            if (syncStatus.queueSize === 0) {
                statusMessage = currentLanguage === 'bn' 
                    ? '✓ সব ডাটা সিঙ্ক হয়ে গেছে' 
                    : '✓ All data synced';
            } else if (!syncStatus.isOnline) {
                statusMessage = currentLanguage === 'bn' 
                    ? `⚠ অফলাইন: ${syncStatus.queueSize} টি ডাটা সিঙ্ক অপেক্ষায়` 
                    : `⚠ Offline: ${syncStatus.queueSize} items waiting`;
            } else {
                statusMessage = currentLanguage === 'bn' 
                    ? `⏳ ${syncStatus.queueSize} টি ডাটা সিঙ্ক হচ্ছে...` 
                    : `⏳ ${syncStatus.queueSize} items syncing...`;
                
                // Trigger manual sync
                manualSync();
            }
            
            showToast(statusMessage, syncStatus.queueSize === 0 ? 'success' : 'error');
        });
    }
});

// ═══════════════════════════════════════════════════════════
// Modal Management with Smart Closure
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

function vibrate(time = 50) {
    if (navigator.vibrate) navigator.vibrate(time);
}

// ═══════════════════════════════════════════════════════════
// Online/Offline Status with Visual Feedback
// ═══════════════════════════════════════════════════════════

function updateOnlineStatus() {
    const badge = document.getElementById('statusBadge');
    if (!badge) return;
    
    if (navigator.onLine) {
        badge.innerHTML = `<span class="status-dot"></span> <span data-bn="Online" data-en="Online">${currentLanguage === 'bn' ? 'Online' : 'Online'}</span>`;
        badge.className = 'status-badge status-online';
        processQueue();
    } else {
        badge.innerHTML = `<span class="status-dot"></span> <span data-bn="Offline" data-en="Offline">${currentLanguage === 'bn' ? 'Offline' : 'Offline'}</span>`;
        badge.className = 'status-badge status-offline';
    }
}

window.addEventListener('online', () => {
    updateOnlineStatus();
    showToast(
        currentLanguage === 'bn' ? 'ইন্টারনেট সংযুক্ত হয়েছে' : 'Back online',
        'success'
    );
});

window.addEventListener('offline', () => {
    updateOnlineStatus();
    showToast(
        currentLanguage === 'bn' ? 'অফলাইন মোডে চলছে' : 'Working offline',
        'error'
    );
});

// ═══════════════════════════════════════════════════════════
// Data Migration
// ═══════════════════════════════════════════════════════════

async function migrateData() {
    const oldData = JSON.parse(localStorage.getItem('supari_v4_data')) || [];
    const oldBin = JSON.parse(localStorage.getItem('supari_v4_bin')) || [];
    
    if (oldData.length > 0) {
        await db.customers.bulkPut(oldData);
        localStorage.removeItem('supari_v4_data');
    }
    if (oldBin.length > 0) {
        await db.recycleBin.bulkPut(oldBin);
        localStorage.removeItem('supari_v4_bin');
    }
    
    localStorage.removeItem('supari_data');
    localStorage.removeItem('customers');
}

// ═══════════════════════════════════════════════════════════
// Sorting
// ═══════════════════════════════════════════════════════════

function applySort() {
    sortBy = document.getElementById('sortSelect')?.value || 'newest';
    render();
}

// ═══════════════════════════════════════════════════════════
// Tag Badge
// ═══════════════════════════════════════════════════════════

function getTagBadge(tag) {
    if (!tag) return '';
    const cls = tag === 'VIP' ? 'tag-vip' : tag === 'Regular' ? 'tag-regular' : 'tag-new';
    return `<span class="tag ${cls}">${tag}</span>`;
}

// ═══════════════════════════════════════════════════════════
// Render Customer List
// ═══════════════════════════════════════════════════════════

async function render() {
    const tbody = document.getElementById('customerTable');
    if (!tbody) return;

    let customers = await db.customers.toArray();
    allCustomers = [...customers];

    // Apply sorting
    if (sortBy === 'newest') customers.sort((a, b) => (b.id || 0) - (a.id || 0));
    else if (sortBy === 'oldest') customers.sort((a, b) => (a.id || 0) - (b.id || 0));
    else if (sortBy === 'name') customers.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'bn'));
    else if (sortBy === 'dueHigh') {
        customers.sort((a, b) => {
            const dA = (a.history || []).reduce((s, h) => s + (parseFloat(h.bill) || 0) - (parseFloat(h.cash) || 0), 0);
            const dB = (b.history || []).reduce((s, h) => s + (parseFloat(h.bill) || 0) - (parseFloat(h.cash) || 0), 0);
            return dB - dA;
        });
    } else if (sortBy === 'dueLow') {
        customers.sort((a, b) => {
            const dA = (a.history || []).reduce((s, h) => s + (parseFloat(h.bill) || 0) - (parseFloat(h.cash) || 0), 0);
            const dB = (b.history || []).reduce((s, h) => s + (parseFloat(h.bill) || 0) - (parseFloat(h.cash) || 0), 0);
            return dA - dB;
        });
    }

    tbody.innerHTML = '';
    let gDue = 0, gCash = 0, gQty = 0;
    const cur = getCurrency();

    if (customers.length === 0) {
        const emptyText = currentLanguage === 'bn' 
            ? { title: 'কোন কাস্টমার নেই', subtitle: 'নতুন কাস্টমার যোগ করতে + বাটনে ক্লিক করুন' }
            : { title: 'No customers', subtitle: 'Click + button to add new customer' };
        
        tbody.innerHTML = `
            <tr style="display:block;padding:48px 24px;text-align:center">
                <td colspan="3" style="display:block">
                    <div class="empty-icon"><i class="fas fa-users-slash"></i></div>
                    <p class="empty-text">${emptyText.title}</p>
                    <p class="empty-text" style="font-size:13px;margin-top:8px">${emptyText.subtitle}</p>
                </td>
            </tr>`;
    }

    customers.forEach((cust, i) => {
        let bill = 0, cash = 0, qty = 0;
        (cust.history || []).forEach(h => {
            bill += (parseFloat(h.bill) || 0);
            cash += (parseFloat(h.cash) || 0);
            qty += (parseInt(h.qty) || 0);
        });
        const due = bill - cash;
        gDue += due; gCash += cash; gQty += qty;

        const phoneNum = cust.phone && cust.phone !== 'N/A' ? cust.phone.replace(/\D/g, '') : '';
        const callBtn = phoneNum ? `<a href="tel:${phoneNum}" onclick="event.stopPropagation()" class="action-btn mr-1" title="${currentLanguage === 'bn' ? 'কল করুন' : 'Call'}"><i class="fas fa-phone-alt text-green-600"></i></a>` : '';

        const tr = document.createElement('tr');
        tr.className = 'customer-row';
        tr.style.animationDelay = `${i * 0.03}s`;
        tr.innerHTML = `
            <td style="flex:1;min-width:0" onclick="viewDetails(${cust.id})">
                <div class="font-bold text-slate-800" style="font-size:15px">${cust.name}${getTagBadge(cust.tag)}</div>
                <div class="text-slate-400 text-xs flex items-center gap-1 mt-0.5">
                    <i class="fas fa-phone-alt" style="font-size:9px"></i> ${cust.phone || 'N/A'}
                </div>
            </td>
            <td style="padding:0 12px;text-align:center" onclick="viewDetails(${cust.id})">
                <span class="font-black ${due > 0 ? 'text-rose-500' : 'text-emerald-500'}" style="font-size:15px">${cur}${due.toLocaleString('bn-BD')}</span>
            </td>
            <td style="display:flex;gap:4px;flex-shrink:0">
                ${callBtn}
                <button onclick="event.stopPropagation(); openEditCustomer(${cust.id})" class="action-btn" title="${currentLanguage === 'bn' ? 'এডিট' : 'Edit'}"><i class="fas fa-edit text-blue-500"></i></button>
                <button onclick="event.stopPropagation(); softDeleteCustomer(${cust.id})" class="action-btn" title="${currentLanguage === 'bn' ? 'ডিলিট' : 'Delete'}"><i class="fas fa-trash-alt text-rose-500"></i></button>
            </td>`;
        tbody.appendChild(tr);
    });

    document.getElementById('totalCust').innerText = customers.length.toLocaleString('bn-BD');
    document.getElementById('totalDue').innerText = cur + gDue.toLocaleString('bn-BD');
    document.getElementById('totalCash').innerText = cur + gCash.toLocaleString('bn-BD');
    document.getElementById('totalQty').innerText = gQty.toLocaleString('bn-BD');
}

// ═══════════════════════════════════════════════════════════
// Save Customer
// ═══════════════════════════════════════════════════════════

async function saveCustomer() {
    const nameInput = document.getElementById('name');
    const phoneInput = document.getElementById('phone');
    const notesInput = document.getElementById('custNotes');
    const tagInput = document.getElementById('custTag');
    
    const name = nameInput.value.trim();
    const phone = (phoneInput.value.trim() || 'N/A').replace(/\D/g, '').slice(0, 11) || 'N/A';
    const notes = (notesInput && notesInput.value.trim()) || '';
    const tag = (tagInput && tagInput.value) || '';

    if (!name) {
        vibrate(100);
        showToast(
            currentLanguage === 'bn' ? "কাস্টমারের নাম লিখুন!" : "Enter customer name!",
            "error"
        );
        return;
    }

    if (editMode && currentId) {
        const cust = await db.customers.get(currentId);
        if (cust) {
            cust.name = name;
            cust.phone = phone;
            cust.notes = notes;
            cust.tag = tag;
            cust.updatedAt = new Date().toISOString();
            await db.customers.put(cust);
            syncToSheet({ action: 'update_customer', id: currentId, name, phone, notes, tag });
            showToast(currentLanguage === 'bn' ? "কাস্টমার আপডেট হয়েছে!" : "Customer updated!");
        }
    } else {
        const newCust = {
            id: Date.now(),
            name,
            phone,
            notes,
            tag,
            history: [],
            createdAt: new Date().toISOString()
        };
        await db.customers.add(newCust);
        syncToSheet({ action: 'add_customer', id: newCust.id, name, phone, qty: 0, bill: 0, cash: 0, due: 0 });
        showToast(currentLanguage === 'bn' ? "কাস্টমার যোগ হয়েছে!" : "Customer added!");
        
        triggerNotification(
            currentLanguage === 'bn' ? `নতুন কাস্টমার: ${name}` : `New customer: ${name}`
        );
    }

    closeModal('customerModal');
    editMode = false;
    currentId = null;
    render();
    vibrate(30);

    nameInput.value = '';
    phoneInput.value = '';
    if (notesInput) notesInput.value = '';
    if (tagInput) tagInput.value = '';
}

// ═══════════════════════════════════════════════════════════
// Edit Customer
// ═══════════════════════════════════════════════════════════

async function openEditCustomer(id) {
    const cust = await db.customers.get(id);
    if (!cust) return;
    
    editMode = true;
    currentId = id;
    
    const titleText = currentLanguage === 'bn' ? 'কাস্টমার এডিট' : 'Edit Customer';
    document.getElementById('customerModalTitle').textContent = titleText;
    document.getElementById('customerModalTitle').setAttribute('data-bn', 'কাস্টমার এডিট');
    document.getElementById('customerModalTitle').setAttribute('data-en', 'Edit Customer');
    
    document.getElementById('name').value = cust.name || '';
    document.getElementById('phone').value = cust.phone && cust.phone !== 'N/A' ? cust.phone : '';
    document.getElementById('custNotes').value = cust.notes || '';
    
    const tagEl = document.getElementById('custTag');
    if (tagEl) tagEl.value = cust.tag || '';
    
    openModal('customerModal');
}

function openAddCustomer() {
    editMode = false;
    currentId = null;
    
    const titleText = currentLanguage === 'bn' ? 'নতুন কাস্টমার' : 'New Customer';
    document.getElementById('customerModalTitle').textContent = titleText;
    document.getElementById('customerModalTitle').setAttribute('data-bn', 'নতুন কাস্টমার');
    document.getElementById('customerModalTitle').setAttribute('data-en', 'New Customer');
    
    document.getElementById('name').value = '';
    document.getElementById('phone').value = '';
    
    const n = document.getElementById('custNotes');
    if (n) n.value = '';
    
    const t = document.getElementById('custTag');
    if (t) t.value = '';
    
    openModal('customerModal');
}

// ═══════════════════════════════════════════════════════════
// Professional Invoice Generation
// ═══════════════════════════════════════════════════════════

function generateProfessionalInvoice(cust, tr) {
    const cur = getCurrency();
    const d = new Date(tr.date);
    const dateStr = d.toLocaleDateString(currentLanguage === 'bn' ? 'bn-BD' : 'en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Invoice - ${cust.name}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'DM Sans', sans-serif;
            padding: 40px;
            background: #f8fafc;
            color: #0f172a;
        }
        .invoice {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 60px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.1);
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 50px;
            padding-bottom: 30px;
            border-bottom: 3px solid #0d9488;
        }
        .company {
            flex: 1;
        }
        .company h1 {
            font-size: 32px;
            font-weight: 900;
            color: #0d9488;
            margin-bottom: 8px;
            letter-spacing: -0.02em;
        }
        .company p {
            color: #64748b;
            font-size: 14px;
            font-weight: 500;
        }
        .invoice-meta {
            text-align: right;
        }
        .invoice-meta h2 {
            font-size: 42px;
            font-weight: 900;
            color: #0f172a;
            margin-bottom: 12px;
            letter-spacing: -0.03em;
        }
        .invoice-meta p {
            color: #64748b;
            font-size: 14px;
            margin: 4px 0;
        }
        .info-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-bottom: 40px;
        }
        .info-block h3 {
            font-size: 12px;
            font-weight: 800;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin-bottom: 12px;
        }
        .info-block p {
            font-size: 16px;
            font-weight: 600;
            color: #1e293b;
            margin: 6px 0;
        }
        .items-table {
            width: 100%;
            margin: 40px 0;
            border-collapse: collapse;
        }
        .items-table thead {
            background: linear-gradient(135deg, #0d9488, #0f766e);
        }
        .items-table th {
            padding: 16px 20px;
            text-align: left;
            font-size: 12px;
            font-weight: 800;
            color: white;
            text-transform: uppercase;
            letter-spacing: 0.6px;
        }
        .items-table td {
            padding: 20px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 15px;
            font-weight: 500;
            color: #334155;
        }
        .items-table tbody tr:hover {
            background: #f8fafc;
        }
        .totals {
            margin-top: 40px;
            text-align: right;
        }
        .total-row {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            margin: 12px 0;
            font-size: 16px;
        }
        .total-row label {
            margin-right: 40px;
            color: #64748b;
            font-weight: 600;
            min-width: 150px;
            text-align: right;
        }
        .total-row .value {
            font-weight: 700;
            color: #1e293b;
            min-width: 150px;
            text-align: right;
        }
        .grand-total {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 3px solid #0d9488;
        }
        .grand-total label {
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
        }
        .grand-total .value {
            font-size: 28px;
            font-weight: 900;
            color: #0d9488;
        }
        .footer {
            margin-top: 60px;
            padding-top: 30px;
            border-top: 2px solid #e2e8f0;
            text-align: center;
            color: #94a3b8;
            font-size: 13px;
        }
        .thank-you {
            font-size: 20px;
            font-weight: 700;
            color: #0d9488;
            margin-bottom: 16px;
        }
        @media print {
            body { background: white; padding: 0; }
            .invoice { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="invoice">
        <div class="header">
            <div class="company">
                <h1>${currentLanguage === 'bn' ? 'বন্ধন এন্টারপ্রাইজ' : 'Bondhon Enterprise'}</h1>
                <p>${currentLanguage === 'bn' ? 'ক্রেডিট ম্যানেজমেন্ট সিস্টেম' : 'Credit Management System'}</p>
            </div>
            <div class="invoice-meta">
                <h2>${currentLanguage === 'bn' ? 'রসিদ' : 'INVOICE'}</h2>
                <p><strong>${currentLanguage === 'bn' ? 'নম্বর:' : 'No:'}</strong> #${tr.id}</p>
                <p><strong>${currentLanguage === 'bn' ? 'তারিখ:' : 'Date:'}</strong> ${dateStr}</p>
            </div>
        </div>
        
        <div class="info-section">
            <div class="info-block">
                <h3>${currentLanguage === 'bn' ? 'কাস্টমার তথ্য' : 'Customer Information'}</h3>
                <p><strong>${cust.name}</strong></p>
                <p>${cust.phone}</p>
                ${cust.notes ? `<p style="font-size:14px;color:#64748b;margin-top:8px;">${cust.notes}</p>` : ''}
            </div>
            <div class="info-block">
                <h3>${currentLanguage === 'bn' ? 'লেনদেন বিবরণ' : 'Transaction Details'}</h3>
                <p><strong>${currentLanguage === 'bn' ? 'লেনদেন ID:' : 'Transaction ID:'}</strong> ${tr.id}</p>
                <p><strong>${currentLanguage === 'bn' ? 'তারিখ:' : 'Date:'}</strong> ${dateStr}</p>
            </div>
        </div>
        
        <table class="items-table">
            <thead>
                <tr>
                    <th>${currentLanguage === 'bn' ? 'বিবরণ' : 'Description'}</th>
                    <th style="text-align:center">${currentLanguage === 'bn' ? 'পরিমাণ' : 'Quantity'}</th>
                    <th style="text-align:right">${currentLanguage === 'bn' ? 'মূল্য' : 'Amount'}</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>${currentLanguage === 'bn' ? 'সুপারি' : 'Products'}</td>
                    <td style="text-align:center">${(tr.qty || 0).toLocaleString(currentLanguage === 'bn' ? 'bn-BD' : 'en-US')} ${currentLanguage === 'bn' ? 'পিস' : 'pcs'}</td>
                    <td style="text-align:right">${cur}${(tr.bill || 0).toLocaleString(currentLanguage === 'bn' ? 'bn-BD' : 'en-US')}</td>
                </tr>
            </tbody>
        </table>
        
        <div class="totals">
            <div class="total-row">
                <label>${currentLanguage === 'bn' ? 'মোট বিল:' : 'Total Bill:'}</label>
                <div class="value">${cur}${(tr.bill || 0).toLocaleString(currentLanguage === 'bn' ? 'bn-BD' : 'en-US')}</div>
            </div>
            <div class="total-row">
                <label>${currentLanguage === 'bn' ? 'নগদ জমা:' : 'Cash Paid:'}</label>
                <div class="value" style="color:#059669">${cur}${(tr.cash || 0).toLocaleString(currentLanguage === 'bn' ? 'bn-BD' : 'en-US')}</div>
            </div>
            <div class="total-row grand-total">
                <label>${currentLanguage === 'bn' ? 'বাকি পরিমাণ:' : 'Due Amount:'}</label>
                <div class="value">${cur}${(tr.due || 0).toLocaleString(currentLanguage === 'bn' ? 'bn-BD' : 'en-US')}</div>
            </div>
        </div>
        
        <div class="footer">
            <p class="thank-you">${currentLanguage === 'bn' ? 'ধন্যবাদ!' : 'Thank You!'}</p>
            <p>${currentLanguage === 'bn' ? 'আপনার ব্যবসার জন্য আমরা কৃতজ্ঞ' : 'We appreciate your business'}</p>
        </div>
    </div>
</body>
</html>
    `.trim();
}

// ═══════════════════════════════════════════════════════════
// View Customer Details
// ═══════════════════════════════════════════════════════════

async function viewDetails(id) {
    currentId = id;
    const cust = await db.customers.get(id);
    if (!cust) return;

    let tBill = 0, tCash = 0, tQty = 0;
    (cust.history || []).forEach(h => {
        tBill += (parseFloat(h.bill) || 0);
        tCash += (parseFloat(h.cash) || 0);
        tQty += (parseInt(h.qty) || 0);
    });
    const due = tBill - tCash;
    const cur = getCurrency();

    const labels = currentLanguage === 'bn' 
        ? {
            totalDue: 'মোট বাকি',
            newTransaction: 'নতুন লেনদেন',
            quantity: 'সুপারি (পিস)',
            totalBill: 'মোট বিল',
            cashPaid: 'নগদ জমা',
            printReceipt: 'রিসিপ্ট প্রিন্ট',
            save: 'সেভ করুন',
            history: 'লেনদেন ইতিহাস',
            noHistory: 'কোন ইতিহাস নেই',
            pieces: 'পিস',
            paid: 'জমা',
            close: 'বন্ধ করুন'
        }
        : {
            totalDue: 'Total Due',
            newTransaction: 'New Transaction',
            quantity: 'Quantity (pcs)',
            totalBill: 'Total Bill',
            cashPaid: 'Cash Paid',
            printReceipt: 'Print Receipt',
            save: 'Save',
            history: 'Transaction History',
            noHistory: 'No history',
            pieces: 'pcs',
            paid: 'Paid',
            close: 'Close'
        };

    const modal = document.getElementById('detailModal');
    modal.innerHTML = `
        <div class="modal-backdrop" onclick="closeModal('detailModal')"></div>
        <div class="modal-sheet" style="max-height:94vh">
            <div class="modal-handle"></div>
            <div class="flex justify-between items-start mb-6">
                <div>
                    <h2 class="text-2xl font-black text-slate-800">${cust.name}${getTagBadge(cust.tag)}</h2>
                    <a href="tel:${(cust.phone || '').replace(/\D/g, '')}" onclick="event.stopPropagation()" class="text-slate-500 text-sm font-bold flex items-center gap-2 mt-1">
                        <i class="fas fa-phone-alt"></i> ${cust.phone}
                    </a>
                    ${cust.notes ? `<p class="text-slate-400 text-xs mt-2">${cust.notes}</p>` : ''}
                </div>
                <div class="flex gap-2">
                    <button onclick="event.stopPropagation(); openEditCustomer(${cust.id}); closeModal('detailModal');" class="action-btn"><i class="fas fa-edit text-blue-500"></i></button>
                    <div class="text-right">
                        <p class="text-[10px] font-black text-rose-400 uppercase">${labels.totalDue}</p>
                        <p class="text-xl font-black text-rose-500">${cur}${due.toLocaleString('bn-BD')}</p>
                    </div>
                </div>
            </div>
            <div class="overflow-y-auto flex-1 space-y-4 pr-2">
                <div class="bg-slate-100/50 p-6 rounded-2xl space-y-3">
                    <p class="text-[10px] font-black text-slate-400 uppercase ml-1">${labels.newTransaction}</p>
                    <input type="number" id="trQty" inputmode="numeric" placeholder="${labels.quantity}" class="input-field">
                    <div class="grid grid-cols-2 gap-3">
                        <input type="number" id="trBill" inputmode="numeric" placeholder="${labels.totalBill}" class="input-field">
                        <input type="number" id="trCash" inputmode="numeric" placeholder="${labels.cashPaid}" class="input-field bg-emerald-50 border-emerald-200">
                    </div>
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" id="genReceipt" class="rounded">
                        <span class="text-sm font-bold text-slate-600">${labels.printReceipt}</span>
                    </label>
                    <button onclick="addTransaction()" class="btn-primary w-full">${labels.save}</button>
                </div>
                <div class="space-y-3">
                    <h4 class="text-xs font-black text-slate-400 uppercase ml-2">${labels.history}</h4>
                    ${(cust.history || []).length === 0 ? `<p class="text-center text-slate-300 py-10 italic">${labels.noHistory}</p>` :
        (cust.history || []).slice().reverse().map(h => `
                        <div class="bg-white p-4 rounded-2xl flex justify-between items-center border border-slate-100">
                            <div>
                                <p class="text-sm font-bold text-slate-700">${new Date(h.date).toLocaleDateString(currentLanguage === 'bn' ? 'bn-BD' : 'en-US')}</p>
                                <p class="text-[10px] text-slate-400">${h.qty || 0} ${labels.pieces}</p>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="text-right">
                                    <p class="font-black text-sm ${h.due > 0 ? 'text-rose-500' : 'text-emerald-500'}">${cur}${h.due.toLocaleString('bn-BD')}</p>
                                    <p class="text-[8px] text-slate-400">${labels.paid}: ${cur}${h.cash.toLocaleString('bn-BD')}</p>
                                </div>
                                <button onclick="printReceipt(${cust.id},${h.id})" class="action-btn" title="Receipt"><i class="fas fa-receipt text-slate-500"></i></button>
                                <button onclick="deleteTr(${h.id})" class="action-btn"><i class="fas fa-trash-alt text-rose-400"></i></button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="pt-4">
                <button onclick="closeModal('detailModal')" class="btn-secondary w-full">${labels.close}</button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('modal-visible'), 10);
    setupInputScroll();
}

// ═══════════════════════════════════════════════════════════
// Print Professional Receipt
// ═══════════════════════════════════════════════════════════

async function printReceipt(custId, trId) {
    const cust = await db.customers.get(custId);
    if (!cust) return;
    
    const tr = (cust.history || []).find(h => h.id === trId);
    if (!tr) return;
    
    const invoice = generateProfessionalInvoice(cust, tr);
    const w = window.open('', '_blank');
    w.document.write(invoice);
    w.document.close();
    
    setTimeout(() => {
        w.print();
    }, 500);
    
    showToast(
        currentLanguage === 'bn' ? "রিসিপ্ট প্রিন্ট করছেন..." : "Printing receipt...",
        'success'
    );
}

// ═══════════════════════════════════════════════════════════
// Add Transaction
// ═══════════════════════════════════════════════════════════

async function addTransaction() {
    const qtyInput = document.getElementById('trQty');
    const billInput = document.getElementById('trBill');
    const cashInput = document.getElementById('trCash');
    const genReceipt = document.getElementById('genReceipt');

    const qty = parseInt(qtyInput.value) || 0;
    const bill = parseFloat(billInput.value) || 0;
    const cash = parseFloat(cashInput.value) || 0;

    if (bill === 0 && cash === 0) {
        vibrate(100);
        showToast(
            currentLanguage === 'bn' ? "বিল অথবা নগদ জমার পরিমাণ লিখুন!" : "Enter bill or cash amount!",
            "error"
        );
        return;
    }

    const cust = await db.customers.get(currentId);
    if (!cust) return;

    const newTr = {
        id: Date.now(),
        date: new Date().toISOString(),
        qty,
        bill,
        cash,
        due: bill - cash
    };

    cust.history = cust.history || [];
    cust.history.push(newTr);
    await db.customers.put(cust);

    if (genReceipt && genReceipt.checked) {
        const invoice = generateProfessionalInvoice(cust, newTr);
        const w = window.open('', '_blank');
        w.document.write(invoice);
        w.document.close();
        setTimeout(() => w.print(), 500);
    }

    viewDetails(currentId);
    render();
    vibrate(30);
    showToast(
        currentLanguage === 'bn' ? "লেনদেন যোগ হয়েছে!" : "Transaction added!",
        'success'
    );

    syncToSheet({ action: 'add_transaction', customerId: currentId, ...newTr });

    qtyInput.value = '';
    billInput.value = '';
    cashInput.value = '';
}

// ═══════════════════════════════════════════════════════════
// Robust Sync System with Auto-Sync, Offline-First & Polling
// ═══════════════════════════════════════════════════════════

let syncInterval = null;
let isSyncing = false;
const SYNC_POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Initialize sync interval on page load
function initSyncSystem() {
    // Start background polling
    startSyncPolling();
    
    // Sync immediately if online
    if (navigator.onLine) {
        processQueue();
    }
    
    // Listen for online event to trigger sync
    window.addEventListener('online', () => {
        console.log('Connection restored - triggering sync');
        processQueue();
    });
}

// Start background sync polling (every 5 minutes)
function startSyncPolling() {
    if (syncInterval) {
        clearInterval(syncInterval);
    }
    
    syncInterval = setInterval(async () => {
        if (navigator.onLine) {
            const queueSize = await db.syncQueue.count();
            if (queueSize > 0) {
                console.log(`Background sync: ${queueSize} items in queue`);
                processQueue();
            }
        }
    }, SYNC_POLL_INTERVAL);
}

// Stop sync polling (useful for cleanup)
function stopSyncPolling() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
}

// Show syncing indicator on notification bell
function showSyncingIndicator() {
    const notifBtn = document.getElementById('notificationBtn');
    if (!notifBtn) return;
    
    // Add spinning animation class
    notifBtn.classList.add('syncing');
    notifBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i><span id="notificationBadge" class="notification-badge hidden">0</span>';
}

// Hide syncing indicator
function hideSyncingIndicator() {
    const notifBtn = document.getElementById('notificationBtn');
    if (!notifBtn) return;
    
    // Remove spinning animation
    notifBtn.classList.remove('syncing');
    notifBtn.innerHTML = '<i class="fas fa-bell"></i><span id="notificationBadge" class="notification-badge hidden">0</span>';
    
    // Restore notification badge if any
    const currentCount = parseInt(localStorage.getItem('notificationCount') || '0');
    updateNotificationBadge(currentCount);
}

// Add to sync queue (auto-triggered after every operation)
async function syncToSheet(data) {
    try {
        // Add timestamp to track when data was queued
        data.queuedAt = new Date().toISOString();
        
        await db.syncQueue.add(data);
        console.log('Added to sync queue:', data.action);
        
        // Immediately attempt to sync if online
        if (navigator.onLine) {
            processQueue();
        } else {
            const queueSize = await db.syncQueue.count();
            console.log(`Offline: ${queueSize} items waiting in queue`);
            showToast(
                currentLanguage === 'bn' 
                    ? `অফলাইন: ${queueSize} টি ডাটা সিঙ্ক অপেক্ষায়` 
                    : `Offline: ${queueSize} items waiting to sync`,
                'error'
            );
        }
    } catch (error) {
        console.error('Error adding to sync queue:', error);
    }
}

// Process sync queue with robust error handling
async function processQueue() {
    // Prevent concurrent sync operations
    if (isSyncing) {
        console.log('Sync already in progress, skipping...');
        return;
    }
    
    // Check if online
    if (!navigator.onLine) {
        console.log('Offline - skipping sync');
        return;
    }
    
    const queue = await db.syncQueue.toArray();
    if (queue.length === 0) {
        console.log('Sync queue is empty');
        return;
    }
    
    console.log(`Starting sync: ${queue.length} items in queue`);
    isSyncing = true;
    showSyncingIndicator();
    
    let syncedCount = 0;
    let failedCount = 0;
    const failedItems = [];
    
    for (const item of queue) {
        try {
            // Attempt to send to Google Sheets
            const response = await fetch(SHEET_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            
            // no-cors mode doesn't give us response status, so we assume success
            // Remove from queue on successful send
            await db.syncQueue.delete(item.id);
            syncedCount++;
            console.log(`Synced: ${item.action} (ID: ${item.id})`);
            
        } catch (error) {
            console.error(`Sync failed for item ${item.id}:`, error);
            failedCount++;
            failedItems.push(item);
            
            // If we hit a network error, stop processing to avoid wasting attempts
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                console.log('Network error detected - stopping sync');
                break;
            }
        }
    }
    
    isSyncing = false;
    hideSyncingIndicator();
    
    // Provide feedback to user
    if (syncedCount > 0) {
        console.log(`✓ Sync complete: ${syncedCount} items synced`);
        
        triggerNotification(
            currentLanguage === 'bn' 
                ? `${syncedCount} টি ডাটা সিঙ্ক সফল হয়েছে` 
                : `${syncedCount} items synced successfully`
        );
    }
    
    if (failedCount > 0) {
        console.warn(`✗ Sync partial: ${failedCount} items failed`);
        showToast(
            currentLanguage === 'bn' 
                ? `${failedCount} টি ডাটা সিঙ্ক ব্যর্থ হয়েছে` 
                : `${failedCount} items failed to sync`,
            'error'
        );
    }
    
    // Check remaining queue
    const remainingQueue = await db.syncQueue.count();
    if (remainingQueue > 0) {
        console.log(`${remainingQueue} items still in queue`);
    }
}

// Manual sync trigger (can be called from UI)
async function manualSync() {
    if (!navigator.onLine) {
        showToast(
            currentLanguage === 'bn' 
                ? 'ইন্টারনেট সংযোগ নেই' 
                : 'No internet connection',
            'error'
        );
        return;
    }
    
    const queueSize = await db.syncQueue.count();
    
    if (queueSize === 0) {
        showToast(
            currentLanguage === 'bn' 
                ? 'সব ডাটা ইতিমধ্যে সিঙ্ক হয়ে গেছে' 
                : 'All data already synced',
            'success'
        );
        return;
    }
    
    showToast(
        currentLanguage === 'bn' 
            ? `${queueSize} টি ডাটা সিঙ্ক করা হচ্ছে...` 
            : `Syncing ${queueSize} items...`,
        'success'
    );
    
    await processQueue();
}

// Get sync status for display
async function getSyncStatus() {
    const queueSize = await db.syncQueue.count();
    const isOnline = navigator.onLine;
    
    return {
        queueSize,
        isOnline,
        isSyncing,
        status: queueSize === 0 ? 'synced' : (isOnline ? 'pending' : 'offline')
    };
}

// ═══════════════════════════════════════════════════════════
// Delete Transaction
// ═══════════════════════════════════════════════════════════

async function deleteTr(trId) {
    const confirmMsg = currentLanguage === 'bn' 
        ? "এই লেনদেনটি কি মুছে ফেলতে চান?" 
        : "Delete this transaction?";
    
    if (!confirm(confirmMsg)) return;
    
    const cust = await db.customers.get(currentId);
    if (cust) {
        cust.history = (cust.history || []).filter(h => h.id !== trId);
        await db.customers.put(cust);
        syncToSheet({ action: 'delete_transaction', customerId: currentId, trId });
        viewDetails(currentId);
        render();
        vibrate(50);
        showToast(
            currentLanguage === 'bn' ? "লেনদেন মুছে ফেলা হয়েছে" : "Transaction deleted",
            'success'
        );
    }
}

// ═══════════════════════════════════════════════════════════
// Delete Customer
// ═══════════════════════════════════════════════════════════

function softDeleteCustomer(id) {
    deleteTargetId = id;
    deleteType = 'customer';
    
    const msg = currentLanguage === 'bn' 
        ? "কাস্টমার মুছতে নিচে 'DELETE' লিখুন। এটি করলে কাস্টমারটি রিসাইকেল বিন-এ যাবে।"
        : "Type 'DELETE' below to move customer to recycle bin.";
    
    showAdvancedDeleteModal(msg);
}

function showAdvancedDeleteModal(msg) {
    vibrate(50);
    const oldModal = document.getElementById('advancedDeleteModal');
    if (oldModal) oldModal.remove();

    const labels = currentLanguage === 'bn'
        ? { sure: 'আপনি কি নিশ্চিত?', placeholder: 'এখানে DELETE লিখুন', no: 'না', delete: 'মুছুন' }
        : { sure: 'Are you sure?', placeholder: 'Type DELETE here', no: 'No', delete: 'Delete' };

    const modalHTML = `
        <div id="advancedDeleteModal" class="modal-overlay modal-visible" style="align-items:center">
            <div class="modal-backdrop" onclick="closeAdvancedDeleteModal()"></div>
            <div class="modal-sheet" style="max-width:360px">
                <div class="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-trash-alt text-2xl"></i>
                </div>
                <h3 class="text-xl font-black mb-2 text-slate-800 text-center">${labels.sure}</h3>
                <p class="text-slate-500 text-sm mb-6 text-center">${msg}</p>
                <input type="text" id="deleteConfirmInput" placeholder="${labels.placeholder}" class="input-field mb-6 text-center">
                <div class="flex gap-3">
                    <button onclick="closeAdvancedDeleteModal()" class="btn-secondary">${labels.no}</button>
                    <button id="finalDeleteBtn" onclick="verifyAndDelete()" class="btn-primary opacity-50 cursor-not-allowed">${labels.delete}</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const input = document.getElementById('deleteConfirmInput');
    const btn = document.getElementById('finalDeleteBtn');
    input.addEventListener('input', (e) => {
        if (e.target.value.trim() === "DELETE") {
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    });
}

function verifyAndDelete() {
    const input = document.getElementById('deleteConfirmInput');
    if (input.value.trim() === "DELETE") {
        handleFinalDelete();
        closeAdvancedDeleteModal();
    }
}

function closeAdvancedDeleteModal() {
    const modal = document.getElementById('advancedDeleteModal');
    if (modal) modal.remove();
}

async function handleFinalDelete() {
    if (deleteType === 'customer') {
        const cust = await db.customers.get(deleteTargetId);
        if (cust) {
            await db.recycleBin.put(cust);
            await db.customers.delete(deleteTargetId);
            syncToSheet({ action: 'delete_customer', id: deleteTargetId });
            showToast(
                currentLanguage === 'bn' ? "কাস্টমার বিনে সরানো হয়েছে" : "Customer moved to bin",
                'success'
            );
        }
    } else if (deleteType === 'permanent') {
        await db.recycleBin.delete(deleteTargetId);
        showToast(
            currentLanguage === 'bn' ? "চিরতরে মুছে ফেলা হয়েছে" : "Permanently deleted",
            'success'
        );
    }
    render();
    const bin = document.getElementById('binModal');
    if (bin && !bin.classList.contains('hidden')) renderBin();
    vibrate(50);
}

// ═══════════════════════════════════════════════════════════
// Recycle Bin
// ═══════════════════════════════════════════════════════════

async function renderBin() {
    const binBody = document.getElementById('binTable');
    if (!binBody) return;
    
    const binData = await db.recycleBin.toArray();
    const emptyText = currentLanguage === 'bn' ? 'বিন খালি' : 'Bin is empty';
    
    binBody.innerHTML = binData.length === 0 
        ? `<tr><td class="p-10 text-center text-slate-300 font-bold">${emptyText}</td></tr>` 
        : '';
    
    binData.forEach(cust => {
        binBody.innerHTML += `
            <tr class="border-b border-slate-100" style="display:flex;align-items:center;padding:16px;gap:12px">
                <td style="flex:1">
                    <p class="font-bold text-slate-700">${cust.name}</p>
                    <p class="text-xs text-slate-400">${cust.phone}</p>
                </td>
                <td style="display:flex;gap:8px">
                    <button onclick="restoreCustomer(${cust.id})" class="action-btn text-emerald-600"><i class="fas fa-undo"></i></button>
                    <button onclick="permanentDelete(${cust.id})" class="action-btn text-rose-500"><i class="fas fa-times"></i></button>
                </td>
            </tr>`;
    });
}

async function restoreCustomer(id) {
    const cust = await db.recycleBin.get(id);
    if (cust) {
        await db.customers.put(cust);
        await db.recycleBin.delete(id);
        render();
        renderBin();
        vibrate(30);
        showToast(
            currentLanguage === 'bn' ? "কাস্টমার পুনরুদ্ধার হয়েছে!" : "Customer restored!",
            'success'
        );
        syncToSheet({ action: 'restore_customer', id });
    }
}

function permanentDelete(id) {
    deleteTargetId = id;
    deleteType = 'permanent';
    
    const msg = currentLanguage === 'bn'
        ? "এটি চিরতরে ডিলিট করতে নিচে 'DELETE' লিখুন।"
        : "Type 'DELETE' below to permanently delete.";
    
    showAdvancedDeleteModal(msg);
}

// ═══════════════════════════════════════════════════════════
// Export Functions
// ═══════════════════════════════════════════════════════════

function toggleExportMenu() {
    const m = document.getElementById('exportMenu');
    if (m) m.classList.toggle('hidden');
}

document.addEventListener('click', (e) => {
    const m = document.getElementById('exportMenu');
    if (m && !m.contains(e.target) && !e.target.closest('.dropdown-wrap button')) {
        m.classList.add('hidden');
    }
});

async function exportCSV() {
    const customers = allCustomers.length ? allCustomers : await db.customers.toArray();
    const cur = getCurrency();
    
    const headers = currentLanguage === 'bn'
        ? "নাম,ফোন,মোট বিল,মোট জমা,বাকি,সুপারি (পিস)\n"
        : "Name,Phone,Total Bill,Total Paid,Due,Quantity\n";
    
    let csv = headers;
    
    customers.forEach(c => {
        let bill = 0, cash = 0, qty = 0;
        (c.history || []).forEach(h => {
            bill += (parseFloat(h.bill) || 0);
            cash += (parseFloat(h.cash) || 0);
            qty += (parseInt(h.qty) || 0);
        });
        csv += `"${(c.name || '').replace(/"/g, '""')}","${(c.phone || '').replace(/"/g, '""')}",${bill},${cash},${bill - cash},${qty}\n`;
    });
    
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bondhon_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    
    showToast(
        currentLanguage === 'bn' ? "CSV ডাউনলোড হয়েছে!" : "CSV downloaded!",
        'success'
    );
    document.getElementById('exportMenu')?.classList.add('hidden');
}

async function exportJSON() {
    const customers = allCustomers.length ? allCustomers : await db.customers.toArray();
    const bin = await db.recycleBin.toArray();
    const data = { customers, bin, exportDate: new Date().toISOString() };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bondhon_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    
    showToast(
        currentLanguage === 'bn' ? "JSON ব্যাকআপ ডাউনলোড হয়েছে!" : "JSON backup downloaded!",
        'success'
    );
    document.getElementById('exportMenu')?.classList.add('hidden');
}

async function printReport() {
    const customers = allCustomers.length ? allCustomers : await db.customers.toArray();
    const cur = getCurrency();
    
    const title = currentLanguage === 'bn' ? 'বন্ধন এন্টারপ্রাইজ - কাস্টমার তালিকা' : 'Bondhon Enterprise - Customer List';
    const headers = currentLanguage === 'bn' 
        ? { name: 'নাম', phone: 'ফোন', due: 'বাকি', qty: 'সুপারি' }
        : { name: 'Name', phone: 'Phone', due: 'Due', qty: 'Quantity' };
    
    let html = `<html><head><title>${title}</title><style>body{font-family:arial;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}</style></head><body>`;
    html += `<h1>${title}</h1><p>${new Date().toLocaleDateString(currentLanguage === 'bn' ? 'bn-BD' : 'en-US')}</p>`;
    html += `<table><tr><th>${headers.name}</th><th>${headers.phone}</th><th>${headers.due}</th><th>${headers.qty}</th></tr>`;
    
    customers.forEach(c => {
        let bill = 0, cash = 0, qty = 0;
        (c.history || []).forEach(h => {
            bill += (parseFloat(h.bill) || 0);
            cash += (parseFloat(h.cash) || 0);
            qty += (parseInt(h.qty) || 0);
        });
        html += `<tr><td>${(c.name || '').replace(/</g, '&lt;')}</td><td>${(c.phone || '').replace(/</g, '&lt;')}</td><td>${cur}${(bill - cash).toLocaleString('bn-BD')}</td><td>${qty}</td></tr>`;
    });
    
    html += '</table></body></html>';
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.print();
    w.close();
    document.getElementById('exportMenu')?.classList.add('hidden');
}

// ═══════════════════════════════════════════════════════════
// Report & Analytics
// ═══════════════════════════════════════════════════════════

async function renderReport() {
    const container = document.getElementById('reportContent');
    if (!container) return;

    const customers = await db.customers.toArray();
    const cur = getCurrency();
    let gDue = 0, gCash = 0, gQty = 0;
    const withDue = [];
    const today = new Date().toISOString().slice(0, 10);
    let todayBill = 0, todayCash = 0;

    const weekData = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        weekData.push({
            date: d.toISOString().slice(0, 10),
            label: d.toLocaleDateString(currentLanguage === 'bn' ? 'bn-BD' : 'en-US', { weekday: 'short' }),
            bill: 0,
            cash: 0
        });
    }

    customers.forEach(c => {
        let bill = 0, cash = 0, qty = 0;
        (c.history || []).forEach(h => {
            const amt = parseFloat(h.bill) || 0;
            const paid = parseFloat(h.cash) || 0;
            bill += amt;
            cash += paid;
            qty += (parseInt(h.qty) || 0);
            const hDate = (h.date || '').slice(0, 10);
            if (hDate === today) {
                todayBill += amt;
                todayCash += paid;
            }
            const wd = weekData.find(w => w.date === hDate);
            if (wd) {
                wd.bill += amt;
                wd.cash += paid;
            }
        });
        const due = bill - cash;
        gDue += due; gCash += cash; gQty += qty;
        if (due > 0) withDue.push({ ...c, due, bill, cash, qty });
    });

    withDue.sort((a, b) => b.due - a.due);
    const maxDay = Math.max(...weekData.map(w => w.bill), 1);

    const labels = currentLanguage === 'bn'
        ? {
            todaySales: 'আজকের বিক্রয়',
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
            <p class="text-slate-700">${labels.totalDue}: <strong>${cur}${gDue.toLocaleString('bn-BD')}</strong></p>
            <p class="text-slate-700">${labels.totalPaid}: <strong>${cur}${gCash.toLocaleString('bn-BD')}</strong></p>
            <p class="text-slate-700">${labels.totalQty}: <strong>${gQty.toLocaleString('bn-BD')} ${labels.pieces}</strong></p>
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
// Search Filter
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
    
    // Initialize robust sync system
    initSyncSystem();
    
    // Log sync status
    const syncStatus = await getSyncStatus();
    console.log('Sync Status:', syncStatus);
};

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopSyncPolling();
});
