// === CONFIGURATION ===
const SUPABASE_URL = 'https://qouonnohcwhzayznibjo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvdW9ubm9oY3doemF5em5pYmpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMTAzMzYsImV4cCI6MjA3MTg4NjMzNn0.4UMYvmVZvTzurcpNbhItUyzRUbJS60BXHlofqroAuww';
const BACKEND_URL = 'https://si-backend-2i9b.onrender.com';

// === GLOBAL STATE ===
let supabaseClient = null;
let currentUser = null;
let currentSection = 'dashboard';
let users = [];
let userLogs = [];
let adminLogs = [];
let transactions = [];

// === PAGINATION ===
const itemsPerPage = 20;
let currentPage = {
    users: 1,
    userLogs: 1,
    adminLogs: 1,
    transactions: 1
};

// === SORTING ===
let sortConfig = {
    users: { field: 'user_id', direction: 'asc' },
    userLogs: { field: 'created_at', direction: 'desc' },
    adminLogs: { field: 'created_at', direction: 'desc' },
    transactions: { field: 'created_at', direction: 'desc' }
};

// === INITIALIZATION ===
async function initAdminPanel() {
    console.log('Initializing admin panel...');

    // Wait for Supabase to be available
    if (typeof window.supabase === 'undefined') {
        console.error('Supabase library not loaded');
        showError('Supabase library failed to load. Please refresh the page.');
        return;
    }

    // Initialize Supabase client
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

// === AUTHENTICATION ===
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
            // Check if user is admin
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

        // Verify admin privileges
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

// === NAVIGATION ===
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    // Remove active class from all nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected section
    document.getElementById(sectionName).classList.add('active');

    // Add active class to clicked nav button
    event.target.classList.add('active');

    currentSection = sectionName;

    // Load section data
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


// Test different header names in your admin.js
async function loadDashboardStats() {
    if (!currentUser) return;

    try {
        console.log('🔄 Testing different header names...');

        // Test 1: Original header name
        const response1 = await fetch(`${BACKEND_URL}/admin/stats`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Admin-ID': currentUser.id
            }
        });
        console.log('Test 1 (Admin-ID) status:', response1.status);

        // Test 2: Lowercase header name
        const response2 = await fetch(`${BACKEND_URL}/admin/stats`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'admin-id': currentUser.id
            }
        });
        console.log('Test 2 (admin-id) status:', response2.status);

        // Test 3: Different header name
        const response3 = await fetch(`${BACKEND_URL}/admin/stats`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-id': currentUser.id
            }
        });
        console.log('Test 3 (x-admin-id) status:', response3.status);

        // Use the first successful response
        const response = response1.ok ? response1 : response2.ok ? response2 : response3;

        if (!response.ok) throw new Error('All header tests failed');

        const data = await response.json();
        console.log('✅ Stats data received:', data);

        // Update UI...
        document.getElementById('total-users').textContent = data.totalUsers || 0;
        document.getElementById('total-clicks').textContent = data.totalClicks || 0;
        document.getElementById('active-today').textContent = data.activeToday || 0;
        document.getElementById('banned-users').textContent = data.bannedUsers || 0;

    } catch (error) {
        console.error('❌ Error loading dashboard stats:', error);
        // Show error in UI...
    }
}


