const SHEET_URL = "https://script.google.com/macros/s/AKfycbwCLJTE0243PM8WYJym0N35aAYbss4-yMBsB4eooHcE5p7cmr55vgZT6MONLtePMRsKbA/exec";

// ডাটা লোড করা
let customers = JSON.parse(localStorage.getItem('supari_v4_data')) || [];
let recycleBin = JSON.parse(localStorage.getItem('supari_v4_bin')) || [];
let syncQueue = JSON.parse(localStorage.getItem('supari_sync_queue')) || [];
let currentId = null;
let deleteTargetId = null;
let deleteType = '';

// হ্যাপটিক ফিডব্যাক
const vibrate = () => { if (navigator.vibrate) navigator.vibrate(50); };

// ডাটা লোকাল স্টোরেজে সেভ করা
function saveData() {
    localStorage.setItem('supari_v4_data', JSON.stringify(customers));
    localStorage.setItem('supari_v4_bin', JSON.stringify(recycleBin));
    localStorage.setItem('supari_sync_queue', JSON.stringify(syncQueue));
}

// উইন্ডো লোড হওয়ার সময় গুগল শিট থেকে ডাটা আনা
window.onload = async function() {
    render();
    processQueue(); 
    try {
        const response = await fetch(SHEET_URL);
        const sheetData = await response.json();
        if (sheetData && sheetData.length > 0) {
            let tempCustomers = [];
            sheetData.forEach(row => {
                let existing = tempCustomers.find(c => c.id === row.id);
                if (existing) {
                    if(row.bill > 0 || row.cash > 0 || row.qty > 0) {
                        existing.history.push({
                            id: row.trId || Date.now() + Math.random(),
                            date: new Date(row.date).toLocaleDateString('bn-BD'),
                            qty: row.qty, bill: row.bill, cash: row.cash, due: row.due
                        });
                    }
                } else {
                    tempCustomers.push({
                        id: row.id, name: row.name, phone: row.phone,
                        history: (row.bill > 0 || row.cash > 0 || row.qty > 0) ? [{
                            id: Date.now(),
                            date: new Date(row.date).toLocaleDateString('bn-BD'),
                            qty: row.qty, bill: row.bill, cash: row.cash, due: row.due
                        }] : []
                    });
                }
            });
            customers = tempCustomers;
            saveData();
            render();
        }
    } catch (e) { console.log("অফলাইন মুড সক্রিয়।"); }
};

// সিঙ্ক ফাংশন
async function syncToSheet(data) {
    syncQueue.push(data);
    saveData();
    processQueue();
}

async function processQueue() {
    if (!navigator.onLine || syncQueue.length === 0) return;
    const dataToSync = syncQueue[0];
    try {
        await fetch(SHEET_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dataToSync)
        });
        syncQueue.shift();
        saveData();
        if (syncQueue.length > 0) processQueue();
    } catch (e) { console.log("সিঙ্ক স্থগিত।"); }
}

// নতুন কাস্টমার সেভ
function saveCustomer() {
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim() || 'N/A';
    if(!name) { vibrate(); return alert("অনুগ্রহ করে নাম লিখুন!"); }
    
    const newCust = { 
        id: Date.now(), 
        name, phone, history: [], 
        createdAt: new Date().toLocaleDateString('bn-BD') 
    };
    
    customers.unshift(newCust);
    saveData();
    closeModal('customerModal');
    render();
    vibrate();
    syncToSheet({ id: newCust.id, name, phone, qty: 0, bill: 0, cash: 0, due: 0 });
    document.getElementById('name').value = '';
    document.getElementById('phone').value = '';
}

// লেনদেন যোগ করা
function addTransaction() {
    const qtyInput = document.getElementById('trQty');
    const billInput = document.getElementById('trBill');
    const cashInput = document.getElementById('trCash');

    const qty = parseInt(qtyInput.value) || 0;
    const bill = parseFloat(billInput.value) || 0;
    const cash = parseFloat(cashInput.value) || 0;

    if(bill === 0 && cash === 0 && qty === 0) { vibrate(); return alert("সঠিক হিসাব দিন!"); }

    const index = customers.findIndex(c => c.id === currentId);
    const newHistory = { 
        id: Date.now(), 
        date: new Date().toLocaleDateString('bn-BD'), 
        qty, bill, cash, 
        due: bill - cash 
    };

    customers[index].history.unshift(newHistory);
    saveData();
    vibrate();
    syncToSheet({ id: customers[index].id, name: customers[index].name, phone: customers[index].phone, qty, bill, cash, due: bill - cash });
    
    viewDetails(currentId);
    render();
}

