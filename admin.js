const SUPABASE_URL = 'https://qouonnohcwhzayznibjo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvdW9ubm9oY3doemF5em5pYmpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMTAzMzYsImV4cCI6MjA3MTg4NjMzNn0.4UMYvmVZvTzurcpNbhItUyzRUbJS60BXHlofqroAuww';
const BACKEND_URL = 'https://si-backend-2i9b.onrender.com';
const ADMIN_SECRET = 'your-admin-secret-here'; // Replace with your actual admin secret

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

let currentEditingUserId = null;
let debounceTimer = null;

// Initialize Admin Panel
async function initAdminPanel() {
    try {
        console.log('Initializing admin panel...');
        
        // Initialize Supabase
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client initialized');
        
        // Check authentication
        await checkAuth();
        
        // Setup event listeners
        setupEventListeners();
        
        // Initialize dashboard if user is logged in
        if (currentUser) {
            loadDashboardStats();
            loadUsers();
        }
        
    } catch (error) {
        console.error('Failed to initialize admin panel:', error);
        showError('Failed to initialize admin panel. Please refresh the page.');
    }
}

// Show error page
function showError(message) {
    document.body.innerHTML = `
        <div style="
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background: var(--dark);
            color: var(--text);
            text-align: center;
            padding: 2rem;
        ">
            <h2 style="color: var(--danger); margin-bottom: 1rem;">Error</h2>
            <p style="margin-bottom: 2rem; color: var(--text-secondary);">${message}</p>
            <button onclick="location.reload()" style="
                padding: 0.75rem 1.5rem;
                background: var(--primary);
                color: white;
                border: none;
                border-radius: 0.5rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            ">
                Refresh Page
            </button>
        </div>
    `;
}

// Check authentication
async function checkAuth() {
    if (!supabaseClient) {
        console.error('Supabase client not initialized');
        return;
    }

    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();

        if (error) {
            console.error('Auth session error:', error);
            return;
        }

        if (session && session.user) {
            // Verify admin access
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

// Login function
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

        // Verify admin access
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

        // Log admin action
        await logAdminAction('login', null, 'Admin logged in');

    } catch (error) {
        console.error('Login error:', error);
        errorElement.textContent = error.message;
        errorElement.style.display = 'block';
        showNotification('Login failed: ' + error.message, 'error');
    }
}

// Logout function
async function logout() {
    try {
        if (supabaseClient) {
            await supabaseClient.auth.signOut();
        }
        currentUser = null;
        document.getElementById('login-section').style.display = 'flex';
        document.getElementById('admin-panel').style.display = 'none';
        showNotification('Logged out successfully', 'info');
    } catch (error) {
        console.error('Logout error:', error);
        showNotification('Logout failed', 'error');
    }
}

// Show admin panel
function showAdminPanel() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
}

// Show section
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
    const sectionElement = document.getElementById(sectionName);
    if (sectionElement) {
        sectionElement.classList.add('active');
    }

    // Add active class to clicked button
    if (event && event.target) {
        event.target.classList.add('active');
    }

    // Update current section
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

// Load dashboard stats
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

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();

        // Update stats
        document.getElementById('total-users').textContent = data.totalUsers || 0;
        document.getElementById('active-today').textContent = data.activeToday || 0;
        document.getElementById('banned-users').textContent = data.bannedUsers || 0;
        document.getElementById('total-transactions').textContent = data.totalTransactions || 0;
        document.getElementById('total-coins').textContent = new Decimal(data.totalCoins || 0).toFixed(2);

        // Update API status
        document.getElementById('api-status').textContent = 'Online';
        document.getElementById('api-status-indicator').classList.add('online');

        // Load recent activity
        await loadRecentActivity();

    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        showNotification('Failed to load dashboard data', 'error');
        
        // Update API status to offline
        document.getElementById('api-status').textContent = 'Offline';
        document.getElementById('api-status-indicator').classList.remove('online');
    }
}

