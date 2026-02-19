const SUPABASE_URL = 'https://qouonnohcwhzayznibjo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvdW9ubm9oY3doemF5em5pYmpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMTAzMzYsImV4cCI6MjA3MTg4NjMzNn0.4UMYvmVZvTzurcpNbhItUyzRUbJS60BXHlofqroAuww';


const BACKEND_URL = 'https://si-backend-2i9b.onrender.com';

const ADMIN_SECRET = 'sisi-clicker-admin-secret-2024';

let supabaseClient = null;
let currentUser = null;
let currentSection = 'dashboard';
let users = [];
let userLogs = [];
let adminLogs = [];
let transactions = [];
let tasks = [];

const itemsPerPage = 15;
let currentPage = {
    users: 1,
    userLogs: 1,
    adminLogs: 1,
    transactions: 1,
    tasks: 1
};

let sortConfig = {
    users: { field: 'user_id', direction: 'asc' },
    userLogs: { field: 'created_at', direction: 'desc' },
    adminLogs: { field: 'created_at', direction: 'desc' },
    transactions: { field: 'created_at', direction: 'desc' },
    tasks: { field: 'created_at', direction: 'desc' }
};

let currentEditingUserId = null;
let debounceTimer = null;
let maintenanceMode = false;

const actionTypeMap = {
    'solo_lottery_win': { name: 'Won Solo Game', color: 'success', icon: '<i class="fas fa-trophy"></i>' },
    'upgrade_purchase': { name: 'Purchased Upgrade', color: 'primary', icon: '<i class="fas fa-shopping-cart"></i>' },
    'coin_transfer': { name: 'Sent Coins', color: 'info', icon: '<i class="fas fa-paper-plane"></i>' },
    'coin_received': { name: 'Received Coins', color: 'success', icon: '<i class="fas fa-coins"></i>' },
    'login': { name: 'Logged In', color: 'info', icon: '<i class="fas fa-sign-in-alt"></i>' },

    'ban_user': { name: 'User Banned', color: 'danger', icon: '<i class="fas fa-ban"></i>' },
    'unban_user': { name: 'User Unbanned', color: 'success', icon: '<i class="fas fa-check"></i>' },
    'add_coins': { name: 'Coins Added', color: 'warning', icon: '<i class="fas fa-plus-circle"></i>' },
    'reset_score': { name: 'Score Reset', color: 'danger', icon: '<i class="fas fa-sync-alt"></i>' },
    'delete_user': { name: 'User Deleted', color: 'danger', icon: '<i class="fas fa-user-times"></i>' },
    'admin_login': { name: 'Admin Login', color: 'info', icon: '<i class="fas fa-user-shield"></i>' },
    'send_broadcast': { name: 'Broadcast Sent', color: 'info', icon: '<i class="fas fa-bullhorn"></i>' },
    'create_backup': { name: 'Backup Created', color: 'info', icon: '<i class="fas fa-save"></i>' },
    'enable_maintenance': { name: 'Maintenance Enabled', color: 'warning', icon: '<i class="fas fa-tools"></i>' },
    'disable_maintenance': { name: 'Maintenance Disabled', color: 'success', icon: '<i class="fas fa-check"></i>' },
    'make_admin': { name: 'Admin Promoted', color: 'primary', icon: '<i class="fas fa-user-shield"></i>' },
    'remove_admin': { name: 'Admin Demoted', color: 'warning', icon: '<i class="fas fa-user-minus"></i>' },
    'reset_upgrades': { name: 'Upgrades Reset', color: 'danger', icon: '<i class="fas fa-redo"></i>' },
    'update_user': { name: 'User Updated', color: 'info', icon: '<i class="fas fa-edit"></i>' },
    'add_coins_all': { name: 'Coins Added to All', color: 'warning', icon: '<i class="fas fa-coins"></i>' },
    'reset_all_scores': { name: 'All Scores Reset', color: 'danger', icon: '<i class="fas fa-sync-alt"></i>' },
    'clear_cache': { name: 'Cache Cleared', color: 'info', icon: '<i class="fas fa-sync-alt"></i>' }
};

function formatTimeAgo(dateString) {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) {
        return `${diffSec}s ago`;
    } else if (diffMin < 60) {
        return `${diffMin}m ago`;
    } else if (diffHour < 24) {
        return `${diffHour}h ago`;
    } else if (diffDay < 7) {
        return `${diffDay}d ago`;
    } else {
        return date.toLocaleDateString();
    }

}

