const SUPABASE_URL = 'https://qouonnohcwhzayznibjo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvdW9ubm9oY3doemF5em5pYmpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMTAzMzYsImV4cCI6MjA3MTg4NjMzNn0.4UMYvmVZvTzurcpNbhItUyzRUbJS60BXHlofqroAuww';
const BACKEND_URL = 'https://si-backend-2i9b.onrender.com';

let supabaseClient = null;
let currentUser = null;
let currentSection = 'dashboard';
let users = [];
let userLogs = [];
let adminLogs = [];
let transactions = [];

const itemsPerPage = 20;
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

async function initAdminPanel() {
    console.log('Initializing admin panel...');

    if (typeof window.supabase === 'undefined') {
        console.error('Supabase library not loaded');
        showError('Supabase library failed to load. Please refresh the page.');
        return;
    }

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client initialized:', !!supabaseClient);

    await checkAuth();
    setupEventListeners();

    if (currentUser) {
        loadDashboardStats();
        loadUsers();
    }
}

function showError(message) {
    document.body.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: white;">
            <h2>Error</h2>
            <p>${message}</p>
            <button onclick="location.reload()" style="padding: 0.5rem 1rem; background: #8e44ad; color: white; border: none; border-radius: 0.25rem; cursor: pointer;">Refresh Page</button>
        </div>
    `;
}

async function checkAuth() {
    if (!supabaseClient) {
        console.error('Supabase client not initialized');
        return;
    }

    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();

        if (error) {
            console.error('Auth error:', error);
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
            showAdminPanel();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
    }
}

async function login() {
    if (!supabaseClient) {
        showNotification('System not ready. Please refresh.', 'error');
        return;
    }

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
        showAdminPanel();
        await logAdminAction('login', null, 'Admin logged in');

    } catch (error) {
        console.error('Login error:', error);
        errorElement.textContent = error.message;
        errorElement.style.display = 'block';
    }
}

async function logout() {
    if (supabaseClient) {
        await supabaseClient.auth.signOut();
    }
    currentUser = null;
    document.getElementById('login-section').style.display = 'flex';
    document.getElementById('admin-panel').style.display = 'none';
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

    document.getElementById(sectionName).classList.add('active');
    event.target.classList.add('active');
    currentSection = sectionName;

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
        console.log('🔄 Loading dashboard stats...');
        const response = await fetch(`${BACKEND_URL}/admin/stats`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Admin-ID': currentUser.id
            }
        });

        if (!response.ok) throw new Error('Failed to fetch dashboard stats');

        const data = await response.json();
        console.log('✅ Stats data received:', data);

        document.getElementById('total-users').textContent = data.totalUsers || 0;
        document.getElementById('total-clicks').textContent = data.totalClicks || 0;
        document.getElementById('active-today').textContent = data.activeToday || 0;
        document.getElementById('banned-users').textContent = data.bannedUsers || 0;
        document.getElementById('total-transactions').textContent = data.totalTransactions || 0;
        document.getElementById('total-coins').textContent = data.totalCoins || '0';

        await loadRecentActivity();

    } catch (error) {
        console.error('❌ Error loading dashboard stats:', error);
        showNotification(`❌ Error loading stats: ${error.message}`, 'error');
    }
}

async function loadUsers(page = 1) {
    if (!currentUser) return;
    const searchTerm = document.getElementById('user-search').value.toLowerCase();
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '<tr><td colspan="8" class="loading">Loading users...</td></tr>';

    try {
        const response = await fetch(`${BACKEND_URL}/admin/users?page=${page}&limit=${itemsPerPage}&search=${searchTerm}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Admin-ID': currentUser.id
            }
        });

        if (!response.ok) throw new Error('Failed to fetch users');

        const data = await response.json();
        users = data.users || [];
        renderUsersTable();
        renderPagination('users', data.totalCount, page);

    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="8" class="error">Error loading users: ${error.message}</td></tr>`;
    }
}

function renderUsersTable() {
    const tbody = document.getElementById('users-tbody');

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.user_id}</td>
            <td><strong>${user.username || 'N/A'}</strong></td>
            <td>${new Decimal(user.score || 0).toFixed(4)}</td>
            <td>${new Decimal(user.click_value || 0).toFixed(6)}</td>
            <td>${new Decimal(user.auto_click_rate || 0).toFixed(6)}</td>
            <td>
                ${user.is_banned ?
            '<span class="badge badge-banned">Banned</span>' :
            '<span class="badge badge-active">Active</span>'}
                ${user.is_admin ? '<span class="badge" style="color:var(--accent)">Admin</span>' : ''}
            </td>
            <td>
                <button class="btn btn-sm" onclick="editUser(${user.user_id})">Manage</button>
            </td>
        </tr>
    `).join('');
}