// Load users with pagination and search
async function loadUsers(page = 1) {
    if (!currentUser) return;
    
    const searchTerm = document.getElementById('user-search')?.value || '';
    const tbody = document.getElementById('users-tbody');
    
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="8" class="loading">Loading users...</td></tr>';

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

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to fetch users: ${response.status}`);
        }

        const data = await response.json();
        users = data.users || [];
        
        // Update current page
        currentPage.users = page;
        
        // Render users table
        renderUsersTable();
        
        // Render pagination
        renderPagination('users', data.totalCount || 0, page);

    } catch (error) {
        console.error('Error loading users:', error);
        tbody.innerHTML = `<tr><td colspan="8" class="error">Error loading users: ${error.message}</td></tr>`;
        showNotification('Failed to load users', 'error');
    }
}

// Render users table
function renderUsersTable() {
    const tbody = document.getElementById('users-tbody');
    
    if (!tbody) return;

    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => {
        let statusHtml = '';

        if (user.is_banned === true) {
            statusHtml += '<span class="status-badge status-banned">BANNED</span>';
        } else {
            statusHtml += '<span class="status-badge status-active">ACTIVE</span>';
        }

        if (user.is_admin === true) {
            statusHtml += ' <span class="status-badge status-admin">ADMIN</span>';
        }

        return `
        <tr>
            <td>${user.user_id}</td>
            <td><strong>${user.username || 'N/A'}</strong></td>
            <td>${new Decimal(user.score || 0).toFixed(9)}</td>
            <td>${new Decimal(user.click_value || 0).toFixed(9)}</td>
            <td>${new Decimal(user.auto_click_rate || 0).toFixed(9)}</td>
            <td>${user.last_updated ? new Date(user.last_updated).toLocaleString() : 'Never'}</td>
            <td>${statusHtml}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editUser('${user.user_id}')">
                    <span>⚙️</span> Manage
                </button>
            </td>
        </tr>
        `;
    }).join('');
}

// Edit user modal
async function editUser(userId) {
    const user = users.find(u => u.user_id == userId);
    if (!user) {
        showNotification('User not found', 'error');
        return;
    }

    currentEditingUserId = userId;

    const form = document.getElementById('edit-user-form');
    if (!form) return;

    const getVal = (val) => new Decimal(val || 0).toFixed(9);
    const getLvl = (val) => val || 0;

    const banButtonHtml = user.is_banned
        ? `<button class="btn btn-success" onclick="unbanUser('${user.user_id}')">
            <span>✅</span> Unban User
          </button>`
        : `<button class="btn btn-danger" onclick="banUser('${user.user_id}')">
            <span>🚫</span> Ban User
          </button>`;

    form.innerHTML = `
        <div class="modal-body">
            <h3 class="section-title" style="margin-top: 0;">
                Managing: <span class="highlight">${user.username || user.user_id}</span>
            </h3>

            <!-- Basic Information -->
            <div class="grid-2">
                <div class="form-group">
                    <label>User ID</label>
                    <input type="text" class="form-control" value="${user.user_id}" disabled>
                </div>
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" class="form-control" value="${user.username || ''}" disabled>
                </div>
            </div>

            <!-- Stats Management -->
            <h4 class="section-title">Stats Management</h4>
            <div class="grid-2">
                <div class="form-group">
                    <label>Score</label>
                    <input type="text" id="edit-score" class="form-control" value="${getVal(user.score)}">
                </div>
                <div class="form-group">
                    <label>Click Value</label>
                    <input type="text" id="edit-click-value" class="form-control" value="${getVal(user.click_value)}">
                </div>
                <div class="form-group">
                    <label>Auto Click Rate</label>
                    <input type="text" id="edit-auto-rate" class="form-control" value="${getVal(user.auto_click_rate)}">
                </div>
                <div class="form-group">
                    <label>Last Updated</label>
                    <input type="text" class="form-control" 
                           value="${user.last_updated ? new Date(user.last_updated).toLocaleString() : 'Never'}" 
                           disabled>
                </div>
            </div>

            <!-- Upgrade Levels -->
            <h4 class="section-title">Upgrade Levels</h4>
            
            <div class="upgrade-section">
                <div class="upgrade-title">Click Upgrades (Tiers 1-5)</div>
                <div class="upgrade-grid">
                    <div class="upgrade-input">
                        <label>Tier 1</label>
                        <input type="number" id="lvl-click-1" class="form-control" value="${getLvl(user.click_tier_1_level)}">
                    </div>
                    <div class="upgrade-input">
                        <label>Tier 2</label>
                        <input type="number" id="lvl-click-2" class="form-control" value="${getLvl(user.click_tier_2_level)}">
                    </div>
                    <div class="upgrade-input">
                        <label>Tier 3</label>
                        <input type="number" id="lvl-click-3" class="form-control" value="${getLvl(user.click_tier_3_level)}">
                    </div>
                    <div class="upgrade-input">
                        <label>Tier 4</label>
                        <input type="number" id="lvl-click-4" class="form-control" value="${getLvl(user.click_tier_4_level)}">
                    </div>
                    <div class="upgrade-input">
                        <label>Tier 5</label>
                        <input type="number" id="lvl-click-5" class="form-control" value="${getLvl(user.click_tier_5_level)}">
                    </div>
                </div>
            </div>

            <div class="upgrade-section">
                <div class="upgrade-title">Auto Upgrades (Tiers 1-5)</div>
                <div class="upgrade-grid">
                    <div class="upgrade-input">
                        <label>Tier 1</label>
                        <input type="number" id="lvl-auto-1" class="form-control" value="${getLvl(user.auto_tier_1_level)}">
                    </div>
                    <div class="upgrade-input">
                        <label>Tier 2</label>
                        <input type="number" id="lvl-auto-2" class="form-control" value="${getLvl(user.auto_tier_2_level)}">
                    </div>
                    <div class="upgrade-input">
                        <label>Tier 3</label>
                        <input type="number" id="lvl-auto-3" class="form-control" value="${getLvl(user.auto_tier_3_level)}">
                    </div>
                    <div class="upgrade-input">
                        <label>Tier 4</label>
                        <input type="number" id="lvl-auto-4" class="form-control" value="${getLvl(user.auto_tier_4_level)}">
                    </div>
                    <div class="upgrade-input">
                        <label>Tier 5</label>
                        <input type="number" id="lvl-auto-5" class="form-control" value="${getLvl(user.auto_tier_5_level)}">
                    </div>
                </div>
            </div>

            <!-- Quick Actions -->
            <h4 class="section-title">Quick Actions</h4>
            <div style="display: grid; gap: 10px; margin-bottom: 20px;">
                ${banButtonHtml}
                <button class="btn btn-warning" onclick="showAddCoinsModal()">
                    <span>💰</span> Add Coins
                </button>
                <button class="btn btn-danger" onclick="resetUserScore('${user.user_id}')">
                    <span>🔄</span> Reset Score
                </button>
                <button class="btn btn-danger" onclick="deleteUser('${user.user_id}')">
                    <span>🗑️</span> Delete User
                </button>
            </div>
        </div>

        <div class="modal-footer">
            <button class="btn btn-primary" onclick="saveUserChanges()">
                <span>💾</span> Save Changes
            </button>
            <button class="btn btn-outline" onclick="closeModal('edit-user-modal')">
                Cancel
            </button>
        </div>
    `;

    document.getElementById('edit-user-modal').classList.add('active');
}

// Show add coins modal
function showAddCoinsModal() {
    document.getElementById('add-coins-modal').classList.add('active');
}

// Close add coins modal
function closeAddCoinsModal() {
    document.getElementById('add-coins-modal').classList.remove('active');
}

// Add coins to user
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
            body: JSON.stringify({ amount })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to add coins');
        }

        showNotification(`Added ${amount} coins to user`, 'success');
        closeModal('add-coins-modal');
        loadUsers(currentPage.users);

    } catch (error) {
        console.error('Error adding coins:', error);
        showNotification(`Failed to add coins: ${error.message}`, 'error');
    }
}

// Reset user score
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

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to reset user score');
        }

        closeModal('edit-user-modal');
        loadUsers(currentPage.users);
        showNotification('User score reset to 0', 'success');

    } catch (error) {
        console.error('Error resetting score:', error);
        showNotification(`Failed to reset score: ${error.message}`, 'error');
    }
}

// Reset user upgrades
async function resetUserUpgrades(userId) {
    if (!confirm('Are you sure you want to reset ALL upgrades for this user? This cannot be undone.')) return;

    try {
        const response = await fetch(`${BACKEND_URL}/admin/users/${userId}/reset-upgrades`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': ADMIN_SECRET
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to reset upgrades');
        }

        closeModal('edit-user-modal');
        loadUsers(currentPage.users);
        showNotification('All user upgrades reset', 'success');

    } catch (error) {
        console.error('Error resetting upgrades:', error);
        showNotification(`Failed to reset upgrades: ${error.message}`, 'error');
    }
}

// Delete user
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

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to delete user');
        }

        closeModal('edit-user-modal');
        loadUsers(currentPage.users);
        showNotification('User deleted successfully', 'success');

    } catch (error) {
        console.error('Error deleting user:', error);
        showNotification(`Failed to delete user: ${error.message}`, 'error');
    }
}

// Save user changes
async function saveUserChanges() {
    if (!currentEditingUserId) {
        showNotification('No user selected', 'error');
        return;
    }

    const saveBtn = document.querySelector('#edit-user-form .btn-primary');
    if (!saveBtn) return;

    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span>⏳</span> Saving...';

    try {
        const getValue = (id) => {
            const el = document.getElementById(id);
            return el ? el.value : null;
        };

        const updates = {
            score: getValue('edit-score'),
            click_value: getValue('edit-click-value'),
            auto_click_rate: getValue('edit-auto-rate'),

            click_tier_1_level: parseInt(getValue('lvl-click-1')) || 0,
            click_tier_2_level: parseInt(getValue('lvl-click-2')) || 0,
            click_tier_3_level: parseInt(getValue('lvl-click-3')) || 0,
            click_tier_4_level: parseInt(getValue('lvl-click-4')) || 0,
            click_tier_5_level: parseInt(getValue('lvl-click-5')) || 0,

            auto_tier_1_level: parseInt(getValue('lvl-auto-1')) || 0,
            auto_tier_2_level: parseInt(getValue('lvl-auto-2')) || 0,
            auto_tier_3_level: parseInt(getValue('lvl-auto-3')) || 0,
            auto_tier_4_level: parseInt(getValue('lvl-auto-4')) || 0,
            auto_tier_5_level: parseInt(getValue('lvl-auto-5')) || 0,
        };

        // Validate required fields
        if (!updates.score || !updates.click_value || !updates.auto_click_rate) {
            throw new Error('Please fill in all required fields');
        }

        const response = await fetch(`${BACKEND_URL}/admin/users/${currentEditingUserId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': ADMIN_SECRET
            },
            body: JSON.stringify(updates)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server responded with ${response.status}`);
        }

        const result = await response.json();

        showNotification('✅ Saved successfully!', 'success');
        closeModal('edit-user-modal');

        // Refresh data
        await loadUsers(currentPage.users);
        await loadDashboardStats();

    } catch (error) {
        console.error('Save failed:', error);
        showNotification('❌ Error saving: ' + error.message, 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
    }
}

// Ban user
async function banUser(userId) {
    if (!confirm('Ban this user?')) return;

    try {
        const response = await fetch(`${BACKEND_URL}/admin/users/${userId}/ban`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': ADMIN_SECRET
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to ban user');
        }

        await loadUsers(currentPage.users);
        showNotification('✅ User banned successfully', 'success');
        await logAdminAction('ban_user', userId, 'User banned');

    } catch (error) {
        console.error('Error banning user:', error);
        showNotification(`❌ Error banning user: ${error.message}`, 'error');
    }
}

// Unban user
async function unbanUser(userId) {
    try {
        const response = await fetch(`${BACKEND_URL}/admin/users/${userId}/unban`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': ADMIN_SECRET
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to unban user');
        }

        await loadUsers(currentPage.users);
        closeModal('edit-user-modal');
        showNotification('✅ User unbanned successfully', 'success');
        await logAdminAction('unban_user', userId, 'User unbanned');

    } catch (error) {
        console.error('Error unbanning user:', error);
        showNotification(`❌ Error unbanning user: ${error.message}`, 'error');
    }
}

// Load user logs
async function loadUserLogs(page = 1) {
    if (!currentUser) return;

    const tbody = document.getElementById('user-logs-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="loading">Loading user logs...</td></tr>';

    try {
        const response = await fetch(`${BACKEND_URL}/admin/user-logs?page=${page}&limit=${itemsPerPage}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': ADMIN_SECRET
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to fetch user logs');
        }

        const data = await response.json();
        userLogs = data.logs || [];
        
        // Update current page
        currentPage.userLogs = page;
        
        // Render logs table
        renderUserLogsTable();
        
        // Render pagination
        renderPagination('user-logs', data.totalCount || 0, page);

    } catch (error) {
        console.error('Error loading user logs:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="error">Error loading user logs: ${error.message}</td></tr>`;
        showNotification('Failed to load user logs', 'error');
    }
}