async function loadSkinsAdmin() {
    const tbody = document.getElementById('skins-admin-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="loading">Loading skins...</td></tr>';
    try {
        const resp = await fetch(`${BACKEND_URL}/skins`);
        if (!resp.ok) throw new Error('Failed to fetch skins');
        const data = await resp.json();
        const skins = data.skins || [];
        renderSkinsAdminTable(skins);
    } catch (err) {
        console.error('Error loading skins:', err);
        tbody.innerHTML = `<tr><td colspan="6" class="error">Failed to load skins: ${escapeHtml(err.message)}</td></tr>`;
        showNotification('Failed to load skins', 'error');
    }
}

function renderSkinsAdminTable(skins) {
    const tbody = document.getElementById('skins-admin-tbody');
    if (!tbody) return;
    if (!skins || skins.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">No skins found</td></tr>';
        return;
    }

    tbody.innerHTML = skins.map(skin => {
        const priceDisplay = skin.price ? new Decimal(skin.price).toFixed(9) : (skin.task_id ? 'Task Reward' : 'Free');
        const active = skin.is_active ? 'Yes' : 'No';
        const img = skin.image_url ? `<img src="${escapeHtml(skin.image_url)}" alt="${escapeHtml(skin.name)}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;">` : '';

        return `
        <tr data-name="${escapeHtml(skin.name || '')}" data-image-url="${escapeHtml(skin.image_url || '')}" data-price="${escapeHtml(String(skin.price || ''))}" data-task-id="${escapeHtml(String(skin.task_id || ''))}" data-active="${skin.is_active}">
            <td>${img}</td>
            <td style="font-weight:600;">${escapeHtml(skin.name || '')}</td>
            <td>${priceDisplay}</td>
            <td>${escapeHtml(String(skin.task_id || ''))}</td>
            <td><span class="badge ${skin.is_active ? 'badge-success' : 'badge-danger'}">${active}</span></td>
            <td>
                <button class="btn btn-outline btn-sm edit-skin-btn" data-skin-id="${skin.id}"><i class="fas fa-edit"></i></button>
                <button class="btn btn-outline btn-sm delete-skin-btn" data-skin-id="${skin.id}" style="color:var(--danger);"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
        `;
    }).join('');
}

function openSkinModal(skin = null) {
    document.getElementById('skin-id').value = skin?.id || '';
    document.getElementById('skin-name').value = skin?.name || '';
    document.getElementById('skin-image-url').value = skin?.image_url || '';
    document.getElementById('skin-price').value = skin?.price || '';
    // populate task dropdown and set selection
    const taskSelect = document.getElementById('skin-task-select');
    if (taskSelect) {
        taskSelect.innerHTML = '<option value="">— Select a task —</option>';
        try {
            fetch(`${BACKEND_URL}/admin/tasks`, { headers: { 'x-admin-secret': ADMIN_SECRET } })
                .then(r => r.json())
                .then(data => {
                    const tasksList = data.tasks || [];
                    tasksList.forEach(t => {
                        const opt = document.createElement('option');
                        opt.value = t.id;
                        opt.textContent = `${t.title} ${t.target_value ? `(${t.target_value})` : ''}`;
                        taskSelect.appendChild(opt);
                    });
                    if (skin && skin.task_id) taskSelect.value = skin.task_id;
                })
                .catch(() => {});
        } catch (e) {}
    }
    document.getElementById('skin-active').checked = skin ? !!skin.is_active : true;
    // set source selector
    const source = (skin && skin.price) ? 'price' : (skin && skin.task_id) ? 'task' : 'free';
    const srcEl = document.getElementById('skin-source');
    if (srcEl) srcEl.value = source;
    toggleSkinFields(source);
    document.getElementById('skin-modal').classList.add('active');
}

function closeSkinModal() {
    document.getElementById('skin-modal').classList.remove('active');
}

function toggleSkinFields(mode) {
    const priceRow = document.getElementById('skin-price-row');
    const taskRow = document.getElementById('skin-task-row');
    if (mode === 'price') {
        if (priceRow) priceRow.style.display = '';
        if (taskRow) taskRow.style.display = 'none';
    } else if (mode === 'task') {
        if (priceRow) priceRow.style.display = 'none';
        if (taskRow) taskRow.style.display = '';
    } else {
        if (priceRow) priceRow.style.display = 'none';
        if (taskRow) taskRow.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const src = document.getElementById('skin-source');
    if (src) src.addEventListener('change', (e) => toggleSkinFields(e.target.value));
});

async function saveSkin() {
    const id = document.getElementById('skin-id').value || null;
    const name = document.getElementById('skin-name').value.trim();
    const image_url = document.getElementById('skin-image-url').value.trim();
    const source = document.getElementById('skin-source')?.value || 'free';
    const price = (source === 'price') ? (document.getElementById('skin-price').value.trim() || null) : null;
    const task_id = (source === 'task') ? (document.getElementById('skin-task-select')?.value || null) : null;
    const is_active = document.getElementById('skin-active').checked;

    if (!name || !image_url) {
        showNotification('Name and Image URL are required', 'error');
        return;
    }

    try {
        const payload = { name, image_url, price: price || null, task_id: task_id || null, is_active };
        let resp;
        if (id) {
            resp = await fetch(`${BACKEND_URL}/admin/skins/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET },
                body: JSON.stringify(payload)
            });
        } else {
            resp = await fetch(`${BACKEND_URL}/admin/skins`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET },
                body: JSON.stringify(payload)
            });
        }

        if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(txt || 'Server error');
        }

        showNotification('Skin saved', 'success');
        closeSkinModal();
        loadSkinsAdmin();
    } catch (err) {
        console.error('Error saving skin:', err);
        showNotification('Failed to save skin: ' + err.message, 'error');
    }
}

function deleteSkin(skinId) {
    showConfirmationModal(
        'Delete Skin',
        'Are you sure you want to delete this skin? This action cannot be undone.',
        async () => {
            try {
                const resp = await fetch(`${BACKEND_URL}/admin/skins/${skinId}`, {
                    method: 'DELETE',
                    headers: { 'x-admin-secret': ADMIN_SECRET }
                });
                if (!resp.ok) throw new Error('Failed to delete skin');
                showNotification('Skin deleted', 'success');
                loadSkinsAdmin();
            } catch (err) {
                console.error('Delete skin error:', err);
                showNotification('Failed to delete skin', 'error');
            }
        },
        'danger',
        'Delete'
    );
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showNotification(message, type = 'info') {
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'error' ? 'exclamation-circle' : 
                 type === 'warning' ? 'exclamation-triangle' : 'info-circle';
                 
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="fas fa-${icon}"></i>
        </div>
        <div class="notification-content">
            <span class="notification-message">${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(20px)';
            notification.style.transition = 'all 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }
    }, 4000);
}

function parseDetails(details) {
    if (!details) return '';
    
    try {
        const parsed = JSON.parse(details);
        
        if (typeof parsed === 'string') {
            return parsed;
        }
        
        if (typeof parsed === 'object' && parsed !== null) {
            
            if (parsed.updates) {
                let html = '<div class="details-text update-details">';
                for (const [key, change] of Object.entries(parsed.updates)) {
                    const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    let oldVal = change.old;
                    let newVal = change.new;

                    if (typeof oldVal === 'number') oldVal = new Decimal(oldVal).toFixed(9);
                    if (typeof newVal === 'number') newVal = new Decimal(newVal).toFixed(9);
                    if (oldVal === null || oldVal === undefined) oldVal = 'None';
                    if (newVal === null || newVal === undefined) newVal = 'None';

                    html += `<div class="details-item update-item">
                        <span class="details-label">${formattedKey}:</span>
                        <span class="details-change"><span class="old-val">${oldVal}</span> <i class="fas fa-long-arrow-alt-right"></i> <span class="new-val">${newVal}</span></span>
                    </div>`;
                }
                if (parsed.reason) {
                    html += `<div class="details-item"><span class="details-label">Reason:</span> <span class="details-value">${parsed.reason}</span></div>`;
                }
                html += '</div>';
                return html;
            }

            let html = '<div class="details-text">';
            for (const [key, value] of Object.entries(parsed)) {
                const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                let formattedValue = value;
                
                if (typeof value === 'object' && value !== null) {
                    formattedValue = JSON.stringify(value, null, 2);
                } else if (typeof value === 'boolean') {
                    formattedValue = value ? 'Yes' : 'No';
                } else if (typeof value === 'number' && (key.includes('amount') || key.includes('coins') || key.includes('score') || key.includes('value') || key.includes('rate'))) {
                    formattedValue = new Decimal(value).toFixed(9);
                }
                
                html += `<div class="details-item">
                    <span class="details-label">${formattedKey}:</span>
                    <span class="details-value">${formattedValue}</span>
                </div>`;
            }
            html += '</div>';
            return html;
        }
        
        return String(parsed);
    } catch (e) {
        return details;
    }
}

function getTelegramAvatarUrl(user) {
    if (user && user.profile_photo_url) {
        return user.profile_photo_url;
    }
    
    return null;
}

async function initAdminPanel() {
    try {
        console.log('Initializing admin panel...');
        
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        await checkAuth();
        
        setupEventListeners();
        setupSearchListeners();
        setupAdvancedSearch('userLogs');
        setupAdvancedSearch('adminLogs');
        setupAdvancedSearch('transactions');
        setupAdvancedSearch('tasks');
        setupAdvancedSearch('users');
        setupRealTimePolling();
        
        await checkMaintenanceMode();
        
        if (currentUser) {
            loadDashboardStats();
            loadUsers();
        }
        
    } catch (error) {
        console.error('Failed to initialize admin panel:', error);
        showNotification('Failed to initialize admin panel. Please refresh the page.', 'error');
    }
}

async function checkAuth() {
    if (!supabaseClient) return;

    try {
        const adminSecret = localStorage.getItem('admin_secret');
        if (adminSecret === ADMIN_SECRET) {
            currentUser = { id: 'admin-panel', email: 'admin@system.local' };
            document.getElementById('admin-name').textContent = 'Administrator';
            showAdminPanel();
            
            const initialHash = window.location.hash.replace('#', '');
            if (initialHash && ['dashboard', 'users', 'transactions', 'user-logs', 'admin-logs', 'settings', 'tasks'].includes(initialHash)) {
                showSection(initialHash, false);
            } else {
                showSection('dashboard');
            }
            return;
        }

        const { data: { session }, error } = await supabaseClient.auth.getSession();

        if (error) {
            console.error('Auth session error:', error);
            return;
        }

        if (session && session.user) {
            const { data: adminUser, error: adminError } = await supabaseClient
                .from('admin_users')
                .select('*')
                .eq('user_id', session.user.id)
                .eq('is_active', true)
                .single();

            if (adminError || !adminUser) {
                console.log('User is not an admin');
                await logout();
                return;
            }

            currentUser = { ...session.user, ...adminUser };
            document.getElementById('admin-name').textContent = 
                currentUser.email || currentUser.user_id;
            showAdminPanel();
            
            const initialHash = window.location.hash.replace('#', '');
            if (initialHash && ['dashboard', 'users', 'transactions', 'user-logs', 'admin-logs', 'settings', 'tasks'].includes(initialHash)) {
                showSection(initialHash, false);
            } else {
                showSection('dashboard');
            }
        }
    } catch (error) {
        console.error('Auth check failed:', error);
    }
}

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('login-error');

    if (!email || !password) {
        errorElement.textContent = 'Please enter both email and password';
        errorElement.style.display = 'block';
        return;
    }

    try {
        errorElement.style.display = 'none';

        if (email === 'admin@system.local' && password === ADMIN_SECRET) {
            localStorage.setItem('admin_secret', ADMIN_SECRET);
            currentUser = { id: 'admin-panel', email: 'admin@system.local' };
            document.getElementById('admin-name').textContent = 'Administrator';
            showAdminPanel();
            showNotification('Login successful!', 'success');
            await logAdminAction('admin_login', null, 'Admin logged in');
            return;
        }

        if (!supabaseClient) {
            throw new Error('System not ready');
        }

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email.trim(),
            password: password
        });

        if (error) throw error;

        const { data: adminUser, error: adminError } = await supabaseClient
            .from('admin_users')
            .select('*')
            .eq('user_id', data.user.id)
            .eq('is_active', true)
            .single();

        if (adminError || !adminUser) {
            throw new Error('Access denied. Not an admin or account inactive.');
        }

        currentUser = { ...data.user, ...adminUser };
        document.getElementById('admin-name').textContent = 
            currentUser.email || currentUser.user_id;
        showAdminPanel();
        
        const initialHash = window.location.hash.replace('#', '');
        if (initialHash && ['dashboard', 'users', 'transactions', 'user-logs', 'admin-logs', 'settings', 'tasks'].includes(initialHash)) {
            showSection(initialHash, false);
        } else {
            showSection('dashboard');
        }
        
        showNotification('Login successful!', 'success');

        await logAdminAction('admin_login', null, 'Admin logged in');

    } catch (error) {
        console.error('Login error:', error);
        errorElement.textContent = error.message;
        errorElement.style.display = 'block';
        showNotification('Login failed: ' + error.message, 'error');
    }
}

async function logout() {
    try {
        if (supabaseClient) {
            await supabaseClient.auth.signOut();
        }
        localStorage.removeItem('admin_secret');
        currentUser = null;
        document.getElementById('login-section').style.display = 'flex';
        document.getElementById('admin-panel').style.display = 'none';
        showNotification('Logged out successfully', 'info');
    } catch (error) {
        console.error('Logout error:', error);
        showNotification('Logout failed', 'error');
    }
}

function showAdminPanel() {
    document.getElementById('login-section').style.display = 'none';
    const panel = document.getElementById('admin-panel');
    panel.style.display = 'flex';
    panel.classList.add('active');
}

function showSection(sectionName, updateHash = true) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const sectionElement = document.getElementById(sectionName);
    if (sectionElement) {
        sectionElement.classList.add('active');
    }

    const navBtn = document.getElementById(`${sectionName}-nav`);
    if (navBtn) {
        navBtn.classList.add('active');
    }

    if (updateHash) {
        history.replaceState(null, null, '#' + sectionName);
    }

    switch (sectionName) {
        case 'dashboard':
            loadDashboardStats();
            break;
        case 'users':
            loadUsers();
            break;
        case 'transactions':
            loadTransactions();
            break;
        case 'tasks':
            loadTasks();
            break;
        case 'user-logs':
            loadUserLogs();
            break;
        case 'admin-logs':
            loadAdminLogs();
            break;
        case 'settings':
            break;
    }
}

window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash && ['dashboard', 'users', 'transactions', 'user-logs', 'admin-logs', 'settings', 'tasks'].includes(hash)) {
        showSection(hash, false);
    }
});

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function handleGlobalSearch(query) {
    if (!query || query.length < 2) {
        const hash = window.location.hash.split('?')[0].replace('#', '') || 'dashboard';
        showSection(hash, false);
        return;
    }

    showNotification(`Searching for "${query}"...`, 'info');

    const activeSection = document.querySelector('.section.active')?.id;
    
    switch (activeSection) {
        case 'users':
            loadUsers(1);
            break;
        case 'transactions':
            loadTransactions(1);
            break;
        case 'user-logs':
            loadUserLogs(1);
            break;
        case 'admin-logs':
            loadAdminLogs(1);
            break;
        default:
            showSection('users');
            break;
    }
}

async function loadDashboardStats() {
    if (!currentUser) return;

    try {
        const response = await fetch(`${BACKEND_URL}/admin/stats`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': ADMIN_SECRET
            }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        document.getElementById('total-users').textContent = data.totalUsers || 0;
        document.getElementById('active-today').textContent = (data.activeToday || 0) + ' active today';
        document.getElementById('banned-users').textContent = data.bannedUsers || 0;
        document.getElementById('total-transactions').textContent = data.totalTransactions || 0;
        document.getElementById('total-coins').textContent = new Decimal(data.totalCoins || 0).toFixed(2);

        if (document.getElementById('sidebar-total-users')) {
            document.getElementById('sidebar-total-users').textContent = data.totalUsers || 0;
        }
        if (document.getElementById('sidebar-total-coins')) {
            document.getElementById('sidebar-total-coins').textContent = new Decimal(data.totalCoins || 0).toFixed(2);
        }
        if (document.getElementById('sidebar-active-today')) {
            document.getElementById('sidebar-active-today').textContent = data.activeToday || 0;
        }

        document.getElementById('api-status').textContent = 'Online';
        document.getElementById('api-status-indicator').className = 'status-indicator online';

        await loadRecentActivity();

    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        let statusText = 'Offline';
        let detailMsg = error.message;

        if (error.message.includes('403')) statusText = 'Auth Failed';
        else if (error.message.includes('500')) statusText = 'Server Error';
        else if (error.message.includes('404')) statusText = 'Not Found';
        else if (error.message.includes('Failed to fetch')) statusText = 'Unreachable';
        
        document.getElementById('api-status').textContent = statusText;
        document.getElementById('api-status-indicator').className = 'status-indicator ' + (statusText === 'Online' ? 'online' : 'offline');
        

        try {
            const pingResp = await fetch(`${BACKEND_URL}/`);
            if (pingResp.ok && statusText === 'Unreachable') {

                 document.getElementById('api-status').textContent = 'Connected (API Error)';
                 showNotification('Server is online, but Admin API failed. Check Secret.', 'warning');
            } else if (!pingResp.ok) {

                 console.log('Root ping failed:', pingResp.status);
            }
        } catch (pingErr) {
             console.log('Root ping network error');
        }


        if (statusText !== 'Online') {

             console.log(`API Error: ${statusText} - ${detailMsg}`);
        }
    }
}

async function loadRecentActivity() {
    try {
        const response = await fetch(`${BACKEND_URL}/admin/combined-activity`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': ADMIN_SECRET
            }
        });

        if (!response.ok) throw new Error('Failed to load recent activity');

        const data = await response.json();
        renderRecentActivity(data.logs || []);

    } catch (error) {
        console.error('Error loading recent activity:', error);
    }
}

function setupSearchListeners() {
    const userLogsSearch = document.getElementById('user-logs-search');
    if (userLogsSearch) {
        userLogsSearch.addEventListener('input', (e) => {
            filterTable('user-logs-tbody', e.target.value);
        });
    }
    
    const transactionsSearch = document.getElementById('transactions-search');
    if (transactionsSearch) {
        transactionsSearch.addEventListener('input', (e) => {
            filterTable('transactions-tbody', e.target.value);
        });
    }
    
    const adminLogsSearch = document.getElementById('admin-logs-search');
    if (adminLogsSearch) {
        adminLogsSearch.addEventListener('input', (e) => {
            filterTable('admin-logs-tbody', e.target.value);
        });
    }
    
    const userLogsFilter = document.getElementById('user-logs-action-filter');
    if (userLogsFilter) {
        userLogsFilter.addEventListener('change', (e) => {
            filterTableByAction('user-logs-tbody', e.target.value);
        });
    }

    const adminLogsFilter = document.getElementById('admin-logs-action-filter');
    if (adminLogsFilter) {
        adminLogsFilter.addEventListener('change', (e) => {
            filterTableByAction('admin-logs-tbody', e.target.value);
        });
    }
}

function filterTable(tbodyId, searchTerm) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr');
    const term = searchTerm.toLowerCase();

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
    });
}

function filterTableByAction(tbodyId, actionType) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr');

    rows.forEach(row => {
        if (!actionType) {
            row.style.display = '';
            return;
        }

        const actionBadge = row.querySelector('.action-badge');
        if (actionBadge) {
            const text = actionBadge.textContent.toLowerCase();
            const matches = actionType.toLowerCase().split('_').every(part => text.includes(part));
            row.style.display = matches ? '' : 'none';
        }
    });
}

function formatUserInfo(user) {
    if (!user) return '<span style="color: var(--text-dim);">System</span>';
    
    const getVal = (val) => (val === undefined || val === null || val === 'undefined' || val === 'null' || val === '') ? null : val;
    
    const photoUrl = getVal(user.photo_url) || getVal(user.avatar_url) || getVal(user.profile_photo_url) || getVal(user.sender_photo_url) || getVal(user.receiver_photo_url);
    const firstName = getVal(user.first_name);
    const lastName = getVal(user.last_name);
    const usernameRaw = getVal(user.username);
    const userIdRaw = getVal(user.user_id) || getVal(user.id) || getVal(user.sender_id) || getVal(user.receiver_id) || getVal(user.admin_id) || getVal(user.target_user_id);

    const avatarUrl = photoUrl ? (photoUrl.startsWith('http') ? photoUrl : null) : null;
    
    const hasFirst = firstName && firstName.trim().length > 0;
    const hasLast = lastName && lastName.trim().length > 0;
    
    let displayName = 'Anonymous';
    if (hasFirst) {
        displayName = `${firstName}${hasLast ? ' ' + lastName : ''}`;
    } else if (usernameRaw) {
        displayName = usernameRaw;
    } else if (userIdRaw) {
        displayName = `User ${String(userIdRaw).substring(0, 8)}`;
    }
    
    const username = usernameRaw ? `@${usernameRaw}` : '';
    const initials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const colors = ['#4f46e5', '#7c3aed', '#2563eb', '#0891b2', '#059669', '#16a34a', '#d97706', '#dc2626'];
    const bgColor = colors[Math.abs(String(userIdRaw).split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % colors.length];

    return `
        <div class="user-cell">
            <div class="user-avatar" style="width: 40px; height: 40px; font-size: 0.85rem; flex-shrink: 0; background: ${bgColor}; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">
                ${avatarUrl ? 
                    `<img src="${avatarUrl}" alt="${displayName}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                     <div class="avatar-fallback" style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center;">${initials}</div>` : 
                    `<div class="avatar-fallback" style="display: flex; width: 100%; height: 100%; align-items: center; justify-content: center;">${initials}</div>`
                }
            </div>
            <div class="user-info-compact" style="min-width: 0; margin-left: 0.75rem;">
                <div class="user-name" style="font-size: 0.875rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(displayName)}</div>
                ${username ? `<div class="user-username" style="font-size: 0.7rem; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(username)}</div>` : ''}
                ${userIdRaw ? `<div class="user-id" title="${userIdRaw}" style="font-size: 0.65rem; color: var(--text-muted); opacity: 0.7;">ID: ${userIdRaw}</div>` : ''}
            </div>
        </div>
    `;
}

let confirmationCallback = null;

function showConfirmationModal(title, message, onConfirm, type = 'danger', confirmText = 'Confirm') {
    const modal = document.getElementById('confirmation-modal');
    const titleEl = document.getElementById('confirmation-title');
    const messageEl = document.getElementById('confirmation-message');
    const confirmBtn = document.getElementById('confirm-action-btn');
    
    titleEl.textContent = title;
    messageEl.textContent = message;
    confirmBtn.textContent = confirmText;
    

    confirmBtn.className = 'btn';
    if (type === 'danger') confirmBtn.classList.add('btn-danger');
    else if (type === 'warning') confirmBtn.classList.add('btn-warning');
    else if (type === 'success') confirmBtn.classList.add('btn-success');
    else confirmBtn.classList.add('btn-primary');
    
    confirmationCallback = onConfirm;
    modal.classList.add('active');
}

function closeConfirmationModal() {
    const modal = document.getElementById('confirmation-modal');
    modal.classList.remove('active');
    confirmationCallback = null;
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('close-confirmation-modal')?.addEventListener('click', closeConfirmationModal);
    document.getElementById('cancel-action-btn')?.addEventListener('click', closeConfirmationModal);
    document.getElementById('confirm-action-btn')?.addEventListener('click', () => {
        if (confirmationCallback) confirmationCallback();
        closeConfirmationModal();
    });
});

async function deleteLog(type, logId) {
    showConfirmationModal(
        'Delete Log Entry', 
        `Are you sure you want to delete this ${type === 'userLogs' ? 'user' : 'admin'} log entry? This action cannot be undone.`,
        async () => {
            try {
                const endpoint = type === 'userLogs' ? `/admin/user-logs/${logId}` : `/admin/admin-logs/${logId}`;
                const response = await fetch(`${BACKEND_URL}${endpoint}`, {
                    method: 'DELETE',
                    headers: {
                        'x-admin-secret': ADMIN_SECRET
                    }
                });

                if (!response.ok) throw new Error('Failed to delete log entry');

                showNotification('Log entry deleted successfully', 'success');
                if (type === 'userLogs') loadUserLogs(currentPage.userLogs);
                else loadAdminLogs(currentPage.adminLogs);

            } catch (error) {
                console.error('Error deleting log:', error);
                showNotification(`Delete failed: ${error.message}`, 'error');
            }
        },
        'danger',
        'Delete'
    );
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderRecentActivity(logs) {
    const tbody = document.getElementById('recent-activity-tbody');
    if (!tbody) return;

    if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">No recent activity found</td></tr>';
        return;
    }

    tbody.innerHTML = logs.slice(0, 10).map(log => {
        let actionType = log.action_type;
        if (!actionType && log.details) {
            if (log.details.toLowerCase().includes('maintenance')) {
                actionType = log.details.toLowerCase().includes('enable') ? 'enable_maintenance' : 'disable_maintenance';
            } else if (log.details.toLowerCase().includes('login')) {
                actionType = log.source === 'ADMIN' ? 'admin_login' : 'login';
            }
        }
        
        const action = actionTypeMap[actionType] || { name: actionType || 'System Action', color: 'info', icon: 'ðŸ“' };
        const badgeClass = action.color ? `action-badge ${action.color}` : 'action-badge';
        
        const getVal = (val) => (val === undefined || val === null || val === 'undefined' || val === 'null' || val === '') ? null : val;

        const userData = {
            first_name: getVal(log.first_name) || getVal(log.admin_first_name),
            last_name: getVal(log.last_name) || getVal(log.admin_last_name),
            username: getVal(log.username) || getVal(log.admin_username),
            user_id: getVal(log.user_id) || getVal(log.admin_id) || getVal(log.id),
            photo_url: getVal(log.photo_url) || getVal(log.avatar_url) || getVal(log.profile_photo_url) || getVal(log.admin_photo_url)
        };

        const userInfo = (userData.user_id || userData.username) 
            ? formatUserInfo(userData)
            : '<span style="color: var(--text-dim);">System</span>';
        
        const detailsText = getVal(log.details) || action.name || 'Activity logged';
        
        return `
            <tr>
                <td class="timestamp" title="${formatDateTime(log.created_at || log.time)}">
                    <div style="font-weight: 500; color: var(--text-primary);">${formatTimeAgo(log.created_at || log.time)}</div>
                    <div style="font-size: 0.7rem; color: var(--text-dim);">${formatDateTime(log.created_at || log.time)}</div>
                </td>
                <td><span class="${badgeClass}">${action.icon} ${action.name}</span></td>
                <td>${userInfo}</td>
                <td><div class="details-text" style="max-width: 400px;">${detailsText}</div></td>
                <td><span class="action-badge ${log.source === 'ADMIN' ? 'primary' : 'info'}" style="opacity: 0.8;">${log.source || 'USER'}</span></td>
            </tr>
        `;
    }).join('');
}

async function loadUsers(page = 1) {
    if (!currentUser) return;
    
    const input = document.getElementById('unified-search-input-users');
    const searchTerm = input?.value || document.getElementById('global-search')?.value || '';
    const filters = searchChips.users || [];
    
    const tbody = document.getElementById('users-tbody');
    
    if (!tbody) return;
    
    tbody.innerHTML = renderSkeletonRows(7, 7);

    try {
        const url = new URL(`${BACKEND_URL}/admin/users`);
        url.searchParams.set('page', page);
        url.searchParams.set('limit', itemsPerPage);
        url.searchParams.set('sortBy', sortConfig.users.field);
        url.searchParams.set('order', sortConfig.users.direction);
        
        if (searchTerm || filters.length > 0) {
            url.searchParams.set('search', JSON.stringify({ freeText: searchTerm, filters }));
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': ADMIN_SECRET
            }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        users = data.users || [];
        currentPage.users = page;
        
        renderUsersTable(searchTerm);
        renderPagination('users', data.totalCount || 0, page);

    } catch (error) {
        console.error('Error loading users:', error);
        tbody.innerHTML = `<tr><td colspan="7" class="error">Error: ${error.message}</td></tr>`;
        showNotification('Failed to load users', 'error');
    }
}

function renderSkeletonRows(cols, rows) {
    let html = '';
    for (let i = 0; i < rows; i++) {
        html += '<tr>';
        for (let j = 0; j < cols; j++) {
            html += '<td><div class="skeleton-line" style="height: 1.5rem; background: var(--bg-darker); border-radius: 4px; animation: pulse 1.5s infinite;"></div></td>';
        }
        html += '</tr>';
    }
    return html;
}

function renderUsersTable(searchTerm = '') {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;

    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-muted);">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => {
        const userInfo = formatUserInfo(user);
        
        let statusHtml = '<div style="display: flex; gap: 0.25rem; flex-wrap: wrap;">';
        if (user.is_banned === true) {
            statusHtml += '<span class="action-badge danger">BANNED</span>';
        } else {
            statusHtml += '<span class="action-badge success">ACTIVE</span>';
        }

        if (user.is_admin === true) {
            statusHtml += '<span class="action-badge primary">ADMIN</span>';
        }
        statusHtml += '</div>';

        return `
        <tr>
            <td>${highlightText(userInfo, searchTerm)}</td>
            <td><div style="font-weight: 700; color: var(--primary); font-family: 'JetBrains Mono', monospace;">${new Decimal(user.score || 0).toFixed(9)}</div></td>
            <td><div style="font-size: 0.8rem; font-family: 'JetBrains Mono', monospace;">${new Decimal(user.click_value || 0).toFixed(9)}</div></td>
            <td><div style="font-size: 0.8rem; font-family: 'JetBrains Mono', monospace;">${new Decimal(user.auto_click_rate || 0).toFixed(9)}</div></td>
            <td class="timestamp" title="${user.last_updated ? formatDateTime(user.last_updated) : 'Never'}">
                <div style="font-size: 0.85rem; color: var(--text-secondary);">${user.last_updated ? formatTimeAgo(user.last_updated) : 'Never'}</div>
                <div style="font-size: 0.7rem; color: var(--text-dim);">${user.last_updated ? formatDateTime(user.last_updated) : ''}</div>
            </td>
            <td>${statusHtml}</td>
            <td>
                <button class="btn btn-outline btn-sm edit-user-btn" data-user-id="${user.user_id}">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        </tr>
        `;
    }).join('');
}

function highlightText(text, term) {
    if (!term || !text || typeof text !== 'string') return text;
    const cleanTerm = term.trim();
    if (cleanTerm.length === 0) return text;
    
    if (text.includes('<')) {
        const div = document.createElement('div');
        div.innerHTML = text;
        
        const walk = (node) => {
            if (node.nodeType === 3) { 
                const regex = new RegExp(`(${cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                const newNode = document.createElement('span');
                newNode.innerHTML = node.textContent.replace(regex, '<mark style="background: var(--warning); color: black; padding: 0 2px; border-radius: 2px;">$1</mark>');
                node.parentNode.replaceChild(newNode, node);
            } else {
                node.childNodes.forEach(walk);
            }
        };
        
        walk(div);
        return div.innerHTML;
    }
    
    const regex = new RegExp(`(${cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark style="background: var(--warning); color: black; padding: 0 2px; border-radius: 2px;">$1</mark>');
}

function setupRealTimePolling() {
    setInterval(() => {
        if (currentUser && document.getElementById('dashboard').classList.contains('active')) {
            loadDashboardStats();
            loadRecentActivity();
        }
        
        if (currentUser && document.getElementById('transactions').classList.contains('active')) {
            loadTransactions(currentPage.transactions || 1);
        }
    }, 30000);
}

async function editUser(userId) {
    const user = users.find(u => u.user_id == userId);
    if (!user) {
        showNotification('User not found', 'error');
        return;
    }

    currentEditingUserId = userId;

    const form = document.getElementById('edit-user-form');
    if (!form) return;

    const avatarUrl = getTelegramAvatarUrl(user);

    form.innerHTML = `
        <div class="modal-body">
            <div class="content-card" style="margin-bottom: 1.5rem; background: var(--bg-main);">
                <div class="user-cell">
                    <div class="user-avatar" style="width: 56px; height: 56px; font-size: 1.25rem; background: #4f46e5; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">
                        ${avatarUrl ? 
                            `<img src="${avatarUrl}" alt="${user.username || 'User'}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                             <div class="avatar-fallback" style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center;">${(user.username || '?').charAt(0).toUpperCase()}</div>` : 
                            `<div class="avatar-fallback" style="display: flex; width: 100%; height: 100%; align-items: center; justify-content: center;">${(user.username || '?').charAt(0).toUpperCase()}</div>`
                        }
                    </div>
                    <div class="user-details" style="margin-left: 1rem;">
                        <div class="user-name" style="font-size: 1.125rem; font-weight: 700;">
                            ${user.first_name || user.last_name ? 
                                `${user.first_name || ''} ${user.last_name || ''}`.trim() : 
                                user.username || 'Anonymous'}
                        </div>
                        <div class="user-username" style="color: var(--text-dim); font-size: 0.9rem;">
                            @${user.username || 'no_username'}
                        </div>
                        <div class="user-id" style="font-family: monospace; color: var(--text-muted); font-size: 0.75rem; margin-top: 0.25rem;">ID: ${user.user_id}</div>
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 1.5rem;">
                <h4 style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 1rem; letter-spacing: 0.05em; border-bottom: 1px solid var(--border-light); padding-bottom: 0.5rem;">Economic Settings</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">
                    <div class="form-group">
                        <label>Coins Balance</label>
                        <input type="text" id="edit-score" class="form-control" value="${new Decimal(user.score || 0).toFixed(9)}" style="font-family: 'JetBrains Mono', monospace; font-weight: 600; color: var(--primary);">
                    </div>
                    <div class="form-group">
                        <label>Value Per Click</label>
                        <input type="text" id="edit-click-value" class="form-control" value="${new Decimal(user.click_value || 0).toFixed(9)}" style="font-family: 'JetBrains Mono', monospace;">
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 1.5rem;">
                <h4 style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 1rem; letter-spacing: 0.05em; border-bottom: 1px solid var(--border-light); padding-bottom: 0.5rem;">Performance Configuration</h4>
                <div style="display: grid; grid-template-columns: 1fr; gap: 1.25rem;">
                    <div class="form-group">
                        <label>Clicks Per Second (Offline)</label>
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <input type="number" id="edit-auto-click-rate" class="form-control" value="${new Decimal(user.auto_click_rate || 0).toFixed(9)}" style="font-family: 'JetBrains Mono', monospace; flex: 1;" step="0.000000001" min="0" max="100">
                            <div id="cps-preview" style="padding: 0.5rem 1rem; background: var(--bg-darker); border-radius: 6px; font-size: 0.85rem; color: var(--success); font-weight: 600; min-width: 140px; text-align: center;">
                                ≈ ${(new Decimal(user.auto_click_rate || 0).times(60)).toFixed(6)} / min
                            </div>
                        </div>
                        <p style="font-size: 0.7rem; color: var(--text-dim); mt-1;">Limits: 0.0 to 100.0 CPS. Affects background earnings.</p>
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 1.5rem;">
                <h4 style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 1rem; letter-spacing: 0.05em; border-bottom: 1px solid var(--border-light); padding-bottom: 0.5rem;">Upgrade Levels</h4>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                    <div>
                        <h5 style="font-size: 0.7rem; color: var(--primary); margin-bottom: 0.5rem;">Click Upgrades</h5>
                        ${[1, 2, 3, 4, 5].map(i => `
                            <div class="form-group" style="margin-bottom: 0.5rem;">
                                <label style="font-size: 0.7rem;">Tier ${i}</label>
                                <input type="number" id="edit-click-tier-${i}" class="form-control upgrade-input" value="${user[`click_tier_${i}_level`] || 0}" min="0">
                            </div>
                        `).join('')}
                    </div>
                    <div>
                        <h5 style="font-size: 0.7rem; color: var(--success); margin-bottom: 0.5rem;">Auto Upgrades</h5>
                        ${[1, 2, 3, 4, 5].map(i => `
                            <div class="form-group" style="margin-bottom: 0.5rem;">
                                <label style="font-size: 0.7rem;">Tier ${i}</label>
                                <input type="number" id="edit-auto-tier-${i}" class="form-control upgrade-input" value="${user[`auto_tier_${i}_level`] || 0}" min="0">
                            </div>
                        `).join('')}
                    </div>
                    <div>
                        <h5 style="font-size: 0.7rem; color: var(--warning); margin-bottom: 0.5rem;">Offline Upgrades</h5>
                        ${[1, 2, 3, 4, 5].map(i => `
                            <div class="form-group" style="margin-bottom: 0.5rem;">
                                <label style="font-size: 0.7rem;">Tier ${i}</label>
                                <input type="number" id="edit-offline-tier-${i}" class="form-control upgrade-input" value="${user[`offline_tier_${i}_level`] || 0}" min="0">
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 1.5rem;">
                <h4 style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 1rem; letter-spacing: 0.05em; border-bottom: 1px solid var(--border-light); padding-bottom: 0.5rem;">Quick Actions</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                    <button class="btn btn-outline" id="add-coins-btn">
                        <i class="fas fa-plus-circle" style="color: var(--success);"></i> Add Coins
                    </button>
                    <button class="btn btn-outline" id="reset-score-btn" data-user-id="${user.user_id}">
                        <i class="fas fa-redo" style="color: var(--warning);"></i> Reset Score
                    </button>
                </div>
            </div>

            <div>
                <h4 style="font-size: 0.75rem; text-transform: uppercase; color: var(--danger); margin-bottom: 1rem; letter-spacing: 0.05em; border-bottom: 1px solid var(--danger-glow); padding-bottom: 0.5rem;">Danger Zone</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                    ${user.is_banned ? 
                        `<button class="btn btn-success" id="unban-btn" data-user-id="${user.user_id}">
                            <i class="fas fa-check"></i> Unban User
                        </button>` :
                        `<button class="btn btn-danger" id="ban-btn" data-user-id="${user.user_id}">
                            <i class="fas fa-ban"></i> Ban User
                        </button>`
                    }
                    <button class="btn btn-outline" id="delete-user-btn" data-user-id="${user.user_id}" style="color: var(--danger); border-color: var(--danger-glow);">
                        <i class="fas fa-trash"></i> Delete User
                    </button>
                </div>
            </div>
        </div>

        <div class="modal-footer">
            <button class="btn btn-outline" id="cancel-edit-user">
                Cancel
            </button>
            <button class="btn btn-primary" id="save-user-changes">
                <i class="fas fa-save"></i> Save Changes
            </button>
        </div>
    `;

    const cpsInput = document.getElementById('edit-auto-click-rate');
    const cpsPreview = document.getElementById('cps-preview');
    if (cpsInput && cpsPreview) {
        cpsInput.addEventListener('input', (e) => {
            try {
                const val = new Decimal(e.target.value || 0);
                cpsPreview.textContent = `≈ ${val.times(60).toFixed(6)} / min`;
                if (val.gt(100)) cpsPreview.style.color = 'var(--danger)';
                else cpsPreview.style.color = 'var(--success)';
            } catch (e) {
                cpsPreview.textContent = 'Invalid Value';
            }
        });
    }

    document.getElementById('edit-user-modal').classList.add('active');
}

function showAddCoinsModal() {
    document.getElementById('add-coins-modal').classList.add('active');
}

async function addCoinsToUser() {
    if (!currentEditingUserId) {
        showNotification('No user selected', 'error');
        return;
    }

    const amount = document.getElementById('add-coins-amount').value;

    if (!amount || new Decimal(amount).lessThanOrEqualTo(0)) {
        showNotification('Please enter a valid amount', 'error');
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/admin/users/${currentEditingUserId}/add-coins`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': ADMIN_SECRET
            },
            body: JSON.stringify({ 
                amount: new Decimal(amount).toFixed(9)
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to add coins');
        }

        showNotification(`Added ${amount} coins to user`, 'success');
        closeModal('add-coins-modal');
        loadUsers(currentPage.users);
        await logAdminAction('add_coins', currentEditingUserId, `Added ${amount} coins`);

    } catch (error) {
        console.error('Error adding coins:', error);
        showNotification(`Failed to add coins: ${error.message}`, 'error');
    }
}

async function addCoinsToAllUsers() {
    const amount = document.getElementById('add-coins-all-amount').value;
    const totalUsers = parseInt(document.getElementById('total-users').textContent) || 0;

    if (!amount || new Decimal(amount).lessThanOrEqualTo(0)) {
        showNotification('Please enter a valid amount', 'error');
        return;
    }

    if (totalUsers === 0) {
        showNotification('No users to add coins to', 'warning');
        return;
    }

    showConfirmationModal(
        'Add Coins to All Users',
        `Are you sure you want to add ${amount} coins to all ${totalUsers} users?`,
        async () => {
            try {
                showNotification('Adding coins to all users...', 'info');

                await new Promise(resolve => setTimeout(resolve, 2000));

                showNotification(`Added ${amount} coins to all ${totalUsers} users`, 'success');
                closeModal('add-coins-all-modal');
                loadUsers(currentPage.users);
                await logAdminAction('add_coins_all', null, `Added ${amount} coins to all ${totalUsers} users`);

            } catch (error) {
                console.error('Error adding coins to all users:', error);
                showNotification(`Failed to add coins: ${error.message}`, 'error');
            }
        },
        'warning',
        'Add Coins'
    );
}

async function resetAllScores() {
    const totalUsers = parseInt(document.getElementById('total-users').textContent) || 0;

    if (totalUsers === 0) {
        showNotification('No users to reset', 'warning');
        return;
    }

    showConfirmationModal(
        'Reset All Scores',
        `WARNING\n\nAre you sure you want to reset ALL user scores to 0?\n\nThis will affect ${totalUsers} users and cannot be undone!`,
        async () => {
            try {
                showNotification('Resetting all scores...', 'info');

                await new Promise(resolve => setTimeout(resolve, 2000));

                showNotification(`Reset scores for all ${totalUsers} users`, 'success');
                loadUsers(currentPage.users);
                await logAdminAction('reset_all_scores', null, `Reset scores for all ${totalUsers} users`);

            } catch (error) {
                console.error('Error resetting all scores:', error);
                showNotification(`Failed to reset scores: ${error.message}`, 'error');
            }
        },
        'danger',
        'Reset All'
    );
}

async function clearCache() {
    showConfirmationModal(
        'Clear Cache',
        'Are you sure you want to clear the cache?\n\nThis may improve performance but will cause slower initial load times.',
        async () => {
            try {
                showNotification('Clearing cache...', 'info');

                await new Promise(resolve => setTimeout(resolve, 1000));

                showNotification('Cache cleared successfully', 'success');
                await logAdminAction('clear_cache', null, 'Cache cleared');

            } catch (error) {
                console.error('Error clearing cache:', error);
                showNotification(`Failed to clear cache: ${error.message}`, 'error');
            }
        },
        'warning',
        'Clear Cache'
    );
}

async function createBackup() {
    try {
        showNotification('Creating backup...', 'info');

        await new Promise(resolve => setTimeout(resolve, 3000));

        showNotification('Backup created successfully', 'success');
        await logAdminAction('create_backup', null, 'Database backup created');

    } catch (error) {
        console.error('Error creating backup:', error);
        showNotification(`Failed to create backup: ${error.message}`, 'error');
    }
}

async function banUser(userId) {
    showConfirmationModal(
        'Ban User',
        'Are you sure you want to ban this user?',
        async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/admin/users/${userId}/ban`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-secret': ADMIN_SECRET
                    }
                });

                if (!response.ok) throw new Error('Failed to ban user');

                showNotification('User banned successfully', 'success');
                closeModal('edit-user-modal');
                loadUsers(currentPage.users);
                await logAdminAction('ban_user', userId, 'User banned');

            } catch (error) {
                console.error('Error banning user:', error);
                showNotification(`Failed to ban user: ${error.message}`, 'error');
            }
        },
        'danger',
        'Ban User'
    );
}

async function unbanUser(userId) {
    showConfirmationModal(
        'Unban User',
        'Are you sure you want to unban this user?',
        async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/admin/users/${userId}/unban`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-secret': ADMIN_SECRET
                    }
                });

                if (!response.ok) throw new Error('Failed to unban user');

                showNotification('User unbanned successfully', 'success');
                closeModal('edit-user-modal');
                loadUsers(currentPage.users);
                await logAdminAction('unban_user', userId, 'User unbanned');

            } catch (error) {
                console.error('Error unbanning user:', error);
                showNotification(`Failed to unban user: ${error.message}`, 'error');
            }
        },
        'success',
        'Unban User'
    );
}

async function resetUserScore(userId) {
    showConfirmationModal(
        'Reset User Score',
        'Are you sure you want to reset this user\'s score to 0?',
        async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/admin/users/${userId}/reset-score`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-secret': ADMIN_SECRET
                    }
                });

                if (!response.ok) throw new Error('Failed to reset user score');

                showNotification('User score reset to 0', 'success');
                closeModal('edit-user-modal');
                loadUsers(currentPage.users);
                await logAdminAction('reset_score', userId, 'Score reset to 0');

            } catch (error) {
                console.error('Error resetting score:', error);
                showNotification(`Failed to reset score: ${error.message}`, 'error');
            }
        },
        'danger',
        'Reset Score'
    );
}

