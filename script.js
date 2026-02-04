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

// উইন্ডো লোড হওয়ার সময় গুগল শিট থেকে ডাটা আনা
window.onload = async function() {
    render();
    processQueue(); // অফলাইন ডাটা থাকলে সিঙ্ক শুরু করা
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
    } catch (e) { console.log("ইন্টারনেট নেই, লোকাল ডাটা দেখানো হচ্ছে।"); }
};

// উন্নত সিঙ্ক ফাংশন (অফলাইন সাপোর্ট সহ)
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
    
    qtyInput.value = ''; billInput.value = ''; cashInput.value = '';
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
                    <button onclick="event.stopPropagation(); softDeleteCustomer(${cust.id})" class="text-slate-300 p-2 hover:text-rose-500 transition-colors">
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

// বিস্তারিত প্রোফাইল দেখা
function viewDetails(id) {
    currentId = id;
    const cust = customers.find(c => c.id === id);
    let tBill = 0, tCash = 0;
    cust.history.forEach(h => { tBill += h.bill; tCash += h.cash; });
    
    const modal = document.getElementById('detailModal');
    modal.innerHTML = `
        <div class="bg-white rounded-t-[2.5rem] md:rounded-[2rem] w-full max-w-6xl h-[94vh] flex flex-col overflow-hidden shadow-2xl scale-in">
            <div class="p-6 bg-slate-900 text-white flex justify-between items-center shadow-xl">
                <div>
                    <h2 class="text-2xl font-black">${cust.name}</h2>
                    <div class="flex flex-col gap-1 mt-1">
                        <p class="text-slate-400 text-xs flex items-center gap-2">
                            <i class="fas fa-phone"></i> ${cust.phone}
                        </p>
                        <button onclick="sendWhatsApp(${cust.id})" class="w-fit mt-1 text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl text-[10px] font-bold border border-emerald-500/20 active:scale-95 transition-transform flex items-center gap-2">
                            <i class="fab fa-whatsapp text-sm"></i> হোয়াটসঅ্যাপে হিসাব পাঠান
                        </button>
                    </div>
                </div>
                <div class="bg-rose-500 text-white px-5 py-2 rounded-2xl text-center shadow-lg">
                    <p class="text-[9px] uppercase font-bold opacity-80">মোট বাকি</p>
                    <p class="text-lg font-black">৳${(tBill - tCash).toLocaleString('bn-BD')}</p>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8">
                <div class="flex flex-col md:flex-row gap-6">
                    <div class="w-full md:w-80 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col gap-3">
                        <h4 class="text-sm font-black text-slate-400 uppercase mb-2">নতুন হিসাব</h4>
                        <input type="number" id="trQty" inputmode="numeric" placeholder="সুপারি (পিস)" class="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-green-500">
                        <input type="number" id="trBill" inputmode="numeric" placeholder="মোট বিল" class="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-green-500">
                        <input type="number" id="trCash" inputmode="numeric" placeholder="নগদ জমা" class="w-full p-4 bg-emerald-50 rounded-2xl outline-none focus:ring-2 focus:ring-green-500 font-bold text-emerald-700">
                        <button onclick="addTransaction()" class="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black shadow-lg active:scale-95 transition-transform mt-2">সেভ করুন</button>
                    </div>

                    <div class="flex-1 space-y-3">
                        <h4 class="text-sm font-black text-slate-400 uppercase mb-2">লেনদেন ইতিহাস</h4>
                        ${cust.history.length === 0 ? '<div class="p-10 text-center text-slate-300">কোন ইতিহাস নেই</div>' : ''}
                        ${cust.history.map(h => `
                            <div class="bg-white p-5 rounded-2xl flex justify-between items-center border border-slate-100 shadow-sm active:bg-slate-50">
                                <div class="flex items-center gap-4">
                                    <div class="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 text-xs">
                                        <i class="fas fa-calendar-alt"></i>
                                    </div>
                                    <div>
                                        <p class="text-sm font-bold text-slate-700">${h.date}</p>
                                        <p class="text-[11px] text-slate-400">${h.qty} পিস সুপারি</p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-5">
                                    <div class="text-right">
                                        <p class="text-[10px] text-slate-400 font-bold uppercase">বাকি</p>
                                        <p class="font-black text-rose-500">৳${h.due.toLocaleString('bn-BD')}</p>
                                    </div>
                                    <button onclick="deleteTr(${h.id})" class="text-slate-200 p-2 hover:text-rose-500">
                                        <i class="fas fa-trash-alt text-sm"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <div class="p-6 bg-white border-t flex gap-4">
                <button onclick="closeModal('detailModal')" class="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black hover:bg-slate-200">বন্ধ করুন</button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}

