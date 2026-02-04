const SHEET_URL = "https://script.google.com/macros/s/AKfycbwCLJTE0243PM8WYJym0N35aAYbss4-yMBsB4eooHcE5p7cmr55vgZT6MONLtePMRsKbA/exec"; 

let customers = JSON.parse(localStorage.getItem('supari_v4_data')) || [];
let recycleBin = JSON.parse(localStorage.getItem('supari_v4_bin')) || [];
let currentId = null;
let deleteTargetId = null;
let deleteType = ''; 

function saveData() {
    localStorage.setItem('supari_v4_data', JSON.stringify(customers));
    localStorage.setItem('supari_v4_bin', JSON.stringify(recycleBin));
}

window.onload = async function() {
    render();
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
                            id: Date.now() + Math.random(),
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
    } catch (e) { console.log("সিঙ্ক হয়নি।"); }
};

async function syncToSheet(data) {
    try {
        await fetch(SHEET_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    } catch (e) {}
}

function saveCustomer() {
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value || 'N/A';
    if(!name) return alert("নাম লিখুন!");
    const newCust = { id: Date.now(), name, phone, history: [], createdAt: new Date().toLocaleDateString('bn-BD') };
    customers.push(newCust);
    saveData();
    closeModal('customerModal');
    render();
    syncToSheet({ id: newCust.id, name, phone, qty: 0, bill: 0, cash: 0, due: 0 });
}

function addTransaction() {
    const qty = parseInt(document.getElementById('trQty').value) || 0;
    const bill = parseFloat(document.getElementById('trBill').value) || 0;
    const cash = parseFloat(document.getElementById('trCash').value) || 0;
    if(bill === 0 && cash === 0 && qty === 0) return alert("সঠিক হিসাব দিন!");

    const index = customers.findIndex(c => c.id === currentId);
    const newHistory = { id: Date.now(), date: new Date().toLocaleDateString('bn-BD'), qty, bill, cash, due: bill - cash };
    customers[index].history.unshift(newHistory);
    saveData();
    syncToSheet({ id: customers[index].id, name: customers[index].name, phone: customers[index].phone, qty, bill, cash, due: bill - cash });
    viewDetails(currentId);
    render();
}

function softDeleteCustomer(id) {
    deleteTargetId = id;
    deleteType = 'customer';
    showDeleteModal();
}

function deleteTr(trId) {
    deleteTargetId = trId;
    deleteType = 'transaction';
    showDeleteModal();
}

function showDeleteModal() {
    const modalHTML = `
        <div id="deleteConfirmModal" class="modal-overlay fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <div class="bg-white rounded-[2rem] w-full max-w-xs p-6 shadow-2xl scale-in text-center">
                <div class="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-exclamation-triangle text-2xl"></i>
                </div>
                <h3 class="text-xl font-black text-slate-800 mb-2">আপনি কি নিশ্চিত?</h3>
                <p class="text-slate-500 text-xs mb-4">মুছতে ইংরেজিতে বড় হাতের <span class="font-bold text-rose-600 uppercase">DELETE</span> লিখুন</p>
                <input type="text" id="deleteInput" placeholder="এখানে লিখুন..." class="w-full p-3 bg-slate-100 rounded-xl mb-4 text-center border-none ring-1 ring-slate-200 outline-none focus:ring-rose-500 font-bold">
                <div class="flex gap-3">
                    <button onclick="closeDeleteModal()" class="flex-1 py-3 text-slate-500 font-bold">না</button>
                    <button onclick="handleFinalDelete()" class="flex-1 py-3 bg-rose-500 text-white rounded-xl font-bold shadow-lg">মুছুন</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeDeleteModal() {
    const el = document.getElementById('deleteConfirmModal');
    if(el) el.remove();
}

// --- আপনার দেওয়া নতুন ডিলিট হ্যান্ডেলার ফাংশনটি এখানে ---
function handleFinalDelete() {
    const input = document.getElementById('deleteInput').value;
    
    if (input === "DELETE") {
        if (deleteType === 'transaction') {
            const idx = customers.findIndex(c => c.id === currentId);
            customers[idx].history = customers[idx].history.filter(h => h.id !== deleteTargetId);
        } else if (deleteType === 'customer') {
            const cust = customers.find(c => c.id === deleteTargetId);
            if (!recycleBin.find(item => item.id === cust.id)) {
                recycleBin.push(cust); 
            }
            customers = customers.filter(c => c.id !== deleteTargetId);
        }
        saveData();
        render();
        if(currentId && deleteType === 'transaction') viewDetails(currentId);
        closeDeleteModal();
    } else {
        alert("ভুল হয়েছে! ইংরেজি বড় হাতের অক্ষরে 'DELETE' লিখুন।");
    }
}

function render() {
    const tbody = document.getElementById('customerTable');
    if(!tbody) return;
    tbody.innerHTML = '';
    let gDue = 0, gCash = 0, gQty = 0;

    customers.forEach(cust => {
        let bill = 0, cash = 0, qty = 0;
        cust.history.forEach(h => { bill += h.bill; cash += h.cash; qty += h.qty; });
        const due = bill - cash;
        gDue += due; gCash += cash; gQty += qty;

        tbody.innerHTML += `
            <tr onclick="viewDetails(${cust.id})" class="active:bg-slate-50 border-b border-slate-50">
                <td class="p-4">
                    <div class="font-bold text-slate-800 text-sm">${cust.name}</div>
                    <div class="text-[10px] text-slate-400">${cust.phone}</div>
                </td>
                <td class="p-4 text-center font-black text-sm ${due > 0 ? 'text-rose-500' : 'text-emerald-500'}">৳${due}</td>
                <td class="p-4 text-center">
                    <button onclick="event.stopPropagation(); softDeleteCustomer(${cust.id})" class="text-slate-200 p-2 hover:text-rose-500"><i class="fas fa-trash-alt"></i></button>
                </td>
            </tr>
        `;
    });
    document.getElementById('totalCust').innerText = customers.length;
    document.getElementById('totalDue').innerText = "৳" + gDue;
    document.getElementById('totalCash').innerText = "৳" + gCash;
    document.getElementById('totalQty').innerText = gQty;
}

function viewDetails(id) {
    currentId = id;
    const cust = customers.find(c => c.id === id);
    let tBill = 0, tCash = 0;
    cust.history.forEach(h => { tBill += h.bill; tCash += h.cash; });
    
    const modal = document.getElementById('detailModal');
    modal.innerHTML = `
        <div class="bg-white rounded-t-[2.5rem] md:rounded-[2rem] w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden shadow-2xl scale-in">
            <div class="p-6 bg-slate-900 text-white flex justify-between items-center">
                <div><h2 class="text-xl font-black">${cust.name}</h2><p class="text-slate-400 text-xs">${cust.phone}</p></div>
                <div class="bg-rose-500/20 px-3 py-2 rounded-xl text-center">
                    <p class="text-[8px] uppercase text-rose-300">মোট বাকি</p>
                    <p class="text-rose-400 font-bold">৳${tBill - tCash}</p>
                </div>
            </div>
            <div class="flex-1 overflow-y-auto bg-slate-50 p-4">
                <div class="flex flex-col md:flex-row gap-4">
                    <div class="w-full md:w-72 bg-white p-5 rounded-2xl border">
                        <input type="number" id="trQty" placeholder="সুপারি (পিস)" class="w-full p-3 bg-slate-50 rounded-xl mb-2 outline-none ring-1 ring-slate-200">
                        <input type="number" id="trBill" placeholder="মোট বিল" class="w-full p-3 bg-slate-50 rounded-xl mb-2 outline-none ring-1 ring-slate-200">
                        <input type="number" id="trCash" placeholder="নগদ জমা" class="w-full p-3 bg-green-50 rounded-xl mb-3 outline-none ring-1 ring-green-100 font-bold">
                        <button onclick="addTransaction()" class="w-full bg-green-600 text-white py-3 rounded-xl font-black shadow-lg">সেভ করুন</button>
                    </div>
                    <div class="flex-1 space-y-2">
                        ${cust.history.map(h => `
                            <div class="bg-white p-4 rounded-xl border flex justify-between items-center">
                                <div><p class="text-sm font-bold">${h.date}</p><p class="text-[10px] text-slate-400">${h.qty} পিস</p></div>
                                <div class="flex items-center gap-4">
                                    <div class="text-right font-black text-rose-500 text-sm">৳${h.due}</div>
                                    <button onclick="deleteTr(${h.id})" class="text-slate-200 p-2 hover:text-rose-500"><i class="fas fa-trash-alt"></i></button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="p-4 bg-white border-t"><button onclick="closeModal('detailModal')" class="w-full py-4 bg-slate-100 text-slate-600 rounded-xl font-bold">বন্ধ করুন</button></div>
        </div>
    `;
    modal.classList.remove('hidden');
}

function openModal(id) { 
    document.getElementById(id).classList.remove('hidden');
    if(id === 'binModal') renderBin();
}
function closeModal(id) { document.getElementById(id).classList.add('hidden'); currentId = null; }

function renderBin() {
    const binBody = document.getElementById('binTable');
    binBody.innerHTML = recycleBin.map(cust => `
        <tr class="border-b">
            <td class="p-4 text-sm font-bold">${cust.name}</td>
            <td class="p-4 text-right">
                <button onclick="restoreCustomer(${cust.id})" class="text-emerald-500 font-bold mr-2">ফিরিয়ে আনুন</button>
                <button onclick="permanentDelete(${cust.id})" class="text-rose-400">স্থায়ীভাবে মুছুন</button>
            </td>
        </tr>
    `).join('');
}

function restoreCustomer(id) {
    const cust = recycleBin.find(c => c.id === id);
    customers.push(cust);
    recycleBin = recycleBin.filter(c => c.id !== id);
    saveData(); render(); renderBin();
}

function permanentDelete(id) {
    if(confirm("চিরতরে মুছে যাবে!")) {
        recycleBin = recycleBin.filter(c => c.id !== id);
        saveData(); renderBin();
    }
}

function filterTable() {
    let q = document.getElementById('search').value.toLowerCase();
    let rows = document.querySelectorAll('#customerTable tr');
    rows.forEach(r => r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none');
}