// === USERS MANAGEMENT ===
async function loadUsers(page = 1) {
    if (!currentUser) return;

    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '<tr><td colspan="8" class="loading">Loading users...</td></tr>';

    try {
        const response = await fetch(`${BACKEND_URL}/admin/users?page=${page}&limit=${itemsPerPage}`, {
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
        tbody.innerHTML = '<tr><td colspan="8" class="loading">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.user_id}</td>
            <td>${user.username || 'N/A'}</td>
            <td>${new Decimal(user.score || 0).toFixed(9)}</td>
            <td>${new Decimal(user.click_value || 0).toFixed(9)}</td>
            <td>${new Decimal(user.auto_click_rate || 0).toFixed(9)}</td>
            <td>${formatDate(user.last_updated)}</td>
            <td>
                ${user.is_banned ?
            '<span class="status-badge status-banned">Banned</span>' :
            '<span class="status-badge status-active">Active</span>'
        }
                ${user.is_admin ?
            '<span class="status-badge status-admin">Admin</span>' : ''
        }
            </td>
            <td class="action-buttons">
                <button class="btn btn-primary btn-sm" onclick="editUser(${user.user_id})">Edit</button>
                ${user.is_banned ?
            `<button class="btn btn-success btn-sm" onclick="unbanUser(${user.user_id})">Unban</button>` :
            `<button class="btn btn-warning btn-sm" onclick="banUser(${user.user_id})">Ban</button>`
        }
                ${user.is_admin ?
            `<button class="btn btn-warning btn-sm" onclick="removeAdmin(${user.user_id})">Remove Admin</button>` :
            `<button class="btn btn-success btn-sm" onclick="makeAdmin(${user.user_id})">Make Admin</button>`
        }
            </td>
        </tr>
    `).join('');
}

// === USER ACTIONS ===
async function editUser(userId) {
    const user = users.find(u => u.user_id === userId);
    if (!user) return;

    const form = document.getElementById('edit-user-form');
    form.innerHTML = `
        <div class="form-group">
            <label>User ID</label>
            <input type="text" value="${user.user_id}" disabled>
        </div>
        <div class="form-group">
            <label>Username</label>
            <input type="text" id="edit-username" value="${user.username || ''}">
        </div>
        <div class="form-group">
            <label>Score</label>
            <input type="text" id="edit-score" value="${user.score || '0'}">
        </div>
        <div class="form-group">
            <label>Click Value</label>
            <input type="text" id="edit-click-value" value="${user.click_value || '0'}">
        </div>
        <div class="form-group">
            <label>Auto Click Rate</label>
            <input type="text" id="edit-auto-click-rate" value="${user.auto_click_rate || '0'}">
        </div>
        <div class="form-group">
            <button class="btn btn-primary" onclick="saveUserChanges(${userId})">Save Changes</button>
            <button class="btn btn-warning" onclick="closeModal('edit-user-modal')">Cancel</button>
        </div>
    `;

    document.getElementById('edit-user-modal').classList.add('active');
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
    if (!confirm('Are you sure you want to ban this user?')) return;

    try {
        const response = await fetch(`${BACKEND_URL}/admin/users/${userId}/ban`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Admin-ID': currentUser.id
            }
        });

        if (!response.ok) throw new Error('Failed to ban user');

        loadUsers(currentPage.users);
        showNotification('User banned successfully', 'success');

    } catch (error) {
        showNotification(`Error banning user: ${error.message}`, 'error');
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

        if (!response.ok) throw new Error('Failed to unban user');

        loadUsers(currentPage.users);
        showNotification('User unbanned successfully', 'success');

    } catch (error) {
        showNotification(`Error unbanning user: ${error.message}`, 'error');
    }
}

async function makeAdmin(userId) {
    try {
        const response = await fetch(`${BACKEND_URL}/admin/users/${userId}/make-admin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Admin-ID': currentUser.id
            }
        });

        if (!response.ok) throw new Error('Failed to make user admin');

        loadUsers(currentPage.users);
        showNotification('User promoted to admin successfully', 'success');

    } catch (error) {
        showNotification(`Error making user admin: ${error.message}`, 'error');
    }
}

async function removeAdmin(userId) {
    if (!confirm('Are you sure you want to remove admin privileges from this user?')) return;

    try {
        const response = await fetch(`${BACKEND_URL}/admin/users/${userId}/remove-admin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Admin-ID': currentUser.id
            }
        });

        if (!response.ok) throw new Error('Failed to remove admin privileges');

        loadUsers(currentPage.users);
        showNotification('Admin privileges removed successfully', 'success');

    } catch (error) {
        showNotification(`Error removing admin: ${error.message}`, 'error');
    }
}

// === LOGS MANAGEMENT ===
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


// === TRANSACTIONS ===
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

// === UTILITY FUNCTIONS ===
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
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

    // Previous button
    if (currentPageNum > 1) {
        paginationHTML += `<button class="page-btn" onclick="load${type.charAt(0).toUpperCase() + type.slice(1)}(${currentPageNum - 1})">Previous</button>`;
    }

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPageNum) {
            paginationHTML += `<button class="page-btn active">${i}</button>`;
        } else {
            paginationHTML += `<button class="page-btn" onclick="load${type.charAt(0).toUpperCase() + type.slice(1)}(${i})">${i}</button>`;
        }
    }

    // Next button
    if (currentPageNum < totalPages) {
        paginationHTML += `<button class="page-btn" onclick="load${type.charAt(0).toUpperCase() + type.slice(1)}(${currentPageNum + 1})">Next</button>`;
    }

    paginationElement.innerHTML = paginationHTML;
}

// === SORTING FUNCTIONS ===
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

// === SEARCH FUNCTIONS ===
function searchUsers() {
    const searchTerm = document.getElementById('user-search').value.toLowerCase();
    // Implement search logic here
    console.log('Search users:', searchTerm);
}

function searchUserLogs() {
    const searchTerm = document.getElementById('user-logs-search').value.toLowerCase();
    // Implement search logic here
    console.log('Search user logs:', searchTerm);
}

function searchAdminLogs() {
    const searchTerm = document.getElementById('admin-logs-search').value.toLowerCase();
    // Implement search logic here
    console.log('Search admin logs:', searchTerm);
}

function searchTransactions() {
    const searchTerm = document.getElementById('transactions-search').value.toLowerCase();
    // Implement search logic here
    console.log('Search transactions:', searchTerm);
}

// === ADMIN LOGGING ===
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

// === EVENT LISTENERS ===
function setupEventListeners() {
    // Enter key for login
    document.getElementById('password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            login();
        }
    });
}

// === INITIALIZE WHEN PAGE LOADS ===
document.addEventListener('DOMContentLoaded', function () {
    // Add a small delay to ensure Supabase is fully loaded
    setTimeout(initAdminPanel, 100);
});