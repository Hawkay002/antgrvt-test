// State Management
const state = {
    eventSettings: {
        event_name: 'My Event',
        event_place: 'Event Venue',
        arrival_deadline: '',
    },
    tickets: []
};

// DOM Elements
const els = {
    appSection: document.getElementById('app-section'),
    navItems: document.querySelectorAll('.nav-item'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    createTicketForm: document.getElementById('create-ticket-form'),
    ticketPreviewContainer: document.getElementById('ticket-preview-container'),
    shareBtn: document.getElementById('share-btn'),
    ticketsTableBody: document.querySelector('#tickets-table tbody'),
    selectAllCheckbox: document.getElementById('select-all'),
    deleteSelectedBtn: document.getElementById('delete-selected-btn'),
    settingsForm: document.getElementById('settings-form'),
    scannerVideo: document.getElementById('scanner-video'),
    scannerCanvas: document.getElementById('scanner-canvas'),
    scanResult: document.getElementById('scan-result'),
    scanMessage: document.getElementById('scan-message'),
    headerEventName: document.getElementById('header-event-name')
};

// --- Initialization ---

function init() {
    loadSettings();
    loadTickets();
    renderTickets();
    updateSettingsUI();
}

// --- Navigation ---

els.navItems.forEach(item => {
    item.addEventListener('click', () => {
        const targetId = item.dataset.tab;

        // Update Nav UI
        els.navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        // Update Tab UI
        els.tabPanes.forEach(pane => pane.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');

        // Special actions
        if (targetId === 'tab-validate') {
            startScanner();
        } else {
            stopScanner();
        }
    });
});

// --- Settings ---

function loadSettings() {
    const localSettings = localStorage.getItem('eventSettings');
    if (localSettings) {
        state.eventSettings = JSON.parse(localSettings);
    }
}

function updateSettingsUI() {
    document.getElementById('setting-event-name').value = state.eventSettings.event_name || '';
    document.getElementById('setting-event-place').value = state.eventSettings.event_place || '';
    // Format timestamp for datetime-local input (YYYY-MM-DDThh:mm)
    if (state.eventSettings.arrival_deadline) {
        const date = new Date(state.eventSettings.arrival_deadline);
        // Adjust to local ISO string roughly
        const localIso = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        document.getElementById('setting-event-time').value = localIso;
    }
    els.headerEventName.textContent = state.eventSettings.event_name || 'Event';
}

els.settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newSettings = {
        event_name: document.getElementById('setting-event-name').value,
        event_place: document.getElementById('setting-event-place').value,
        arrival_deadline: new Date(document.getElementById('setting-event-time').value).toISOString()
    };

    state.eventSettings = { ...state.eventSettings, ...newSettings };
    localStorage.setItem('eventSettings', JSON.stringify(state.eventSettings));
    updateSettingsUI();
    alert('Settings saved!');
});

// --- Create Ticket ---

els.createTicketForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const ticketData = {
        id: 'T-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        full_name: document.getElementById('ticket-name').value,
        gender: document.getElementById('ticket-gender').value,
        age: parseInt(document.getElementById('ticket-age').value),
        phone_number: document.getElementById('ticket-phone').value,
        status: 'booked',
        created_at: new Date().toISOString(),
        event_id: 'default'
    };

    generateTicketPreview(ticketData);
    saveTicket(ticketData);
});

function generateTicketPreview(data) {
    els.ticketPreviewContainer.classList.remove('hidden');

    document.getElementById('preview-event-name').textContent = state.eventSettings.event_name;
    document.getElementById('preview-id').textContent = '#' + data.id;
    document.getElementById('preview-name').textContent = data.full_name;
    document.getElementById('preview-gender').textContent = data.gender;
    document.getElementById('preview-age').textContent = data.age + ' yrs';
    document.getElementById('preview-phone').textContent = data.phone_number;
    document.getElementById('preview-place').textContent = state.eventSettings.event_place;

    const date = state.eventSettings.arrival_deadline ? new Date(state.eventSettings.arrival_deadline).toLocaleString() : 'TBD';
    document.getElementById('preview-time').textContent = date;

    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
        text: data.id,
        width: 128,
        height: 128
    });
}

function saveTicket(ticket) {
    state.tickets.unshift(ticket);
    saveTicketsToStorage();
    renderTickets();
    els.createTicketForm.reset();
    document.getElementById('ticket-phone').value = "+91 ";
}

els.shareBtn.addEventListener('click', () => {
    const ticketCard = document.getElementById('ticket-card');
    html2canvas(ticketCard).then(canvas => {
        const imgData = canvas.toDataURL("image/png");
        const link = document.createElement('a');
        link.download = `ticket-${document.getElementById('preview-id').textContent}.png`;
        link.href = imgData;
        link.click();

        const phone = document.getElementById('preview-phone').textContent.replace(/\s+/g, '');
        const msg = encodeURIComponent(`Here is your ticket for ${state.eventSettings.event_name}!`);
        window.open(`https://wa.me/?text=${msg}`, '_blank');
    });
});