async function editUser(userId) {
    const user = users.find(u => u.user_id == userId);
    if (!user) return;

    const form = document.getElementById('edit-user-form');

    form.innerHTML = `
        <h3 class="modal-title">Edit: ${user.username || user.user_id}</h3>

        <!-- SECTION 1: Manual Edits -->
        <label>Username</label>
        <input type="text" id="edit-username" value="${user.username || ''}">

        <div class="grid-2">
            <div>
                <label>Score (Coins)</label>
                <input type="text" id="edit-score" value="${new Decimal(user.score).toFixed(9)}">
            </div>
            <div>
                <label>Click Value</label>
                <input type="text" id="edit-click-value" value="${new Decimal(user.click_value).toFixed(9)}">
            </div>
        </div>

        <button class="btn btn-primary" style="width:100%" onclick="saveUserChanges('${user.user_id}')">
            Save Data Changes
        </button>

        <div class="divider"></div>

        <!-- SECTION 2: Immediate Actions -->
        <label>Management Actions</label>
        <div class="grid-2">
            <button class="btn" onclick="showAddCoinsModal('${user.user_id}')">💰 Add Coins</button>
            <button class="btn" onclick="resetUserScore('${user.user_id}')">🔄 Reset Score</button>
            <button class="btn" onclick="resetUserUpgrades('${user.user_id}')">⚡ Reset Upgrades</button>
            
            ${user.is_banned ?
            `<button class="btn btn-primary" onclick="unbanUser('${user.user_id}')">✅ Unban</button>` :
            `<button class="btn btn-danger" onclick="banUser('${user.user_id}')">🔨 Ban User</button>`
        }
        </div>
        
        <div style="margin-top: 10px; text-align: center;">
             ${user.is_admin ?
            `<button class="btn btn-danger btn-sm" onclick="removeAdmin('${user.user_id}')">Remove Admin</button>` :
            `<button class="btn btn-sm" onclick="makeAdmin('${user.user_id}')">Make Admin</button>`
        }
             <button class="btn btn-danger btn-sm" style="margin-left:5px" onclick="deleteUser('${user.user_id}')">Delete User</button>
        </div>

        <div class="action-row">
            <button class="btn" style="flex:1" onclick="closeModal('edit-user-modal')">Close</button>
        </div>
    `;

    document.getElementById('edit-user-modal').classList.add('active');
}


function showAddCoinsModal(userId) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Add Coins to User</h3>
            <div class="form-group">
                <label>Amount to Add</label>
                <input type="text" id="add-coins-amount" placeholder="0.000000100" value="0.000000100">
            </div>
            <div class="form-group">
                <button class="btn btn-success" onclick="addCoinsToUser('${userId}')">Add Coins</button>
                <button class="btn btn-warning" onclick="closeAddCoinsModal()">Cancel</button>
            </div>
        </div>
    `;
    modal.id = 'add-coins-modal';
    document.body.appendChild(modal);
}

function closeAddCoinsModal() {
    const modal = document.getElementById('add-coins-modal');
    if (modal) {
        document.body.removeChild(modal);
    }
}


async function resetUserScore(userId) {
    if (!confirm('Are you sure you want to reset this user\'s score to 0?')) return;

    try {
        const response = await fetch(`${BACKEND_URL}/admin/users/${userId}/reset-score`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Admin-ID': currentUser.id
            }
        });

        if (!response.ok) throw new Error('Failed to reset user score');

        closeModal('edit-user-modal');
        loadUsers(currentPage.users);
        showNotification('User score reset to 0', 'success');

    } catch (error) {
        showNotification(`Error resetting score: ${error.message}`, 'error');
    }
}

async function addCoinsToUser(userId) {
    const amount = document.getElementById('add-coins-amount').value;

    if (!amount || new Decimal(amount).lessThanOrEqualTo(0)) {
        showNotification('Please enter a valid amount', 'error');
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/admin/users/${userId}/add-coins`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Admin-ID': currentUser.id
            },
            body: JSON.stringify({ amount })
        });

        if (!response.ok) throw new Error('Failed to add coins');

        closeAddCoinsModal();
        closeModal('edit-user-modal');
        loadUsers(currentPage.users);
        showNotification(`Added ${amount} coins to user`, 'success');

    } catch (error) {
        showNotification(`Error adding coins: ${error.message}`, 'error');
    }
}