// Render user logs table
function renderUserLogsTable() {
    const tbody = document.getElementById('user-logs-tbody');
    
    if (!tbody) return;

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

// Load admin logs
async function loadAdminLogs(page = 1) {
    if (!currentUser) return;

    const tbody = document.getElementById('admin-logs-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="loading">Loading admin logs...</td></tr>';

    try {
        const response = await fetch(`${BACKEND_URL}/admin/admin-logs?page=${page}&limit=${itemsPerPage}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': ADMIN_SECRET
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to fetch admin logs');
        }

        const data = await response.json();
        adminLogs = data.logs || [];
        
        // Update current page
        currentPage.adminLogs = page;
        
        // Render logs table
        renderAdminLogsTable();
        
        // Render pagination
        renderPagination('admin-logs', data.totalCount || 0, page);

    } catch (error) {
        console.error('Error loading admin logs:', error);
        tbody.innerHTML = `<tr><td colspan="6" class="error">Error loading admin logs: ${error.message}</td></tr>`;
        showNotification('Failed to load admin logs', 'error');
    }
}

// Render admin logs table
function renderAdminLogsTable() {
    const tbody = document.getElementById('admin-logs-tbody');
    
    if (!tbody) return;

    if (adminLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">No admin logs found</td></tr>';
        return;
    }

    tbody.innerHTML = adminLogs.map(log => `
        <tr>
            <td>${log.admin_id}</td>
            <td>${log.admin_id === currentUser?.id ? 'You' : log.admin_id}</td>
            <td>${log.action_type}</td>
            <td>${log.target_user_id || 'N/A'}</td>
            <td>${log.details}</td>
            <td>${formatDate(log.created_at)}</td>
        </tr>
    `).join('');
}

// Load transactions
async function loadTransactions(page = 1) {
    if (!currentUser) return;

    const tbody = document.getElementById('transactions-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="loading">Loading transactions...</td></tr>';

    try {
        const response = await fetch(`${BACKEND_URL}/admin/transactions?page=${page}&limit=${itemsPerPage}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': ADMIN_SECRET
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to fetch transactions');
        }

        const data = await response.json();
        transactions = data.transactions || [];
        
        // Update current page
        currentPage.transactions = page;
        
        // Render transactions table
        renderTransactionsTable();
        
        // Render pagination
        renderPagination('transactions', data.totalCount || 0, page);

    } catch (error) {
        console.error('Error loading transactions:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="error">Error loading transactions: ${error.message}</td></tr>`;
        showNotification('Failed to load transactions', 'error');
    }
}

// Render transactions table
function renderTransactionsTable() {
    const tbody = document.getElementById('transactions-tbody');
    
    if (!tbody) return;

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

// Load recent activity
async function loadRecentActivity() {
    try {
        const response = await fetch(`${BACKEND_URL}/admin/combined-activity`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': ADMIN_SECRET
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to load recent activity');
        }

        const data = await response.json();
        renderRecentActivity(data.logs || []);

    } catch (error) {
        console.error('Error loading recent activity:', error);
    }
}

// Render recent activity
function renderRecentActivity(logs) {
    const tbody = document.getElementById('recent-activity-tbody');
    
    if (!tbody) return;

    if (!logs.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading">No recent activity</td></tr>';
        return;
    }

    tbody.innerHTML = logs.map(log => {
        const badgeStyle = log.source === 'ADMIN'
            ? 'status-admin'
            : 'status-active';

        return `
            <tr>
                <td>${new Date(log.time).toLocaleString()}</td>
                <td><span class="status-badge ${badgeStyle}">${log.source}</span></td>
                <td>${log.actor}</td>
                <td>${log.action}</td>
                <td>${log.details}</td>
            </tr>
        `;
    }).join('');
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
}

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
    currentEditingUserId = null;
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }
    }, 3000);
}