// হোয়াটসঅ্যাপ মেসেজ পাঠানো
function sendWhatsApp(id) {
    const cust = customers.find(c => c.id === id);
    let tBill = 0, tCash = 0;
    cust.history.forEach(h => { tBill += h.bill; tCash += h.cash; });
    const due = tBill - tCash;
    const text = `নমস্কার ${cust.name} দা, আপনার বন্ধন এন্টারপ্রাইজে বর্তমান মোট বাকি ৳${due.toLocaleString('bn-BD')}। অনুগ্রহ করে দ্রুত পরিশোধ করবেন। ধন্যবাদ!`;
    const formattedPhone = cust.phone.startsWith('0') ? '88' + cust.phone : cust.phone;
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`, '_blank');
}

// ডিলিট এবং অন্যান্য ফাংশন
function softDeleteCustomer(id) { deleteTargetId = id; deleteType = 'customer'; showDeleteModal(); }
function deleteTr(trId) { deleteTargetId = trId; deleteType = 'transaction'; showDeleteModal(); }

function showDeleteModal() {
    vibrate();
    const modalHTML = `
        <div id="deleteConfirmModal" class="modal-overlay fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[110] flex items-end md:items-center justify-center">
            <div class="bg-white rounded-t-[2.5rem] md:rounded-[2rem] w-full max-w-sm p-8 shadow-2xl scale-in text-center pb-12">
                <div class="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <i class="fas fa-trash-alt text-3xl"></i>
                </div>
                <h3 class="text-2xl font-black text-slate-800 mb-2">মুছে ফেলবেন?</h3>
                <p class="text-slate-500 text-sm mb-6 px-4">নিশ্চিত করতে নিচে <span class="font-bold text-rose-600">DELETE</span> লিখুন</p>
                <input type="text" id="deleteInput" autocomplete="off" class="w-full p-4 bg-slate-100 rounded-2xl mb-6 text-center outline-none focus:ring-2 focus:ring-rose-500 font-black text-lg">
                <div class="flex gap-4">
                    <button onclick="closeDeleteModal()" class="flex-1 py-4 text-slate-400 font-bold">না</button>
                    <button onclick="handleFinalDelete()" class="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-black shadow-lg">মুছুন</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    setTimeout(() => document.getElementById('deleteInput').focus(), 300);
}

function closeDeleteModal() { const el = document.getElementById('deleteConfirmModal'); if(el) el.remove(); }

function handleFinalDelete() {
    const input = document.getElementById('deleteInput').value.trim();
    if (input === "DELETE") {
        if (deleteType === 'transaction') {
            const idx = customers.findIndex(c => c.id === currentId);
            customers[idx].history = customers[idx].history.filter(h => h.id !== deleteTargetId);
            viewDetails(currentId);
        } else if (deleteType === 'customer') {
            const cust = customers.find(c => c.id === deleteTargetId);
            if (!recycleBin.find(item => item.id === cust.id)) recycleBin.push(cust);
            customers = customers.filter(c => c.id !== deleteTargetId);
        }
        saveData();
        render();
        closeDeleteModal();
        vibrate();
    } else { alert("ভুল হয়েছে! 'DELETE' লিখুন।"); }
}

// বিন এবং মোডাল হ্যান্ডলিং
function openModal(id) { document.getElementById(id).classList.remove('hidden'); if(id === 'binModal') renderBin(); vibrate(); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); currentId = null; }

function filterTable() {
    let q = document.getElementById('search').value.toLowerCase();
    let rows = document.querySelectorAll('#customerTable tr');
    rows.forEach(r => {
        const text = r.innerText.toLowerCase();
        r.style.display = text.includes(q) ? '' : 'none';
    });
}

function renderBin() {
    const binBody = document.getElementById('binTable');
    if(!binBody) return;
    binBody.innerHTML = recycleBin.length === 0 ? '<tr><td colspan="2" class="p-20 text-center text-slate-300 font-bold">বিন খালি</td></tr>' : '';
    recycleBin.forEach(cust => {
        binBody.innerHTML += `
            <tr class="border-b last:border-0">
                <td class="p-5 font-bold text-slate-700">${cust.name}</td>
                <td class="p-5 text-right flex justify-end gap-2">
                    <button onclick="restoreCustomer(${cust.id})" class="text-emerald-600 font-black bg-emerald-50 px-4 py-2 rounded-xl text-xs">ফিরিয়ে আনুন</button>
                </td>
            </tr>
        `;
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

// PWA Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('SW failed', err));
    });
}
// ইন্টারনেট ফিরে আসলে অটো সিঙ্ক
window.addEventListener('online', processQueue);