// মেইন টেবিল রেন্ডার
function render() {
    const tbody = document.getElementById('customerTable');
    if(!tbody) return;
    tbody.innerHTML = '';
    let gDue = 0, gCash = 0, gQty = 0;

    if(customers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-20 text-center text-slate-400 font-medium">কোন কাস্টমার নেই</td></tr>`;
    }

    customers.forEach(cust => {
        let bill = 0, cash = 0, qty = 0;
        cust.history.forEach(h => { bill += h.bill; cash += h.cash; qty += h.qty; });
        const due = bill - cash;
        gDue += due; gCash += cash; gQty += qty;

        tbody.innerHTML += `
            <tr onclick="viewDetails(${cust.id})" class="active:bg-slate-100 border-b border-slate-50 transition-colors cursor-pointer">
                <td class="p-4 font-bold text-slate-800 text-base">
                    ${cust.name}
                    <div class="text-[11px] text-slate-400 font-normal flex items-center gap-1">
                        <i class="fas fa-phone-alt text-[8px]"></i> ${cust.phone}
                    </div>
                </td>
                <td class="p-4 text-center font-black text-base ${due > 0 ? 'text-rose-500' : 'text-emerald-500'}">
                    ৳${due.toLocaleString('bn-BD')}
                </td>
                <td class="p-4 text-center">
                    <button onclick="event.stopPropagation(); softDeleteCustomer(${cust.id})" class="text-slate-300 p-2 hover:text-rose-500">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    document.getElementById('totalCust').innerText = customers.length;
    document.getElementById('totalDue').innerText = "৳" + gDue.toLocaleString('bn-BD');
    document.getElementById('totalCash').innerText = "৳" + gCash.toLocaleString('bn-BD');
    document.getElementById('totalQty').innerText = gQty.toLocaleString('bn-BD');
}

// প্রোফাইল দেখা
function viewDetails(id) {
    currentId = id;
    const cust = customers.find(c => c.id === id);
    let tBill = 0, tCash = 0;
    cust.history.forEach(h => { tBill += h.bill; tCash += h.cash; });
    
    const modal = document.getElementById('detailModal');
    modal.innerHTML = `
        <div class="bg-white rounded-t-[2.5rem] md:rounded-[2rem] w-full max-w-6xl h-[94vh] flex flex-col overflow-hidden shadow-2xl scale-in">
            <div class="p-6 bg-slate-900 text-white flex justify-between items-center">
                <div>
                    <h2 class="text-2xl font-black">${cust.name}</h2>
                    <button onclick="sendWhatsApp(${cust.id})" class="mt-2 text-emerald-400 text-[11px] flex items-center gap-2">
                        <i class="fab fa-whatsapp"></i> হোয়াটসঅ্যাপে পাঠান
                    </button>
                </div>
                <div class="bg-rose-500 p-3 rounded-2xl text-center">
                    <p class="text-[10px] opacity-80">বাকি</p>
                    <p class="text-lg font-black">৳${(tBill - tCash).toLocaleString('bn-BD')}</p>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto bg-slate-50 p-4">
                <div class="bg-white p-6 rounded-[2rem] shadow-sm mb-6 space-y-3">
                    <input type="number" id="trQty" inputmode="numeric" placeholder="সুপারি (পিস)" class="w-full p-4 bg-slate-50 rounded-2xl outline-none border-none ring-1 ring-slate-100 focus:ring-2 focus:ring-emerald-500">
                    <input type="number" id="trBill" inputmode="numeric" placeholder="মোট বিল" class="w-full p-4 bg-slate-50 rounded-2xl outline-none border-none ring-1 ring-slate-100 focus:ring-2 focus:ring-emerald-500">
                    <input type="number" id="trCash" inputmode="numeric" placeholder="নগদ জমা" class="w-full p-4 bg-emerald-50 rounded-2xl outline-none border-none ring-1 ring-slate-100 focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-700">
                    <button onclick="addTransaction()" class="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black">সেভ করুন</button>
                </div>

                <div class="space-y-3">
                    <h4 class="text-xs font-black text-slate-400 uppercase ml-2">লেনদেন ইতিহাস</h4>
                    ${cust.history.map(h => `
                        <div class="bg-white p-4 rounded-2xl flex justify-between items-center border border-slate-100">
                            <div>
                                <p class="text-sm font-bold">${h.date}</p>
                                <p class="text-[10px] text-slate-400">${h.qty} পিস সুপারি</p>
                            </div>
                            <div class="flex items-center gap-4">
                                <p class="font-black text-rose-500">৳${h.due.toLocaleString('bn-BD')}</p>
                                <button onclick="deleteTr(${h.id})" class="text-slate-200"><i class="fas fa-trash-alt"></i></button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="p-4 bg-white border-t">
                <button onclick="closeModal('detailModal')" class="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold">বন্ধ করুন</button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
    setupInputScroll(); // টাইপিং ফিক্স চালু করা
}

// টাইপিং ফিক্স: কিবোর্ড যাতে ইনপুট বক্স না ঢাকে
function setupInputScroll() {
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('focus', () => {
            setTimeout(() => {
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        });
    });
}

function sendWhatsApp(id) {
    const cust = customers.find(c => c.id === id);
    let tBill = 0, tCash = 0;
    cust.history.forEach(h => { tBill += h.bill; tCash += h.cash; });
    const text = `নমস্কার ${cust.name} দা, বন্ধন এন্টারপ্রাইজে আপনার বর্তমান মোট বাকি ৳${(tBill - tCash).toLocaleString('bn-BD')}। ধন্যবাদ!`;
    const phone = cust.phone.replace(/[^0-9]/g, '');
    const finalPhone = phone.length === 11 ? '88' + phone : phone;
    window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`, '_blank');
}

// ডিলিট ম্যানেজমেন্ট
function softDeleteCustomer(id) { deleteTargetId = id; deleteType = 'customer'; showDeleteModal(); }
function deleteTr(trId) { deleteTargetId = trId; deleteType = 'transaction'; showDeleteModal(); }

function showDeleteModal() {
    vibrate();
    const modalHTML = `
        <div id="deleteConfirmModal" class="modal-overlay fixed inset-0 bg-slate-900/70 z-[110] flex items-center justify-center p-6">
            <div class="bg-white rounded-[2rem] w-full max-w-sm p-8 text-center scale-in">
                <div class="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-exclamation-triangle text-2xl"></i>
                </div>
                <h3 class="text-xl font-black mb-2">আপনি কি নিশ্চিত?</h3>
                <p class="text-slate-500 text-sm mb-6">এই তথ্যটি মুছে ফেলা হবে।</p>
                <div class="flex gap-3">
                    <button onclick="closeDeleteModal()" class="flex-1 py-4 bg-slate-100 rounded-2xl font-bold">না</button>
                    <button onclick="handleFinalDelete()" class="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-bold">হ্যাঁ, মুছুন</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeDeleteModal() { const el = document.getElementById('deleteConfirmModal'); if(el) el.remove(); }

function handleFinalDelete() {
    if (deleteType === 'transaction') {
        const idx = customers.findIndex(c => c.id === currentId);
        customers[idx].history = customers[idx].history.filter(h => h.id !== deleteTargetId);
        viewDetails(currentId);
    } else {
        const cust = customers.find(c => c.id === deleteTargetId);
        if (cust && !recycleBin.find(i => i.id === cust.id)) recycleBin.push(cust);
        customers = customers.filter(c => c.id !== deleteTargetId);
    }
    saveData(); render(); closeDeleteModal(); vibrate();
}

function openModal(id) { 
    document.getElementById(id).classList.remove('hidden'); 
    if(id === 'binModal') renderBin(); 
    setupInputScroll();
    vibrate(); 
}
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function filterTable() {
    let q = document.getElementById('search').value.toLowerCase();
    document.querySelectorAll('#customerTable tr').forEach(r => {
        r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
}

function renderBin() {
    const binBody = document.getElementById('binTable');
    if(!binBody) return;
    binBody.innerHTML = recycleBin.length === 0 ? '<tr><td class="p-10 text-center text-slate-300">বিন খালি</td></tr>' : '';
    recycleBin.forEach(cust => {
        binBody.innerHTML += `
            <tr class="border-b">
                <td class="p-4 font-bold">${cust.name}</td>
                <td class="p-4 text-right">
                    <button onclick="restoreCustomer(${cust.id})" class="text-emerald-600 text-xs font-bold bg-emerald-50 px-3 py-2 rounded-lg">রিস্টোর</button>
                </td>
            </tr>`;
    });
}

function restoreCustomer(id) {
    const cust = recycleBin.find(c => c.id === id);
    if(cust) {
        customers.unshift(cust);
        recycleBin = recycleBin.filter(c => c.id !== id);
        saveData(); render(); renderBin(); vibrate();
    }
}

// Service Worker & Online Sync
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('SW failed', err));
    });
}
window.addEventListener('online', processQueue);
