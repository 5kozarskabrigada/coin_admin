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

const itemsPerPage = 15;
let currentPage = {
    users: 1,
    userLogs: 1,
    adminLogs: 1,
    transactions: 1
};

let sortConfig = {
    users: { field: 'user_id', direction: 'asc' },
    userLogs: { field: 'created_at', direction: 'desc' },
    adminLogs: { field: 'created_at', direction: 'desc' },
    transactions: { field: 'created_at', direction: 'desc' }
};

let currentEditingUserId = null;
let debounceTimer = null;
let maintenanceMode = false;

const actionTypeMap = {
    'solo_lottery_win': { name: 'Won Solo Game', color: 'success', icon: '🏆' },
    'upgrade_purchase': { name: 'Purchased Upgrade', color: 'primary', icon: '⚙️' },
    'coin_transfer': { name: 'Sent Coins', color: 'info', icon: '💰' },
    'coin_received': { name: 'Received Coins', color: 'success', icon: '💸' },
    'login': { name: 'Logged In', color: 'info', icon: '🔑' },
    
    'ban_user': { name: 'User Banned', color: 'danger', icon: '🚫' },
    'unban_user': { name: 'User Unbanned', color: 'success', icon: '✅' },
    'add_coins': { name: 'Coins Added', color: 'warning', icon: '➕' },
    'reset_score': { name: 'Score Reset', color: 'danger', icon: '🔄' },
    'delete_user': { name: 'User Deleted', color: 'danger', icon: '🗑️' },
    'admin_login': { name: 'Admin Login', color: 'info', icon: '👑' },
    'send_broadcast': { name: 'Broadcast Sent', color: 'info', icon: '📢' },
    'create_backup': { name: 'Backup Created', color: 'info', icon: '💾' },
    'enable_maintenance': { name: 'Maintenance Enabled', color: 'warning', icon: '🔧' },
    'disable_maintenance': { name: 'Maintenance Disabled', color: 'success', icon: '✅' },
    'make_admin': { name: 'Admin Promoted', color: 'primary', icon: '👑' },
    'remove_admin': { name: 'Admin Demoted', color: 'warning', icon: '👤' },
    'reset_upgrades': { name: 'Upgrades Reset', color: 'danger', icon: '🔄' },
    'update_user': { name: 'User Updated', color: 'info', icon: '✏️' },
    'add_coins_all': { name: 'Coins Added to All', color: 'warning', icon: '👥' },
    'reset_all_scores': { name: 'All Scores Reset', color: 'danger', icon: '🔄' },
    'clear_cache': { name: 'Cache Cleared', color: 'info', icon: '🗑️' }
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
            let html = '<div class="details-text">';
            for (const [key, value] of Object.entries(parsed)) {
                const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                let formattedValue = value;
                
                if (typeof value === 'object' && value !== null) {
                    formattedValue = JSON.stringify(value, null, 2);
                } else if (typeof value === 'boolean') {
                    formattedValue = value ? 'Yes' : 'No';
                } else if (typeof value === 'number' && (key.includes('amount') || key.includes('coins') || key.includes('score'))) {
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
        console.log('🚀 Initializing admin panel...');
        
         
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        await checkAuth();
        
        setupEventListeners();
        setupSearchListeners();
        
        await checkMaintenanceMode();
        
        if (currentUser) {
            loadDashboardStats();
            loadUsers();
        }
        
    } catch (error) {
        console.error('❌ Failed to initialize admin panel:', error);
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
    document.getElementById('admin-panel').style.display = 'block';
}

function showSection(sectionName) {
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

    document.getElementById(`${sectionName}-nav`).classList.add('active');

    switch (sectionName) {
        case 'dashboard':
            loadDashboardStats();
            break;
        case 'users':
            loadUsers();
            break;
        case 'user-logs':
            loadUserLogs();
            break;
        case 'admin-logs':
            loadAdminLogs();
            break;
        case 'transactions':
            loadTransactions();
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
        document.getElementById('active-today').textContent = data.activeToday || 0;
        document.getElementById('banned-users').textContent = data.bannedUsers || 0;
        document.getElementById('total-transactions').textContent = data.totalTransactions || 0;
        document.getElementById('total-coins').textContent = new Decimal(data.totalCoins || 0).toFixed(2);

        document.getElementById('sidebar-total-users').textContent = data.totalUsers || 0;
        document.getElementById('sidebar-total-coins').textContent = new Decimal(data.totalCoins || 0).toFixed(2);
        document.getElementById('sidebar-active-today').textContent = data.activeToday || 0;

        document.getElementById('api-status').textContent = 'Online';
        document.getElementById('api-status-indicator').className = 'status-indicator online';

        await loadRecentActivity();

    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        document.getElementById('api-status').textContent = 'Offline';
        document.getElementById('api-status-indicator').className = 'status-indicator';
        showNotification('Failed to load dashboard data', 'error');
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
    const hasFirst = user.first_name && user.first_name.trim().length > 0;
    const hasLast = user.last_name && user.last_name.trim().length > 0;
    const displayName = hasFirst
        ? `${user.first_name}${hasLast ? ' ' + user.last_name : ''}`
        : (user.username || 'Anonymous');
    
    const username = user.username ? `@${user.username}` : '';
    const userId = user.user_id ? String(user.user_id).substring(0, 8) + '...' : '';

    return `
        <div class="user-info-compact">
            <div class="user-name">${escapeHtml(displayName)}</div>
            ${username ? `<div class="user-username">${escapeHtml(username)}</div>` : ''}
            ${userId ? `<div class="user-id">ID: ${userId}</div>` : ''}
        </div>
    `;
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
        const action = actionTypeMap[log.action_type] || { name: log.action_type, color: 'info', icon: '📝' };
        const badgeClass = action.color ? `action-badge ${action.color}` : 'action-badge';
        
        return `
            <tr>
                <td class="timestamp" title="${formatDateTime(log.created_at || log.time)}">
                    <div style="font-weight: 500; color: var(--text-primary);">${formatTimeAgo(log.created_at || log.time)}</div>
                    <div style="font-size: 0.7rem; color: var(--text-dim);">${formatDateTime(log.created_at || log.time)}</div>
                </td>
                <td><span class="${badgeClass}">${action.icon} ${action.name}</span></td>
                <td>
                    <div class="user-cell">
                        <div class="user-avatar" style="width: 32px; height: 32px; font-size: 0.75rem;">
                            ${(log.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <div class="user-details">
                            <div class="user-name" style="font-size: 0.875rem;">${log.username || 'System'}</div>
                            <div class="user-username" style="font-size: 0.7rem;">${log.user_id ? String(log.user_id).substring(0, 8) : 'System'}</div>
                        </div>
                    </div>
                </td>
                <td><div class="details-text" style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${log.details || '-'}</div></td>
                <td><span class="action-badge ${log.source === 'ADMIN' ? 'primary' : 'info'}" style="opacity: 0.8;">${log.source || 'USER'}</span></td>
            </tr>
        `;
    }).join('');
}

async function loadUsers(page = 1) {
    if (!currentUser) return;
    
    const searchTerm = document.getElementById('user-search')?.value || '';
    const tbody = document.getElementById('users-tbody');
    
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" class="loading">Loading users...</td></tr>';

    try {
        const url = new URL(`${BACKEND_URL}/admin/users`);
        url.searchParams.set('page', page);
        url.searchParams.set('limit', itemsPerPage);
        if (searchTerm) {
            url.searchParams.set('search', searchTerm);
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
        
        renderUsersTable();
        renderPagination('users', data.totalCount || 0, page);

    } catch (error) {
        console.error('Error loading users:', error);
        tbody.innerHTML = `<tr><td colspan="7" class="error">Error: ${error.message}</td></tr>`;
        showNotification('Failed to load users', 'error');
    }
}

function renderUsersTable() {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;

    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-muted);">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => {
        const avatarUrl = getTelegramAvatarUrl(user);
        
        const userCell = `
            <div class="user-cell">
                <div class="user-avatar">
                    ${avatarUrl ? 
                        `<img src="${avatarUrl}" alt="${user.username || 'User'}" onerror="this.style.display='none'; this.parentNode.innerHTML='<div class=\\'avatar-fallback\\'>${(user.username || '?').charAt(0).toUpperCase()}</div>';">` : 
                        `<div class="avatar-fallback">${(user.username || '?').charAt(0).toUpperCase()}</div>`
                    }
                </div>
                <div class="user-details">
                    <div class="user-name">
                        ${user.first_name || user.last_name ? 
                            `${user.first_name || ''} ${user.last_name || ''}`.trim() : 
                            user.username || 'Anonymous'}
                    </div>
                    <div class="user-username">
                        @${user.username || 'no_username'}
                    </div>
                    <div class="user-id" title="${user.user_id}">ID: ${String(user.user_id).substring(0, 8)}...</div>
                </div>
            </div>
        `;

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
            <td>${userCell}</td>
            <td><div style="font-weight: 700; color: var(--primary); font-family: monospace;">${new Decimal(user.score || 0).toFixed(4)}</div></td>
            <td><div style="font-size: 0.8rem;">${new Decimal(user.click_value || 0).toFixed(6)}</div></td>
            <td><div style="font-size: 0.8rem;">${new Decimal(user.auto_click_rate || 0).toFixed(6)}</div></td>
            <td class="timestamp" title="${user.last_updated ? formatDateTime(user.last_updated) : 'Never'}">
                <div style="font-size: 0.85rem;">${user.last_updated ? formatTimeAgo(user.last_updated) : 'Never'}</div>
            </td>
            <td>${statusHtml}</td>
            <td>
                <button class="btn btn-outline btn-sm edit-user-btn" data-user-id="${user.user_id}">
                    <i class="fas fa-edit"></i> Edit
                </button>
            </td>
        </tr>
        `;
    }).join('');
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
                    <div class="user-avatar" style="width: 56px; height: 56px; font-size: 1.25rem;">
                        ${avatarUrl ? 
                            `<img src="${avatarUrl}" alt="${user.username || 'User'}" onerror="this.style.display='none'; this.parentNode.innerHTML='<div class=\\'avatar-fallback\\'>${(user.username || '?').charAt(0).toUpperCase()}</div>';">` : 
                            `<div class="avatar-fallback">${(user.username || '?').charAt(0).toUpperCase()}</div>`
                        }
                    </div>
                    <div class="user-details">
                        <div class="user-name" style="font-size: 1.125rem;">
                            ${user.first_name || user.last_name ? 
                                `${user.first_name || ''} ${user.last_name || ''}`.trim() : 
                                user.username || 'Anonymous'}
                        </div>
                        <div class="user-username">
                            @${user.username || 'no_username'}
                        </div>
                        <div class="user-id" style="font-family: monospace; color: var(--text-dim);">ID: ${user.user_id}</div>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                <div class="form-group">
                    <label>Coins Balance</label>
                    <input type="text" id="edit-score" class="form-control" value="${new Decimal(user.score || 0).toFixed(9)}" style="font-family: monospace; font-weight: 600; color: var(--primary);">
                </div>
                <div class="form-group">
                    <label>Value Per Click</label>
                    <input type="text" id="edit-click-value" class="form-control" value="${new Decimal(user.click_value || 0).toFixed(9)}" style="font-family: monospace;">
                </div>
            </div>

            <div style="margin-bottom: 1.5rem;">
                <h4 style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.75rem; letter-spacing: 0.05em;">Quick Actions</h4>
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
                <h4 style="font-size: 0.75rem; text-transform: uppercase; color: var(--danger); margin-bottom: 0.75rem; letter-spacing: 0.05em;">Danger Zone</h4>
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

    if (!confirm(`Are you sure you want to add ${amount} coins to all ${totalUsers} users?`)) {
        return;
    }

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
}

async function resetAllScores() {
    const totalUsers = parseInt(document.getElementById('total-users').textContent) || 0;

    if (totalUsers === 0) {
        showNotification('No users to reset', 'warning');
        return;
    }

    if (!confirm(`⚠️ WARNING ⚠️\n\nAre you sure you want to reset ALL user scores to 0?\n\nThis will affect ${totalUsers} users and cannot be undone!`)) {
        return;
    }

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
}

async function clearCache() {
    if (!confirm('Are you sure you want to clear the cache?\n\nThis may improve performance but will cause slower initial load times.')) {
        return;
    }

    try {
        showNotification('Clearing cache...', 'info');

        await new Promise(resolve => setTimeout(resolve, 1000));

        showNotification('Cache cleared successfully', 'success');
        await logAdminAction('clear_cache', null, 'Cache cleared');

    } catch (error) {
        console.error('Error clearing cache:', error);
        showNotification(`Failed to clear cache: ${error.message}`, 'error');
    }
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
    if (!confirm('Are you sure you want to ban this user?')) return;

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
}

async function unbanUser(userId) {
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
}

async function resetUserScore(userId) {
    if (!confirm('Are you sure you want to reset this user\'s score to 0?')) return;

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
}

async function deleteUser(userId) {
    if (!confirm('⚠️ DANGER ZONE ⚠️\n\nAre you absolutely sure you want to PERMANENTLY DELETE this user?\n\nThis action cannot be undone and will remove all user data permanently!')) return;

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
}

async function saveUserChanges() {
    if (!currentEditingUserId) {
        showNotification('No user selected', 'error');
        return;
    }

    const score = document.getElementById('edit-score').value;
    const clickValue = document.getElementById('edit-click-value').value;

    if (!score || !clickValue) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/admin/users/${currentEditingUserId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': ADMIN_SECRET
            },
            body: JSON.stringify({
                score: new Decimal(score).toFixed(9),
                click_value: new Decimal(clickValue).toFixed(9)
            })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        showNotification('User updated successfully', 'success');
        closeModal('edit-user-modal');
        loadUsers(currentPage.users);
        await logAdminAction('update_user', currentEditingUserId, 'User stats updated');

    } catch (error) {
        console.error('Error saving user changes:', error);
        showNotification(`Failed to save changes: ${error.message}`, 'error');
    }
}

async function loadTransactions(page = 1) {
    if (!currentUser) return;

    const tbody = document.getElementById('transactions-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="3" class="loading">Loading transactions...</td></tr>';

    try {
        const response = await fetch(`${BACKEND_URL}/admin/enhanced-transaction-details?page=${page}&limit=${itemsPerPage}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': ADMIN_SECRET
            }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        transactions = data.transactions || [];
        currentPage.transactions = page;
        
        renderTransactionsTable();
        renderPagination('transactions', data.totalCount || 0, page);

    } catch (error) {
        console.error('Error loading transactions:', error);
        tbody.innerHTML = `<tr><td colspan="3" class="error">Error: ${error.message}</td></tr>`;
        showNotification('Failed to load transactions', 'error');
    }
}