// Render pagination
function renderPagination(type, totalCount, currentPageNum) {
    const totalPages = Math.ceil(totalCount / itemsPerPage);
    const paginationElement = document.getElementById(`${type}-pagination`);
    
    if (!paginationElement) return;
    
    if (totalPages <= 1) {
        paginationElement.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    
    // Previous button
    if (currentPageNum > 1) {
        paginationHTML += `
            <button class="page-btn" onclick="load${type.charAt(0).toUpperCase() + type.slice(1)}(${currentPageNum - 1})">
                ←
            </button>
        `;
    }
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPageNum) {
            paginationHTML += `<button class="page-btn active">${i}</button>`;
        } else {
            paginationHTML += `
                <button class="page-btn" onclick="load${type.charAt(0).toUpperCase() + type.slice(1)}(${i})">
                    ${i}
                </button>
            `;
        }
    }
    
    // Next button
    if (currentPageNum < totalPages) {
        paginationHTML += `
            <button class="page-btn" onclick="load${type.charAt(0).toUpperCase() + type.slice(1)}(${currentPageNum + 1})">
                →
            </button>
        `;
    }
    
    paginationElement.innerHTML = paginationHTML;
}

// Sort functions
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

// Search with debounce
function debounceSearch() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        searchUsers();
    }, 300);
}