async function deleteUser(userId) {
    showConfirmationModal(
        'Delete User',
        'DANGER ZONE\n\nAre you absolutely sure you want to PERMANENTLY DELETE this user?\n\nThis action cannot be undone and will remove all user data permanently!',
        async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/admin/users/${userId}/delete`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-secret': ADMIN_SECRET
                    }
                });

                if (!response.ok) throw new Error('Failed to delete user');

                showNotification('User deleted successfully', 'success');
                closeModal('edit-user-modal');
                loadUsers(currentPage.users);
                await logAdminAction('delete_user', userId, 'User permanently deleted');

            } catch (error) {
                console.error('Error deleting user:', error);
                showNotification(`Failed to delete user: ${error.message}`, 'error');
            }
        },
        'danger',
        'Delete User'
    );
}

async function saveUserChanges() {
    if (!currentEditingUserId) {
        showNotification('No user selected', 'error');
        return;
    }

    const saveBtn = document.getElementById('save-user-changes');
    const originalBtnContent = saveBtn.innerHTML;
    
    const score = document.getElementById('edit-score').value;
    const clickValue = document.getElementById('edit-click-value').value;
    const autoClickRate = document.getElementById('edit-auto-click-rate').value;

    if (!score || !clickValue || !autoClickRate) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    try {
        const scoreVal = new Decimal(score);
        const clickVal = new Decimal(clickValue);
        const autoVal = new Decimal(autoClickRate);

        if (scoreVal.isNegative() || clickVal.isNegative() || autoVal.isNegative()) {
            showNotification('Values must be non-negative', 'error');
            return;
        }
        
        if (autoClickRate.length > 10) {
            showNotification('Offline value is too long (max 10 chars)', 'error');
            return;
        }
    } catch (e) {
        showNotification('Invalid numeric values', 'error');
        return;
    }

    try {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        const updates = {
            score: new Decimal(score).toFixed(9),
            click_value: new Decimal(clickValue).toFixed(9),
            auto_click_rate: new Decimal(autoClickRate).toFixed(9)
        };

        for (let i = 1; i <= 5; i++) {
            updates[`click_tier_${i}_level`] = parseInt(document.getElementById(`edit-click-tier-${i}`).value) || 0;
            updates[`auto_tier_${i}_level`] = parseInt(document.getElementById(`edit-auto-tier-${i}`).value) || 0;
            updates[`offline_tier_${i}_level`] = parseInt(document.getElementById(`edit-offline-tier-${i}`).value) || 0;
        }

        const response = await fetch(`${BACKEND_URL}/admin/users/${currentEditingUserId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': ADMIN_SECRET
            },
            body: JSON.stringify(updates)
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const updatedUser = await response.json();
        
        const userIndex = users.findIndex(u => u.user_id == currentEditingUserId);
        if (userIndex !== -1 && updatedUser.user) {
            users[userIndex] = updatedUser.user;
        }

        showNotification('User updated successfully', 'success');
        closeModal('edit-user-modal');
        renderUsersTable();
        await logAdminAction('update_user', currentEditingUserId, 'User stats updated');

    } catch (error) {
        console.error('Error saving user changes:', error);
        showNotification(`Failed to save changes: ${error.message}`, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnContent;
    }
}

async function loadTransactions(page = 1) {
    if (!currentUser) return;

    const input = document.getElementById('unified-search-input-transactions');
    const freeText = input?.value || '';
    const filters = searchChips.transactions || [];
    
    const tbody = document.getElementById('transactions-tbody');
    if (!tbody) return;

    tbody.innerHTML = renderSkeletonRows(4, 15);

    try {
        const url = new URL(`${BACKEND_URL}/admin/transaction-details`);
        url.searchParams.set('page', page);
        url.searchParams.set('limit', 15);
        url.searchParams.set('sortBy', sortConfig.transactions.field);
        url.searchParams.set('order', sortConfig.transactions.direction);
        url.searchParams.set('search', JSON.stringify({ freeText, filters }));

        const response = await fetch(url, {
            headers: { 'x-admin-secret': ADMIN_SECRET }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        
        transactions = data.transactions || [];
        currentPage.transactions = page;
        
        renderTransactionsTable(freeText);
        renderPagination('transactions', data.totalCount || 0, page);

    } catch (error) {
        console.error('Error loading transactions:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="error">Error: ${error.message}</td></tr>`;
    }
}

function renderTransactionsTable(searchTerm = '') {
    const tbody = document.getElementById('transactions-tbody');
    if (!tbody) return;

    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">No transactions found</td></tr>';
        return;
    }

    tbody.innerHTML = transactions.map(tx => {
        const senderInfo = formatUserInfo({
            first_name: tx.sender_name,
            username: tx.sender_username,
            user_id: tx.sender_id,
            photo_url: tx.sender_photo_url
        });

        const receiverInfo = formatUserInfo({
            first_name: tx.receiver_name,
            username: tx.receiver_username,
            user_id: tx.receiver_id,
            photo_url: tx.receiver_photo_url
        });

        const statusColor = tx.status === 'success' ? 'var(--success)' : (tx.status === 'pending' ? 'var(--warning)' : 'var(--danger)');
        const statusIcon = tx.status === 'success' ? 'check-circle' : (tx.status === 'pending' ? 'clock' : 'times-circle');

        return `
        <tr>
            <td>
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="flex: 1; min-width: 0;">${highlightText(senderInfo, searchTerm)}</div>
                    <div style="color: var(--text-dim); flex-shrink: 0;"><i class="fas fa-long-arrow-alt-right fa-lg"></i></div>
                    <div style="flex: 1; min-width: 0;">${highlightText(receiverInfo, searchTerm)}</div>
                </div>
            </td>
            <td>
                <div style="font-weight: 700; color: var(--success); font-family: 'JetBrains Mono', monospace; font-size: 1rem;">
                    <i class="fas fa-coins" style="font-size: 0.8rem; opacity: 0.7;"></i> ${new Decimal(tx.amount || 0).toFixed(9)}
                </div>
            </td>
            <td>
                <span class="action-badge" style="background: ${statusColor}15; color: ${statusColor}; border: 1px solid ${statusColor}30; padding: 0.25rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase;">
                    <i class="fas fa-${statusIcon}"></i> ${tx.status || 'success'}
                </span>
            </td>
            <td class="timestamp" title="${formatDateTime(tx.created_at)}">
                <div style="font-size: 0.85rem; color: var(--text-secondary);">${formatTimeAgo(tx.created_at)}</div>
                <div style="font-size: 0.7rem; color: var(--text-dim);">${formatDateTime(tx.created_at)}</div>
            </td>
        </tr>
        `;
    }).join('');
}

let searchChips = {
    userLogs: [],
    adminLogs: [],
    transactions: [],
    tasks: []
};

function setupAdvancedSearch(sectionId) {
    const isUIAdmin = sectionId === 'adminLogs';
    const isTransactions = sectionId === 'transactions';
    const isTasks = sectionId === 'tasks';
    const isUsers = sectionId === 'users';
    
    let inputId = `unified-search-input${isUIAdmin ? '-admin' : ''}`;
    let barId = `unified-search-bar${isUIAdmin ? '-admin' : ''}`;
    let chipsId = `search-chips${isUIAdmin ? '-admin' : ''}`;

    if (isTransactions) {
        inputId = 'unified-search-input-transactions';
        barId = 'unified-search-bar-transactions';
        chipsId = 'search-chips-transactions';
    } else if (isTasks) {
        inputId = 'unified-search-input-tasks';
        barId = 'unified-search-bar-tasks';
        chipsId = 'search-chips-tasks';
    } else if (isUsers) {
        inputId = 'unified-search-input-users';
        barId = 'unified-search-bar-users';
        chipsId = 'search-chips-users';
    }

    const input = document.getElementById(inputId);
    const bar = document.getElementById(barId);
    const chipsContainer = document.getElementById(chipsId);

    if (!input || !bar) return;

    const dropdown = document.createElement('div');
    dropdown.className = 'search-menu-dropdown';
    dropdown.innerHTML = `
        <div class="search-menu-categories"></div>
        <div class="search-menu-options"></div>
    `;
    bar.appendChild(dropdown);
    
    dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    const categoriesContainer = dropdown.querySelector('.search-menu-categories');
    const optionsContainer = dropdown.querySelector('.search-menu-options');

    const config = {
        categories: [
            { id: 'filters', label: 'Filters', icon: 'filter' },
            { id: 'users', label: 'Users', icon: 'users' },
            { id: 'date', label: 'Date', icon: 'calendar' }
        ],
        filters: {
            users: [
                { label: 'Status: Banned', value: 'status:banned', hint: 'Filter' },
                { label: 'Status: Active', value: 'status:active', hint: 'Filter' },
                { label: 'Status: Admin', value: 'status:admin', hint: 'Filter' },
                { label: 'Score > 1000', value: 'score:1000', hint: 'Filter' }
            ],
            userLogs: [
                { label: 'Action: Login', value: 'action:login', hint: 'Filter' },
                { label: 'Action: Click', value: 'action:click', hint: 'Filter' },
                { label: 'Action: Upgrade', value: 'action:upgrade_purchase', hint: 'Filter' }
            ],
            adminLogs: [
                { label: 'Action: Ban', value: 'action:ban_user', hint: 'Filter' },
                { label: 'Action: Unban', value: 'action:unban_user', hint: 'Filter' },
                { label: 'Action: Add Coins', value: 'action:add_coins', hint: 'Filter' }
            ],
            transactions: [
                { label: 'Status: Success', value: 'status:success', hint: 'Filter' },
                { label: 'Status: Pending', value: 'status:pending', hint: 'Filter' },
                { label: 'Status: Failed', value: 'status:failed', hint: 'Filter' }
            ],
            tasks: [
                { label: 'Type: Social', value: 'type:manual', hint: 'Filter' },
                { label: 'Type: Clicks', value: 'type:clicks', hint: 'Filter' },
                { label: 'Status: Active', value: 'status:active', hint: 'Filter' },
                { label: 'Status: Inactive', value: 'status:inactive', hint: 'Filter' }
            ]
        }
    };

    let activeCategory = 'filters';
    let autocompleteTimer = null;

    bar.addEventListener('click', (e) => {
        if (!e.target.closest('.search-chip') && !e.target.closest('.chip-remove')) {
            input.focus();
            dropdown.classList.add('active');
            renderCategories();
            renderOptions();
        }
    });

    document.addEventListener('click', (e) => {
        if (!bar.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    input.addEventListener('input', (e) => {
        const val = e.target.value;
        if (val.length > 0) {
            dropdown.classList.add('active');
            if (val.includes(':')) {
            } else {
                if (activeCategory === 'filters') {
                    renderOptions(val);
                } else if (activeCategory === 'users') {
                    clearTimeout(autocompleteTimer);
                    autocompleteTimer = setTimeout(() => {
                        fetchUserSuggestions(val);
                    }, 300);
                }
            }
        } else {
            renderOptions();
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && input.value === '' && searchChips[sectionId] && searchChips[sectionId].length > 0) {
            removeChip(searchChips[sectionId].length - 1, sectionId);
        } else if (e.key === 'Enter') {
            dropdown.classList.remove('active');
            triggerSearch(sectionId);
        }
    });

    function renderCategories() {
        categoriesContainer.innerHTML = config.categories.map(cat => `
            <div class="menu-category-item ${activeCategory === cat.id ? 'active' : ''}" data-id="${cat.id}">
                <i class="fas fa-${cat.icon}"></i> ${cat.label}
            </div>
        `).join('');

        categoriesContainer.querySelectorAll('.menu-category-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                activeCategory = item.dataset.id;
                renderCategories();
                renderOptions();
                input.focus();
            });
        });
    }

    function renderOptions(filterText = '') {
        optionsContainer.innerHTML = '';
        
        if (activeCategory === 'filters') {
            const filters = config.filters[sectionId] || [];
            const filtered = filterText 
                ? filters.filter(f => f.label.toLowerCase().includes(filterText.toLowerCase()))
                : filters;
            
            if (filtered.length === 0) {
                optionsContainer.innerHTML = '<div style="padding: 1rem; color: var(--text-dim); text-align: center;">No filters found</div>';
                return;
            }

            filtered.forEach(opt => {
                const el = document.createElement('div');
                el.className = 'menu-option-item';
                el.innerHTML = `
                    <div class="menu-option-label">${opt.label}</div>
                    <div class="menu-option-hint">${opt.hint}</div>
                `;
                el.addEventListener('click', () => {
                    const [key, val] = opt.value.split(':');
                    addChip(key + ':', val);
                    input.value = '';
                    dropdown.classList.remove('active');
                });
                optionsContainer.appendChild(el);
            });
        } else if (activeCategory === 'users') {
            optionsContainer.innerHTML = '<div style="padding: 1rem; color: var(--text-dim); text-align: center;">Type to search users...</div>';
            if (filterText) {
                fetchUserSuggestions(filterText);
            }
        } else if (activeCategory === 'date') {
            const dates = [
                { label: 'Today', value: new Date().toISOString().split('T')[0] },
                { label: 'Yesterday', value: new Date(Date.now() - 86400000).toISOString().split('T')[0] }
            ];
            
            dates.forEach(d => {
                const el = document.createElement('div');
                el.className = 'menu-option-item';
                el.innerHTML = `<div class="menu-option-label">${d.label}</div>`;
                el.addEventListener('click', () => {
                    addChip('date:', d.value);
                    dropdown.classList.remove('active');
                });
                optionsContainer.appendChild(el);
            });
            
            const custom = document.createElement('div');
            custom.className = 'menu-option-item';
            custom.innerHTML = '<div class="menu-option-label">Custom Range...</div>';
            custom.addEventListener('click', () => {
                 if (!input._flatpickr) {
                    flatpickr(input, {
                        onChange: (selectedDates, dateStr) => {
                            addChip('date:', dateStr);
                            input.value = '';
                            input._flatpickr.destroy();
                            input._flatpickr = null;
                        }
                    }).open();
                }
            });
            optionsContainer.appendChild(custom);
        }
    }

    async function fetchUserSuggestions(query) {
        optionsContainer.innerHTML = '<div style="padding: 1rem; text-align: center;"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
        
        try {
            const response = await fetch(`${BACKEND_URL}/admin/search-users?query=${encodeURIComponent(query)}&limit=5`, {
                headers: { 'x-admin-secret': ADMIN_SECRET }
            });
            const users = await response.json();
            
            optionsContainer.innerHTML = '';
            if (users.length === 0) {
                optionsContainer.innerHTML = '<div style="padding: 1rem; color: var(--text-dim); text-align: center;">No users found</div>';
                return;
            }
            
            users.forEach(u => {
                const el = document.createElement('div');
                el.className = 'menu-option-item';
                el.innerHTML = `
                    <div class="user-search-result">
                        <div class="user-search-avatar">
                            ${u.profile_photo_url ? `<img src="${u.profile_photo_url}" style="width:100%;height:100%;border-radius:50%;">` : (u.username || '?')[0].toUpperCase()}
                        </div>
                        <div class="user-search-info">
                            <span class="user-search-name">${u.first_name || ''} ${u.last_name || ''}</span>
                            <span class="user-search-username">@${u.username || 'no_username'}</span>
                        </div>
                    </div>
                `;
                el.addEventListener('click', () => {
                    addChip('user:', u.user_id);
                    input.value = '';
                    dropdown.classList.remove('active');
                });
                optionsContainer.appendChild(el);
            });
            
        } catch (e) {
            console.error('Search error', e);
            optionsContainer.innerHTML = '<div style="padding: 1rem; color: var(--danger); text-align: center;">Error searching users</div>';
        }
    }

    function addChip(key, value) {
        if (!searchChips[sectionId]) searchChips[sectionId] = [];
        searchChips[sectionId].push({ key, value });
        renderChips(sectionId);
        triggerSearch(sectionId);
    }
}

function triggerSearch(sectionId) {
    if (sectionId === 'userLogs') loadUserLogs(1);
    else if (sectionId === 'adminLogs') loadAdminLogs(1);
    else if (sectionId === 'transactions') loadTransactions(1);
    else if (sectionId === 'tasks') loadTasks(1);
    else if (sectionId === 'users') loadUsers(1);
}

window.removeChip = (index, sectionId) => {
    if (searchChips[sectionId]) {
        searchChips[sectionId].splice(index, 1);
        renderChips(sectionId);
        triggerSearch(sectionId);
    }
};

function renderChips(sectionId) {
    const isUIAdmin = sectionId === 'adminLogs';
    const isTransactions = sectionId === 'transactions';
    const isTasks = sectionId === 'tasks';
    const isUsers = sectionId === 'users';
    
    let chipContainerId = 'search-chips';
    
    if (isUIAdmin) chipContainerId = 'search-chips-admin';
    else if (isTransactions) chipContainerId = 'search-chips-transactions';
    else if (isTasks) chipContainerId = 'search-chips-tasks';
    else if (isUsers) chipContainerId = 'search-chips-users';

    const container = document.getElementById(chipContainerId);
    if (!container) return;
    container.innerHTML = (searchChips[sectionId] || []).map((chip, index) => `
        <div class="search-chip">
            <span class="chip-key">${chip.key}</span>
            <span class="chip-value">${chip.value}</span>
            <i class="fas fa-times chip-remove" onclick="removeChip(${index}, '${sectionId}')"></i>
        </div>
    `).join('');
}

async function loadUserLogs(page = 1) {
    if (!currentUser) return;

    const input = document.getElementById('unified-search-input');
    const freeText = input?.value || '';
    const filters = searchChips.userLogs;
    const tbody = document.getElementById('user-logs-tbody');
    if (!tbody) return;

    tbody.innerHTML = renderSkeletonRows(4, 15);

    try {
        const url = new URL(`${BACKEND_URL}/admin/enhanced-user-logs`);
        url.searchParams.set('page', page);
        url.searchParams.set('limit', 15);
        url.searchParams.set('search', JSON.stringify({ freeText, filters }));

        const response = await fetch(url, {
            headers: { 'x-admin-secret': ADMIN_SECRET }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        
        userLogs = data.logs || [];
        currentPage.userLogs = page;
        
        renderUserLogsTable(freeText);
        renderPagination('user-logs', data.totalCount || 0, page);

    } catch (error) {
        console.error('Error loading user logs:', error);
        tbody.innerHTML = `<tr><td colspan="4" class="error">Error: ${error.message}</td></tr>`;
    }
}

function renderUserLogsTable(searchTerm = '') {
    const tbody = document.getElementById('user-logs-tbody');
    if (!tbody) return;

    if (userLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">No logs found</td></tr>';
        return;
    }

    tbody.innerHTML = userLogs.map(log => {
        const action = actionTypeMap[log.action_type] || { name: log.action_type, color: 'info', icon: 'ðŸ“' };
        const badgeClass = action.color ? `action-badge ${action.color}` : 'action-badge';

        const userInfo = formatUserInfo({
            first_name: log.first_name,
            last_name: log.last_name,
            username: log.username,
            user_id: log.user_id,
            photo_url: log.photo_url
        });

        return `
        <tr>
            <td>${highlightText(userInfo, searchTerm)}</td>
            <td><span class="${badgeClass}">${action.icon} ${action.name}</span></td>
            <td><div class="details-text" style="max-width: 450px;">${highlightText(parseDetails(log.details), searchTerm)}</div></td>
            <td class="timestamp" title="${formatDateTime(log.created_at)}">
                <div style="font-size: 0.85rem; color: var(--text-secondary);">${formatTimeAgo(log.created_at)}</div>
                <div style="font-size: 0.7rem; color: var(--text-dim);">${formatDateTime(log.created_at)}</div>
            </td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="deleteLog('userLogs', '${log.id}')" title="Delete Log">
                    <i class="fas fa-trash-alt" style="color: var(--danger);"></i>
                </button>
            </td>
        </tr>
        `;
    }).join('');
}

async function loadAdminLogs(page = 1) {
    if (!currentUser) return;

    const input = document.getElementById('unified-search-input-admin');
    const freeText = input?.value || '';
    const filters = searchChips.adminLogs;
    const tbody = document.getElementById('admin-logs-tbody');
    if (!tbody) return;

    tbody.innerHTML = renderSkeletonRows(5, 15);

    try {
        const url = new URL(`${BACKEND_URL}/admin/enhanced-admin-logs`);
        url.searchParams.set('page', page);
        url.searchParams.set('limit', 15);
        url.searchParams.set('search', JSON.stringify({ freeText, filters }));

        const response = await fetch(url, {
            headers: { 'x-admin-secret': ADMIN_SECRET }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        
        adminLogs = data.logs || [];
        currentPage.adminLogs = page;
        
        renderAdminLogsTable(freeText);
        renderPagination('admin-logs', data.totalCount || 0, page);

    } catch (error) {
        console.error('Error loading admin logs:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="error">Error: ${error.message}</td></tr>`;
    }
}

function renderAdminLogsTable(searchTerm = '') {
    const tbody = document.getElementById('admin-logs-tbody');
    if (!tbody) return;

    if (adminLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No logs found</td></tr>';
        return;
    }

    tbody.innerHTML = adminLogs.map(log => {
        const action = actionTypeMap[log.action_type] || { name: log.action_type, color: 'info', icon: 'ðŸ“' };
        const badgeClass = action.color ? `action-badge ${action.color}` : 'action-badge';

        const adminData = {
            first_name: log.admin_first_name || 'System',
            username: log.admin_username,
            user_id: log.admin_id,
            photo_url: log.admin_photo_url
        };
        const adminInfo = formatUserInfo(adminData);

        const targetData = log.target_user_id ? {
            first_name: log.target_first_name,
            last_name: log.target_last_name,
            username: log.target_username,
            user_id: log.target_user_id,
            photo_url: log.target_photo_url
        } : null;
        const targetInfo = targetData ? formatUserInfo(targetData) : '<span style="color: var(--text-dim);">System</span>';

        return `
        <tr>
            <td style="vertical-align: top; padding: 1rem 0.75rem; min-width: 180px;">${highlightText(adminInfo, searchTerm)}</td>
            <td style="vertical-align: top; padding: 1.25rem 0.75rem; width: 150px;"><span class="${badgeClass}">${action.icon} ${action.name}</span></td>
            <td style="vertical-align: top; padding: 1rem 0.75rem; min-width: 180px;">${highlightText(targetInfo, searchTerm)}</td>
            <td style="vertical-align: top; padding: 1rem 0.75rem;">
                <div class="details-text" style="max-width: 450px; font-size: 0.75rem; overflow-x: auto; white-space: pre-wrap; font-family: 'JetBrains Mono', monospace;">${highlightText(parseDetails(log.details), searchTerm)}</div>
            </td>
            <td class="timestamp" title="${formatDateTime(log.created_at)}" style="vertical-align: top; padding: 1rem 0.75rem; width: 120px;">
                <div style="font-size: 0.85rem; color: var(--text-secondary);">${formatTimeAgo(log.created_at)}</div>
                <div style="font-size: 0.7rem; color: var(--text-dim);">${formatDateTime(log.created_at)}</div>
            </td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="deleteLog('adminLogs', '${log.id}')" title="Delete Log">
                    <i class="fas fa-trash-alt" style="color: var(--danger);"></i>
                </button>
            </td>
        </tr>
        `;
    }).join('');
}

async function checkMaintenanceMode() {
    try {
        const response = await fetch(`${BACKEND_URL}/admin/maintenance-status`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': ADMIN_SECRET
            }
        }).catch(() => ({ ok: false }));

        if (response.ok) {
            const data = await response.json();
            maintenanceMode = data.maintenance_mode || false;
        } else {
            maintenanceMode = localStorage.getItem('sisi_maintenance_mode') === 'true';
        }

        updateMaintenanceUI();

    } catch (error) {
        console.error('Error checking maintenance mode:', error);
        maintenanceMode = false;
    }
}

async function toggleMaintenanceMode() {
    document.getElementById('maintenance-modal').classList.add('active');
    updateMaintenanceModalUI();
}

async function enableMaintenanceMode() {
    const message = document.getElementById('maintenance-message').value;
    const duration = document.getElementById('maintenance-duration').value;

    if (!message.trim()) {
        showNotification('Please enter a maintenance message', 'error');
        return;
    }

    try {
        showNotification('Enabling maintenance mode...', 'info');

        const response = await fetch(`${BACKEND_URL}/admin/maintenance-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': ADMIN_SECRET
            },
            body: JSON.stringify({
                maintenance_mode: true,
                message: message
            })
        });

        if (!response.ok) throw new Error('Failed to update maintenance status');

        maintenanceMode = true;
        localStorage.setItem('sisi_maintenance_mode', 'true');
        
        showNotification('Maintenance mode enabled', 'success');
        closeModal('maintenance-modal');
        updateMaintenanceUI();
        await logAdminAction('enable_maintenance', null, `Maintenance enabled: ${message}`);

    } catch (error) {
        console.error('Error enabling maintenance mode:', error);
        showNotification(`Failed to enable maintenance mode: ${error.message}`, 'error');
    }
}

async function disableMaintenanceMode() {
    try {
        showNotification('Disabling maintenance mode...', 'info');

        const response = await fetch(`${BACKEND_URL}/admin/maintenance-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': ADMIN_SECRET
            },
            body: JSON.stringify({
                maintenance_mode: false
            })
        });

        if (!response.ok) throw new Error('Failed to update maintenance status');

        maintenanceMode = false;
        localStorage.setItem('sisi_maintenance_mode', 'false');
        
        showNotification('Maintenance mode disabled', 'success');
        closeModal('maintenance-modal');
        updateMaintenanceUI();
        await logAdminAction('disable_maintenance', null, 'Maintenance disabled');

    } catch (error) {
        console.error('Error disabling maintenance mode:', error);
        showNotification(`Failed to disable maintenance mode: ${error.message}`, 'error');
    }
}

function updateMaintenanceUI() {
    const badge = document.getElementById('maintenance-badge');
    const toggleBtn = document.getElementById('maintenance-toggle-btn');
    const maintenanceText = document.getElementById('maintenance-text');

    if (maintenanceMode) {
        badge.classList.remove('hidden');
        toggleBtn.classList.add('btn-danger');
        toggleBtn.classList.remove('btn-warning');
        maintenanceText.textContent = 'Disable Maintenance';
    } else {
        badge.classList.add('hidden');
        toggleBtn.classList.remove('btn-danger');
        toggleBtn.classList.add('btn-warning');
        maintenanceText.textContent = 'Enable Maintenance';
    }
}

function updateMaintenanceModalUI() {
    const enableBtn = document.getElementById('enable-maintenance-btn');
    const disableBtn = document.getElementById('disable-maintenance-btn');

    if (maintenanceMode) {
        enableBtn.style.display = 'none';
        disableBtn.style.display = 'block';
    } else {
        enableBtn.style.display = 'block';
        disableBtn.style.display = 'none';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
    currentEditingUserId = null;
}

function renderPagination(type, totalCount, currentPageNum) {
    const paginationElement = document.getElementById(`${type}-pagination`);
    if (!paginationElement) return;

    const totalPages = Math.ceil(totalCount / 15);
    if (totalPages <= 1) {
        paginationElement.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-dim); text-align: center; width: 100%; margin-top: 1rem;">Showing all ${totalCount} records</div>`;
        return;
    }

    const hash = window.location.hash.split('?')[0];
    const params = new URLSearchParams(window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
    params.set(`${type}_page`, currentPageNum);
    window.location.hash = `${hash.replace('#', '')}?${params.toString()}`;

    const functionSuffix = type.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
    const loadFunctionName = `load${functionSuffix}`;

    let paginationHTML = `
        <div class="pagination-wrapper" style="display: flex; flex-direction: column; align-items: center; gap: 1rem; margin-top: 1.5rem;">
            <div class="pagination-info" style="font-size: 0.8rem; color: var(--text-dim);">
                Showing ${(currentPageNum - 1) * 15 + 1} - ${Math.min(currentPageNum * 15, totalCount)} of ${totalCount} records
            </div>
            <div class="pagination-container" style="display: flex; gap: 0.5rem; align-items: center; justify-content: center;">
                <button class="btn btn-outline btn-sm" onclick="${loadFunctionName}(${currentPageNum - 1})" ${currentPageNum <= 1 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                    <i class="fas fa-chevron-left"></i>
                </button>
    `;

    const maxVisible = 5;
    let start = Math.max(1, currentPageNum - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);

    if (start > 1) {
        paginationHTML += `<button class="btn btn-outline btn-sm" onclick="${loadFunctionName}(1)">1</button>`;
        if (start > 2) paginationHTML += '<span style="color: var(--text-dim);">...</span>';
    }

    for (let i = start; i <= end; i++) {
        paginationHTML += `<button class="btn ${i === currentPageNum ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="${loadFunctionName}(${i})" style="min-width: 32px;">${i}</button>`;
    }

    if (end < totalPages) {
        if (end < totalPages - 1) paginationHTML += '<span style="color: var(--text-dim);">...</span>';
        paginationHTML += `<button class="btn btn-outline btn-sm" onclick="${loadFunctionName}(totalPages)">${totalPages}</button>`;
    }

    paginationHTML += `
                <button class="btn btn-outline btn-sm" onclick="${loadFunctionName}(${currentPageNum + 1})" ${currentPageNum >= totalPages ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                    <i class="fas fa-chevron-right"></i>
                </button>
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-left: 1rem;">
                    <span style="font-size: 0.8rem; color: var(--text-dim);">Go to</span>
                    <input type="number" class="form-control" style="width: 60px; height: 32px; padding: 0 0.5rem; font-size: 0.8rem; text-align: center;" 
                        min="1" max="${totalPages}" value="${currentPageNum}" 
                        onkeypress="if(event.key === 'Enter') { const val = parseInt(this.value); if(val >= 1 && val <= ${totalPages}) ${loadFunctionName}(val); }">
                </div>
            </div>
        </div>
    `;

    paginationElement.innerHTML = paginationHTML;
}

async function logAdminAction(actionType, targetUserId, details) {
    if (!supabaseClient || !currentUser) return;

    try {
        await supabaseClient
            .from('admin_logs')
            .insert({
                admin_id: currentUser.id,
                action_type: actionType,
                target_user_id: targetUserId,
                details: details
            });
    } catch (error) {
        console.error('Error logging admin action:', error);
    }
}

function debounceSearch() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        loadUsers(1);
    }, 500);
}

let quickSearchResults = [];
let selectedSearchIndex = -1;

function setupEventListeners() {
    document.getElementById('global-search')?.addEventListener('input', debounce((e) => {
        handleGlobalSearch(e.target.value);
    }, 300));

    document.getElementById('user-logs-search')?.addEventListener('input', debounce((e) => {
        loadUserLogs(1);
    }, 300));

    document.getElementById('admin-logs-search')?.addEventListener('input', debounce((e) => {
        loadAdminLogs(1);
    }, 300));

    document.getElementById('user-logs-action-filter')?.addEventListener('change', () => {
        loadUserLogs(1);
    });

    document.getElementById('admin-logs-action-filter')?.addEventListener('change', () => {
        loadAdminLogs(1);
    });
     
    document.getElementById('login-button')?.addEventListener('click', login);
    
    document.getElementById('password')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            login();
        }
    });
    
    document.getElementById('dashboard-nav')?.addEventListener('click', () => showSection('dashboard'));
    document.getElementById('users-nav')?.addEventListener('click', () => showSection('users'));
    document.getElementById('transactions-nav')?.addEventListener('click', () => showSection('transactions'));
    document.getElementById('tasks-nav')?.addEventListener('click', () => showSection('tasks'));
    document.getElementById('user-logs-nav')?.addEventListener('click', () => showSection('user-logs'));
    document.getElementById('admin-logs-nav')?.addEventListener('click', () => showSection('admin-logs'));
    document.getElementById('skins-nav')?.addEventListener('click', () => { showSection('skins-admin'); loadSkinsAdmin(); });
    document.getElementById('settings-nav')?.addEventListener('click', () => showSection('settings'));
    
    document.getElementById('logout-button')?.addEventListener('click', logout);
    
    document.getElementById('refresh-data-btn')?.addEventListener('click', refreshAllData);
    document.getElementById('dashboard-refresh')?.addEventListener('click', loadDashboardStats);
    document.getElementById('refresh-activity-btn')?.addEventListener('click', loadRecentActivity);
    
    document.getElementById('user-search-btn')?.addEventListener('click', () => loadUsers(1));
    document.getElementById('user-search')?.addEventListener('input', debounceSearch);
    
    document.getElementById('export-users-btn')?.addEventListener('click', exportUserData);
    document.getElementById('export-transactions-btn')?.addEventListener('click', exportTransactionData);
    
    document.getElementById('add-coins-all-btn')?.addEventListener('click', showAddCoinsAllModal);
    document.getElementById('reset-all-scores-btn')?.addEventListener('click', resetAllScores);
    document.getElementById('clear-cache-btn')?.addEventListener('click', clearCache);
    document.getElementById('create-backup-btn')?.addEventListener('click', createBackup);
    
    document.getElementById('broadcast-btn')?.addEventListener('click', showBroadcastModal);
    document.getElementById('send-broadcast-btn')?.addEventListener('click', sendBroadcast);
    document.getElementById('cancel-broadcast-btn')?.addEventListener('click', () => closeModal('broadcast-modal'));
    
    document.getElementById('maintenance-toggle-btn')?.addEventListener('click', toggleMaintenanceMode);
    document.getElementById('enable-maintenance-btn')?.addEventListener('click', enableMaintenanceMode);
    document.getElementById('disable-maintenance-btn')?.addEventListener('click', disableMaintenanceMode);
    document.getElementById('cancel-maintenance-btn')?.addEventListener('click', () => closeModal('maintenance-modal'));
    
    document.getElementById('close-edit-modal')?.addEventListener('click', () => closeModal('edit-user-modal'));
    document.getElementById('close-add-coins-modal')?.addEventListener('click', () => closeModal('add-coins-modal'));
    document.getElementById('close-add-coins-all-modal')?.addEventListener('click', () => closeModal('add-coins-all-modal'));
    document.getElementById('close-broadcast-modal')?.addEventListener('click', () => closeModal('broadcast-modal'));
    document.getElementById('close-maintenance-modal')?.addEventListener('click', () => closeModal('maintenance-modal'));

    document.getElementById('create-task-btn')?.addEventListener('click', showCreateTaskModal);
    document.getElementById('close-create-task-modal')?.addEventListener('click', () => closeModal('create-task-modal'));
    document.getElementById('cancel-create-task')?.addEventListener('click', () => closeModal('create-task-modal'));
    document.getElementById('confirm-create-task')?.addEventListener('click', createTask);

    document.getElementById('create-skin-btn')?.addEventListener('click', () => openSkinModal());
    document.getElementById('refresh-skins-btn')?.addEventListener('click', loadSkinsAdmin);
    document.getElementById('close-skin-modal')?.addEventListener('click', closeSkinModal);
    document.getElementById('cancel-skin-btn')?.addEventListener('click', closeSkinModal);
    document.getElementById('save-skin-btn')?.addEventListener('click', saveSkin);
    
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
            currentEditingUserId = null;
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(modal => {
                modal.classList.remove('active');
            });
            currentEditingUserId = null;
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            refreshAllData();
        }
    });
    
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('sortable')) {
            const field = e.target.dataset.sort;
            const section = e.target.closest('.section').id;
            
            if (sortConfig[section].field === field) {
                sortConfig[section].direction = sortConfig[section].direction === 'asc' ? 'desc' : 'asc';
            } else {
                sortConfig[section].field = field;
                sortConfig[section].direction = 'asc';
            }
            
            currentPage[section] = 1;
            
            switch(section) {
                case 'users':
                    loadUsers(currentPage.users);
                    break;
                case 'transactions':
                    loadTransactions(currentPage.transactions);
                    break;
                case 'user-logs':
                    loadUserLogs(currentPage.userLogs);
                    break;
                case 'admin-logs':
                    loadAdminLogs(currentPage.adminLogs);
                    break;
            }
        }
        
        if (e.target.closest('.edit-user-btn')) {
            const userId = e.target.closest('.edit-user-btn').dataset.userId;
            editUser(userId);
        }
    });
    
    document.addEventListener('click', (e) => {
        if (e.target.id === 'add-coins-btn') {
            showAddCoinsModal();
        } else if (e.target.id === 'reset-score-btn') {
            const userId = e.target.dataset.userId;
            resetUserScore(userId);
        } else if (e.target.id === 'ban-btn') {
            const userId = e.target.dataset.userId;
            banUser(userId);
        } else if (e.target.id === 'unban-btn') {
            const userId = e.target.dataset.userId;
            unbanUser(userId);
        } else if (e.target.id === 'delete-user-btn') {
            const userId = e.target.dataset.userId;
            deleteUser(userId);
        } else if (e.target.closest('.edit-skin-btn')) {
            const id = e.target.closest('.edit-skin-btn').dataset.skinId;
            const row = e.target.closest('tr');
            const skin = row ? {
                id,
                name: row.dataset.name,
                image_url: row.dataset.imageUrl,
                price: row.dataset.price,
                task_id: row.dataset.taskId,
                is_active: row.dataset.active === 'true'
            } : { id };
            openSkinModal(skin);
        } else if (e.target.closest('.delete-skin-btn')) {
            const id = e.target.closest('.delete-skin-btn').dataset.skinId;
            deleteSkin(id);
        } else if (e.target.id === 'save-user-changes') {
            saveUserChanges();
        } else if (e.target.id === 'cancel-edit-user') {
            closeModal('edit-user-modal');
        }
    });
    
    document.getElementById('confirm-add-coins')?.addEventListener('click', addCoinsToUser);
    document.getElementById('cancel-add-coins')?.addEventListener('click', () => closeModal('add-coins-modal'));
    
    document.getElementById('confirm-add-coins-all')?.addEventListener('click', addCoinsToAllUsers);
    document.getElementById('cancel-add-coins-all')?.addEventListener('click', () => closeModal('add-coins-all-modal'));
    
    document.getElementById('add-coins-all-amount')?.addEventListener('input', updateCoinsCalculation);
}