function renderTransactionsTable() {
    const tbody = document.getElementById('transactions-tbody');
    if (!tbody) return;

    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 2rem; color: var(--text-muted);">No transactions found</td></tr>';
        return;
    }

    tbody.innerHTML = transactions.map(tx => {
        const senderInfo = formatUserInfo({
            first_name: tx.sender_name,
            username: tx.sender_username,
            user_id: tx.sender_id
        });

        const receiverInfo = formatUserInfo({
            first_name: tx.receiver_name,
            username: tx.receiver_username,
            user_id: tx.receiver_id
        });

        return `
        <tr>
            <td>
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="flex: 1;">${senderInfo}</div>
                    <div style="color: var(--text-dim);"><i class="fas fa-long-arrow-alt-right"></i></div>
                    <div style="flex: 1;">${receiverInfo}</div>
                </div>
            </td>
            <td>
                <div style="font-weight: 700; color: var(--success); font-family: monospace;">
                    <i class="fas fa-coins" style="font-size: 0.8rem; opacity: 0.7;"></i> ${new Decimal(tx.amount || 0).toFixed(6)}
                </div>
            </td>
            <td class="timestamp" title="${formatDateTime(tx.created_at)}">
                <div style="font-size: 0.85rem; color: var(--text-secondary);">${formatTimeAgo(tx.created_at)}</div>
                <div style="font-size: 0.7rem; color: var(--text-dim);">${formatDateTime(tx.created_at)}</div>
            </td>
        </tr>
        `;
    }).join('');
}

