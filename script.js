document.addEventListener('DOMContentLoaded', () => {
    // User Management Configuration
    const USERS = {
        Bhavin: {
            password: "Bhavin",
            contact: "9924426959 | skagro3105@gmail.com"
        },
        Meet: {
            password: "Meet",
            contact: "7778078032 | skagro3105@gmail.com"
        },
        Dharmesh: {
            password: "Dharmesh",
            contact: "9106714212 | skagro3105@gmail.com"
        },
        Tirth: {
            password: "Tirth",
            contact: "9664675227 | skagro3105@gmail.com"
        }
    };

    let currentUser = null;

    // State management for items (includes brand)
    let items = [
        { id: 1, brand: '', description: '', itemDetails: '', quantity: 1, price: 0.00 }
    ];
    // Paste your Google Sheets CSV URL here:
    const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR_VwyESB419ROlLkNZmuQ18cyLit9leySgP6VpetMr509IjARdSEBw1uFGNGIseaLTdbbe4iR8kcXN/pub?output=csv'; // Paste your Google Sheets published CSV URL here

    // Products array (will be loaded from Google Sheets or Excel)
    // Each product: { name, price, brand }
    let PRODUCTS = [];

    function normalizeHeader(header) {
        return String(header || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }

    function isBrandHeader(header) {
        const h = normalizeHeader(header);
        return /(^|\s)brand(\s*name)?(\s|$)/.test(h);
    }

    function isPriceHeader(header) {
        const h = normalizeHeader(header);
        return /(^|\s)(price|rate|mrp)(\s|$)/.test(h);
    }

    function isProductHeader(header) {
        const h = normalizeHeader(header);
        if (!h) return false;
        if (isBrandHeader(h) || isPriceHeader(h)) return false;
        return /(^|\s)(product|technical|item|description|name)(\s|$)/.test(h);
    }

    // DOM Elementsx
    const itemsContainer = document.getElementById('items-container');
    const addItemBtn = document.getElementById('addItemBtn');
    const addRowBtn = document.getElementById('addRowBtn');
    const previewItemsBody = document.getElementById('previewItemsBody');
    const previewGrandTotal = document.getElementById('previewGrandTotal');
    const generatePdfBtn = document.getElementById('generatePdfBtn');
    const invoiceDateEl = document.getElementById('invoiceDate');
    const previewInvoiceDateEl = document.getElementById('previewInvoiceDate');
    // Date preview flags declared early to avoid race if login is clicked before script finishes
    let previewDateManual = false;
    let lastInvoiceDateValue = invoiceDateEl ? invoiceDateEl.value : '';

    const autocompleteMenu = document.createElement('div');
    autocompleteMenu.className = 'autocomplete-menu';
    document.body.appendChild(autocompleteMenu);
    let activeDescriptionInput = null;
    let activeAutocompleteIndex = -1;
    let activeAutocompleteItems = [];
    let autocompleteOpenTime = 0;
    let _ac_touchStartY = 0;
    let _ac_touchStartX = 0;
    let _ac_touchMoved = false;

    // Input fields mapping
    const inputs = {
        senderName: 'previewSenderName',
        senderAddress1: 'previewSenderAddress1',
        senderAddress2: 'previewSenderAddress2',
        senderContact: 'previewSenderContact',
        senderGSTIN: 'previewSenderGSTIN',
        receiverName: 'previewReceiverName',
        receiverDetails: 'previewReceiverDetails',
        receiverAddress: 'previewReceiverAddress',
        receiverPhone: 'previewReceiverPhone',
        invoiceNumber: 'previewInvoiceNumber',
        invoiceDate: 'previewInvoiceDate'
    };

    // Elements for QR and Excel
    const excelUpload = document.getElementById('excelUpload');
    const qrToggle = document.getElementById('qrToggle');
    const qrContainer = document.getElementById('qrContainer');
    const bankDetailsPreview = document.getElementById('bankDetailsPreview');
    const companyDetailsPreview = document.getElementById('companyDetailsPreview');
    const qrImageUpload = document.getElementById('qrImageUpload');
    const qrImageUrl = document.getElementById('qrImageUrl');
    let qrImageDataUrl = null;
    const previewQR = document.getElementById('previewQR');
    const qrStaticLink = document.getElementById('qrStaticLink');

    // Function to load products from Google Sheets
    async function loadProductsFromGoogleSheets() {
        const statusEl = document.getElementById('product-status-text');

        if (!GOOGLE_SHEET_CSV_URL || GOOGLE_SHEET_CSV_URL.trim() === '') {
            console.log('⚠️ Google Sheets URL not configured');
            if (statusEl) statusEl.textContent = '⚠️ No product source configured';
            return;
        }

        if (statusEl) statusEl.textContent = '📥 Loading products from Google Sheets...';
        console.log('📥 Loading products from Google Sheets...');

        try {
            const response = await fetch(GOOGLE_SHEET_CSV_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const csvText = await response.text();
            console.log('📄 CSV Data received:', csvText.substring(0, 100) + '...');

            // Parse CSV (attempt to read header columns: name, price, brand)
            const lines = csvText.trim().split('\n');
            if (lines.length < 2) {
                console.warn('⚠️ Google Sheet has no products');
                if (statusEl) statusEl.textContent = '⚠️ No products found in sheet';
                return;
            }

            const header = lines[0].split(',').map(h => h.trim());
            const brandIdx = header.findIndex(isBrandHeader);
            const nameIdx = header.findIndex(isProductHeader);
            const priceIdx = header.findIndex(isPriceHeader);

            const products = [];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const parts = line.split(',');
                // Fallback: if header not recognized, use first two columns
                let brand = (brandIdx >= 0 ? (parts[brandIdx] || '') : '').trim();
                let name = (nameIdx >= 0 ? (parts[nameIdx] || '') : '').trim();
                const priceStr = (priceIdx >= 0 ? (parts[priceIdx] || '') : (parts[1] || '')).trim();
                // Brand-only sheets should still work with brand autocomplete.
                if (!brand && !name) {
                    const fallback = (parts[0] || '').trim();
                    brand = fallback;
                    name = fallback;
                } else if (!name && brand) {
                    name = brand;
                } else if (!brand && name) {
                    brand = name;
                }
                const price = parseFloat(priceStr) || 0;
                if (name || brand) {
                    products.push({ name, price, brand });
                    console.log(`  ✓ ${name} (${brand}): ₹${price}`);
                }
            }

            if (products.length > 0) {
                PRODUCTS.length = 0; // Clear existing
                PRODUCTS.push(...products); // Add new products
                console.log(`✅ Successfully loaded ${products.length} products from Google Sheets`);
                if (statusEl) {
                    statusEl.innerHTML = `✅ <span style="color: #22c55e;">${products.length} products loaded from Google Sheets</span>`;
                }

                // If the user already clicked the input and is waiting, immediately update the dropdown
                if (activeDescriptionInput && autocompleteMenu.style.display === 'block') {
                    const query = activeDescriptionInput.value || '';
                    const field = activeDescriptionInput.dataset.field;
                    let matches;
                    if (field === 'brand') {
                        matches = filterBrands(query);
                    } else {
                        matches = filterProducts(query);
                    }
                    openAutocomplete(activeDescriptionInput, matches);
                }
            } else {
                console.warn('⚠️ No valid products found in Google Sheet');
                if (statusEl) statusEl.textContent = '⚠️ No valid products found';
            }
        } catch (error) {
            console.error('❌ Error loading products from Google Sheets:', error);
            console.error('   Make sure the sheet is published to web as CSV');
            if (statusEl) {
                statusEl.innerHTML = `❌ <span style="color: #ef4444;">Error loading products. Check console (F12) for details.</span>`;
            }
        }
    }

    // Load products from Google Sheets on page load
    loadProductsFromGoogleSheets();

    // Excel import handling (SheetJS)
    async function handleExcelFile(file) {
        const statusEl = document.getElementById('excel-status');
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            const products = [];
            json.forEach(row => {
                // Normalize keys
                const keys = Object.keys(row);
                let name = '';
                let price = 0;
                let brand = '';
                keys.forEach(k => {
                    if (isBrandHeader(k)) {
                        brand = row[k];
                    } else if (isPriceHeader(k)) {
                        price = parseFloat(row[k]) || 0;
                    } else if (isProductHeader(k)) {
                        name = row[k];
                    }
                });
                // Fallbacks so brand-only uploads remain searchable.
                if (!name && !brand && keys[0]) {
                    const fallback = row[keys[0]];
                    name = fallback;
                    brand = fallback;
                } else if (!name && brand) {
                    name = brand;
                } else if (!brand && name) {
                    brand = name;
                }
                if (!price && keys[1]) price = parseFloat(row[keys[1]]) || 0;
                if (name || brand) {
                    products.push({
                        name: String(name || '').trim(),
                        price,
                        brand: String(brand || '').trim()
                    });
                }
            });

            if (products.length) {
                PRODUCTS.length = 0;
                PRODUCTS.push(...products);
                if (statusEl) statusEl.innerHTML = `✅ <span style="color:#22c55e">${products.length} products loaded from Excel</span>`;
                // refresh autocomplete list if currently open
                if (activeDescriptionInput && autocompleteMenu.style.display === 'block') {
                    const query = activeDescriptionInput.value || '';
                    const field = activeDescriptionInput.dataset.field;
                    const matches = field === 'brand' ? filterBrands(query) : filterProducts(query);
                    openAutocomplete(activeDescriptionInput, matches);
                }
            } else {
                if (statusEl) statusEl.textContent = '⚠️ No products found in Excel';
            }
        } catch (err) {
            console.error('Excel parse error', err);
            if (statusEl) statusEl.textContent = '❌ Error parsing Excel';
        }
    }

    if (excelUpload) {
        excelUpload.addEventListener('change', (e) => {
            const f = e.target.files[0];
            if (f) handleExcelFile(f);
        });
    }

    // QR Code generation and controls
    function getQRText() {
        // Simplified: always generate QR from the Bank Details text (full block)
        return bankDetailsPreview ? bankDetailsPreview.innerText.trim() : '';
    }

    function updateQRCode() {
        if (!qrContainer) return;
        // clear
        qrContainer.innerHTML = '';
        if (!qrToggle || !qrToggle.checked) {
            try { qrContainer.style.display = 'none'; } catch (e) {}
            if (qrStaticLink) qrStaticLink.style.display = 'none';
            return;
        }
        try { qrContainer.style.display = 'flex'; } catch (e) {}
        // If user provided an uploaded image use it
        if (qrImageDataUrl) {
            const img = document.createElement('img');
            img.src = qrImageDataUrl;
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            qrContainer.appendChild(img);
            if (qrStaticLink) qrStaticLink.style.display = 'none';
            return;
        }

        // If user provided an image URL
        const url = qrImageUrl ? qrImageUrl.value.trim() : '';
        if (url) {
            const img = document.createElement('img');
            // Encode the URL so filenames with spaces (e.g. 'qr code.jpg') work
            try {
                const src = (url.indexOf('://') === -1) ? encodeURI(url) : url;
                img.src = src;
            } catch (e) {
                img.src = url;
            }
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.decoding = 'async';
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                // image loaded successfully
            };
            img.onerror = () => {
                console.warn('QR image URL failed to load:', url);
            };
            qrContainer.appendChild(img);
            if (qrStaticLink) qrStaticLink.style.display = 'none';
            return;
        }

        // No upload or URL: try loading a local static file 'qr-code.jpg' and use it if available.
        try {
            const localSrc = 'qr-code.jpg';
            const imgLocal = document.createElement('img');
            imgLocal.style.maxWidth = '100%';
            imgLocal.style.height = 'auto';
            imgLocal.decoding = 'async';
            imgLocal.crossOrigin = 'anonymous';

            imgLocal.onload = () => {
                // show the local image in the qr container
                qrContainer.appendChild(imgLocal);
                if (qrStaticLink) qrStaticLink.style.display = (qrToggle && qrToggle.checked) ? 'inline-block' : 'none';
            };

            imgLocal.onerror = () => {
                // local image not available - hide static link and fall back to generated QR
                if (qrStaticLink) qrStaticLink.style.display = 'none';
                const text = getQRText();
                if (!text) return;
                try {
                    new QRCode(qrContainer, {
                        text: String(text),
                        width: 140,
                        height: 140,
                        correctLevel: QRCode.CorrectLevel.H
                    });
                } catch (err) {
                    console.error('QR error', err);
                }
            };

            // Start loading the local image (onload or onerror will handle the rest)
            imgLocal.src = encodeURI(localSrc);
            return; // wait for onload/onerror to populate qrContainer
        } catch (err) {
            console.warn('Local QR load failed', err);
        }

        // Fallback: generate QR from bank details text
        const text = getQRText();
        if (!text) return;
        try {
            new QRCode(qrContainer, {
                text: String(text),
                width: 140,
                height: 140,
                correctLevel: QRCode.CorrectLevel.H
            });
        } catch (err) {
            console.error('QR error', err);
        }
    }

    if (qrToggle) qrToggle.addEventListener('change', updateQRCode);
    if (bankDetailsPreview) bankDetailsPreview.addEventListener('input', updateQRCode);
    if (qrImageUrl) qrImageUrl.addEventListener('input', () => { qrImageDataUrl = null; updateQRCode(); });
    if (qrImageUpload) {
        qrImageUpload.addEventListener('change', (e) => {
            const f = e.target.files && e.target.files[0];
            if (!f) { qrImageDataUrl = null; updateQRCode(); return; }
            const reader = new FileReader();
            reader.onload = (ev) => {
                qrImageDataUrl = ev.target.result;
                // clear URL if any
                if (qrImageUrl) qrImageUrl.value = '';
                updateQRCode();
            };
            reader.readAsDataURL(f);
        });
    }
    // initial
    setTimeout(updateQRCode, 250);

    // Static QR preview handling (show link only when toggle is ON and no upload/URL)
    if (previewQR) {
        previewQR.onload = () => {
            if (qrStaticLink) qrStaticLink.style.display = (qrToggle && qrToggle.checked && !qrImageDataUrl && !(qrImageUrl && qrImageUrl.value.trim())) ? 'inline-block' : 'none';
        };
        previewQR.onerror = () => {
            if (qrStaticLink) qrStaticLink.style.display = 'none';
        };
    }

    // Invoice Number Management
    function getNextInvoiceNumber() {
        if (!currentUser) return '001';
        const key = `lastInvoiceNumberStr_${currentUser}`;
        let stored = localStorage.getItem(key);
        if (!stored) {
            stored = '001';
            localStorage.setItem(key, stored);
        }
        return String(stored);
    }

    function incrementInvoiceNumber() {
        if (!currentUser) return;
        const key = `lastInvoiceNumberStr_${currentUser}`;
        let stored = localStorage.getItem(key) || '001';
        const numeric = parseInt(stored, 10) || 0;
        const next = numeric + 1;
        const nextStr = String(next).padStart(3, '0');
        localStorage.setItem(key, nextStr);
        document.getElementById('invoiceNumber').value = nextStr;
        updatePreview();
    }

    // Login and Session Management
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const logoutBtn = document.getElementById('logoutBtn');

    function initializeAppForUser(username) {
        currentUser = username;
        const userData = USERS[username];

        // Forcefully set the contact number depending on the logged in user
        if (userData.contact) {
            document.getElementById('senderContact').value = userData.contact;
        }

        // Reset and show next invoice number for this user
        document.getElementById('invoiceNumber').value = getNextInvoiceNumber();
        renderItemsInput();
        updatePreview();

        // Reveal the app
        loginContainer.style.display = 'none';
        appContainer.style.display = 'block';
    }

    // Centralized login handler to be used for submit and button click
    function handleLoginEvent(e) {
        if (e && e.preventDefault) e.preventDefault();
        try {
            const userVal = document.getElementById('loginUsername').value.trim();
            const passVal = document.getElementById('loginPassword').value.trim();

            console.log('Attempt login', { userVal });

            // Match username case-insensitively
            const matchedKey = Object.keys(USERS).find(k => k.toLowerCase() === userVal.toLowerCase());
            if (matchedKey && USERS[matchedKey].password === passVal) {
                localStorage.setItem('loggedInUser', matchedKey);
                loginError.style.display = 'none';
                initializeAppForUser(matchedKey);
                return true;
            }

            loginError.textContent = "Invalid username or password. Check capitalization.";
            loginError.style.display = 'block';
            return false;
        } catch (err) {
            console.error('Login handler error', err);
            if (loginError) {
                loginError.textContent = 'Login error. See console.';
                loginError.style.display = 'block';
            }
            return false;
        }
    }

    // Attach for form submit and button click (cover both cases)
    if (loginForm) loginForm.addEventListener('submit', handleLoginEvent);
    const loginBtnEl = document.getElementById('loginBtn');
    if (loginBtnEl) loginBtnEl.addEventListener('click', handleLoginEvent);

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('loggedInUser');
        currentUser = null;
        appContainer.style.display = 'none';
        loginContainer.style.display = 'flex';
        document.getElementById('loginForm').reset();
    });

    // Check existing session
    const savedSession = localStorage.getItem('loggedInUser');
    if (savedSession && USERS[savedSession]) {
        initializeAppForUser(savedSession);
    } else {
        loginContainer.style.display = 'flex';
        appContainer.style.display = 'none';
    }

    // Initialize with today's date (ISO yyyy-mm-dd)
    if (invoiceDateEl && !invoiceDateEl.value) {
        invoiceDateEl.value = new Date().toISOString().split('T')[0];
    }

    // Auto-update date when the system day changes, unless the user manually edited the preview date
    setInterval(() => {
        try {
            if (typeof previewDateManual !== 'undefined' && previewDateManual) return;
            const todayIso = new Date().toISOString().split('T')[0];
            if (invoiceDateEl && invoiceDateEl.value !== todayIso) {
                invoiceDateEl.value = todayIso;
                lastInvoiceDateValue = todayIso;
                updatePreview();
            }
        } catch (err) {
            console.warn('Date auto-update failed', err);
        }
    }, 60 * 1000); // check every minute

    // Event Listeners for basic inputs
    Object.keys(inputs).forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('input', updatePreview);
        }
    });

    // Date sync flags: if user edits preview date directly, don't overwrite it when invoice number changes

    function toISODateStringFromText(text) {
        if (!text) return null;
        text = text.trim();
        // Try dd/mm/yyyy
        let m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m) {
            const dd = m[1].padStart(2, '0');
            const mm = m[2].padStart(2, '0');
            const yyyy = m[3];
            return `${yyyy}-${mm}-${dd}`;
        }
        // Try yyyy-mm-dd
        m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (m) {
            const yyyy = m[1];
            const mm = m[2].padStart(2, '0');
            const dd = m[3].padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        }
        // Fallback: try Date.parse
        const parsed = Date.parse(text);
        if (!Number.isNaN(parsed)) {
            return new Date(parsed).toISOString().split('T')[0];
        }
        return null;
    }

    if (previewInvoiceDateEl) {
        previewInvoiceDateEl.addEventListener('input', () => {
            previewDateManual = true;
        });
        previewInvoiceDateEl.addEventListener('blur', () => {
            const txt = previewInvoiceDateEl.textContent || '';
            const iso = toISODateStringFromText(txt);
            if (iso && invoiceDateEl) {
                invoiceDateEl.value = iso;
                lastInvoiceDateValue = iso;
                previewDateManual = true; // user edited preview intentionally
            }
        });
    }

    if (invoiceDateEl) {
        invoiceDateEl.addEventListener('change', () => {
            previewDateManual = false; // user changed via date input, keep preview in sync
            lastInvoiceDateValue = invoiceDateEl.value;
            updatePreview();
        });
    }

    // Logo Upload
    const logoUpload = document.getElementById('logoUpload');
    const previewLogo = document.getElementById('previewLogo');

    if (logoUpload) {
        logoUpload.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    previewLogo.src = e.target.result;
                    previewLogo.style.display = 'block';
                }
                reader.readAsDataURL(file);
            } else {
                previewLogo.src = '';
                previewLogo.style.display = 'none';
            }
        });
    }

    // Add Item Button
    function addNewItem() {
        items.push({ id: Date.now(), brand: '', description: '', itemDetails: '', quantity: 1, price: 0 });
        renderItemsInput();
        renderItemsTable();
    }

    if (addItemBtn) {
        addItemBtn.addEventListener('click', addNewItem);
    }

    if (addRowBtn) {
        addRowBtn.addEventListener('click', addNewItem);
    }

    // PDF Generation
    generatePdfBtn.addEventListener('click', async () => {
        // Validate invoice has content
        const rows = document.querySelectorAll('#previewItemsBody tr');
        if (rows.length === 0) {
            alert('Please add at least one product row before generating PDF.');
            return;
        }

        // Disable button and show loading
        const originalText = generatePdfBtn.textContent;
        generatePdfBtn.disabled = true;
        generatePdfBtn.textContent = 'Generating PDF...';
        generatePdfBtn.style.opacity = '0.6';

        let tempContainer = null;

        try {
            const element = document.getElementById('invoice-preview');
            if (!element) {
                throw new Error('Invoice preview element not found');
            }

            const filename = `Invoice_${document.getElementById('invoiceNumber').value || 'New'}.pdf`;

            // Clone the element
            const clone = element.cloneNode(true);
            // ==============================
            // CLEAN PDF TABLE (NO DUPLICATE TOTAL)
            // ==============================

            // Remove any existing Grand Total rows completely
            clone.querySelectorAll('tr').forEach(tr => {
                if (tr.innerText.toUpperCase().includes('GRAND TOTAL')) {
                    tr.remove();
                }
            });

            const pdfTable = clone.querySelector('.invoice-table');

            if (pdfTable) {

                // Force fixed layout (important for width control)
                pdfTable.style.tableLayout = 'fixed';
                pdfTable.style.width = '100%';

                try {
                    // Prefer copying the live preview table rows so any user-entered values
                    // (including description) are preserved exactly as seen in the preview.
                    const liveTbody = document.getElementById('previewItemsBody');
                    const tbody = pdfTable.querySelector('tbody');
                    if (liveTbody && tbody) {
                        // Build tbody from live rows, extracting current input values and contenteditable text
                        tbody.innerHTML = '';
                        const liveRows = Array.from(liveTbody.querySelectorAll('tr'));
                        liveRows.forEach(lr => {
                            const newRow = document.createElement('tr');
                            Array.from(lr.children).forEach(origCell => {
                                const newCell = document.createElement(origCell.tagName.toLowerCase());
                                const colIndex = Array.from(lr.children).indexOf(origCell);
                                // copy attributes (class, data-*) so styling and data-label remain
                                Array.from(origCell.attributes).forEach(attr => {
                                    try { newCell.setAttribute(attr.name, attr.value); } catch (e) {}
                                });

                                // Collect visible text from inputs, contenteditable, or plain text
                                let cellText = '';
                                // Inputs (may be multiple inside a cell)
                                const inputs = Array.from(origCell.querySelectorAll('input'));
                                if (inputs.length) {
                                    cellText = inputs.map(i => (i.value != null && String(i.value).trim() !== '') ? String(i.value).trim() : (i.getAttribute('value') || '')).filter(Boolean).join(' ');
                                }
                                // If no input text, check for contenteditable children
                                if (!cellText) {
                                    const ce = origCell.querySelector('[contenteditable]');
                                    if (ce && (ce.textContent || '').trim()) cellText = ce.textContent.trim();
                                }
                                // If still empty, take the visible text of the cell
                                if (!cellText) cellText = (origCell.textContent || '').trim();

                                // If product description cell is still empty, fall back to items[] using column position
                                if (!cellText) {
                                    // product/description is expected at colIndex 2 (0-based), but handle flexibly
                                    if (!Number.isNaN(colIndex) && items && items.length) {
                                        const rowIndex = liveRows.indexOf(lr);
                                        const it = items[rowIndex];
                                        if (it) {
                                            if (colIndex === 2 && it.description) cellText = String(it.description).trim();
                                            if (colIndex === 1 && it.brand) cellText = String(it.brand).trim();
                                            if ((colIndex === 4 || colIndex === 5) && it.price != null) cellText = String(it.price);
                                        }
                                    }
                                }

                                // If this is the product column, prefer rendering product name above details
                                if (colIndex === 2) {
                                    const descInput = origCell.querySelector('input[data-field="description"]');
                                    const detailsInput = origCell.querySelector('input[data-field="itemDetails"]');
                                    const mainText = descInput ? (descInput.value != null && String(descInput.value).trim() !== '' ? String(descInput.value).trim() : (descInput.getAttribute('value') || '')) : '';
                                    const detailsText = detailsInput ? (detailsInput.value != null && String(detailsInput.value).trim() !== '' ? String(detailsInput.value).trim() : (detailsInput.getAttribute('value') || '')) : '';
                                    // If we have either main or details, build stacked HTML
                                    const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                                    if (mainText || detailsText) {
                                        newCell.innerHTML = `<div class="pdf-cell-product"><div class="pdf-product-main">${escapeHtml(mainText)}</div>${detailsText ? `<div class="pdf-product-details">${escapeHtml(detailsText)}</div>` : ''}</div>`;
                                    } else if (cellText) {
                                        // If no inputs but cellText present, try to split by newline into main/details
                                        const parts = cellText.split(/\n+/).map(p => p.trim()).filter(Boolean);
                                        if (parts.length > 1) {
                                            newCell.innerHTML = `<div class="pdf-cell-product"><div class="pdf-product-main">${escapeHtml(parts[0])}</div><div class="pdf-product-details">${escapeHtml(parts.slice(1).join(' '))}</div></div>`;
                                        } else {
                                            newCell.textContent = cellText;
                                        }
                                    } else {
                                        newCell.textContent = cellText;
                                    }
                                } else {
                                    newCell.textContent = cellText;
                                }

                                // Ensure TOTAL column (6th, colIndex === 5) content is centered in the PDF clone
                                if (colIndex === 5) {
                                    try {
                                        const span = document.createElement('span');
                                        span.className = 'pdf-total-amount';
                                        span.textContent = (newCell.textContent || '').trim();
                                        newCell.textContent = '';
                                        newCell.appendChild(span);
                                        newCell.style.setProperty('text-align', 'center', 'important');
                                    } catch (e) { /* ignore */ }
                                }

                                newRow.appendChild(newCell);
                            });
                            tbody.appendChild(newRow);
                        });

                        // Compute grand total from items[] (numeric source)
                        let computedGrand = 0;
                        items.forEach(it => { computedGrand += (Number(it.quantity) || 0) * (Number(it.price) || 0); });
                        const grandRow = document.createElement('tr');
                        grandRow.innerHTML = `
        <td colspan="4"></td>
        <td style="text-align:center; font-weight:600; color:#1e40af;">
            GRAND TOTAL
        </td>
        <td style="text-align:center; font-weight:600; color:#1e40af;">
            ${formatCurrency(computedGrand)}
        </td>
    `;
                        tbody.appendChild(grandRow);
                    } else {
                        // Fallback to building from `items` if live tbody isn't available
                        const fallbackTbody = pdfTable.querySelector('tbody');
                        fallbackTbody.innerHTML = '';
                        let grandTotal = 0;
                        items.forEach((item, index) => {
                            const total = item.quantity * item.price;
                            grandTotal += total;
                            const row = document.createElement('tr');
                            row.innerHTML = `
            <td style="width:6%;">${index + 1}</td>

            <td style="width:18%; text-align:center; white-space:nowrap; overflow:hidden;">
                <span class="pdf-brand">${item.brand || ''}</span>
            </td>

            <td style="width:36%;">${item.description || ''}</td>

            <td style="width:8%; text-align:center;">${item.quantity}</td>

            <td style="width:16%; text-align:center;">${formatCurrency(item.price)}</td>

            <td style="width:16%; text-align:right;">${formatCurrency(total)}</td>
        `;
                            fallbackTbody.appendChild(row);
                        });
                        const grandRow = document.createElement('tr');
                        grandRow.innerHTML = `
        <td colspan="4"></td>
        <td style="text-align:center; font-weight:600; color:#1e40af;">
            GRAND TOTAL
        </td>
        <td style="text-align:center; font-weight:600; color:#1e40af;">
            ${formatCurrency(grandTotal)}
        </td>
    `;
                        fallbackTbody.appendChild(grandRow);
                    }
                } catch (err) {
                    console.warn('Error copying live tbody into PDF clone', err);
                }
            }




            // Apply PDF mode styling
            clone.classList.add('pdf-mode');

            // Ensure the preview date in the cloned node is always a real date (prevents placeholder 'Click to edit')
            try {
                const clonePreviewDate = clone.querySelector('#previewInvoiceDate');
                const mainInvoiceDate = document.getElementById('invoiceDate');
                const sourceDate = (mainInvoiceDate && mainInvoiceDate.value) ? mainInvoiceDate.value : (new Date().toISOString().split('T')[0]);
                let displayDate = '';
                if (sourceDate) {
                    const d = new Date(sourceDate);
                    if (!Number.isNaN(d)) displayDate = d.toLocaleDateString('en-GB');
                }
                if (!displayDate) displayDate = new Date().toLocaleDateString('en-GB');
                if (clonePreviewDate) clonePreviewDate.textContent = displayDate;
            } catch (e) {
                console.warn('Could not set clone preview date', e);
            }

            // Ensure table uses fixed layout and set explicit column widths so headers align with data in PDF
            try {
                const tbl = clone.querySelector('.invoice-table');
                if (tbl) {
                    tbl.style.tableLayout = 'fixed';
                    // Preferred widths (percent) for columns: idx, brand, desc, qty, price, total, delete
                    const colMap = {
                        'col-idx': '6%',
                        'col-brand': '12%',
                        'col-desc': '48%',
                        'col-qty': '8%',
                        'col-price': '13%',
                        'col-total': '13%',
                        'col-delete': '0%'
                    };
                    const cols = tbl.querySelectorAll('col');
                    cols.forEach(c => {
                        const cls = c.className || '';
                        if (colMap[cls]) c.style.width = colMap[cls];
                    });
                }
            } catch (err) {
                console.warn('Could not set PDF column widths', err);
            }

            // Inject PDF-specific CSS to ensure print rendering matches screen
            try {
                const styleEl = document.createElement('style');
                styleEl.type = 'text/css';
                styleEl.appendChild(document.createTextNode(`
    /* ========================= */
    /* PDF TABLE CENTER ALIGN   */
    /* ========================= */

    .pdf-mode .invoice-table {
        border-collapse: collapse !important;
        width: 100% !important;
        table-layout: fixed !important;
    }

    .pdf-mode .invoice-table th,
    .pdf-mode .invoice-table td {
        border: 1px solid #000 !important;
        padding: 8px 10px !important;
        text-align: center !important;
        vertical-align: middle !important;
        box-sizing: border-box !important;
        font-family: 'DejaVu Sans', 'Noto Sans', sans-serif !important;
        font-size: 12px !important;
    }

    .pdf-mode .invoice-table thead th {
        background: #f3f4f6 !important;
        font-weight: 600 !important;
        text-align: center !important;
    }

    /* Ensure GRAND TOTAL row also centered */
    .pdf-mode .invoice-table tr:last-child td {
        text-align: center !important;
        font-weight: 600 !important;
    }

    /* Product cell stacked layout in PDF: product name + smaller details */
    .pdf-mode .pdf-cell-product { display:block; }
    .pdf-mode .pdf-product-main { font-weight: 600 !important; }
    .pdf-mode .pdf-product-details { font-size: 11px !important; color: #444 !important; margin-top: 4px !important; }
`));
                clone.insertBefore(styleEl, clone.firstChild);
            } catch (err) {
                console.warn('Could not inject PDF styles', err);
            }

            // Replace all inputs with spans containing their values
            clone.querySelectorAll('input').forEach(input => {
                const parent = input.parentNode;
                // If it's an empty optional itemDetails field, remove it entirely to save space
                if (input.dataset && input.dataset.field === 'itemDetails' && !input.value.trim()) {
                    parent.removeChild(input);
                    return;
                }
                const span = document.createElement('span');
                span.textContent = input.value || '';
                span.style.cssText = 'display: block; font: inherit; color: inherit;';

                // Keep the 'table-input-details' class for styling
                if (input.classList.contains('table-input-details')) {
                    span.classList.add('table-input-details');
                }

                parent.replaceChild(span, input);
            });

            // Remove contenteditable attributes
            clone.querySelectorAll('[contenteditable]').forEach(el => {
                el.removeAttribute('contenteditable');
            });

            // Ensure the Grand Total amount cell is centered in the PDF clone
            try {
                const cloneGrandAmount = clone.querySelector('#previewGrandTotal');
                if (cloneGrandAmount) {
                    cloneGrandAmount.style.setProperty('text-align', 'center', 'important');
                    cloneGrandAmount.style.setProperty('vertical-align', 'middle', 'important');
                    cloneGrandAmount.style.setProperty('padding-top', '8px', 'important');
                    cloneGrandAmount.style.setProperty('padding-bottom', '8px', 'important');
                }
            } catch (e) { /* ignore */ }

            // Hide no-print elements
            clone.querySelectorAll('.no-print').forEach(el => {
                el.style.display = 'none';
            });

            // Remove any delete buttons or interactive controls inside the cloned invoice table
            try {
                // Remove table action container(s)
                clone.querySelectorAll('.table-actions').forEach(el => el.remove());

                // Remove delete columns/buttons specifically inside the invoice table
                clone.querySelectorAll('.invoice-table button, .invoice-table .delete-row-btn, .invoice-table .delete-col, .invoice-table .col-delete').forEach(el => {
                    if (el && el.parentNode) el.parentNode.removeChild(el);
                });
            } catch (e) { /* ignore */ }

            // Create temporary container in viewport with tiny opacity (ensures render)
            tempContainer = document.createElement('div');
            tempContainer.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 210mm;
                background: white;
                z-index: -1;
                opacity: 0.01;
                pointer-events: none;
                padding: 0;
                box-sizing: border-box;
            `;
            clone.style.width = '210mm';
            clone.style.maxWidth = '210mm';
            clone.style.boxSizing = 'border-box';
            clone.style.transform = 'scale(1)';
            clone.style.transformOrigin = 'top left';
            tempContainer.appendChild(clone);
            document.body.appendChild(tempContainer);

            // Wait for render
            await new Promise(resolve => setTimeout(resolve, 250));

            const opt = {
                margin: [0, 0, 0, 0],
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: false,
                    allowTaint: true,
                    logging: false,
                    scrollX: 0,
                    scrollY: 0
                },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            console.log('Generating PDF...');

            // Generate PDF from the cloned invoice
            await html2pdf().set(opt).from(clone).save();

            console.log('PDF generated successfully!');

            // Increment invoice number upon successful download
            incrementInvoiceNumber();

        } catch (error) {
            console.error('PDF Error:', error);
            console.error('Error details:', error.message, error.stack);
            alert('Error generating PDF: ' + (error.message || 'Unknown error. Please try again.'));
        } finally {
            // Cleanup
            if (tempContainer && tempContainer.parentNode) {
                document.body.removeChild(tempContainer);
            }

            // Re-enable button
            generatePdfBtn.disabled = false;
            generatePdfBtn.textContent = originalText;
            generatePdfBtn.style.opacity = '1';
        }
    });

    function renderItemsInput() {
        if (!itemsContainer) return;
        itemsContainer.innerHTML = '';
        items.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'item-row';
            row.innerHTML = `
                <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                    <input type="text" placeholder="Brand Name" value="${item.brand || ''}" style="margin-bottom: 0;" oninput="updateItem(${index}, 'brand', this.value)">
                    <input type="text" placeholder="Product Name" value="${item.description}" style="margin-bottom: 0;" oninput="updateItem(${index}, 'description', this.value)">
                    <input type="text" placeholder="Details (Optional)" value="${item.itemDetails || ''}" style="margin-bottom: 0; font-size: 12px; color: #666;" oninput="updateItem(${index}, 'itemDetails', this.value)">
                </div>
                <input type="text" placeholder="Unit (e.g. PCS, LTR)" value="${item.unit || ''}" style="width: 80px;" oninput="updateItem(${index}, 'unit', this.value)">
                <input type="number" placeholder="Qty" value="${item.quantity}" style="width: 60px;" oninput="updateItem(${index}, 'quantity', this.value)">
                <input type="number" placeholder="Price" value="${item.price}" style="width: 80px;" oninput="updateItem(${index}, 'price', this.value)">
                <button type="button" class="remove-btn" onclick="removeItem(${index})">&times;</button>
            `;
            itemsContainer.appendChild(row);
        });
    }

    // Expose functions to global scope for inline onclick/oninput
    window.updateItem = (index, field, value) => {
        if (field === 'quantity' || field === 'price') {
            items[index][field] = parseFloat(value) || 0;
        } else {
            items[index][field] = value;
        }

        // propagate cross-fields when editing the simpler input form
        if (field === 'brand') {
            const match = findProductByBrand(items[index].brand || '');
            if (match) {
                items[index].description = match.name;
                items[index].price = match.price;
            }
        } else if (field === 'description') {
            const match = findProductByName(items[index].description || '');
            if (match) {
                items[index].brand = match.brand;
                items[index].price = match.price;
            }
        }

        // reflect any changes in the input rows (re‑render may reset cursor but it's acceptable)
        renderItemsInput();
        updatePreview();
    };

    window.removeItem = (index) => {
        items.splice(index, 1);
        renderItemsInput();
        updatePreview();
    };

    function updatePreview() {
        // Update basic text fields
        Object.keys(inputs).forEach(inputId => {
            const el = document.getElementById(inputs[inputId]);
            const val = document.getElementById(inputId).value;
            if (el) el.textContent = val;
        });

        // Format Date
        const dateVal = invoiceDateEl ? invoiceDateEl.value : '';
        if (typeof previewDateManual !== 'undefined' && previewDateManual) {
            // If preview was manually edited, keep as-is unless date input changed since last sync
            if (invoiceDateEl && invoiceDateEl.value && invoiceDateEl.value !== lastInvoiceDateValue) {
                previewDateManual = false;
                lastInvoiceDateValue = invoiceDateEl.value;
                const d = new Date(invoiceDateEl.value);
                if (!Number.isNaN(d) && previewInvoiceDateEl) previewInvoiceDateEl.textContent = d.toLocaleDateString('en-GB');
            }
        } else {
            if (dateVal) {
                const d = new Date(dateVal);
                if (!Number.isNaN(d) && previewInvoiceDateEl) previewInvoiceDateEl.textContent = d.toLocaleDateString('en-GB'); // DD/MM/YYYY format
            }
        }

        renderItemsTable();
    }

    function parseNumber(text) {
        const cleaned = text.replace(/[^0-9.-]/g, '');
        return parseFloat(cleaned) || 0;
    }

    function formatCurrency(value) {
        return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function findProductByName(name) {
        const normalized = name.trim().toLowerCase();
        return PRODUCTS.find(product => product.name.toLowerCase() === normalized);
    }

    // Return first product that matches a given brand (case‑insensitive).
    function findProductByBrand(brand) {
        const normalized = brand.trim().toLowerCase();
        return PRODUCTS.find(product => {
            const pBrand = (product.brand || '').toLowerCase();
            const pName = (product.name || '').toLowerCase();
            return pBrand === normalized || pName === normalized;
        });
    }

    function filterProducts(query) {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return PRODUCTS.slice(0, 8);
        return PRODUCTS.filter(product => product.name.toLowerCase().includes(normalized)).slice(0, 50);
    }

    // Return unique brand names from PRODUCTS as objects { name }
    function filterBrands(query) {
        const normalized = (query || '').trim().toLowerCase();
        const brands = [];
        const seen = new Set();
        for (const p of PRODUCTS) {
            const b = ((p.brand || '').trim() || (p.name || '').trim());
            if (!b) continue;
            const key = b.toLowerCase();
            if (seen.has(key)) continue;
            if (!normalized || key.includes(normalized)) {
                brands.push({ name: b });
                seen.add(key);
            }
            if (brands.length >= 50) break;
        }
        return brands;
    }

    function closeAutocomplete() {
        autocompleteMenu.style.display = 'none';
        activeDescriptionInput = null;
        activeAutocompleteIndex = -1;
        activeAutocompleteItems = [];
        // Re-enable text selection after closing autocomplete (fix mobile select/scroll)
        try { document.body.style.userSelect = ''; document.body.style.overflow = ''; } catch (e) {}
    }

    function positionAutocomplete(input) {
        const rect = input.getBoundingClientRect();
        autocompleteMenu.style.width = `${Math.max(rect.width, 220)}px`;
        autocompleteMenu.style.left = `${rect.left + window.scrollX}px`;
        autocompleteMenu.style.top = `${rect.bottom + window.scrollY + 6}px`;
    }

    function openAutocomplete(input, products) {
        activeDescriptionInput = input;
        positionAutocomplete(input);
        activeAutocompleteIndex = -1;
        autocompleteOpenTime = Date.now();

        // Prevent accidental text selection while scrolling on mobile when autocomplete is open
        try { document.body.style.userSelect = 'none'; document.body.style.overflow = 'hidden'; } catch (e) {}

        if (!products.length) {
            autocompleteMenu.innerHTML = '<div class="autocomplete-empty">No matches found</div>';
            activeAutocompleteItems = [];
        } else {
            // always show the raw name (brand or product) in the list; the filtering functions
            // already supply the correct set depending on the field type.
            autocompleteMenu.innerHTML = products
                .map(item => `<div class="autocomplete-item" data-name="${item.name}">${item.name}</div>`)
                .join('');
            activeAutocompleteItems = Array.from(autocompleteMenu.querySelectorAll('.autocomplete-item'));
        }

        autocompleteMenu.style.display = 'block';
    }

    function updateActiveAutocompleteItem() {
        activeAutocompleteItems.forEach((item, idx) => {
            item.classList.toggle('is-active', idx === activeAutocompleteIndex);
        });

        const activeItem = activeAutocompleteItems[activeAutocompleteIndex];
        if (activeItem) {
            activeItem.scrollIntoView({ block: 'nearest' });
        }
    }

    function refreshTotals() {
        let grandTotal = 0;

        items.forEach((item, index) => {
            const total = item.quantity * item.price;
            grandTotal += total;

            const totalCell = previewItemsBody.querySelector(`.item-total[data-index="${index}"]`);
            if (totalCell) {
                totalCell.textContent = formatCurrency(total);
            }
        });

        previewGrandTotal.textContent = formatCurrency(grandTotal);
    }

    function renderItemsTable() {
        closeAutocomplete();
        previewItemsBody.innerHTML = '';

        items.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="#">${index + 1}</td>
                <td data-label="Brand">
                    <input class="table-input" data-field="brand" data-index="${index}" value="${item.brand || ''}" placeholder="Brand Name" autocomplete="off" />
                </td>
                <td data-label="Product">
                    <div class="cell-stack">
                        <input class="table-input" data-field="description" data-index="${index}" value="${item.description}" placeholder="Product Name" autocomplete="off" />
                        <input class="table-input table-input-details" data-field="itemDetails" data-index="${index}" value="${item.itemDetails || ''}" placeholder="Details (Optional)" autocomplete="off" />
                    </div>
                </td>
                <td data-label="Qty">
                    <div class="cell-stack">
                        <input class="table-input tiny" data-field="quantity" data-index="${index}" value="${item.quantity}" inputmode="decimal" />
                    </div>
                </td>
                <td data-label="Price">
                    <input class="table-input small" data-field="price" data-index="${index}" value="${formatCurrency(item.price)}" inputmode="decimal" />
                </td>
                <td class="item-total" data-label="Total" data-index="${index}">${formatCurrency(item.quantity * item.price)}</td>
                <td class="delete-col no-print">
                    <button class="delete-row-btn" data-index="${index}" title="Delete Product">×</button>
                </td>
            `;
            previewItemsBody.appendChild(tr);
        });

        refreshTotals();
    }

    function handleTableInput(e) {
        const target = e.target;
        if (!target.dataset || !target.dataset.field) return;

        const index = parseInt(target.dataset.index, 10);
        const field = target.dataset.field;

        if (Number.isNaN(index) || !items[index]) return;

        if (field === 'quantity') {
            items[index].quantity = parseNumber(target.value);
        } else if (field === 'price') {
            items[index].price = parseNumber(target.value);
        } else if (field === 'brand') {
            items[index].brand = target.value;
            // show brand suggestions as the user types
            const brandMatches = filterBrands(items[index].brand);
            openAutocomplete(target, brandMatches);
            // if we can resolve a product for this brand, fill description/price too
            const brandMatch = findProductByBrand(items[index].brand);
            if (brandMatch) {
                items[index].description = brandMatch.name;
                items[index].price = brandMatch.price;

                const row = target.closest('tr');
                if (row) {
                    const descInput = row.querySelector('input[data-field="description"]');
                    if (descInput) descInput.value = brandMatch.name;
                    const priceInput = row.querySelector('input[data-field="price"]');
                    if (priceInput) priceInput.value = formatCurrency(brandMatch.price);
                }
            }
        } else if (field === 'description') {
            items[index].description = target.value.trim();
            const match = findProductByName(items[index].description);
            if (match) {
                items[index].price = match.price;
                if (match.brand) items[index].brand = match.brand;

                const row = target.closest('tr');
                if (row) {
                    const priceInput = row.querySelector('input[data-field="price"]');
                    if (priceInput) priceInput.value = formatCurrency(match.price);
                    const brandInput = row.querySelector('input[data-field="brand"]');
                    if (brandInput && match.brand) brandInput.value = match.brand;
                }
            }

            const matches = filterProducts(items[index].description);
            openAutocomplete(target, matches);
        } else if (field === 'itemDetails') {
            items[index].itemDetails = target.value;
        }

        refreshTotals();
    }

    function handleTableBlur(e) {
        const target = e.target;
        if (!target.dataset || target.dataset.field !== 'price') return;

        const index = parseInt(target.dataset.index, 10);
        if (Number.isNaN(index) || !items[index]) return;

        target.value = formatCurrency(items[index].price);
    }

    function handleDescriptionFocus(e) {
        const target = e.target;
        if (!target.dataset) return;
        if (target.dataset.field === 'description') {
            const matches = filterProducts(target.value || '');
            openAutocomplete(target, matches);
        } else if (target.dataset.field === 'brand') {
            const matches = filterBrands(target.value || '');
            openAutocomplete(target, matches);
        }
    }

    function handleDescriptionKeydown(e) {
        const target = e.target;
        // Only handle keyboard navigation for description or brand fields when autocomplete is open
        if (!target.dataset) return;
        const field = target.dataset.field;
        if (!(field === 'description' || field === 'brand')) return;
        if (!activeDescriptionInput || target !== activeDescriptionInput) return;
        if (autocompleteMenu.style.display !== 'block') return;

        const index = parseInt(target.dataset.index, 10);

        if (e.key === 'ArrowDown') {
            if (!activeAutocompleteItems.length) return;
            e.preventDefault();
            activeAutocompleteIndex = (activeAutocompleteIndex + 1) % activeAutocompleteItems.length;
            updateActiveAutocompleteItem();
        } else if (e.key === 'ArrowUp') {
            if (!activeAutocompleteItems.length) return;
            e.preventDefault();
            activeAutocompleteIndex =
                (activeAutocompleteIndex - 1 + activeAutocompleteItems.length) % activeAutocompleteItems.length;
            updateActiveAutocompleteItem();
        } else if (e.key === 'Enter') {
            if (activeAutocompleteIndex >= 0 && activeAutocompleteItems[activeAutocompleteIndex]) {
                e.preventDefault();
                e.stopPropagation();

                const selectedItem = activeAutocompleteItems[activeAutocompleteIndex];
                const name = selectedItem.dataset.name;

                if (field === 'description') {
                    const product = findProductByName(name);
                    if (product && !Number.isNaN(index) && items[index]) {
                        items[index].description = product.name;
                        items[index].price = product.price;
                        if (product.brand) items[index].brand = product.brand;
                        target.value = product.name;
                        const row = target.closest('tr');
                        if (row) {
                            const priceInput = row.querySelector('input[data-field="price"]');
                            if (priceInput) priceInput.value = formatCurrency(product.price);
                            const brandInput = row.querySelector('input[data-field="brand"]');
                            if (brandInput && product.brand) brandInput.value = product.brand;
                        }
                        refreshTotals();
                        closeAutocomplete();
                    }
                } else if (field === 'brand') {
                    if (!Number.isNaN(index) && items[index]) {
                        items[index].brand = name;
                        // try to fill from the first matching product for this brand
                        const prod = findProductByBrand(name);
                        if (prod) {
                            items[index].description = prod.name;
                            items[index].price = prod.price;
                        }
                        target.value = name;
                        const row = target.closest('tr');
                        if (row) {
                            const brandInput = row.querySelector('input[data-field="brand"]');
                            if (brandInput) brandInput.value = name;
                            if (prod) {
                                const descInput = row.querySelector('input[data-field="description"]');
                                if (descInput) descInput.value = prod.name;
                                const priceInput = row.querySelector('input[data-field="price"]');
                                if (priceInput) priceInput.value = formatCurrency(prod.price);
                            }
                        }
                        refreshTotals();
                        closeAutocomplete();
                    }
                }
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeAutocomplete();
        }
    }

    // Handle both mouse and touch events for mobile support
    function selectAutocompleteElement(itemEl) {
        if (!itemEl || !activeDescriptionInput) return;
        const name = itemEl.dataset.name;
        const field = activeDescriptionInput.dataset.field;
        const index = parseInt(activeDescriptionInput.dataset.index, 10);
        if (Number.isNaN(index) || !items[index]) return;

        if (field === 'description') {
            const product = findProductByName(name);
            if (!product) return;
            items[index].description = product.name;
            items[index].price = product.price;
            if (product.brand) items[index].brand = product.brand;

            activeDescriptionInput.value = product.name;
            const row = activeDescriptionInput.closest('tr');
            if (row) {
                const priceInput = row.querySelector('input[data-field="price"]');
                if (priceInput) priceInput.value = formatCurrency(product.price);
                const brandInput = row.querySelector('input[data-field="brand"]');
                if (brandInput && product.brand) brandInput.value = product.brand;
            }

            refreshTotals();
            closeAutocomplete();
        } else if (field === 'brand') {
            items[index].brand = name;
            // also update item details if we have a matching product
            const prod = findProductByBrand(name);
            if (prod) {
                items[index].description = prod.name;
                items[index].price = prod.price;
            }
            activeDescriptionInput.value = name;
            const row = activeDescriptionInput.closest('tr');
            if (row) {
                const brandInput = row.querySelector('input[data-field="brand"]');
                if (brandInput) brandInput.value = name;
                if (prod) {
                    const descInput = row.querySelector('input[data-field="description"]');
                    if (descInput) descInput.value = prod.name;
                    const priceInput = row.querySelector('input[data-field="price"]');
                    if (priceInput) priceInput.value = formatCurrency(prod.price);
                }
            }
            refreshTotals();
            closeAutocomplete();
        }
    }

    // Mouse click selection
    autocompleteMenu.addEventListener('click', (e) => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        e.preventDefault();
        e.stopPropagation();
        selectAutocompleteElement(item);
    });

    // Touch selection: only select on touchend if there was no significant movement (prevents selecting while scrolling)
    autocompleteMenu.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length === 1) {
            _ac_touchStartY = e.touches[0].clientY;
            _ac_touchStartX = e.touches[0].clientX;
            _ac_touchMoved = false;
        }
    }, { passive: true });

    autocompleteMenu.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches.length === 1) {
            const dy = Math.abs(e.touches[0].clientY - _ac_touchStartY);
            const dx = Math.abs(e.touches[0].clientX - _ac_touchStartX);
            if (dy > 8 || dx > 8) _ac_touchMoved = true;
        }
    }, { passive: true });

    autocompleteMenu.addEventListener('touchend', (e) => {
        if (_ac_touchMoved) return; // user was scrolling
        const touch = (e.changedTouches && e.changedTouches[0]) || null;
        const target = touch ? document.elementFromPoint(touch.clientX, touch.clientY) : e.target;
        const item = target && target.closest ? target.closest('.autocomplete-item') : null;
        if (!item) return;
        e.preventDefault();
        e.stopPropagation();
        selectAutocompleteElement(item);
    }, { passive: true });

    document.addEventListener('click', (e) => {
        if (autocompleteMenu.contains(e.target)) return;
        if (activeDescriptionInput && activeDescriptionInput.contains(e.target)) return;
        closeAutocomplete();
    });

    // Prevent closing autocomplete immediately after opening on mobile (keyboard appearance causes resize/scroll)
    window.addEventListener('resize', () => {
        const timeSinceOpen = Date.now() - autocompleteOpenTime;
        if (timeSinceOpen > 500 && activeDescriptionInput) {
            // Reposition instead of closing
            positionAutocomplete(activeDescriptionInput);
        }
    });

    window.addEventListener('scroll', () => {
        const timeSinceOpen = Date.now() - autocompleteOpenTime;
        if (timeSinceOpen > 500 && activeDescriptionInput) {
            // Reposition instead of closing
            positionAutocomplete(activeDescriptionInput);
        }
    }, true);

    previewItemsBody.addEventListener('input', handleTableInput);
    previewItemsBody.addEventListener('blur', handleTableBlur, true);
    previewItemsBody.addEventListener('focusin', handleDescriptionFocus);
    previewItemsBody.addEventListener('keydown', handleDescriptionKeydown);
    previewItemsBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-row-btn')) {
            const index = parseInt(e.target.dataset.index, 10);
            if (!Number.isNaN(index) && items.length > 1) {
                items.splice(index, 1);
                renderItemsTable();
            }
        }
    });

    // Initial render
    renderItemsInput();
    renderItemsTable();
});


