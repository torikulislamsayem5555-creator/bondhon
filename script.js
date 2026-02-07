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

const defaultSettings = { theme: 'light', currency: '৳' };
function getSettings() {
    try {
        return JSON.parse(localStorage.getItem('bondhon_settings')) || defaultSettings;
    } catch { return defaultSettings; }
}
function saveSettingsObj(s) {
    localStorage.setItem('bondhon_settings', JSON.stringify(s));
}
function getCurrency() {
    return getSettings().currency || '৳';
}

function applyTheme(theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
}
function toggleTheme() {
    const s = getSettings();
    s.theme = s.theme === 'dark' ? 'light' : 'dark';
    saveSettingsObj(s);
    applyTheme(s.theme);
    updateThemeToggleUI();
    showToast(s.theme === 'dark' ? 'ডার্ক মোড চালু' : 'লাইট মোড চালু');
}
function updateThemeToggleUI() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    const isDark = getSettings().theme === 'dark';
    btn.classList.toggle('active', isDark);
}

function showToast(msg, type = 'success') {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const div = document.createElement('div');
    div.className = `toast ${type === 'success' ? 'bg-emerald-600 text-white' : type === 'error' ? 'bg-rose-500 text-white' : 'bg-slate-800 text-white'}`;
    div.textContent = msg;
    c.appendChild(div);
    setTimeout(() => div.remove(), 2500);
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('modal-visible');
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

function vibrate(time = 50) {
    if (navigator.vibrate) navigator.vibrate(time);
}

function updateOnlineStatus() {
    const badge = document.getElementById('statusBadge');
    if (!badge) return;
    if (navigator.onLine) {
        badge.innerHTML = '<span class="status-dot"></span> Online';
        badge.className = 'status-badge status-online';
        processQueue();
    } else {
        badge.innerHTML = '<span class="status-dot"></span> Offline';
        badge.className = 'status-badge status-offline';
    }
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

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

function applySort() {
    sortBy = document.getElementById('sortSelect')?.value || 'newest';
    render();
}

function getTagBadge(tag) {
    if (!tag) return '';
    const cls = tag === 'VIP' ? 'tag-vip' : tag === 'Regular' ? 'tag-regular' : 'tag-new';
    return `<span class="tag ${cls}">${tag}</span>`;
}

async function render() {
    const tbody = document.getElementById('customerTable');
    if (!tbody) return;

    let customers = await db.customers.toArray();
    allCustomers = [...customers];

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
        tbody.innerHTML = `
            <tr style="display:block;padding:48px 24px;text-align:center">
                <td colspan="3" style="display:block">
                    <div class="empty-icon"><i class="fas fa-users-slash"></i></div>
                    <p class="empty-text">কোন কাস্টমার নেই</p>
                    <p class="empty-text" style="font-size:13px;margin-top:8px">নতুন কাস্টমার যোগ করতে + বাটনে ক্লিক করুন</p>
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
        const callBtn = phoneNum ? `<a href="tel:${phoneNum}" onclick="event.stopPropagation()" class="action-btn mr-1" title="কল করুন"><i class="fas fa-phone-alt text-green-600"></i></a>` : '';

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
                <button onclick="event.stopPropagation(); openEditCustomer(${cust.id})" class="action-btn" title="এডিট"><i class="fas fa-edit text-blue-500"></i></button>
                <button onclick="event.stopPropagation(); softDeleteCustomer(${cust.id})" class="action-btn" title="ডিলিট"><i class="fas fa-trash-alt text-rose-500"></i></button>
            </td>`;
        tbody.appendChild(tr);
    });

    document.getElementById('totalCust').innerText = customers.length.toLocaleString('bn-BD');
    document.getElementById('totalDue').innerText = cur + gDue.toLocaleString('bn-BD');
    document.getElementById('totalCash').innerText = cur + gCash.toLocaleString('bn-BD');
    document.getElementById('totalQty').innerText = gQty.toLocaleString('bn-BD');
}

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
        showToast("কাস্টমারের নাম লিখুন!", "error");
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
            showToast("কাস্টমার আপডেট হয়েছে!");
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
        showToast("কাস্টমার যোগ হয়েছে!");
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