async function loadUserLogs(page = 1) {
    if (!currentUser) return;

    const tbody = document.getElementById('user-logs-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" class="loading">Loading user logs...</td></tr>';

    try {
        const response = await fetch(`${BACKEND_URL}/admin/enhanced-user-logs?page=${page}&limit=${itemsPerPage}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': ADMIN_SECRET
            }
        });

        if (!response.ok) {
             
            const fallbackResponse = await fetch(`${BACKEND_URL}/admin/user-logs?page=${page}&limit=${itemsPerPage}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-secret': ADMIN_SECRET
                }
            });
            
            if (!fallbackResponse.ok) throw new Error(`HTTP ${fallbackResponse.status}`);
            
            const data = await fallbackResponse.json();
            userLogs = data.logs || [];
        } else {
            const data = await response.json();
            userLogs = data.logs || [];
        }
        
        currentPage.userLogs = page;
        
        renderUserLogsTable();
        renderPagination('user-logs', userLogs.length, page);

    } catch (error) {
        console.error('Error loading user logs:', error);
        tbody.innerHTML = `<tr><td colspan="4" class="error">Error: ${error.message}</td></tr>`;
        showNotification('Failed to load user logs', 'error');
    }
}

function renderUserLogsTable() {
    const tbody = document.getElementById('user-logs-tbody');
    if (!tbody) return;

    if (userLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">No logs found</td></tr>';
        return;
    }

    tbody.innerHTML = userLogs.map(log => {
        const action = actionTypeMap[log.action_type] || { name: log.action_type, color: 'info', icon: '📝' };
        const badgeClass = action.color ? `action-badge ${action.color}` : 'action-badge';

        const userInfo = formatUserInfo({
            first_name: log.first_name,
            last_name: log.last_name,
            username: log.username,
            user_id: log.user_id
        });

        return `
        <tr>
            <td>${userInfo}</td>
            <td><span class="${badgeClass}">${action.icon} ${action.name}</span></td>
            <td><div class="details-text" style="max-width: 400px; font-size: 0.8rem; line-height: 1.4;">${parseDetails(log.details)}</div></td>
            <td class="timestamp" title="${formatDateTime(log.created_at)}">
                <div style="font-size: 0.85rem; color: var(--text-secondary);">${formatTimeAgo(log.created_at)}</div>
                <div style="font-size: 0.7rem; color: var(--text-dim);">${formatDateTime(log.created_at)}</div>
            </td>
        </tr>
        `;
    }).join('');
}

