// Supabase Configuration
// TODO: Replace with your actual Supabase project configuration
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_KEY = 'your-anon-key';

// Initialize Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State Management
const state = {
    user: null,
    eventSettings: {
        event_name: 'My Event',
        event_place: 'Event Venue',
        arrival_deadline: '',
    },
    tickets: []
};

// DOM Elements
const els = {
    authSection: document.getElementById('auth-section'),
    appSection: document.getElementById('app-section'),
    loginForm: document.getElementById('login-form'),
    authError: document.getElementById('auth-error'),
    logoutBtn: document.getElementById('logout-btn'),
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

// --- Authentication ---

els.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });
        if (error) throw error;
    } catch (error) {
        els.authError.textContent = error.message;
    }
});

els.logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
});

// Auth State Listener
supabase.auth.onAuthStateChange((event, session) => {
    state.user = session?.user || null;
    if (state.user) {
        els.authSection.classList.add('hidden');
        els.appSection.classList.remove('hidden');
        loadSettings();
        subscribeToTickets();
    } else {
        els.authSection.classList.remove('hidden');
        els.appSection.classList.add('hidden');
        state.tickets = [];
        renderTickets();
    }
});

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

async function loadSettings() {
    if (!state.user) return;

    // Try local storage first
    const localSettings = localStorage.getItem('eventSettings');
    if (localSettings) {
        state.eventSettings = JSON.parse(localSettings);
        updateSettingsUI();
    }

    // Sync with Supabase
    try {
        // Assuming we just use the first row for now, or a specific ID if we had one
        const { data, error } = await supabase
            .from('settings')
            .select('*')
            .limit(1)
            .single();

        if (data) {
            state.eventSettings = data;
            localStorage.setItem('eventSettings', JSON.stringify(state.eventSettings));
            updateSettingsUI();
        }
    } catch (e) {
        console.error("Error loading settings", e);
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

els.settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newSettings = {
        event_name: document.getElementById('setting-event-name').value,
        event_place: document.getElementById('setting-event-place').value,
        arrival_deadline: new Date(document.getElementById('setting-event-time').value).toISOString()
    };

    state.eventSettings = { ...state.eventSettings, ...newSettings };
    localStorage.setItem('eventSettings', JSON.stringify(state.eventSettings));
    updateSettingsUI();

    try {
        // Upsert based on a fixed ID or just insert if empty. 
        // For simplicity, let's assume we are updating the row with id=1 or creating it.
        // We need to know the ID to update, or use upsert.
        const { error } = await supabase
            .from('settings')
            .upsert({ id: 1, ...newSettings }); // Assuming ID 1 for single config

        if (error) throw error;
        alert('Settings saved!');
    } catch (e) {
        console.error("Error saving settings", e);
        alert('Failed to save settings to backend.');
    }
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

async function saveTicket(ticket) {
    try {
        const { error } = await supabase
            .from('tickets')
            .insert([ticket]);

        if (error) throw error;

        els.createTicketForm.reset();
        document.getElementById('ticket-phone').value = "+91 ";
    } catch (e) {
        console.error("Error saving ticket", e);
        alert("Error saving ticket to database: " + e.message);
    }
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

function subscribeToTickets() {
    if (!state.user) return;

    // Initial fetch
    fetchTickets();

    // Realtime subscription
    supabase
        .channel('tickets-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, payload => {
            // Simple approach: re-fetch all or handle specific events. 
            // For this size, re-fetching or manual array manipulation is fine.
            // Let's manually manipulate state for better UX.
            handleRealtimeUpdate(payload);
        })
        .subscribe();
}

async function fetchTickets() {
    const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching tickets", error);
        return;
    }
    state.tickets = data;
    renderTickets();
}

function handleRealtimeUpdate(payload) {
    if (payload.eventType === 'INSERT') {
        state.tickets.unshift(payload.new);
    } else if (payload.eventType === 'DELETE') {
        state.tickets = state.tickets.filter(t => t.id !== payload.old.id);
    } else if (payload.eventType === 'UPDATE') {
        const index = state.tickets.findIndex(t => t.id === payload.new.id);
        if (index !== -1) state.tickets[index] = payload.new;
    }
    renderTickets();
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

window.deleteTicket = async (id) => {
    if (confirm('Delete this ticket?')) {
        try {
            const { error } = await supabase
                .from('tickets')
                .delete()
                .eq('id', id);
            if (error) throw error;
        } catch (e) {
            console.error("Error deleting ticket", e);
        }
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

els.deleteSelectedBtn.addEventListener('click', async () => {
    const selected = Array.from(document.querySelectorAll('.ticket-select:checked')).map(cb => cb.value);
    if (confirm(`Delete ${selected.length} tickets?`)) {
        try {
            const { error } = await supabase
                .from('tickets')
                .delete()
                .in('id', selected);
            if (error) throw error;

            els.selectAllCheckbox.checked = false;
            els.deleteSelectedBtn.classList.add('hidden');
        } catch (e) {
            console.error("Batch delete failed", e);
        }
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
async function handleScan(ticketId) {
    const now = Date.now();
    if (now - lastScanTime < 2000) return;
    lastScanTime = now;

    els.scanResult.classList.remove('hidden');
    els.scanMessage.textContent = `Verifying ${ticketId}...`;
    els.scanResult.className = "scan-result";

    try {
        const { data, error } = await supabase
            .from('tickets')
            .select('*')
            .eq('id', ticketId)
            .single();

        if (error || !data) {
            playSound('error');
            els.scanMessage.textContent = "Invalid Ticket!";
            els.scanResult.className = "scan-result scan-error";
        } else {
            if (data.status === 'arrived') {
                playSound('error');
                els.scanMessage.textContent = `Already Used: ${data.full_name}`;
                els.scanResult.className = "scan-result scan-error";
            } else {
                // Valid entry
                const { error: updateError } = await supabase
                    .from('tickets')
                    .update({ status: 'arrived' })
                    .eq('id', ticketId);

                if (updateError) throw updateError;

                playSound('success');
                els.scanMessage.textContent = `Welcome, ${data.full_name}!`;
                els.scanResult.className = "scan-result scan-success";
            }
        }
    } catch (e) {
        console.error("Scan verification failed", e);
        els.scanMessage.textContent = "Error verifying ticket.";
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