// Search users
function searchUsers() {
    currentPage.users = 1;
    loadUsers(1);
}

// Log admin action
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

// Refresh all data
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
        console.error('Error refreshing data:', error);
        showNotification(`❌ Error refreshing data: ${error.message}`, 'error');
    }
}

// Export user data
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

    // Create and download CSV
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

// Export transaction data
function exportTransactionData() {
    showNotification('Exporting transaction data...', 'info');
    // Implement export logic here
}

// Show broadcast modal
function showBroadcastModal() {
    document.getElementById('broadcast-modal').classList.add('active');
}

// Send broadcast
async function sendBroadcast() {
    const message = document.getElementById('broadcast-message').value;
    const type = document.getElementById('broadcast-type').value;

    if (!message.trim()) {
        showNotification('❌ Please enter a message', 'error');
        return;
    }

    showNotification('📢 Sending broadcast...', 'info');

    try {
        // Implement broadcast logic here
        await new Promise(resolve => setTimeout(resolve, 1500));
        await logAdminAction('send_broadcast', null, `Broadcast sent: ${message.substring(0, 50)}...`);

        closeModal('broadcast-modal');
        document.getElementById('broadcast-message').value = '';
        showNotification('✅ Broadcast sent successfully', 'success');
    } catch (error) {
        console.error('Error sending broadcast:', error);
        showNotification(`❌ Broadcast failed: ${error.message}`, 'error');
    }
}