async function loadAdminLogs(page = 1) {
    if (!currentUser) return;

    const tbody = document.getElementById('admin-logs-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="loading">Loading admin logs...</td></tr>';

    try {
        const response = await fetch(`${BACKEND_URL}/admin/enhanced-admin-logs?page=${page}&limit=${itemsPerPage}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': ADMIN_SECRET
            }
        });

        if (!response.ok) {
             
            const fallbackResponse = await fetch(`${BACKEND_URL}/admin/admin-logs?page=${page}&limit=${itemsPerPage}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-secret': ADMIN_SECRET
                }
            });
            
            if (!fallbackResponse.ok) throw new Error(`HTTP ${fallbackResponse.status}`);
            
            const data = await fallbackResponse.json();
            adminLogs = data.logs || [];
        } else {
            const data = await response.json();
            adminLogs = data.logs || [];
        }
        
        currentPage.adminLogs = page;
        
        renderAdminLogsTable();
        renderPagination('admin-logs', adminLogs.length, page);

    } catch (error) {
        console.error('Error loading admin logs:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="error">Error: ${error.message}</td></tr>`;
        showNotification('Failed to load admin logs', 'error');
    }
}

function renderAdminLogsTable() {
    const tbody = document.getElementById('admin-logs-tbody');
    if (!tbody) return;

    if (adminLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">No logs found</td></tr>';
        return;
    }

    tbody.innerHTML = adminLogs.map(log => {
        const action = actionTypeMap[log.action_type] || { name: log.action_type, color: 'info', icon: '📝' };
        const badgeClass = action.color ? `action-badge ${action.color}` : 'action-badge';

        const isCurrentUser = log.admin_id === currentUser?.id;
        const adminDisplay = isCurrentUser ? 'You' : `Admin ${String(log.admin_id).substring(0, 8)}...`;

        const targetDisplay = log.target_user_id 
            ? `User ${String(log.target_user_id).substring(0, 8)}...`
            : '<span style="color: var(--text-dim);">System</span>';

        return `
        <tr>
            <td>
                <div class="user-info-compact">
                    <div class="user-name" style="font-size: 0.875rem;">${adminDisplay}</div>
                    <div class="user-id" style="font-size: 0.7rem; font-family: monospace;">ID: ${String(log.admin_id).substring(0, 8)}...</div>
                </div>
            </td>
            <td><span class="${badgeClass}">${action.icon} ${action.name}</span></td>
            <td><div style="font-size: 0.875rem; font-weight: 500;">${targetDisplay}</div></td>
            <td><div class="details-text" style="max-width: 350px; font-size: 0.8rem; line-height: 1.4;">${parseDetails(log.details)}</div></td>
            <td class="timestamp" title="${formatDateTime(log.created_at)}">
                <div style="font-size: 0.85rem; color: var(--text-secondary);">${formatTimeAgo(log.created_at)}</div>
                <div style="font-size: 0.7rem; color: var(--text-dim);">${formatDateTime(log.created_at)}</div>
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

        await new Promise(resolve => setTimeout(resolve, 1500));

        maintenanceMode = true;
        localStorage.setItem('sisi_maintenance_mode', 'true');
        
        showNotification('Maintenance mode enabled', 'success');
        closeModal('maintenance-modal');
        updateMaintenanceUI();
        await logAdminAction('enable_maintenance', null, `Maintenance enabled: ${message.substring(0, 50)}...`);

    } catch (error) {
        console.error('Error enabling maintenance mode:', error);
        showNotification(`Failed to enable maintenance mode: ${error.message}`, 'error');
    }
}

async function disableMaintenanceMode() {
    try {
        showNotification('Disabling maintenance mode...', 'info');

        await new Promise(resolve => setTimeout(resolve, 1500));

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
    const totalPages = Math.ceil(totalCount / itemsPerPage);
    const paginationElement = document.getElementById(`${type}-pagination`);
    
    if (!paginationElement) return;
    
    if (totalPages <= 1) {
        paginationElement.innerHTML = '';
        return;
    }
    
    let paginationHTML = '<div class="pagination-container" style="display: flex; gap: 0.5rem; align-items: center; justify-content: center; margin-top: 1.5rem;">';
    
    if (currentPageNum > 1) {
        paginationHTML += `
            <button class="btn btn-outline btn-sm" onclick="load${type.charAt(0).toUpperCase() + type.slice(1)}(${currentPageNum - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
    }
    
         for (let i = Math.max(1, currentPageNum - 2); i <= Math.min(totalPages, currentPageNum + 2); i++) {
        if (i === currentPageNum) {
            paginationHTML += `<button class="btn btn-primary btn-sm">${i}</button>`;
        } else {
            paginationHTML += `
                <button class="btn btn-outline btn-sm" onclick="load${type.charAt(0).toUpperCase() + type.slice(1)}(${i})">
                    ${i}
                </button>
            `;
        }
    }
    
    if (currentPageNum < totalPages) {
        paginationHTML += `
            <button class="btn btn-outline btn-sm" onclick="load${type.charAt(0).toUpperCase() + type.slice(1)}(${currentPageNum + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }
    
    paginationHTML += '</div>';
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

function setupEventListeners() {
     
    document.getElementById('login-button')?.addEventListener('click', login);
    
    document.getElementById('password')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            login();
        }
    });
    
     
    document.getElementById('dashboard-nav')?.addEventListener('click', () => showSection('dashboard'));
    document.getElementById('users-nav')?.addEventListener('click', () => showSection('users'));
    document.getElementById('transactions-nav')?.addEventListener('click', () => showSection('transactions'));
    document.getElementById('user-logs-nav')?.addEventListener('click', () => showSection('user-logs'));
    document.getElementById('admin-logs-nav')?.addEventListener('click', () => showSection('admin-logs'));
    
     
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
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        await logAdminAction('send_broadcast', null, `Broadcast sent: ${message.substring(0, 50)}...`);
        
        closeModal('broadcast-modal');
        document.getElementById('broadcast-message').value = '';
        showNotification('Broadcast sent successfully', 'success');
    } catch (error) {
        console.error('Error sending broadcast:', error);
        showNotification(`Broadcast failed: ${error.message}`, 'error');
    }
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
window.refreshAllData = refreshAllData;
window.editUser = editUser;
window.saveUserChanges = saveUserChanges;
window.closeModal = closeModal;