async function openEditCustomer(id) {
    const cust = await db.customers.get(id);
    if (!cust) return;
    editMode = true;
    currentId = id;
    document.getElementById('customerModalTitle').textContent = 'কাস্টমার এডিট';
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
    document.getElementById('customerModalTitle').textContent = 'নতুন কাস্টমার';
    document.getElementById('name').value = '';
    document.getElementById('phone').value = '';
    const n = document.getElementById('custNotes');
    if (n) n.value = '';
    const t = document.getElementById('custTag');
    if (t) t.value = '';
    openModal('customerModal');
}

function generateReceipt(cust, tr) {
    const cur = getCurrency();
    const d = new Date(tr.date);
    return `
বন্ধন এন্টারপ্রাইজ
─────────────────
${cust.name}
${cust.phone}
─────────────────
তারিখ: ${d.toLocaleDateString('bn-BD')}
সুপারি: ${tr.qty || 0} পিস
বিল: ${cur}${(tr.bill || 0).toLocaleString('bn-BD')}
জমা: ${cur}${(tr.cash || 0).toLocaleString('bn-BD')}
বাকি: ${cur}${(tr.due || 0).toLocaleString('bn-BD')}
─────────────────
ধন্যবাদ
`.trim();
}

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

    const modal = document.getElementById('detailModal');
    modal.innerHTML = `
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
                        <p class="text-[10px] font-black text-rose-400 uppercase">মোট বাকি</p>
                        <p class="text-xl font-black text-rose-500">${cur}${due.toLocaleString('bn-BD')}</p>
                    </div>
                </div>
            </div>
            <div class="overflow-y-auto flex-1 space-y-4 pr-2">
                <div class="bg-slate-100/50 p-6 rounded-2xl space-y-3">
                    <p class="text-[10px] font-black text-slate-400 uppercase ml-1">নতুন লেনদেন</p>
                    <input type="number" id="trQty" inputmode="numeric" placeholder="সুপারি (পিস)" class="input-field">
                    <div class="grid grid-cols-2 gap-3">
                        <input type="number" id="trBill" inputmode="numeric" placeholder="মোট বিল" class="input-field">
                        <input type="number" id="trCash" inputmode="numeric" placeholder="নগদ জমা" class="input-field bg-emerald-50 border-emerald-200">
                    </div>
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" id="genReceipt" class="rounded">
                        <span class="text-sm font-bold text-slate-600">রিসিপ্ট প্রিন্ট</span>
                    </label>
                    <button onclick="addTransaction()" class="btn-primary w-full">সেভ করুন</button>
                </div>
                <div class="space-y-3">
                    <h4 class="text-xs font-black text-slate-400 uppercase ml-2">লেনদেন ইতিহাস</h4>
                    ${(cust.history || []).length === 0 ? '<p class="text-center text-slate-300 py-10 italic">কোন ইতিহাস নেই</p>' :
        (cust.history || []).slice().reverse().map(h => `
                        <div class="bg-white p-4 rounded-2xl flex justify-between items-center border border-slate-100">
                            <div>
                                <p class="text-sm font-bold text-slate-700">${new Date(h.date).toLocaleDateString('bn-BD')}</p>
                                <p class="text-[10px] text-slate-400">${h.qty || 0} পিস</p>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="text-right">
                                    <p class="font-black text-sm ${h.due > 0 ? 'text-rose-500' : 'text-emerald-500'}">${cur}${h.due.toLocaleString('bn-BD')}</p>
                                    <p class="text-[8px] text-slate-400">জমা: ${cur}${h.cash.toLocaleString('bn-BD')}</p>
                                </div>
                                <button onclick="printReceipt(${cust.id},${h.id})" class="action-btn" title="রিসিপ্ট"><i class="fas fa-receipt text-slate-500"></i></button>
                                <button onclick="deleteTr(${h.id})" class="action-btn"><i class="fas fa-trash-alt text-rose-400"></i></button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="pt-4">
                <button onclick="closeModal('detailModal')" class="btn-secondary w-full">বন্ধ করুন</button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
    modal.classList.add('modal-visible');
    setupInputScroll();
}