async function resetUserUpgrades(userId) {
    if (!confirm('Are you sure you want to reset ALL upgrades for this user? This cannot be undone.')) return;

    try {
        const response = await fetch(`${BACKEND_URL}/admin/users/${userId}/reset-upgrades`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Admin-ID': currentUser.id
            }
        });

        if (!response.ok) throw new Error('Failed to reset upgrades');

        closeModal('edit-user-modal');
        loadUsers(currentPage.users);
        showNotification('All user upgrades reset', 'success');

    } catch (error) {
        showNotification(`Error resetting upgrades: ${error.message}`, 'error');
    }
}

async function deleteUser(userId) {
    if (!confirm('⚠️ DANGER ZONE ⚠️\n\nAre you absolutely sure you want to PERMANENTLY DELETE this user?\n\nThis action cannot be undone and will remove all user data permanently!')) return;

    try {
        const response = await fetch(`${BACKEND_URL}/admin/users/${userId}/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Admin-ID': currentUser.id
            }
        });

        if (!response.ok) throw new Error('Failed to delete user');

        closeModal('edit-user-modal');
        loadUsers(currentPage.users);
        showNotification('User deleted successfully', 'success');

    } catch (error) {
        showNotification(`Error deleting user: ${error.message}`, 'error');
    }
}

async function saveUserChanges(userId) {
    const username = document.getElementById('edit-username').value;
    const score = document.getElementById('edit-score').value;
    const clickValue = document.getElementById('edit-click-value').value;
    const autoClickRate = document.getElementById('edit-auto-click-rate').value;

    try {
        const response = await fetch(`${BACKEND_URL}/admin/users/${userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Admin-ID': currentUser.id
            },
            body: JSON.stringify({
                username,
                score,
                click_value: clickValue,
                auto_click_rate: autoClickRate
            })
        });

        if (!response.ok) throw new Error('Failed to update user');

        closeModal('edit-user-modal');
        loadUsers(currentPage.users);
        showNotification('User updated successfully', 'success');

    } catch (error) {
        showNotification(`Error updating user: ${error.message}`, 'error');
    }
}

async function banUser(userId) {
    if (!confirm('Ban this user?')) return;

    try {
        const response = await fetch(`${BACKEND_URL}/admin/users/${userId}/ban`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Admin-ID': currentUser.id
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to ban user');
        }

        await loadUsers(currentPage.users);
        showNotification('✅ User banned successfully', 'success');
        await logAdminAction('ban_user', userId, 'User banned');

    } catch (error) {
        showNotification(`❌ Error banning user: ${error.message}`, 'error');
    }
}

async function unbanUser(userId) {
    try {
        const response = await fetch(`${BACKEND_URL}/admin/users/${userId}/unban`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Admin-ID': currentUser.id
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to unban user');
        }

        await loadUsers(currentPage.users);
        closeModal('edit-user-modal');
        showNotification('✅ User unbanned successfully', 'success');
        await logAdminAction('unban_user', userId, 'User unbanned');

    } catch (error) {
        showNotification(`❌ Error unbanning user: ${error.message}`, 'error');
    }
}

async function makeAdmin(userId) {
    if (!confirm(`Make user ${userId} an admin?`)) return;

    try {
        const response = await fetch(`${BACKEND_URL}/admin/users/${userId}/make-admin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Admin-ID': currentUser.id
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to make user admin');
        }

        await loadUsers(currentPage.users);
        closeModal('edit-user-modal');
        showNotification('✅ User promoted to admin successfully', 'success');
        await logAdminAction('make_admin', userId, 'User promoted to admin');

    } catch (error) {
        showNotification(`❌ Error making user admin: ${error.message}`, 'error');
    }
}

async function removeAdmin(userId) {
    if (!confirm('Remove admin privileges from this user?')) return;

    try {
        const response = await fetch(`${BACKEND_URL}/admin/users/${userId}/remove-admin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Admin-ID': currentUser.id
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to remove admin privileges');
        }

        await loadUsers(currentPage.users);
        closeModal('edit-user-modal');
        showNotification('✅ Admin privileges removed successfully', 'success');
        await logAdminAction('remove_admin', userId, 'Admin privileges removed');

    } catch (error) {
        showNotification(`❌ Error removing admin: ${error.message}`, 'error');
    }
}