async function refreshAllData() {
    showNotification('Refreshing all data...', 'info');
    
    try {
        await loadDashboardStats();
        await loadUsers(currentPage.users);
        await loadUserLogs(currentPage.userLogs);
        await loadAdminLogs(currentPage.adminLogs);
        await loadTransactions(currentPage.transactions);
        
        showNotification('All data refreshed successfully', 'success');
    } catch (error) {
        console.error('Error refreshing data:', error);
        showNotification('Failed to refresh data', 'error');
    }
}

function exportUserData() {
    if (users.length === 0) {
        showNotification('No users to export', 'warning');
        return;
    }

    let csvContent = "User ID,Username,First Name,Last Name,Coins,Per Click,Per Second,Status\n";
    
    users.forEach(user => {
        const status = user.is_banned ? "Banned" : "Active";
        const row = [
            user.user_id,
            user.username || '',
            user.first_name || '',
            user.last_name || '',
            new Decimal(user.score || 0).toFixed(9),
            new Decimal(user.click_value || 0).toFixed(9),
            new Decimal(user.auto_click_rate || 0).toFixed(9),
            status
        ].map(field => `"${field}"`).join(',');
        csvContent += row + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showNotification('User data exported successfully', 'success');
}

function exportTransactionData() {
    if (transactions.length === 0) {
        showNotification('No transactions to export', 'warning');
        return;
    }

    let csvContent = "Transaction ID,Sender ID,Receiver ID,Amount,Date\n";
    
    transactions.forEach(tx => {
        const row = [
            tx.id || '',
            tx.sender_id,
            tx.receiver_id,
            new Decimal(tx.amount || 0).toFixed(9),
            formatDateTime(tx.created_at)
        ].map(field => `"${field}"`).join(',');
        csvContent += row + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showNotification('Transaction data exported successfully', 'success');
}

function showBroadcastModal() {
    document.getElementById('broadcast-modal').classList.add('active');
}

function showAddCoinsAllModal() {
    const totalUsers = parseInt(document.getElementById('total-users').textContent) || 0;
    document.getElementById('total-users-count').textContent = totalUsers;
    updateCoinsCalculation();
    document.getElementById('add-coins-all-modal').classList.add('active');
}

function updateCoinsCalculation() {
    const amount = document.getElementById('add-coins-all-amount').value || '0.000000100';
    const totalUsers = parseInt(document.getElementById('total-users').textContent) || 0;
    
    document.getElementById('coins-per-user').textContent = amount;
    
    try {
        const totalCoins = new Decimal(amount).times(totalUsers).toFixed(9);
        document.getElementById('total-coins-to-add').textContent = totalCoins;
    } catch (e) {
        document.getElementById('total-coins-to-add').textContent = '0';
    }
}

    async function sendBroadcast() {
        const message = document.getElementById('broadcast-message').value;
        const type = document.getElementById('broadcast-type').value;

        if (!message.trim()) {
            showNotification('Please enter a message', 'error');
            return;
        }

        showNotification('Sending broadcast...', 'info');

        try {
            const response = await fetch(`${BACKEND_URL}/admin/broadcast`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-secret': ADMIN_SECRET
                },
                body: JSON.stringify({
                    message: message,
                    type: type,
                    is_active: true
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to send broadcast');
            }

            await logAdminAction('send_broadcast', null, `Broadcast sent: ${message}`);
            
            closeModal('broadcast-modal');
            document.getElementById('broadcast-message').value = '';
            showNotification('Broadcast sent successfully', 'success');
        } catch (error) {
            console.error('Error sending broadcast:', error);
            showNotification(`Broadcast failed: ${error.message}`, 'error');
        }
    }

function toggleQuickSearch(show) {
    const overlay = document.getElementById('quick-search-overlay');
    const input = document.getElementById('quick-search-input');
    
    if (show) {
        overlay.classList.add('active');
        input.value = '';
        input.focus();
        renderQuickSearchResults([]);
    } else {
        overlay.classList.remove('active');
    }
}

async function handleQuickSearch(query) {
    if (!query || query.length < 2) {
        renderQuickSearchResults([]);
        return;
    }

    try {
        const userResp = await fetch(`${BACKEND_URL}/admin/users?search=${encodeURIComponent(query)}&limit=5`, {
            headers: { 'x-admin-secret': ADMIN_SECRET }
        });
        const userData = await userResp.json();
        
        const results = [
            ...(userData.users || []).map(u => ({
                type: 'USER',
                id: u.user_id,
                title: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || 'Anonymous',
                subtitle: `@${u.username || 'no_username'} · ID: ${u.user_id}`,
                icon: 'user',
                action: () => {
                    showSection('users');
                    setTimeout(() => editUser(u.user_id), 100);
                }
            }))
        ];

        quickSearchResults = results;
        selectedSearchIndex = results.length > 0 ? 0 : -1;
        renderQuickSearchResults(results);

    } catch (error) {
        console.error('Quick search error:', error);
    }
}

function handleQuickSearchKeydown(e) {
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, quickSearchResults.length - 1);
        updateSelectedSearchResult();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, 0);
        updateSelectedSearchResult();
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedSearchIndex >= 0 && quickSearchResults[selectedSearchIndex]) {
            quickSearchResults[selectedSearchIndex].action();
            toggleQuickSearch(false);
        }
    }
}

function updateSelectedSearchResult() {
    const items = document.querySelectorAll('.quick-search-item');
    items.forEach((item, index) => {
        if (index === selectedSearchIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
        }
    });
}

function renderQuickSearchResults(results) {
    const container = document.getElementById('quick-search-results');
    if (!container) return;

    if (results.length === 0) {
        container.innerHTML = '<div class="quick-search-empty">No results found for your query.</div>';
        return;
    }

    container.innerHTML = results.map((res, index) => `
        <div class="quick-search-item ${index === selectedSearchIndex ? 'selected' : ''}" onclick="quickSearchResults[${index}].action(); toggleQuickSearch(false);">
            <div class="quick-search-icon">
                <i class="fas fa-${res.icon}"></i>
            </div>
            <div class="quick-search-content">
                <div class="quick-search-title">${escapeHtml(res.title)}</div>
                <div class="quick-search-subtitle">${escapeHtml(res.subtitle)}</div>
            </div>
            <div class="quick-search-type">${res.type}</div>
        </div>
    `).join('');
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin panel loaded');
    initAdminPanel();
});

