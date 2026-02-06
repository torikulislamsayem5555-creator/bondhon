const SHEET_URL = "https://script.google.com/macros/s/AKfycbwCLJTE0243PM8WYJym0N35aAYbss4-yMBsB4eooHcE5p7cmr55vgZT6MONLtePMRsKbA/exec";

// ১. Dexie DB (IndexedDB) Setup
const db = new Dexie("BondhonDB");
db.version(1).stores({
    customers: 'id, name, phone',
    recycleBin: 'id, name',
    syncQueue: '++id, action'
});

// ২. Global Variables
let currentId = null;
let deleteTargetId = null;
let deleteType = null;

// ৩. iOS Style Modal Controls (স্মুথ এনিমেশন)
function openModal(id) {
    const modal = document.getElementById(id);
    if(!modal) return;
    modal.classList.remove('hidden');
    modal.style.opacity = "0";
    setTimeout(() => { modal.style.opacity = "1"; }, 10);
    
    if(id === 'binModal') renderBin();
    vibrate(15); 
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if(!modal) return;
    modal.style.opacity = "0";
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 400); 
}

// ৪. Haptic Feedback (Vibration)
function vibrate(time = 50) {
    if (navigator.vibrate) navigator.vibrate(time);
}

// ৫. Online/Offline Status Check
function updateOnlineStatus() {
    const statusLabel = document.querySelector('.bg-emerald-100 span');
    if (!statusLabel) return;
    
    if (navigator.onLine) {
        statusLabel.innerText = "Online";
        statusLabel.parentElement.className = "bg-emerald-100 text-emerald-600 text-[10px] px-3 py-1 rounded-full font-bold uppercase flex items-center gap-1";
        processQueue(); 
    } else {
        statusLabel.innerText = "Offline";
        statusLabel.parentElement.className = "bg-rose-100 text-rose-600 text-[10px] px-3 py-1 rounded-full font-bold uppercase flex items-center gap-1";
    }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
// ৬. Purano Data Migration
async function migrateData() {
    const oldData = JSON.parse(localStorage.getItem('supari_v4_data')) || [];
    const oldBin = JSON.parse(localStorage.getItem('supari_v4_bin')) || [];
    
    if (oldData.length > 0) {
        await db.customers.bulkPut(oldData);
        localStorage.removeItem('supari_v4_data');
        console.log("Old data migrated!");
    }
    if (oldBin.length > 0) {
        await db.recycleBin.bulkPut(oldBin);
        localStorage.removeItem('supari_v4_bin');
    }
    localStorage.removeItem('supari_data');
    localStorage.removeItem('customers');
}

// ৭. মেইন টেবিল রেন্ডার (UI আপডেট)
async function render() {
    const tbody = document.getElementById('customerTable');
    if(!tbody) return;

    // লেটেস্ট কাস্টমার আগে দেখাবে
    const customers = await db.customers.reverse().toArray(); 
    
    tbody.innerHTML = '';
    let gDue = 0, gCash = 0, gQty = 0;

    if(customers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-20 text-center text-slate-400 italic">কোন কাস্টমার নেই</td></tr>`;
    }

    customers.forEach(cust => {
        let bill = 0, cash = 0, qty = 0;
        if (cust.history) {
            cust.history.forEach(h => { 
                bill += (parseFloat(h.bill) || 0); 
                cash += (parseFloat(h.cash) || 0); 
                qty += (parseInt(h.qty) || 0); 
            });
        }
        
        const due = bill - cash;
        gDue += due; gCash += cash; gQty += qty;

        tbody.innerHTML += `
            <tr onclick="viewDetails(${cust.id})" class="active:bg-slate-100 border-b border-slate-50 transition-colors cursor-pointer">
                <td class="p-4 font-bold text-slate-800">
                    ${cust.name}
                    <div class="text-[11px] text-slate-400 font-normal flex items-center gap-1">
                        <i class="fas fa-phone-alt text-[8px]"></i> ${cust.phone || 'N/A'}
                    </div>
                </td>
                <td class="p-4 text-center font-black ${due > 0 ? 'text-rose-500' : 'text-emerald-500'}">
                    ৳${due.toLocaleString('bn-BD')}
                </td>
                <td class="p-4 text-center">
                    <button onclick="event.stopPropagation(); softDeleteCustomer(${cust.id})" class="text-slate-300 p-2 hover:text-rose-500">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>`;
    });

    // ড্যাশবোর্ড কাউন্টার আপডেট
    document.getElementById('totalCust').innerText = customers.length.toLocaleString('bn-BD');
    document.getElementById('totalDue').innerText = "৳" + gDue.toLocaleString('bn-BD');
    document.getElementById('totalCash').innerText = "৳" + gCash.toLocaleString('bn-BD');
    document.getElementById('totalQty').innerText = gQty.toLocaleString('bn-BD');
}
// ৮. নতুন কাস্টমার সেভ করা
async function saveCustomer() {
    const nameInput = document.getElementById('name');
    const phoneInput = document.getElementById('phone');
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim() || 'N/A';

    if(!name) { 
        vibrate(100); 
        alert("অনুগ্রহ করে কাস্টমারের নাম লিখুন!"); 
        return; 
    }
    
    const newCust = { 
        id: Date.now(), 
        name, 
        phone, 
        history: [], 
        createdAt: new Date().toISOString() 
    };
    
    await db.customers.add(newCust);
    closeModal('customerModal');
    render(); 
    vibrate(30);

    syncToSheet({ 
        action: 'add_customer',
        id: newCust.id, 
        name, phone, qty: 0, bill: 0, cash: 0, due: 0 
    });

    nameInput.value = '';
    phoneInput.value = '';
}

// ৯. কাস্টমার বিস্তারিত তথ্য দেখা (iOS Style Detail View)
async function viewDetails(id) {
    currentId = id;
    const cust = await db.customers.get(id);
    if (!cust) return;

    let tBill = 0, tCash = 0;
    cust.history.forEach(h => { 
        tBill += (parseFloat(h.bill) || 0); 
        tCash += (parseFloat(h.cash) || 0); 
    });
    
    const modal = document.getElementById('detailModal');
    modal.innerHTML = `
        <div class="ios-card w-full p-8 scale-in max-h-[94vh] flex flex-col shadow-2xl">
            <div class="w-12 h-1.5 bg-slate-300/50 rounded-full mx-auto mb-6"></div>
            
            <div class="flex justify-between items-start mb-6">
                <div>
                    <h2 class="text-2xl font-black text-slate-800">${cust.name}</h2>
                    <p class="text-slate-500 text-sm font-bold uppercase tracking-tighter">${cust.phone}</p>
                </div>
                <div class="text-right">
                    <p class="text-[10px] font-black text-rose-400 uppercase">মোট বাকি</p>
                    <p class="text-xl font-black text-rose-500">৳${(tBill - tCash).toLocaleString('bn-BD')}</p>
                </div>
            </div>

            <div class="overflow-y-auto flex-1 space-y-4 pr-2">
                <div class="bg-slate-100/50 p-6 rounded-[2rem] space-y-3">
                    <p class="text-[10px] font-black text-slate-400 uppercase ml-1">নতুন লেনদেন</p>
                    <input type="number" id="trQty" inputmode="numeric" placeholder="সুপারি (পিস)" class="w-full p-4 bg-white rounded-2xl outline-none ring-1 ring-slate-100 focus:ring-2 focus:ring-emerald-500">
                    <div class="grid grid-cols-2 gap-3">
                        <input type="number" id="trBill" inputmode="numeric" placeholder="মোট বিল" class="w-full p-4 bg-white rounded-2xl outline-none ring-1 ring-slate-100 focus:ring-2 focus:ring-emerald-500">
                        <input type="number" id="trCash" inputmode="numeric" placeholder="নগদ জমা" class="w-full p-4 bg-emerald-50 rounded-2xl outline-none ring-1 ring-emerald-100 focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-700">
                    </div>
                    <button onclick="addTransaction()" class="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black shadow-lg active:scale-95 transition-transform">সেভ করুন</button>
                </div>

                <div class="space-y-3">
                    <h4 class="text-xs font-black text-slate-400 uppercase ml-2">লেনদেন ইতিহাস</h4>
                    ${cust.history.length === 0 ? '<p class="text-center text-slate-300 py-10 italic">কোন ইতিহাস নেই</p>' : 
                      cust.history.slice().reverse().map(h => `
                        <div class="bg-white p-4 rounded-2xl flex justify-between items-center border border-slate-100 shadow-sm">
                            <div>
                                <p class="text-sm font-bold text-slate-700">${new Date(h.date).toLocaleDateString('bn-BD')}</p>
                                <p class="text-[10px] text-slate-400">${h.qty || 0} পিস</p>
                            </div>
                            <div class="flex items-center gap-4">
                                <div class="text-right">
                                    <p class="font-black text-sm ${h.due > 0 ? 'text-rose-500' : 'text-emerald-500'}">৳${h.due.toLocaleString('bn-BD')}</p>
                                    <p class="text-[8px] text-slate-400 font-medium">জমা: ৳${h.cash.toLocaleString('bn-BD')}</p>
                                </div>
                                <button onclick="deleteTr(${h.id})" class="text-slate-200 hover:text-rose-400">
                                    <i class="fas fa-trash-alt text-xs"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="pt-4">
                <button onclick="closeModal('detailModal')" class="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold uppercase text-xs tracking-widest">বন্ধ করুন</button>
            </div>
        </div>
    `;
    openModal('detailModal');
    setupInputScroll(); 
}
// ১০. নতুন লেনদেন যোগ করা
async function addTransaction() {
    const qtyInput = document.getElementById('trQty');
    const billInput = document.getElementById('trBill');
    const cashInput = document.getElementById('trCash');
    
    const qty = parseInt(qtyInput.value) || 0;
    const bill = parseFloat(billInput.value) || 0;
    const cash = parseFloat(cashInput.value) || 0;

    if (bill === 0 && cash === 0) {
        vibrate(100);
        alert("বিল অথবা নগদ জমার পরিমাণ লিখুন!");
        return;
    }

    const cust = await db.customers.get(currentId);
    if (!cust) return;

    const newTr = {
        id: Date.now(),
        date: new Date().toISOString(),
        qty: qty,
        bill: bill,
        cash: cash,
        due: bill - cash
    };

    cust.history.push(newTr);
    await db.customers.put(cust);
    
    // UI আপডেট
    viewDetails(currentId);
    render();
    vibrate(30);

    // গুগল শিটে সিঙ্ক
    syncToSheet({ 
        action: 'add_transaction', 
        customerId: currentId, 
        ...newTr 
    });

    // ইনপুট ফিল্ড রিসেট
    qtyInput.value = '';
    billInput.value = '';
    cashInput.value = '';
}

// ১১. গুগল শিটে ডাটা পাঠানো (Queue লজিক সহ)
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

// ১২. লেনদেন ডিলিট করা
async function deleteTr(trId) {
    if(!confirm("এই লেনদেনটি কি মুছে ফেলতে চান?")) return;
    
    const cust = await db.customers.get(currentId);
    if (cust) {
        cust.history = cust.history.filter(h => h.id !== trId);
        await db.customers.put(cust);
        
        syncToSheet({ 
            action: 'delete_transaction', 
            customerId: currentId, 
            trId: trId 
        });
        
        viewDetails(currentId);
        render();
        vibrate(50);
    }
}
// ১৩. কাস্টমারকে রিসাইকেল বিন-এ পাঠানো (Soft Delete)
function softDeleteCustomer(id) {
    deleteTargetId = id;
    deleteType = 'customer';
    showAdvancedDeleteModal("কাস্টমার মুছতে নিচে 'DELETE' লিখুন। এটি করলে কাস্টমারটি রিসাইকেল বিন-এ যাবে।");
}

// ১৪. অ্যাডভান্সড ডিলিট কনফার্মেশন (DELETE টাইপ করা)
function showAdvancedDeleteModal(msg) {
    vibrate(50);
    const oldModal = document.getElementById('advancedDeleteModal');
    if(oldModal) oldModal.remove();

    const modalHTML = `
        <div id="advancedDeleteModal" class="modal-overlay fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-6 backdrop-blur-sm">
            <div class="bg-white rounded-[2.5rem] w-full max-w-sm p-8 text-center scale-in">
                <div class="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-trash-alt text-2xl"></i>
                </div>
                <h3 class="text-xl font-black mb-2 text-slate-800">আপনি কি নিশ্চিত?</h3>
                <p class="text-slate-500 text-sm mb-6">${msg}</p>
                <input type="text" id="deleteConfirmInput" placeholder="এখানে DELETE লিখুন" class="w-full p-4 mb-6 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center font-bold focus:border-rose-500 outline-none">
                <div class="flex gap-3">
                    <button onclick="closeAdvancedDeleteModal()" class="flex-1 py-4 bg-slate-100 rounded-2xl font-bold text-slate-600">না</button>
                    <button id="finalDeleteBtn" onclick="verifyAndDelete()" class="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-bold opacity-50 cursor-not-allowed">মুছুন</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const input = document.getElementById('deleteConfirmInput');
    const btn = document.getElementById('finalDeleteBtn');
    input.addEventListener('input', (e) => {
        if(e.target.value.trim() === "DELETE") {
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    });
}

function verifyAndDelete() {
    const input = document.getElementById('deleteConfirmInput');
    if(input.value.trim() === "DELETE") {
        handleFinalDelete();
        closeAdvancedDeleteModal();
    }
}

function closeAdvancedDeleteModal() {
    const modal = document.getElementById('advancedDeleteModal');
    if(modal) modal.remove();
}

// ১৫. চূড়ান্ত ডিলিট লজিক
async function handleFinalDelete() {
    if (deleteType === 'customer') {
        const cust = await db.customers.get(deleteTargetId);
        if (cust) {
            await db.recycleBin.put(cust);
            await db.customers.delete(deleteTargetId);
            syncToSheet({ action: 'delete_customer', id: deleteTargetId });
        }
    } else if (deleteType === 'permanent') {
        await db.recycleBin.delete(deleteTargetId);
    }

    render();
    if(!document.getElementById('binModal').classList.contains('hidden')) renderBin();
    vibrate(50);
}

// ১৬. রিসাইকেল বিন রেন্ডার
async function renderBin() {
    const binBody = document.getElementById('binTable');
    if(!binBody) return;
    
    const binData = await db.recycleBin.toArray();
    binBody.innerHTML = binData.length === 0 ? 
        '<tr><td class="p-10 text-center text-slate-300 font-bold">বিন খালি</td></tr>' : '';
        
    binData.forEach(cust => {
        binBody.innerHTML += `
            <tr class="border-b border-slate-100">
                <td class="p-4">
                    <p class="font-bold text-slate-700">${cust.name}</p>
                    <p class="text-[10px] text-slate-400">${cust.phone}</p>
                </td>
                <td class="p-4 text-right flex gap-2 justify-end">
                    <button onclick="restoreCustomer(${cust.id})" class="text-emerald-600 bg-emerald-50 p-2 rounded-lg" title="রিস্টোর">
                        <i class="fas fa-undo"></i>
                    </button>
                    <button onclick="permanentDelete(${cust.id})" class="text-rose-500 bg-rose-50 p-2 rounded-lg" title="চিরতরে মুছুন">
                        <i class="fas fa-times"></i>
                    </button>
                </td>
            </tr>`;
    });
}

async function restoreCustomer(id) {
    const cust = await db.recycleBin.get(id);
    if(cust) {
        await db.customers.put(cust);
        await db.recycleBin.delete(id);
        render(); 
        renderBin(); 
        vibrate(30);
        syncToSheet({ action: 'restore_customer', id: id });
    }
}

function permanentDelete(id) {
    deleteTargetId = id;
    deleteType = 'permanent';
    showAdvancedDeleteModal("এটি চিরতরে ডিলিট করতে নিচে 'DELETE' লিখুন।");
}

// ১৭. সার্চ এবং ভয়েস ইনপুট
function filterTable() {
    let q = document.getElementById('search').value.toLowerCase();
    const rows = document.querySelectorAll('#customerTable tr');
    rows.forEach(r => {
        r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
}

function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("ভয়েস টাইপিং সাপোর্ট করে না।");
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'bn-BD';
    recognition.onstart = () => {
        vibrate(20);
        document.getElementById('search').placeholder = "বলুন, শুনছি...";
    };
    recognition.onresult = (event) => {
        document.getElementById('search').value = event.results[0][0].transcript;
        filterTable();
        document.getElementById('search').placeholder = "কাস্টমার খুঁজুন...";
    };
    recognition.start();
}

// ১৮. কিবোর্ড এবং স্ক্রল ফিক্স
function setupInputScroll() {
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('focus', () => {
            setTimeout(() => {
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        });
    });
}

// ১৯. ফাইনাল লোড
window.onload = async function() {
    await migrateData();
    await render();
    updateOnlineStatus();
    setupInputScroll();
};