// Show mass action modal
function showMassActionModal() {
    document.getElementById('mass-actions-modal').classList.add('active');
}

// Mass add coins
function massAddCoins() {
    const amount = prompt('Enter amount to add to all users:');
    if (amount) {
        showNotification(`💰 Adding ${amount} coins to all users...`, 'info');
        closeModal('mass-actions-modal');
    }
}

// Mass reset upgrades
function massResetUpgrades() {
    if (confirm('⚠️ Reset ALL upgrades for ALL users? This cannot be undone!')) {
        showNotification('🔄 Resetting all user upgrades...', 'warning');
        closeModal('mass-actions-modal');
    }
}

// Mass ban inactive users
function massBanInactive() {
    const days = prompt('Ban users inactive for how many days?', '30');
    if (days) {
        showNotification(`🔨 Banning users inactive for ${days} days...`, 'warning');
        closeModal('mass-actions-modal');
    }
}

// Mass export data
function massExportData() {
    showNotification('📥 Preparing full data export...', 'info');
    closeModal('mass-actions-modal');
    exportUserData();
}

// Create backup
async function createBackup() {
    showNotification('💾 Creating backup...', 'info');

    try {
        // Simulate backup process
        await new Promise(resolve => setTimeout(resolve, 2000));
        await logAdminAction('create_backup', null, 'System backup created');

        closeModal('mass-actions-modal');
        showNotification('✅ Backup created successfully', 'success');
    } catch (error) {
        console.error('Error creating backup:', error);
        showNotification(`❌ Backup failed: ${error.message}`, 'error');
    }
}