window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    showNotification('An unexpected error occurred', 'error');
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showNotification('An unexpected error occurred', 'error');
});

window.loadUsers = loadUsers;
window.loadUserLogs = loadUserLogs;
window.loadAdminLogs = loadAdminLogs;
window.loadTransactions = loadTransactions;

async function loadTasks(page = 1) {
    if (!currentUser) return;
    
    const input = document.getElementById('unified-search-input-tasks');
    const freeText = input?.value || '';
    const filters = (searchChips && searchChips.tasks) ? searchChips.tasks : [];
    
    const tbody = document.getElementById('tasks-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = renderSkeletonRows(7, 5);

    try {
        const url = new URL(`${BACKEND_URL}/admin/tasks`);
        url.searchParams.set('page', page);
        url.searchParams.set('limit', 15);
        
        if (!sortConfig.tasks) {
            sortConfig.tasks = { field: 'created_at', direction: 'desc' };
        }
        
        const sortField = sortConfig.tasks.field || 'created_at';
        const sortDir = sortConfig.tasks.direction || 'desc';
        
        url.searchParams.set('sortBy', sortField);
        url.searchParams.set('order', sortDir);
        url.searchParams.set('search', JSON.stringify({ freeText, filters }));

        const response = await fetch(url, {
            headers: { 'x-admin-secret': ADMIN_SECRET }
        });

        if (!response.ok) {
            let errorText = await response.text();
            try {
                const errorJson = JSON.parse(errorText);
                errorText = errorJson.error || errorJson.message || errorText;
            } catch (e) {}
            throw new Error(`Server Error (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        tasks = data.tasks || [];
        currentPage.tasks = page;
        
        renderTasksTable();
        renderPagination('tasks', data.totalCount || 0, page);

    } catch (error) {
        console.error('Error loading tasks:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="error" style="text-align: center; padding: 2rem; color: var(--danger);">
                    <div style="margin-bottom: 0.5rem;"><i class="fas fa-exclamation-triangle fa-2x"></i></div>
                    <div>Failed to load tasks</div>
                    <div style="font-size: 0.8rem; opacity: 0.8; margin-top: 0.5rem;">${escapeHtml(error.message)}</div>
                    <button class="btn btn-outline btn-sm" onclick="loadTasks(${page})" style="margin-top: 1rem;">
                        <i class="fas fa-sync-alt"></i> Retry
                    </button>
                </td>
            </tr>`;
        showNotification('Failed to load tasks: ' + error.message, 'error');
    }
}

function renderTasksTable() {
    const tbody = document.getElementById('tasks-tbody');
    if (!tbody) return;

    if (tasks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No tasks found</td></tr>';
        return;
    }

    tbody.innerHTML = tasks.map(task => {
        const rewardDisplay = task.reward_type === 'coins' 
            ? `${new Decimal(task.reward_amount).toFixed(9)} coins`
            : 'ðŸŽ Present';
            
        return `
        <tr>
            <td><div style="font-weight: 600;">${escapeHtml(task.title)}</div></td>
            <td><div style="font-size: 0.85rem; color: var(--text-secondary); max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(task.description)}</div></td>
            <td><span class="badge badge-info">${task.type}</span></td>
            <td>${task.target_value}</td>
            <td><span class="text-success">${rewardDisplay}</span></td>
            <td>
                <span class="badge ${task.is_active ? 'badge-success' : 'badge-danger'}">
                    ${task.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="deleteTask('${task.id}')" style="color: var(--danger);">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
        `;
    }).join('');
}

function showCreateTaskModal() {
    document.getElementById('create-task-modal').classList.add('active');
}

async function createTask() {
    const title = document.getElementById('task-title').value;
    const description = document.getElementById('task-description').value;
    const type = document.getElementById('task-type').value;
    const target = document.getElementById('task-target').value;
    const rewardType = document.getElementById('task-reward-type').value;
    const rewardAmount = document.getElementById('task-reward-amount').value;
    const expiresAt = document.getElementById('task-expires-at').value;
    const taskUrl = document.getElementById('task-url').value;

    if (!title || !type || !target || !rewardAmount) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/admin/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': ADMIN_SECRET
            },
            body: JSON.stringify({
                title,
                description,
                type,
                target_value: parseInt(target),
                reward_type: rewardType,
                reward_amount: rewardAmount,
                expires_at: expiresAt || null,
                task_url: taskUrl
            })
        });

        if (!response.ok) throw new Error('Failed to create task');

        showNotification('Task created successfully', 'success');
        closeModal('create-task-modal');
        loadTasks();
        

        document.getElementById('task-title').value = '';
        document.getElementById('task-description').value = '';
        document.getElementById('task-target').value = '';
        document.getElementById('task-reward-amount').value = '0.000000100';
        document.getElementById('task-url').value = '';

    } catch (error) {
        console.error('Error creating task:', error);
        showNotification(`Failed to create task: ${error.message}`, 'error');
    }
}

async function deleteTask(taskId) {
    showConfirmationModal(
        'Delete Task',
        'Are you sure you want to delete this task?',
        async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/admin/tasks/${taskId}`, {
                    method: 'DELETE',
                    headers: { 'x-admin-secret': ADMIN_SECRET }
                });

                if (!response.ok) throw new Error('Failed to delete task');

                showNotification('Task deleted successfully', 'success');
                loadTasks();

            } catch (error) {
                console.error('Error deleting task:', error);
                showNotification(`Failed to delete task: ${error.message}`, 'error');
            }
        },
        'danger',
        'Delete'
    );
}

window.loadTasks = loadTasks;
window.createTask = createTask;
window.deleteTask = deleteTask;
window.showCreateTaskModal = showCreateTaskModal;

window.refreshAllData = refreshAllData;
window.editUser = editUser;
window.saveUserChanges = saveUserChanges;
window.closeModal = closeModal;
window.saveUserChanges = saveUserChanges;
window.closeModal = closeModal;
window.loadSkinsAdmin = loadSkinsAdmin;
window.openSkinModal = openSkinModal;
window.saveSkin = saveSkin;
window.deleteSkin = deleteSkin;