async function printReceipt(custId, trId) {
    const cust = await db.customers.get(custId);
    if (!cust) return;
    const tr = (cust.history || []).find(h => h.id === trId);
    if (!tr) return;
    const receipt = generateReceipt(cust, tr);
    const w = window.open('', '_blank');
    w.document.write(`<pre style="font-family:monospace;padding:24px;font-size:14px">${receipt.replace(/\n/g, '<br>')}</pre>`);
    w.document.close();
    w.print();
    w.close();
    showToast("রিসিপ্ট প্রিন্ট করছেন...");
}

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
        showToast("বিল অথবা নগদ জমার পরিমাণ লিখুন!", "error");
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
        const receipt = generateReceipt(cust, newTr);
        const w = window.open('', '_blank');
        w.document.write(`<pre style="font-family:monospace;padding:24px;font-size:14px">${receipt.replace(/\n/g, '<br>')}</pre>`);
        w.document.close();
        w.print();
        w.close();
    }

    viewDetails(currentId);
    render();
    vibrate(30);
    showToast("লেনদেন যোগ হয়েছে!");

    syncToSheet({ action: 'add_transaction', customerId: currentId, ...newTr });

    qtyInput.value = '';
    billInput.value = '';
    cashInput.value = '';
}

async function syncToSheet(data) {
    await db.syncQueue.add(data);
    processQueue();
}

