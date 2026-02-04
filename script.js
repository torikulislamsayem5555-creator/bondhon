// ১. আপনার গুগল অ্যাপস স্ক্রিপ্ট লিঙ্কটি এখানে দিন
const SHEET_URL = "https://script.google.com/macros/s/AKfycbwCLJTE0243PM8WYJym0N35aAYbss4-yMBsB4eooHcE5p7cmr55vgZT6MONLtePMRsKbA/exec"; 

let customers = JSON.parse(localStorage.getItem('supari_v4_data')) || [];
let recycleBin = JSON.parse(localStorage.getItem('supari_v4_bin')) || [];
let currentId = null;

// --- ডাটা সেভ ফাংশন (ব্রাউজারে) ---
function saveData() {
    localStorage.setItem('supari_v4_data', JSON.stringify(customers));
    localStorage.setItem('supari_v4_bin', JSON.stringify(recycleBin));
}

// --- ১. ওয়েবসাইট খোলার সময় গুগল শিট থেকে ডাটা সিঙ্ক করার ফাংশন ---
window.onload = async function() {
    console.log("সিঙ্কিং শুরু হচ্ছে...");
    try {
        const response = await fetch(SHEET_URL);
        const sheetData = await response.json();
        
        if (sheetData && sheetData.length > 0) {
            let tempCustomers = [];
            
            sheetData.forEach(row => {
                let existing = tempCustomers.find(c => c.id === row.id);
                if (existing) {
                    // যদি কাস্টমার আগে থেকেই থাকে, তার ইতিহাস (History) আপডেট করো
                    if(row.bill > 0 || row.cash > 0 || row.qty > 0) {
                        existing.history.push({
                            id: Date.now() + Math.random(),
                            date: new Date(row.date).toLocaleDateString('bn-BD'),
                            qty: row.qty,
                            bill: row.bill,
                            cash: row.cash,
                            due: row.due
                        });
                    }
                } else {
                    // নতুন কাস্টমার হিসেবে যুক্ত করো
                    tempCustomers.push({
                        id: row.id,
                        name: row.name,
                        phone: row.phone,
                        history: (row.bill > 0 || row.cash > 0 || row.qty > 0) ? [{
                            id: Date.now(),
                            date: new Date(row.date).toLocaleDateString('bn-BD'),
                            qty: row.qty,
                            bill: row.bill,
                            cash: row.cash,
                            due: row.due
                        }] : []
                    });
                }
            });
            
            customers = tempCustomers;
            saveData();
            render();
            console.log("গুগল শিট থেকে ডাটা সফলভাবে সিঙ্ক হয়েছে!");
        }
    } catch (error) {
        console.error("সিঙ্ক করতে সমস্যা হয়েছে:", error);
        render(); // সিঙ্ক না হলেও লোকাল ডাটা দেখাও
    }
};