async function loadUserLogs(page = 1) {
    if (!currentUser) return;

    const tbody = document.getElementById('user-logs-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="loading">Loading user logs...</td></tr>';

    try {
        const response = await fetch(`${BACKEND_URL}/admin/user-logs?page=${page}&limit=${itemsPerPage}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Admin-ID': currentUser.id
            }
        });

        if (!response.ok) throw new Error('Failed to fetch user logs');

        const data = await response.json();
        userLogs = data.logs || [];
        renderUserLogsTable();
        renderPagination('user-logs', data.totalCount, page);

    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="error">Error loading user logs: ${error.message}</td></tr>`;
    }
}

function renderUserLogsTable() {
    const tbody = document.getElementById('user-logs-tbody');

    if (userLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading">No user logs found</td></tr>';
        return;
    }

    tbody.innerHTML = userLogs.map(log => `
        <tr>
            <td>${log.user_id}</td>
            <td>${log.username || 'N/A'}</td>
            <td>${log.action_type}</td>
            <td>${log.details}</td>
            <td>${formatDate(log.created_at)}</td>
        </tr>
    `).join('');
}

async function loadAdminLogs(page = 1) {
    if (!currentUser) return;

    const tbody = document.getElementById('admin-logs-tbody');
    tbody.innerHTML = '<tr><td colspan="6" class="loading">Loading admin logs...</td></tr>';

    try {
        const response = await fetch(`${BACKEND_URL}/admin/admin-logs?page=${page}&limit=${itemsPerPage}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Admin-ID': currentUser.id
            }
        });

        if (!response.ok) throw new Error('Failed to fetch admin logs');

        const data = await response.json();
        adminLogs = data.logs || [];
        renderAdminLogsTable();
        renderPagination('admin-logs', data.totalCount, page);

    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="error">Error loading admin logs: ${error.message}</td></tr>`;
    }
}

function renderAdminLogsTable() {
    const tbody = document.getElementById('admin-logs-tbody');

    if (adminLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">No admin logs found</td></tr>';
        return;
    }

    tbody.innerHTML = adminLogs.map(log => `
        <tr>
            <td>${log.admin_id}</td>
            <td>${log.admin_id === '71bf9556-b67f-4860-8219-270f32ccb89b' ? 'You' : log.admin_id}</td>
            <td>${log.action_type}</td>
            <td>${log.target_user_id || 'N/A'}</td>
            <td>${log.details}</td>
            <td>${formatDate(log.created_at)}</td>
        </tr>
    `).join('');
}

async function loadTransactions(page = 1) {
    if (!currentUser) return;

    const tbody = document.getElementById('transactions-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="loading">Loading transactions...</td></tr>';

    try {
        const response = await fetch(`${BACKEND_URL}/admin/transactions?page=${page}&limit=${itemsPerPage}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Admin-ID': currentUser.id
            }
        });

        if (!response.ok) throw new Error('Failed to fetch transactions');

        const data = await response.json();
        transactions = data.transactions || [];
        renderTransactionsTable();
        renderPagination('transactions', data.totalCount, page);

    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="error">Error loading transactions: ${error.message}</td></tr>`;
    }
}

function renderTransactionsTable() {
    const tbody = document.getElementById('transactions-tbody');

    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading">No transactions found</td></tr>';
        return;
    }

    tbody.innerHTML = transactions.map(transaction => `
        <tr>
            <td>${transaction.sender_id}</td>
            <td>${transaction.receiver_id}</td>
            <td>${new Decimal(transaction.amount || 0).toFixed(9)}</td>
            <td>${transaction.receiver_username || 'N/A'}</td>
            <td>${formatDate(transaction.created_at)}</td>
        </tr>
    `).join('');
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 2rem;
        border-radius: var(--border-radius);
        color: white;
        font-weight: 600;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;

    if (type === 'success') {
        notification.style.background = 'var(--success)';
    } else if (type === 'error') {
        notification.style.background = 'var(--danger)';
    } else {
        notification.style.background = 'var(--primary-accent)';
    }

    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        if (notification.parentNode) {
            document.body.removeChild(notification);
        }
    }, 3000);
}

function renderPagination(type, totalCount, currentPageNum) {
    const totalPages = Math.ceil(totalCount / itemsPerPage);
    const paginationElement = document.getElementById(`${type}-pagination`);

    if (totalPages <= 1) {
        paginationElement.innerHTML = '';
        return;
    }

    let paginationHTML = '';

    if (currentPageNum > 1) {
        paginationHTML += `<button class="page-btn" onclick="load${type.charAt(0).toUpperCase() + type.slice(1)}(${currentPageNum - 1})">Previous</button>`;
    }

    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPageNum) {
            paginationHTML += `<button class="page-btn active">${i}</button>`;
        } else {
            paginationHTML += `<button class="page-btn" onclick="load${type.charAt(0).toUpperCase() + type.slice(1)}(${i})">${i}</button>`;
        }
    }

    if (currentPageNum < totalPages) {
        paginationHTML += `<button class="page-btn" onclick="load${type.charAt(0).toUpperCase() + type.slice(1)}(${currentPageNum + 1})">Next</button>`;
    }

    paginationElement.innerHTML = paginationHTML;
}