async function processQueue() {
    if (!navigator.onLine) return;
    const queue = await db.syncQueue.toArray();
    if (queue.length === 0) return;
    for (const item of queue) {
        try {
            await fetch(SHEET_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            await db.syncQueue.delete(item.id);
        } catch (e) {
            console.log("Sync error:", e);
            break;
        }
    }
}

async function deleteTr(trId) {
    if (!confirm("এই লেনদেনটি কি মুছে ফেলতে চান?")) return;
    const cust = await db.customers.get(currentId);
    if (cust) {
        cust.history = (cust.history || []).filter(h => h.id !== trId);
        await db.customers.put(cust);
        syncToSheet({ action: 'delete_transaction', customerId: currentId, trId });
        viewDetails(currentId);
        render();
        vibrate(50);
        showToast("লেনদেন মুছে ফেলা হয়েছে");
    }
}

function softDeleteCustomer(id) {
    deleteTargetId = id;
    deleteType = 'customer';
    showAdvancedDeleteModal("কাস্টমার মুছতে নিচে 'DELETE' লিখুন। এটি করলে কাস্টমারটি রিসাইকেল বিন-এ যাবে।");
}

function showAdvancedDeleteModal(msg) {
    vibrate(50);
    const oldModal = document.getElementById('advancedDeleteModal');
    if (oldModal) oldModal.remove();

    const modalHTML = `
        <div id="advancedDeleteModal" class="modal-overlay modal-visible" style="align-items:center">
            <div class="modal-sheet" style="max-width:360px">
                <div class="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-trash-alt text-2xl"></i>
                </div>
                <h3 class="text-xl font-black mb-2 text-slate-800 text-center">আপনি কি নিশ্চিত?</h3>
                <p class="text-slate-500 text-sm mb-6 text-center">${msg}</p>
                <input type="text" id="deleteConfirmInput" placeholder="এখানে DELETE লিখুন" class="input-field mb-6 text-center">
                <div class="flex gap-3">
                    <button onclick="closeAdvancedDeleteModal()" class="btn-secondary">না</button>
                    <button id="finalDeleteBtn" onclick="verifyAndDelete()" class="btn-primary opacity-50 cursor-not-allowed">মুছুন</button>
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
            showToast("কাস্টমার বিনে সরানো হয়েছে");
        }
    } else if (deleteType === 'permanent') {
        await db.recycleBin.delete(deleteTargetId);
        showToast("চিরতরে মুছে ফেলা হয়েছে");
    }
    render();
    const bin = document.getElementById('binModal');
    if (bin && !bin.classList.contains('hidden')) renderBin();
    vibrate(50);
}

async function renderBin() {
    const binBody = document.getElementById('binTable');
    if (!binBody) return;
    const binData = await db.recycleBin.toArray();
    binBody.innerHTML = binData.length === 0 ?
        '<tr><td class="p-10 text-center text-slate-300 font-bold">বিন খালি</td></tr>' : '';
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
        showToast("কাস্টমার পুনরুদ্ধার হয়েছে!");
        syncToSheet({ action: 'restore_customer', id });
    }
}

function permanentDelete(id) {
    deleteTargetId = id;
    deleteType = 'permanent';
    showAdvancedDeleteModal("এটি চিরতরে ডিলিট করতে নিচে 'DELETE' লিখুন।");
}

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
    let csv = "নাম,ফোন,মোট বিল,মোট জমা,বাকি,সুপারি (পিস)\n";
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
    showToast("CSV ডাউনলোড হয়েছে!");
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
    showToast("JSON ব্যাকআপ ডাউনলোড হয়েছে!");
    document.getElementById('exportMenu')?.classList.add('hidden');
}

async function printReport() {
    const customers = allCustomers.length ? allCustomers : await db.customers.toArray();
    const cur = getCurrency();
    let html = '<html><head><title>বন্ধন এন্টারপ্রাইজ - রিপোর্ট</title><style>body{font-family:arial;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}</style></head><body>';
    html += '<h1>বন্ধন এন্টারপ্রাইজ - কাস্টমার তালিকা</h1><p>' + new Date().toLocaleDateString('bn-BD') + '</p>';
    html += '<table><tr><th>নাম</th><th>ফোন</th><th>বাকি</th><th>সুপারি</th></tr>';
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
            label: d.toLocaleDateString('bn-BD', { weekday: 'short' }),
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

    container.innerHTML = `
        <div class="grid grid-cols-2 gap-3 mb-6">
            <div class="stat-card">
                <p class="stat-label">আজকের বিক্রয়</p>
                <p class="text-xl font-black text-slate-800">${cur}${todayBill.toLocaleString('bn-BD')}</p>
                <p class="text-xs text-slate-400 mt-1">জমা: ${cur}${todayCash.toLocaleString('bn-BD')}</p>
            </div>
            <div class="stat-card">
                <p class="stat-label">বাকি আছে</p>
                <p class="text-xl font-black text-rose-600">${withDue.length} জন</p>
            </div>
        </div>
        <div class="mb-6">
            <h4 class="text-xs font-black text-slate-500 uppercase mb-3">সাপ্তাহিক ট্রেন্ড</h4>
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
            <h4 class="text-xs font-black text-slate-500 uppercase mb-3">সারসংক্ষেপ</h4>
            <p class="text-slate-700">মোট বাকি: <strong>${cur}${gDue.toLocaleString('bn-BD')}</strong></p>
            <p class="text-slate-700">মোট জমা: <strong>${cur}${gCash.toLocaleString('bn-BD')}</strong></p>
            <p class="text-slate-700">মোট সুপারি: <strong>${gQty.toLocaleString('bn-BD')} পিস</strong></p>
        </div>
        <div>
            <h4 class="text-xs font-black text-slate-500 uppercase mb-3">বাকি আছে যাদের</h4>
            ${withDue.length === 0 ? '<p class="text-slate-400 py-6 text-center">কেউ বাকি নেই</p>' :
        withDue.slice(0, 15).map(c => `
                <div class="flex justify-between items-center p-3 bg-white rounded-xl mb-2 border border-slate-100">
                    <span class="font-bold text-slate-700">${c.name}</span>
                    <span class="font-black text-rose-500">${cur}${c.due.toLocaleString('bn-BD')}</span>
                </div>
            `).join('')}
        </div>
    `;
}

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
    showToast("সেটিংস সেভ হয়েছে!");
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
            showToast("ডাটা ইম্পোর্ট সফল!");
            render();
            if (!document.getElementById('binModal').classList.contains('hidden')) renderBin();
        } else {
            showToast("ভুল ফরম্যাট!", "error");
        }
    } catch (err) {
        showToast("ইম্পোর্টে ত্রুটি!", "error");
    }
    e.target.value = '';
}

function filterTable() {
    const q = document.getElementById('search').value.toLowerCase();
    document.querySelectorAll('#customerTable tr').forEach(r => {
        if (r.querySelector('.empty-icon')) return;
        r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
}

function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showToast("ভয়েস সাপোর্ট করে না", "error");
        return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'bn-BD';
    recognition.onstart = () => {
        vibrate(20);
        document.getElementById('search').placeholder = "বলুন, শুনছি...";
    };
    recognition.onresult = (e) => {
        document.getElementById('search').value = e.results[0][0].transcript;
        filterTable();
        document.getElementById('search').placeholder = "কাস্টমার খুঁজুন...";
    };
    recognition.onerror = () => {
        document.getElementById('search').placeholder = "কাস্টমার খুঁজুন...";
    };
    recognition.start();
}

function setupInputScroll() {
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('focus', () => {
            setTimeout(() => input.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
        });
    });
}

window.onload = async function () {
    await migrateData();
    applyTheme(getSettings().theme);
    updateThemeToggleUI();
    await render();
    updateOnlineStatus();
    setupInputScroll();
};
