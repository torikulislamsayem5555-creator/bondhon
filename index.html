<!DOCTYPE html>
<html lang="bn" data-lang="bn">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, interactive-widget=resizes-content">
    <title>Bondhon Enterprise | Premium</title>
    <link rel="manifest" href="manifest.json">
    <meta name="theme-color" content="#0d9488">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600;700&family=Hind+Siliguri:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css">
    <script src="https://unpkg.com/dexie/dist/dexie.js"></script>
    <!-- Firebase Modular SDK v9 -->
    <script type="module">
        import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
        import { getDatabase, ref, set, update, remove, onValue, onChildAdded, onChildChanged, onChildRemoved, push, get, child }
            from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js';
        const firebaseConfig = {
            apiKey: "AIzaSyCqHJaoDuULIhdgciOPDRzVPjrD7Z0U6y8",
            authDomain: "all-data-receved-supari.firebaseapp.com",
            databaseURL: "https://all-data-receved-supari-default-rtdb.firebaseio.com",
            projectId: "all-data-receved-supari",
            storageBucket: "all-data-receved-supari.firebasestorage.app",
            messagingSenderId: "534039941580",
            appId: "1:534039941580:web:187a37823689b16adb8d69"
        };
        const app = initializeApp(firebaseConfig);
        const database = getDatabase(app);
        window.firebaseApp = app;
        window.firebaseDb = database;
        window.firebaseRef = ref;
        window.firebaseSet = set;
        window.firebaseUpdate = update;
        window.firebaseRemove = remove;
        window.firebaseOnValue = onValue;
        window.firebaseOnChildAdded = onChildAdded;
        window.firebaseOnChildChanged = onChildChanged;
        window.firebaseOnChildRemoved = onChildRemoved;
        window.firebasePush = push;
        window.firebaseGet = get;
        window.firebaseChild = child;
        window.dispatchEvent(new Event('firebaseReady'));
    </script>