// --- ২. গুগল শিটে ডাটা পাঠানোর ফাংশন ---
async function syncToSheet(data) {
    try {
        await fetch(SHEET_URL, {
            method: "POST",
            mode: "no-cors", 
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        console.log("শিটে ডাটা পাঠানো হয়েছে!");
    } catch (error) {
        console.error("শিটে পাঠাতে ব্যর্থ:", error);
    }
}

// --- নতুন কাস্টমার যোগ করা ---
function saveCustomer() {
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value || 'N/A';
    
    if(!name) {
        alert("কাস্টমারের নাম অবশ্যই দিতে হবে!");
        return;
    }

    const newCust = {
        id: Date.now(),
        name: name,
        phone: phone,
        history: [],
        createdAt: new Date().toLocaleDateString('bn-BD')
    };

    customers.push(newCust);
    saveData();
    closeModal('customerModal');
    render();

    // গুগল শিটে কাস্টমার তৈরি করা
    syncToSheet({
        id: newCust.id,
        name: name,
        phone: phone,
        qty: 0, bill: 0, cash: 0, due: 0
    });

    document.getElementById('name').value = '';
    document.getElementById('phone').value = '';
}

// --- লেনদেন যোগ করা ---
function addTransaction() {
    const qty = parseInt(document.getElementById('trQty').value) || 0;
    const bill = parseFloat(document.getElementById('trBill').value) || 0;
    const cash = parseFloat(document.getElementById('trCash').value) || 0;
    const due = bill - cash;

    if(bill === 0 && cash === 0 && qty === 0) {
        alert("হিসাব সঠিকভাবে লিখুন!");
        return;
    }

    const index = customers.findIndex(c => c.id === currentId);
    const cust = customers[index];

    const newHistory = {
        id: Date.now(),
        date: new Date().toLocaleDateString('bn-BD'),
        qty: qty,
        bill: bill,
        cash: cash,
        due: due
    };

    cust.history.unshift(newHistory);
    saveData();

    // গুগল শিটে লেনদেন আপডেট করা
    syncToSheet({
        id: cust.id,
        name: cust.name,
        phone: cust.phone,
        qty: qty,
        bill: bill,
        cash: cash,
        due: due
    });

    viewDetails(currentId); 
    render(); 
}

// --- কাস্টমার ডিটেইলস পপআপ ---
function viewDetails(id) {
    currentId = id;
    const cust = customers.find(c => c.id === id);
    if (!cust) return;

    let totalBill = 0, totalCash = 0, totalQty = 0;
    cust.history.forEach(h => {
        totalBill += h.bill;
        totalCash += h.cash;
        totalQty += h.qty;
    });
    const totalDue = totalBill - totalCash;

    const modal = document.getElementById('detailModal');
    modal.innerHTML = `
        <div class="bg-white rounded-[2.5rem] w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden shadow-2xl scale-in border-4 border-slate-50">
            <div class="relative p-8 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg">
                <div class="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div class="flex items-center gap-5">
                        <div class="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center text-3xl font-black">${cust.name.charAt(0)}</div>
                        <div>
                            <h2 class="text-4xl font-black">${cust.name}</h2>
                            <p class="text-slate-400 font-medium">ID: ${cust.id.toString().slice(-5)} | ${cust.phone}</p>
                        </div>
                    </div>
                    <div class="flex gap-4">
                        <div class="bg-white/5 p-4 rounded-3xl text-center min-w-[140px]">
                            <p class="text-[10px] text-slate-400 font-bold uppercase">মোট জমা</p>
                            <h3 class="text-2xl font-black text-emerald-400">৳ ${totalCash}</h3>
                        </div>
                        <div class="bg-rose-500/10 p-4 rounded-3xl text-center min-w-[140px]">
                            <p class="text-[10px] text-rose-300 font-bold uppercase">বাকি টাকা</p>
                            <h3 class="text-2xl font-black text-rose-400">৳ ${totalDue}</h3>
                        </div>
                    </div>
                </div>
            </div>
            <div class="flex-1 overflow-hidden flex flex-col md:flex-row">
                <div class="w-full md:w-[380px] p-8 bg-slate-50 border-r overflow-y-auto">
                    <div class="bg-white p-6 rounded-3xl border">
                        <h4 class="text-sm font-black text-slate-800 mb-6 uppercase">নতুন হিসাব যোগ</h4>
                        <div class="space-y-4">
                            <input type="number" id="trQty" placeholder="সুপারি পিস" class="w-full bg-slate-100 p-4 rounded-2xl font-bold">
                            <input type="number" id="trBill" placeholder="মোট বিল" class="w-full bg-slate-100 p-4 rounded-2xl font-bold">
                            <input type="number" id="trCash" placeholder="নগদ জমা" class="w-full bg-green-50 p-4 rounded-2xl font-bold">
                            <button onclick="addTransaction()" class="w-full bg-green-600 text-white py-5 rounded-2xl font-black shadow-lg">কনফার্ম করুন</button>
                        </div>
                    </div>
                </div>
                <div class="flex-1 p-8 overflow-y-auto bg-white">
                    <div class="space-y-3">
                        ${cust.history.map(h => `
                            <div class="flex items-center justify-between p-5 bg-white border rounded-3xl">
                                <div>
                                    <p class="font-black text-slate-700">${h.date}</p>
                                    <p class="text-xs text-slate-400">সুপারি: ${h.qty} পিস</p>
                                </div>
                                <div class="flex items-center gap-10">
                                    <div class="text-right">
                                        <p class="text-[10px] font-bold">বিল/জমা</p>
                                        <p class="font-bold text-slate-600">${h.bill}/${h.cash}</p>
                                    </div>
                                    <div class="text-right min-w-[80px]">
                                        <p class="text-[10px] font-bold">বাকি</p>
                                        <p class="font-black text-rose-500">৳ ${h.due}</p>
                                    </div>
                                    <button onclick="deleteTr(${h.id})" class="text-slate-300 hover:text-rose-500"><i class="fas fa-trash-alt"></i></button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="p-6 bg-slate-50 border-t flex justify-end">
                <button onclick="closeModal('detailModal')" class="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black">বন্ধ করুন</button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}

// --- রেন্ডার ফাংশন ---
function render() {
    const tbody = document.getElementById('customerTable');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    let gDue = 0, gCash = 0, gQty = 0;

    customers.forEach(cust => {
        let bill = 0, cash = 0, qty = 0;
        cust.history.forEach(h => {
            bill += h.bill; cash += h.cash; qty += h.qty;
        });
        const due = bill - cash;
        gDue += due; gCash += cash; gQty += qty;

        tbody.innerHTML += `
            <tr onclick="viewDetails(${cust.id})" class="cursor-pointer group border-b border-slate-50 last:border-0">
                <td class="p-6">
                    <div class="font-bold text-slate-800 text-lg group-hover:text-green-600">${cust.name}</div>
                    <div class="text-[11px] text-slate-400 font-bold uppercase"><i class="fas fa-phone-alt"></i> ${cust.phone}</div>
                </td>
                <td class="p-6 text-center">
                    <span class="bg-slate-100 text-slate-600 px-4 py-1.5 rounded-full text-xs font-black uppercase">${qty} পিস</span>
                </td>
                <td class="p-6 text-right font-black text-xl ${due > 0 ? 'text-rose-500' : 'text-emerald-500'}">
                    ৳ ${due}
                </td>
                <td class="p-6 text-center">
                    <button onclick="event.stopPropagation(); softDeleteCustomer(${cust.id})" class="text-slate-200 hover:text-rose-500 p-2">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    document.getElementById('totalCust').innerText = customers.length;
    document.getElementById('totalDue').innerText = "৳ " + gDue;
    document.getElementById('totalCash').innerText = "৳ " + gCash;
    document.getElementById('totalQty').innerText = gQty;
}

// --- হেল্পার ফাংশনস ---
function deleteTr(trId) {
    if(!confirm("মুছে ফেলবেন?")) return;
    const idx = customers.findIndex(c => c.id === currentId);
    customers[idx].history = customers[idx].history.filter(h => h.id !== trId);
    saveData();
    viewDetails(currentId);
    render();
}

function softDeleteCustomer(id) {
    const cust = customers.find(c => c.id === id);
    const confirmText = prompt(`কাস্টমার '${cust.name}' ডিলিট করতে চাইলে ইংরেজিতে 'DELETE' লিখুন:`);
    if(confirmText === "DELETE") {
        recycleBin.push(cust);
        customers = customers.filter(c => c.id !== id);
        saveData();
        render();
    }
}

function renderBin() {
    const binBody = document.getElementById('binTable');
    binBody.innerHTML = '';
    recycleBin.forEach(cust => {
        binBody.innerHTML += `
            <tr class="border-b last:border-0 border-slate-100">
                <td class="p-4 font-bold text-slate-700">${cust.name}</td>
                <td class="p-4 text-right">
                    <button onclick="restoreCustomer(${cust.id})" class="text-emerald-500 font-bold text-sm bg-emerald-50 px-4 py-2 rounded-xl">ফিরিয়ে আনুন</button>
                    <button onclick="permanentDelete(${cust.id})" class="text-rose-400 ml-3 text-sm">স্থায়ীভাবে মুছুন</button>
                </td>
            </tr>
        `;
    });
}

function restoreCustomer(id) {
    const cust = recycleBin.find(c => c.id === id);
    customers.push(cust);
    recycleBin = recycleBin.filter(c => c.id !== id);
    saveData();
    render();
    renderBin();
}

function permanentDelete(id) {
    if(confirm("সাবধান! এটি চিরতরে মুছে যাবে।")) {
        recycleBin = recycleBin.filter(c => c.id !== id);
        saveData();
        renderBin();
    }
}

function openModal(id) { 
    document.getElementById(id).classList.remove('hidden');
    if(id === 'binModal') renderBin();
}
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function filterTable() {
    let q = document.getElementById('search').value.toLowerCase();
    let rows = document.querySelectorAll('#customerTable tr');
    rows.forEach(r => r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none');
}

render();