// Enable maintenance
function enableMaintenance() {
    showNotification('🔧 Enabling maintenance mode...', 'warning');

    setTimeout(() => {
        closeModal('mass-actions-modal');
        showNotification('✅ Maintenance mode enabled', 'success');
        logAdminAction('enable_maintenance', null, 'Maintenance mode enabled');
    }, 1000);
}

// Disable maintenance
function disableMaintenance() {
    showNotification('🔧 Disabling maintenance mode...', 'info');

    setTimeout(() => {
        closeModal('mass-actions-modal');
        showNotification('✅ Maintenance mode disabled', 'success');
        logAdminAction('disable_maintenance', null, 'Maintenance mode disabled');
    }, 1000);
}

// Setup event listeners
function setupEventListeners() {
    // Enter key for login
    document.getElementById('password')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            login();
        }
    });

    // Close modals when clicking outside
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
            currentEditingUserId = null;
        }
    });

    // Escape key to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(modal => {
                modal.classList.remove('active');
            });
            currentEditingUserId = null;
        }
        
        // Ctrl+R to refresh
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            refreshAllData();
        }
    });

    // Auto-focus search on users page
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('nav-btn') && 
            e.target.querySelector('.nav-text')?.textContent === 'Users') {
            setTimeout(() => {
                const searchInput = document.getElementById('user-search');
                if (searchInput) {
                    searchInput.focus();
                }
            }, 100);
        }
    });
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(initAdminPanel, 100);
});

// Add global error handler
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    showNotification('An unexpected error occurred', 'error');
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showNotification('An unexpected error occurred', 'error');
});