</head>
<body class="app-body">
    <div class="app-bg-pattern"></div>
    <div class="app-grain"></div>

    <!-- TOP NAV -->
    <nav class="nav-modern">
        <div class="nav-inner">
            <div class="flex items-center gap-3">
                <div class="logo-icon"><i class="fas fa-leaf"></i></div>
                <div>
                    <h1 class="logo-text">
                        <span data-bn="বন্ধন" data-en="Bondhon">বন্ধন</span>
                        <span class="logo-accent" data-bn="এন্টারপ্রাইজ" data-en="Enterprise">এন্টারপ্রাইজ</span>
                    </h1>
                    <p class="logo-sub" data-bn="ক্রেডিট ম্যানেজমেন্ট" data-en="Credit Management">ক্রেডিট ম্যানেজমেন্ট</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button id="notificationBtn" class="nav-btn notification-btn" title="Notifications">
                    <i class="fas fa-bell"></i>
                    <span id="notificationBadge" class="notification-badge hidden">0</span>
                </button>
                <button onclick="toggleLanguage()" class="nav-btn" title="Language Switch">
                    <i class="fas fa-language"></i>
                </button>
                <button onclick="openModal('binModal')" class="nav-btn nav-btn-mobile" title="Recycle Bin">
                    <i class="fas fa-trash-alt"></i>
                    <span class="nav-btn-text" data-bn="বিন" data-en="Bin">বিন</span>
                </button>
                <button onclick="openModal('settingsModal')" class="nav-btn nav-btn-mobile" title="Settings">
                    <i class="fas fa-cog"></i>
                    <span class="nav-btn-text" data-bn="সেটিংস" data-en="Settings">সেটিংস</span>
                </button>
            </div>
        </div>
    </nav>

    <!-- MAIN CONTENT -->
    <main class="main-content">
        <!-- STATS -->
        <section class="hero-stats">
            <div class="stat-grid">
                <div class="stat-card stat-card-1">
                    <div class="stat-icon stat-icon-blue"><i class="fas fa-users"></i></div>
                    <p class="stat-label" data-bn="কাস্টমার" data-en="Customers">কাস্টমার</p>
                    <h2 id="totalCust" class="stat-value">0</h2>
                </div>
                <div class="stat-card stat-card-2">
                    <div class="stat-icon stat-icon-orange"><i class="fas fa-box"></i></div>
                    <p class="stat-label" data-bn="সুপারি" data-en="Products">সুপারি</p>
                    <h2 id="totalQty" class="stat-value">0</h2>
                </div>
                <div class="stat-card stat-card-due">
                    <div class="stat-glow"></div>
                    <p class="stat-label-light" data-bn="মোট বাকি" data-en="Total Due">মোট বাকি</p>
                    <h2 id="totalDue" class="stat-value-light">৳০</h2>
                </div>
                <div class="stat-card stat-card-cash">
                    <div class="stat-glow"></div>
                    <p class="stat-label-light" data-bn="মোট জমা" data-en="Total Paid">মোট জমা</p>
                    <h2 id="totalCash" class="stat-value-light">৳০</h2>
                </div>
            </div>
        </section>

        <!-- SEARCH -->
        <section class="search-section">
            <div class="search-wrapper">
                <i class="fas fa-search search-icon"></i>
                <input type="text" id="search" onkeyup="filterTable()" placeholder="কাস্টমার খুঁজুন..." class="search-input"
                    data-bn-placeholder="কাস্টমার খুঁজুন..." data-en-placeholder="Search customers...">
                <button onclick="startVoiceInput()" class="search-voice" title="Voice search">
                    <i class="fas fa-microphone"></i>
                    <span class="voice-text" data-bn="ভয়েস" data-en="Voice">ভয়েস</span>
                </button>
            </div>
            <select id="sortSelect" onchange="applySort()" class="sort-select">
                <option value="newest" data-bn="নতুন আগে" data-en="Newest first">নতুন আগে</option>
                <option value="oldest" data-bn="পুরনো আগে" data-en="Oldest first">পুরনো আগে</option>
                <option value="name" data-bn="নাম অনুযায়ী" data-en="By name">নাম অনুযায়ী</option>
                <option value="dueHigh" data-bn="বাকি বেশি" data-en="Highest due">বাকি বেশি</option>
                <option value="dueLow" data-bn="বাকি কম" data-en="Lowest due">বাকি কম</option>
            </select>
        </section>

        <!-- CUSTOMER LIST -->
        <section class="list-section">
            <div class="list-card">
                <div class="list-header">
                    <h3 class="list-title" data-bn="কাস্টমার তালিকা" data-en="Customer List">কাস্টমার তালিকা</h3>
                    <div class="list-actions">
                        <div id="statusBadge" class="status-badge status-online">
                            <span class="status-dot"></span>
                            <span data-bn="Online" data-en="Online">Online</span>
                        </div>
                        <button onclick="openModal('reportModal')" class="action-btn" title="Report">
                            <i class="fas fa-chart-pie"></i>
                            <span class="action-btn-text" data-bn="রিপোর্ট" data-en="Report">রিপোর্ট</span>
                        </button>
                        <div class="dropdown-wrap">
                            <button onclick="toggleExportMenu()" class="action-btn" title="Export">
                                <i class="fas fa-download"></i>
                                <span class="action-btn-text" data-bn="এক্সপোর্ট" data-en="Export">এক্সপোর্ট</span>
                            </button>
                            <div id="exportMenu" class="dropdown-menu hidden">
                                <button onclick="exportCSV()" class="dropdown-item">
                                    <i class="fas fa-file-csv"></i>
                                    <span data-bn="CSV ডাউনলোড" data-en="Download CSV">CSV ডাউনলোড</span>
                                </button>
                                <button onclick="exportJSON()" class="dropdown-item">
                                    <i class="fas fa-file-code"></i>
                                    <span data-bn="JSON ব্যাকআপ" data-en="JSON Backup">JSON ব্যাকআপ</span>
                                </button>
                                <button onclick="printReport()" class="dropdown-item">
                                    <i class="fas fa-print"></i>
                                    <span data-bn="প্রিন্ট করুন" data-en="Print Report">প্রিন্ট করুন</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="list-body">
                    <table class="w-full"><tbody id="customerTable" class="customer-table"></tbody></table>
                </div>
            </div>
        </section>
    </main>

    <!-- FAB -->
    <button onclick="openAddCustomer()" class="fab">
        <span class="fab-icon"><i class="fas fa-plus"></i></span>
        <span class="fab-ripple"></span>
    </button>

    <!-- BOTTOM NAV -->
    <nav class="bottom-nav">
        <button onclick="scrollTopSmooth()" class="nav-item nav-active">
            <i class="fas fa-home"></i>
            <span data-bn="হোম" data-en="Home">হোম</span>
        </button>
        <button onclick="openAddCustomer()" class="nav-item">
            <i class="fas fa-user-plus"></i>
            <span data-bn="নতুন" data-en="New">নতুন</span>
        </button>
        <button onclick="openModal('reportModal')" class="nav-item">
            <i class="fas fa-chart-bar"></i>
            <span data-bn="রিপোর্ট" data-en="Report">রিপোর্ট</span>
        </button>
        <button onclick="openModal('binModal')" class="nav-item">
            <i class="fas fa-history"></i>
            <span data-bn="বিন" data-en="Bin">বিন</span>
        </button>
        <button onclick="openModal('settingsModal')" class="nav-item">
            <i class="fas fa-cog"></i>
            <span data-bn="সেটিংস" data-en="Settings">সেটিংস</span>
        </button>
    </nav>

    <!-- TOAST CONTAINER -->
    <div id="toastContainer" class="toast-container"></div>

    <!-- ═══ CUSTOMER MODAL ═══ -->
    <div id="customerModal" class="modal-overlay hidden">
        <div class="modal-backdrop" onclick="closeModal('customerModal')"></div>
        <div class="modal-sheet">
            <div class="modal-handle"></div>
            <h3 id="customerModalTitle" class="modal-title">নতুন কাস্টমার</h3>
            <p class="modal-subtitle" data-bn="প্রোফাইল তৈরি করুন" data-en="Create profile">প্রোফাইল তৈরি করুন</p>
            <div class="modal-body">
                <input type="text" id="name" placeholder="কাস্টমারের নাম" class="input-field"
                    data-bn-placeholder="কাস্টমারের নাম" data-en-placeholder="Customer name">
                <input type="text" id="phone" placeholder="মোবাইল নম্বর" class="input-field" inputmode="tel"
                    data-bn-placeholder="মোবাইল নম্বর" data-en-placeholder="Mobile number">
                <select id="custTag" class="input-field">
                    <option value="">ট্যাগ (ঐচ্ছিক)</option>
                    <option value="VIP">⭐ VIP</option>
                    <option value="Regular">নিয়মিত</option>
                    <option value="New">নতুন</option>
                </select>
                <input type="text" id="custNotes" placeholder="নোট (ঐচ্ছিক)" class="input-field"
                    data-bn-placeholder="নোট (ঐচ্ছিক)" data-en-placeholder="Notes (optional)">
                <div class="modal-actions">
                    <button onclick="closeModal('customerModal')" class="btn-secondary">বন্ধ</button>
                    <button onclick="saveCustomer()" class="btn-primary">সেভ করুন</button>
                </div>
            </div>
        </div>
    </div>

    <!-- ═══ DETAIL MODAL ═══ -->
    <div id="detailModal" class="modal-overlay hidden overflow-hidden"></div>

    <!-- ═══ ADD TRANSACTION MODAL ═══ -->
    <div id="addTransactionModal" class="modal-overlay hidden">
        <div class="modal-backdrop" onclick="closeModal('addTransactionModal')"></div>
        <div class="modal-sheet">
            <div class="modal-handle"></div>
            <h3 class="modal-title" data-bn="নতুন বিক্রয়" data-en="New Sale">নতুন বিক্রয়</h3>
            <p class="modal-subtitle" data-bn="লেনদেন যোগ করুন" data-en="Add transaction">লেনদেন যোগ করুন</p>
            <div class="modal-body">
                <input type="number" id="txQty" placeholder="সুপারি পরিমাণ" class="input-field" inputmode="decimal"
                    data-bn-placeholder="সুপারি পরিমাণ" data-en-placeholder="Quantity">
                <input type="number" id="txBill" placeholder="বিল" class="input-field" inputmode="decimal"
                    data-bn-placeholder="বিল" data-en-placeholder="Bill amount" oninput="updateTxDuePreview()">
                <input type="number" id="txCash" placeholder="জমা" class="input-field" inputmode="decimal"
                    data-bn-placeholder="জমা" data-en-placeholder="Amount paid" oninput="updateTxDuePreview()">
                <input type="text" id="txDetails" placeholder="বিস্তারিত (ঐচ্ছিক)" class="input-field"
                    data-bn-placeholder="বিস্তারিত (ঐচ্ছিক)" data-en-placeholder="Details (optional)">
                <div id="txDuePreview" style="background: rgba(220,38,38,0.08); border-radius: var(--radius-md); padding: 14px 18px; display: none;">
                    <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;" data-bn="বাকি থাকবে" data-en="Remaining due">বাকি থাকবে</p>
                    <p id="txDueAmount" style="font-size: 22px; font-weight: 900; color: var(--danger);"></p>
                </div>
                <div class="modal-actions">
                    <button onclick="closeModal('addTransactionModal')" class="btn-secondary">বন্ধ</button>
                    <button onclick="submitTransaction()" class="btn-primary">সেভ করুন</button>
                </div>
            </div>
        </div>
    </div>

    <!-- ═══ REPORT MODAL ═══ -->
    <div id="reportModal" class="modal-overlay hidden">
        <div class="modal-backdrop" onclick="closeModal('reportModal')"></div>
        <div class="modal-sheet modal-sheet-tall">
            <div class="modal-handle"></div>
            <div class="modal-header">
                <h3 class="modal-title" data-bn="রিপোর্ট ও অ্যানালিটিক্স" data-en="Reports & Analytics">রিপোর্ট ও অ্যানালিটিক্স</h3>
                <button onclick="closeModal('reportModal')" class="modal-close">&times;</button>
            </div>
            <div id="reportContent" class="report-content"></div>
            <button onclick="closeModal('reportModal')" class="btn-secondary btn-full">বন্ধ করুন</button>
        </div>
    </div>

    <!-- ═══ SETTINGS MODAL ═══ -->
    <div id="settingsModal" class="modal-overlay hidden">
        <div class="modal-backdrop" onclick="closeModal('settingsModal')"></div>
        <div class="modal-sheet">
            <div class="modal-handle"></div>
            <h3 class="modal-title" data-bn="সেটিংস" data-en="Settings">সেটিংস</h3>
            <div class="modal-body">
                <div class="settings-row">
                    <span class="settings-label" data-bn="ডার্ক মোড" data-en="Dark Mode">ডার্ক মোড</span>
                    <button id="themeToggle" onclick="toggleTheme()" class="toggle-btn">
                        <span class="toggle-thumb"></span>
                    </button>
                </div>
                <div class="settings-block">
                    <label class="settings-label" data-bn="মুদ্রা প্রতীক" data-en="Currency Symbol">মুদ্রা প্রতীক</label>
                    <input type="text" id="currencySymbol" placeholder="৳" class="input-field" maxlength="3">
                </div>
                <div class="settings-block">
                    <label class="settings-label" data-bn="ডাটা ইম্পোর্ট (JSON)" data-en="Data Import (JSON)">ডাটা ইম্পোর্ট (JSON)</label>
                    <input type="file" id="importFile" accept=".json" onchange="handleImport(event)" class="input-file">
                </div>
                <div class="modal-actions">
                    <button onclick="closeModal('settingsModal')" class="btn-secondary">বন্ধ</button>
                    <button onclick="saveSettings()" class="btn-primary">সেভ করুন</button>
                </div>
            </div>
        </div>
    </div>

    <!-- ═══ BIN MODAL ═══ -->
    <div id="binModal" class="modal-overlay hidden">
        <div class="modal-backdrop" onclick="closeModal('binModal')"></div>
        <div class="modal-sheet modal-sheet-tall">
            <div class="modal-handle"></div>
            <div class="modal-header">
                <h3 class="modal-title" data-bn="রিসাইকেল বিন" data-en="Recycle Bin">রিসাইকেল বিন</h3>
                <button onclick="closeModal('binModal')" class="modal-close">&times;</button>
            </div>
            <div class="bin-content">
                <table class="w-full"><tbody id="binTable"></tbody></table>
            </div>
            <button onclick="closeModal('binModal')" class="btn-secondary btn-full">বন্ধ করুন</button>
        </div>
    </div>

    <!-- ═══ SECURE DELETE CONFIRMATION MODAL ═══ -->
    <div id="deleteConfirmModal" class="modal-overlay hidden" style="z-index: 350;">
        <div class="modal-backdrop"></div>
        <div class="modal-sheet" style="max-width: 420px;">
            <div class="modal-handle"></div>
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="width: 68px; height: 68px; background: rgba(220,38,38,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; border: 2px solid rgba(220,38,38,0.25);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 28px; color: var(--danger);"></i>
                </div>
                <h3 id="deleteModalTitle" class="modal-title" style="color: var(--danger); font-size: 1.25rem;"></h3>
                <p id="deleteModalSubtitle" style="font-size: 14px; color: var(--text-secondary); margin-top: 10px; line-height: 1.6;"></p>
            </div>
            <div style="background: rgba(220,38,38,0.06); border: 1px solid rgba(220,38,38,0.2); border-radius: var(--radius-md); padding: 18px; margin-bottom: 22px;">
                <p id="deleteTypingInstruction" style="font-size: 13px; color: var(--danger); font-weight: 700; margin-bottom: 12px; text-align: center;"></p>
                <input
                    type="text" id="deleteConfirmInput" class="input-field"
                    placeholder="DELETE"
                    oninput="checkDeleteInput()"
                    autocomplete="off" spellcheck="false"
                    style="text-align: center; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; border-color: rgba(220,38,38,0.3); background: var(--bg-card); font-size: 18px;"
                >
            </div>
            <div class="modal-actions">
                <button onclick="cancelDelete()" class="btn-secondary">বাতিল</button>
                <button id="confirmDeleteBtn" onclick="executeDelete()" class="btn-danger" disabled>
                    <i class="fas fa-trash"></i> মুছুন
                </button>
            </div>
        </div>
    </div>

    <script src="script.js"></script>
</body>
</html>