// --- Booked Tickets ---

function loadTickets() {
    const storedTickets = localStorage.getItem('tickets');
    if (storedTickets) {
        state.tickets = JSON.parse(storedTickets);
    }
}

function saveTicketsToStorage() {
    localStorage.setItem('tickets', JSON.stringify(state.tickets));
}

function renderTickets() {
    els.ticketsTableBody.innerHTML = '';
    state.tickets.forEach(ticket => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" class="ticket-select" value="${ticket.id}"></td>
            <td>${ticket.full_name}</td>
            <td>${ticket.gender}, ${ticket.age}<br><small>${ticket.phone_number}</small></td>
            <td><span class="status-${ticket.status}">${ticket.status}</span></td>
            <td>
                <button onclick="deleteTicket('${ticket.id}')" class="btn-danger" style="padding: 4px 8px; font-size: 0.8rem;">×</button>
            </td>
        `;
        els.ticketsTableBody.appendChild(tr);
    });

    document.querySelectorAll('.ticket-select').forEach(cb => {
        cb.addEventListener('change', updateDeleteBtnState);
    });
}

window.deleteTicket = (id) => {
    if (confirm('Delete this ticket?')) {
        state.tickets = state.tickets.filter(t => t.id !== id);
        saveTicketsToStorage();
        renderTickets();
    }
};

els.selectAllCheckbox.addEventListener('change', (e) => {
    const checked = e.target.checked;
    document.querySelectorAll('.ticket-select').forEach(cb => cb.checked = checked);
    updateDeleteBtnState();
});

function updateDeleteBtnState() {
    const anyChecked = document.querySelectorAll('.ticket-select:checked').length > 0;
    if (anyChecked) {
        els.deleteSelectedBtn.classList.remove('hidden');
    } else {
        els.deleteSelectedBtn.classList.add('hidden');
    }
}

els.deleteSelectedBtn.addEventListener('click', () => {
    const selected = Array.from(document.querySelectorAll('.ticket-select:checked')).map(cb => cb.value);
    if (confirm(`Delete ${selected.length} tickets?`)) {
        state.tickets = state.tickets.filter(t => !selected.includes(t.id));
        saveTicketsToStorage();
        renderTickets();
        els.selectAllCheckbox.checked = false;
        els.deleteSelectedBtn.classList.add('hidden');
    }
});

// --- Scanner ---

let videoStream = null;
let isScanning = false;

async function startScanner() {
    if (isScanning) return;

    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        els.scannerVideo.srcObject = videoStream;
        els.scannerVideo.setAttribute("playsinline", true);
        els.scannerVideo.play();
        isScanning = true;
        requestAnimationFrame(tickScanner);
    } catch (e) {
        console.error("Camera access denied", e);
        els.scanMessage.textContent = "Camera access denied or not supported.";
        els.scanResult.className = "scan-result scan-error";
        els.scanResult.classList.remove('hidden');
    }
}

function stopScanner() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    isScanning = false;
}

function tickScanner() {
    if (!isScanning) return;

    if (els.scannerVideo.readyState === els.scannerVideo.HAVE_ENOUGH_DATA) {
        els.scannerCanvas.height = els.scannerVideo.videoHeight;
        els.scannerCanvas.width = els.scannerVideo.videoWidth;
        const ctx = els.scannerCanvas.getContext("2d");
        ctx.drawImage(els.scannerVideo, 0, 0, els.scannerCanvas.width, els.scannerCanvas.height);

        const imageData = ctx.getImageData(0, 0, els.scannerCanvas.width, els.scannerCanvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
        });

        if (code) {
            handleScan(code.data);
        }
    }
    requestAnimationFrame(tickScanner);
}

let lastScanTime = 0;
function handleScan(ticketId) {
    const now = Date.now();
    if (now - lastScanTime < 2000) return;
    lastScanTime = now;

    els.scanResult.classList.remove('hidden');
    els.scanMessage.textContent = `Verifying ${ticketId}...`;
    els.scanResult.className = "scan-result";

    const ticket = state.tickets.find(t => t.id === ticketId);

    if (!ticket) {
        playSound('error');
        els.scanMessage.textContent = "Invalid Ticket!";
        els.scanResult.className = "scan-result scan-error";
    } else {
        if (ticket.status === 'arrived') {
            playSound('error');
            els.scanMessage.textContent = `Already Used: ${ticket.full_name}`;
            els.scanResult.className = "scan-result scan-error";
        } else {
            // Valid entry
            ticket.status = 'arrived';
            saveTicketsToStorage();
            renderTickets(); // Update list if visible

            playSound('success');
            els.scanMessage.textContent = `Welcome, ${ticket.full_name}!`;
            els.scanResult.className = "scan-result scan-success";
        }
    }
}

function playSound(type) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
    } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.3);
    }

    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);
    osc.stop(ctx.currentTime + 0.5);
}

// Start App
init();