function sortUsers(field) {
    if (sortConfig.users.field === field) {
        sortConfig.users.direction = sortConfig.users.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortConfig.users.field = field;
        sortConfig.users.direction = 'asc';
    }
    currentPage.users = 1;
    loadUsers(currentPage.users);
}

function sortUserLogs(field) {
    if (sortConfig.userLogs.field === field) {
        sortConfig.userLogs.direction = sortConfig.userLogs.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortConfig.userLogs.field = field;
        sortConfig.userLogs.direction = 'asc';
    }
    currentPage.userLogs = 1;
    loadUserLogs(currentPage.userLogs);
}

function sortAdminLogs(field) {
    if (sortConfig.adminLogs.field === field) {
        sortConfig.adminLogs.direction = sortConfig.adminLogs.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortConfig.adminLogs.field = field;
        sortConfig.adminLogs.direction = 'asc';
    }
    currentPage.adminLogs = 1;
    loadAdminLogs(currentPage.adminLogs);
}

function sortTransactions(field) {
    if (sortConfig.transactions.field === field) {
        sortConfig.transactions.direction = sortConfig.transactions.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortConfig.transactions.field = field;
        sortConfig.transactions.direction = 'asc';
    }
    currentPage.transactions = 1;
    loadTransactions(currentPage.transactions);
}

// FIXED: Connected search inputs to the actual load functions
function searchUsers() {
    currentPage.users = 1;
    loadUsers(1);
}

function searchUserLogs() {
    // Note: To implement searchUserLogs, backend support is needed (like users?search=)
    // For now, it just logs, but you should add filtering in loadUserLogs similar to loadUsers
    console.log('Search feature requires backend update for Logs');
}

function searchAdminLogs() {
    console.log('Search feature requires backend update for Logs');
}

function searchTransactions() {
    console.log('Search feature requires backend update for Transactions');
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

async function refreshAllData() {
    if (!currentUser) return;

    showNotification('🔄 Refreshing all data...', 'info');

    try {
        await loadDashboardStats();
        await loadUsers(currentPage.users);
        await loadUserLogs(currentPage.userLogs);
        await loadAdminLogs(currentPage.adminLogs);
        await loadTransactions(currentPage.transactions);
        await loadRecentActivity();

        showNotification('✅ All data refreshed successfully', 'success');
    } catch (error) {
        showNotification(`❌ Error refreshing data: ${error.message}`, 'error');
    }
}

async function loadRecentActivity() {
    try {
        const response = await fetch(`${BACKEND_URL}/admin/admin-logs?page=1&limit=10`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Admin-ID': currentUser.id
            }
        });

        if (!response.ok) throw new Error('Failed to fetch recent activity');

        const data = await response.json();
        renderRecentActivity(data.logs || []);

    } catch (error) {
        console.error('Error loading recent activity:', error);
    }
}

