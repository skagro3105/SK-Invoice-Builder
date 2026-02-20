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
            contact: "9998675227 | skagro3105@gmail.com"
        }
    };

    let currentUser = null;

    // State management for items
    let items = [
        { id: 1, description: '', itemDetails: '', quantity: 1, price: 0.00 }
    ];
    // Paste your Google Sheets CSV URL here:
    const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR_VwyESB419ROlLkNZmuQ18cyLit9leySgP6VpetMr509IjARdSEBw1uFGNGIseaLTdbbe4iR8kcXN/pub?output=csv'; // Paste your Google Sheets published CSV URL here

    // Products array (will be loaded from Google Sheets)
    let PRODUCTS = [];

    // DOM Elementsx
    const itemsContainer = document.getElementById('items-container');
    const addItemBtn = document.getElementById('addItemBtn');
    const addRowBtn = document.getElementById('addRowBtn');
    const previewItemsBody = document.getElementById('previewItemsBody');
    const previewGrandTotal = document.getElementById('previewGrandTotal');
    const generatePdfBtn = document.getElementById('generatePdfBtn');

    const autocompleteMenu = document.createElement('div');
    autocompleteMenu.className = 'autocomplete-menu';
    document.body.appendChild(autocompleteMenu);
    let activeDescriptionInput = null;
    let activeAutocompleteIndex = -1;
    let activeAutocompleteItems = [];
    let autocompleteOpenTime = 0;

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

            // Parse CSV
            const lines = csvText.trim().split('\n');
            if (lines.length < 2) {
                console.warn('⚠️ Google Sheet has no products');
                if (statusEl) statusEl.textContent = '⚠️ No products found in sheet';
                return;
            }

            // Skip header row and parse products
            const products = [];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                // Simple split by comma
                const parts = line.split(',');
                if (parts.length < 2) continue;

                const name = parts[0].trim();
                const priceStr = parts[1].trim();
                const price = parseFloat(priceStr) || 0;

                if (name) {
                    products.push({ name, price });
                    console.log(`  ✓ ${name}: ₹${price}`);
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
                    const matches = filterProducts(activeDescriptionInput.value || '');
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

    // Invoice Number Management
    function getNextInvoiceNumber() {
        if (!currentUser) return '001';
        let currentNum = localStorage.getItem(`lastInvoiceNumber_${currentUser}`);
        if (!currentNum) {
            currentNum = 1;
        } else {
            currentNum = parseInt(currentNum, 10);
        }
        return currentNum.toString().padStart(3, '0');
    }

    function incrementInvoiceNumber() {
        if (!currentUser) return;
        let currentNum = localStorage.getItem(`lastInvoiceNumber_${currentUser}`);
        if (!currentNum) {
            currentNum = 1;
        } else {
            currentNum = parseInt(currentNum, 10);
        }
        const nextNum = currentNum + 1;
        localStorage.setItem(`lastInvoiceNumber_${currentUser}`, nextNum);
        document.getElementById('invoiceNumber').value = nextNum.toString().padStart(3, '0');
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

    loginForm.addEventListener('submit', (e) => {
        const userVal = document.getElementById('loginUsername').value.trim();
        const passVal = document.getElementById('loginPassword').value.trim();

        if (USERS[userVal] && USERS[userVal].password === passVal) {
            // Success! The form submits to the hidden_iframe natively (triggering Save Password),
            // while we instantly update the UI manually here without a page reload.
            localStorage.setItem('loggedInUser', userVal);
            loginError.style.display = 'none';
            initializeAppForUser(userVal);
        } else {
            // Only stop the form from submitting if the password was wrong
            e.preventDefault();
            loginError.textContent = "Invalid username or password";
            loginError.style.display = 'block';
        }
    });

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

    // Initialize with today's date
    document.getElementById('invoiceDate').valueAsDate = new Date();

    // Event Listeners for basic inputs
    Object.keys(inputs).forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('input', updatePreview);
        }
    });

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
        items.push({ id: Date.now(), description: '', itemDetails: '', quantity: 1, price: 0 });
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

            // Apply PDF mode styling
            clone.classList.add('pdf-mode');

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

            // Force alignment for Grand Total row to bypass mobile CSS overrides in PDF
            const grandTotalLabel = clone.querySelector('.grand-total-row td:first-child');
            if (grandTotalLabel) {
                grandTotalLabel.style.setProperty('text-align', 'right', 'important');
                grandTotalLabel.style.setProperty('padding-right', '15px', 'important');
            }

            // Hide no-print elements
            clone.querySelectorAll('.no-print').forEach(el => {
                el.style.display = 'none';
            });

            // Hide delete buttons and action buttons
            clone.querySelectorAll('.col-delete, .delete-row-btn, .table-actions').forEach(el => {
                el.style.display = 'none';
            });

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
                    <input type="text" placeholder="Description" value="${item.description}" style="margin-bottom: 0;" oninput="updateItem(${index}, 'description', this.value)">
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
        const dateVal = document.getElementById('invoiceDate').value;
        if (dateVal) {
            const d = new Date(dateVal);
            document.getElementById('previewInvoiceDate').textContent = d.toLocaleDateString('en-GB'); // DD/MM/YYYY format
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

    function filterProducts(query) {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return PRODUCTS.slice(0, 8);
        return PRODUCTS.filter(product => product.name.toLowerCase().includes(normalized)).slice(0, 8);
    }

    function closeAutocomplete() {
        autocompleteMenu.style.display = 'none';
        activeDescriptionInput = null;
        activeAutocompleteIndex = -1;
        activeAutocompleteItems = [];
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

        if (!products.length) {
            autocompleteMenu.innerHTML = '<div class="autocomplete-empty">No matches found</div>';
            activeAutocompleteItems = [];
        } else {
            autocompleteMenu.innerHTML = products
                .map(product => `<div class="autocomplete-item" data-name="${product.name}">${product.name}</div>`)
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
                <td data-label="Description">
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
        } else if (field === 'description') {
            items[index].description = target.value.trim();
            const match = findProductByName(items[index].description);
            if (match) {
                items[index].price = match.price;

                const row = target.closest('tr');
                if (row) {
                    const priceInput = row.querySelector('input[data-field="price"]');
                    if (priceInput) priceInput.value = formatCurrency(match.price);
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
        if (!target.dataset || target.dataset.field !== 'description') return;
        const matches = filterProducts(target.value || '');
        openAutocomplete(target, matches);
    }

    function handleDescriptionKeydown(e) {
        const target = e.target;

        // Only handle keyboard navigation for description fields when autocomplete is open
        if (!target.dataset || target.dataset.field !== 'description') return;
        if (!activeDescriptionInput || target !== activeDescriptionInput) return;
        if (autocompleteMenu.style.display !== 'block') return;

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

                // Get the selected product and update the item
                const selectedItem = activeAutocompleteItems[activeAutocompleteIndex];
                const name = selectedItem.dataset.name;
                const product = findProductByName(name);

                if (product) {
                    const index = parseInt(target.dataset.index, 10);
                    if (!Number.isNaN(index) && items[index]) {
                        items[index].description = product.name;
                        items[index].price = product.price;

                        target.value = product.name;
                        const row = target.closest('tr');
                        if (row) {
                            const priceInput = row.querySelector('input[data-field="price"]');
                            if (priceInput) priceInput.value = formatCurrency(product.price);
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
    function handleAutocompleteItemSelect(e) {
        const item = e.target.closest('.autocomplete-item');
        if (!item || !activeDescriptionInput) return;
        e.preventDefault();
        e.stopPropagation();

        const name = item.dataset.name;
        const product = findProductByName(name);
        if (!product) return;

        const index = parseInt(activeDescriptionInput.dataset.index, 10);
        if (Number.isNaN(index) || !items[index]) return;

        items[index].description = product.name;
        items[index].price = product.price;

        activeDescriptionInput.value = product.name;
        const row = activeDescriptionInput.closest('tr');
        if (row) {
            const priceInput = row.querySelector('input[data-field="price"]');
            if (priceInput) priceInput.value = formatCurrency(product.price);
        }

        refreshTotals();
        closeAutocomplete();
    }

    autocompleteMenu.addEventListener('mousedown', handleAutocompleteItemSelect);
    autocompleteMenu.addEventListener('touchstart', handleAutocompleteItemSelect);

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