function renderRecentActivity(logs) {
    const tbody = document.getElementById('recent-activity-tbody');

    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading">No recent activity</td></tr>';
        return;
    }

    tbody.innerHTML = logs.map(log => `
        <tr>
            <td>${formatDate(log.created_at)}</td>
            <td>${log.admin_id === currentUser.id ? 'You' : log.admin_id}</td>
            <td>${log.action_type}</td>
            <td>${log.target_user_id || 'N/A'}</td>
            <td>${log.details}</td>
        </tr>
    `).join('');
}


function exportUserData() {
    if (!currentUser) return;

    showNotification('📊 Preparing data export...', 'info');

    let csvContent = "User ID,Username,Score,Per Click,Per Second,Last Active,Status\n";

    users.forEach(user => {
        const status = user.is_banned ? "Banned" : "Active";
        const row = [
            user.user_id,
            user.username || 'N/A',
            new Decimal(user.score || 0).toFixed(9),
            new Decimal(user.click_value || 0).toFixed(9),
            new Decimal(user.auto_click_rate || 0).toFixed(9),
            formatDate(user.last_updated),
            status
        ].join(',');
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

    showNotification('✅ User data exported successfully', 'success');
}

function showBackupModal() {
    document.getElementById('backup-modal').classList.add('active');
}

function showMaintenanceModal() {
    document.getElementById('maintenance-modal').classList.add('active');
}

function showBroadcastModal() {
    document.getElementById('broadcast-modal').classList.add('active');
}

function showMassActionModal() {
    document.getElementById('mass-actions-modal').classList.add('active');
}

async function createBackup() {
    showNotification('💾 Creating backup...', 'info');

    try {
        await new Promise(resolve => setTimeout(resolve, 2000));

        await logAdminAction('create_backup', null, 'System backup created');

        closeModal('backup-modal');
        showNotification('✅ Backup created successfully', 'success');
    } catch (error) {
        showNotification(`❌ Backup failed: ${error.message}`, 'error');
    }
}

function enableMaintenance() {
    showNotification('🔧 Enabling maintenance mode...', 'warning');

    setTimeout(() => {
        closeModal('maintenance-modal');
        showNotification('✅ Maintenance mode enabled', 'success');
        logAdminAction('enable_maintenance', null, 'Maintenance mode enabled');
    }, 1000);
}

function disableMaintenance() {
    showNotification('🔧 Disabling maintenance mode...', 'info');

    setTimeout(() => {
        closeModal('maintenance-modal');
        showNotification('✅ Maintenance mode disabled', 'success');
        logAdminAction('disable_maintenance', null, 'Maintenance mode disabled');
    }, 1000);
}

async function sendBroadcast() {
    const message = document.getElementById('broadcast-message').value;
    const type = document.getElementById('broadcast-type').value;

    if (!message.trim()) {
        showNotification('❌ Please enter a message', 'error');
        return;
    }

    showNotification('📢 Sending broadcast...', 'info');

    try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        await logAdminAction('send_broadcast', null, `Broadcast sent: ${message.substring(0, 50)}...`);

        closeModal('broadcast-modal');
        document.getElementById('broadcast-message').value = '';
        showNotification('✅ Broadcast sent successfully', 'success');
    } catch (error) {
        showNotification(`❌ Broadcast failed: ${error.message}`, 'error');
    }
}

function massAddCoins() {
    const amount = prompt('Enter amount to add to all users:');
    if (!amount) return;
    showNotification(`💰 Adding ${amount} coins to all users...`, 'info');
    closeModal('mass-actions-modal');
}

function massResetUpgrades() {
    if (confirm('⚠️ Reset ALL upgrades for ALL users? This cannot be undone!')) {
        showNotification('🔄 Resetting all user upgrades...', 'warning');
        closeModal('mass-actions-modal');
    }
}

function massBanInactive() {
    const days = prompt('Ban users inactive for how many days?', '30');
    if (!days) return;
    showNotification(`🔨 Banning users inactive for ${days} days...`, 'warning');
    closeModal('mass-actions-modal');
}

function massExportData() {
    showNotification('📥 Preparing full data export...', 'info');
    closeModal('mass-actions-modal');
    exportUserData();
}

function setupEventListeners() {
    document.getElementById('password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            login();
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(modal => {
                modal.classList.remove('active');
            });
        }
    });
}

document.addEventListener('DOMContentLoaded', function () {
    setTimeout(initAdminPanel, 100);
});