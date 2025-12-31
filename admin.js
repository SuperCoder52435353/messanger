import { database, supabase } from './firebase-config.js';
import { showNotification } from './auth.js';
import {
  ref,
  get,
  set,
  update,
  remove,
  onValue,
  query,
  orderByChild,
  push,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Toggle Block User
window.toggleBlockUser = async function(uid, block) {
  try {
    await update(ref(database, `users/${uid}`), {
      blocked: block
    });

    // Update in Supabase
    await supabase.update('users', uid, { blocked: block });

    showNotification(`User ${block ? 'blocked' : 'unblocked'} successfully`, 'success');
    await loadAdminUsers();
    await loadDashboardStats();

  } catch (error) {
    console.error('Toggle block error:', error);
    showNotification('Failed to update user status', 'error');
  }
};

// Delete User
window.deleteUser = async function(uid) {
  if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
    return;
  }

  try {
    // Delete from Firebase
    await remove(ref(database, `users/${uid}`));

    // Delete from Supabase
    await supabase.delete('users', uid);

    showNotification('User deleted successfully', 'success');
    await loadAdminUsers();
    await loadDashboardStats();

  } catch (error) {
    console.error('Delete user error:', error);
    showNotification('Failed to delete user', 'error');
  }
};

// Message User (from admin)
window.messageUser = function(uid) {
  showNotification('Message feature coming soon', 'info');
};

// Load Support Messages
async function loadSupportMessages() {
  try {
    const supportRef = ref(database, 'support');
    const snapshot = await get(supportRef);
    
    allSupportMessages = [];
    snapshot.forEach((child) => {
      const ticket = { id: child.key, ...child.val() };
      allSupportMessages.push(ticket);
    });

    // Sort by newest first
    allSupportMessages.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    displaySupportMessages(allSupportMessages);

  } catch (error) {
    console.error('Load support messages error:', error);
    showNotification('Failed to load support messages', 'error');
  }
}

// Display Support Messages
function displaySupportMessages(messages) {
  if (!supportMessagesList) return;

  if (messages.length === 0) {
    supportMessagesList.innerHTML = `
      <p style="padding: 40px; text-align: center; color: var(--text-secondary);">
        No support messages yet
      </p>
    `;
    return;
  }

  supportMessagesList.innerHTML = messages.map(ticket => {
    const latestMessage = ticket.messages ? Object.values(ticket.messages).pop() : null;
    
    return `
      <div class="support-message-card">
        <div class="support-message-header">
          <div class="support-message-user">
            <div class="user-item-avatar">${ticket.userName?.charAt(0) || 'U'}</div>
            <div>
              <h4>${ticket.userName || 'User'}</h4>
              <p style="font-size: 13px; color: var(--text-secondary);">${ticket.userEmail || ''}</p>
            </div>
          </div>
          <span style="padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;
                       background: ${ticket.status === 'open' ? 'rgba(0, 255, 136, 0.1)' : 'rgba(160, 174, 192, 0.1)'};
                       color: ${ticket.status === 'open' ? 'var(--success)' : 'var(--text-secondary)'};">
            ${ticket.status === 'open' ? 'Open' : 'Closed'}
          </span>
        </div>
        
        ${latestMessage ? `
          <div class="support-message-text">
            <strong>${latestMessage.senderName}:</strong> ${latestMessage.text}
          </div>
        ` : ''}
        
        <div class="support-message-reply">
          <input type="text" 
                 id="reply-${ticket.id}" 
                 placeholder="Type your reply..." 
                 class="neon-input">
          <button class="neon-button" 
                  onclick="window.replyToSupport('${ticket.id}')">
            Send Reply
          </button>
        </div>
        
        <div style="margin-top: 10px; display: flex; gap: 10px;">
          <button class="admin-action-btn" onclick="window.viewSupportMessages('${ticket.id}')">
            View All Messages
          </button>
          <button class="admin-action-btn" onclick="window.closeSupportTicket('${ticket.id}')">
            ${ticket.status === 'open' ? 'Close Ticket' : 'Reopen Ticket'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Reply to Support
window.replyToSupport = async function(ticketId) {
  const input = document.getElementById(`reply-${ticketId}`);
  const text = input?.value.trim();

  if (!text) {
    showNotification('Please enter a message', 'error');
    return;
  }

  try {
    const message = {
      text: text,
      senderId: 'admin',
      senderName: 'Administrator',
      timestamp: serverTimestamp()
    };

    await push(ref(database, `support/${ticketId}/messages`), message);
    
    if (input) input.value = '';
    showNotification('Reply sent!', 'success');
    await loadSupportMessages();

  } catch (error) {
    console.error('Reply error:', error);
    showNotification('Failed to send reply', 'error');
  }
};

// View Support Messages
window.viewSupportMessages = function(ticketId) {
  showNotification('Full conversation view coming soon', 'info');
};

// Close Support Ticket
window.closeSupportTicket = async function(ticketId) {
  try {
    const ticketRef = ref(database, `support/${ticketId}`);
    const snapshot = await get(ticketRef);
    
    if (snapshot.exists()) {
      const currentStatus = snapshot.val().status;
      const newStatus = currentStatus === 'open' ? 'closed' : 'open';
      
      await update(ticketRef, { status: newStatus });
      showNotification(`Ticket ${newStatus}`, 'success');
      await loadSupportMessages();
    }

  } catch (error) {
    console.error('Close ticket error:', error);
    showNotification('Failed to update ticket', 'error');
  }
};

// Load Admin Private Chats
async function loadAdminPrivateChats() {
  try {
    const chatsRef = ref(database, 'privateChats');
    const snapshot = await get(chatsRef);
    
    allPrivateChats = [];
    snapshot.forEach((child) => {
      allPrivateChats.push({ code: child.key, ...child.val() });
    });

    displayAdminPrivateChats(allPrivateChats);

  } catch (error) {
    console.error('Load private chats error:', error);
    showNotification('Failed to load private chats', 'error');
  }
}

// Display Admin Private Chats
function displayAdminPrivateChats(chats) {
  if (!adminPrivateList) return;

  if (chats.length === 0) {
    adminPrivateList.innerHTML = `
      <p style="padding: 40px; text-align: center; color: var(--text-secondary);">
        No private chats yet
      </p>
    `;
    return;
  }

  adminPrivateList.innerHTML = chats.map(chat => {
    const memberCount = chat.members ? Object.keys(chat.members).length : 0;
    const creatorName = chat.members && chat.createdBy ? 
                        chat.members[chat.createdBy]?.name || 'Unknown' : 'Unknown';
    
    return `
      <div class="private-chat-card">
        <div class="private-chat-code">${chat.code}</div>
        <div class="private-chat-info">
          <p><strong>Members:</strong> ${memberCount}/15</p>
          <p><strong>Created by:</strong> ${creatorName}</p>
          <p><strong>Created:</strong> ${formatDate(chat.createdAt)}</p>
        </div>
        <div style="margin-top: 15px; display: flex; gap: 10px;">
          <button class="admin-action-btn" onclick="window.viewPrivateChatMembers('${chat.code}')">
            View Members
          </button>
          <button class="admin-action-btn danger" onclick="window.deletePrivateChat('${chat.code}')">
            Delete Chat
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// View Private Chat Members
window.viewPrivateChatMembers = function(code) {
  const chat = allPrivateChats.find(c => c.code === code);
  if (!chat || !chat.members) {
    showNotification('No members found', 'error');
    return;
  }

  const membersList = Object.entries(chat.members)
    .map(([uid, data]) => `• ${data.name || 'User'} (joined ${formatDate(data.joinedAt)})`)
    .join('\n');

  alert(`Members of ${code}:\n\n${membersList}`);
};

// Delete Private Chat
window.deletePrivateChat = async function(code) {
  if (!confirm('Delete this private chat? All messages will be lost.')) {
    return;
  }

  try {
    await remove(ref(database, `privateChats/${code}`));
    await supabase.delete('private_chats', code);
    
    showNotification('Private chat deleted', 'success');
    await loadAdminPrivateChats();
    await loadDashboardStats();

  } catch (error) {
    console.error('Delete private chat error:', error);
    showNotification('Failed to delete chat', 'error');
  }
};

// Save Settings
async function saveMaintenance() {
  try {
    const enabled = maintenanceMode?.checked || false;
    await set(ref(database, 'settings/maintenance'), enabled);
    showNotification('Maintenance mode updated', 'success');
  } catch (error) {
    console.error('Save maintenance error:', error);
    showNotification('Failed to update settings', 'error');
  }
}

async function saveRegistrationSettings() {
  try {
    const enabled = allowRegistrations?.checked || false;
    await set(ref(database, 'settings/allowRegistrations'), enabled);
    showNotification('Registration settings updated', 'success');
  } catch (error) {
    console.error('Save registration error:', error);
    showNotification('Failed to update settings', 'error');
  }
}

async function saveAutoDelete() {
  try {
    const days = parseInt(autoDeleteDays?.value) || 30;
    await set(ref(database, 'settings/autoDeleteDays'), days);
    showNotification('Auto-delete settings updated', 'success');
  } catch (error) {
    console.error('Save auto-delete error:', error);
    showNotification('Failed to update settings', 'error');
  }
}

// Utility Functions
function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Unknown';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return formatDate(timestamp);
}

function formatDate(timestamp) {
  if (!timestamp) return 'Unknown';
  
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Initialize admin panel when needed
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdmin);
} else {
  initAdmin();
}

// imports moved to top

// Admin Panel Module

// DOM Elements
const adminMenuItems = document.querySelectorAll('.admin-menu-item');
const adminSections = document.querySelectorAll('.admin-section');
const adminUsersList = document.getElementById('adminUsersList');
const adminSearchUsers = document.getElementById('adminSearchUsers');
const supportMessagesList = document.getElementById('supportMessagesList');
const adminPrivateList = document.getElementById('adminPrivateList');
const recentActivity = document.getElementById('recentActivity');

// Stats elements
const totalUsers = document.getElementById('totalUsers');
const totalMessages = document.getElementById('totalMessages');
const onlineUsers = document.getElementById('onlineUsers');
const privateChats = document.getElementById('privateChats');

// Settings
const maintenanceMode = document.getElementById('maintenanceMode');
const allowRegistrations = document.getElementById('allowRegistrations');
const autoDeleteDays = document.getElementById('autoDeleteDays');

// Global state
let allUsers = [];
let allSupportMessages = [];
let allPrivateChats = [];

// Initialize Admin Panel
function initAdmin() {
  setupAdminEventListeners();
  loadAdminData();
}

// Setup Event Listeners
function setupAdminEventListeners() {
  // Menu navigation
  adminMenuItems?.forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      
      adminMenuItems.forEach(i => i.classList.remove('active'));
      adminSections.forEach(s => s.classList.remove('active'));
      
      item.classList.add('active');
      document.getElementById(`${section}Section`)?.classList.add('active');
      
      // Load section data
      if (section === 'users') loadAdminUsers();
      if (section === 'messages') loadSupportMessages();
      if (section === 'private') loadAdminPrivateChats();
    });
  });

  // Search users
  adminSearchUsers?.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    filterAdminUsers(searchTerm);
  });

  // Settings
  maintenanceMode?.addEventListener('change', saveMaintenance);
  allowRegistrations?.addEventListener('change', saveRegistrationSettings);
  autoDeleteDays?.addEventListener('change', saveAutoDelete);
}

// Load Admin Data
window.loadAdminData = async function() {
  try {
    await Promise.all([
      loadDashboardStats(),
      loadRecentActivity(),
      loadAdminUsers()
    ]);
  } catch (error) {
    console.error('Load admin data error:', error);
  }
};

// Load Dashboard Stats
async function loadDashboardStats() {
  try {
    // Load users
    const usersRef = ref(database, 'users');
    const usersSnapshot = await get(usersRef);
    const users = [];
    let onlineCount = 0;
    
    usersSnapshot.forEach((child) => {
      const user = child.val();
      users.push(user);
      if (user.online) onlineCount++;
    });

    if (totalUsers) totalUsers.textContent = users.length;
    if (onlineUsers) onlineUsers.textContent = onlineCount;

    // Load messages count (today)
    const chatsRef = ref(database, 'chats');
    const chatsSnapshot = await get(chatsRef);
    let messageCount = 0;
    const today = new Date().setHours(0, 0, 0, 0);

    chatsSnapshot.forEach((chatChild) => {
      const messages = chatChild.child('messages').val();
      if (messages) {
        Object.values(messages).forEach(msg => {
          if (msg.timestamp && new Date(msg.timestamp).setHours(0, 0, 0, 0) === today) {
            messageCount++;
          }
        });
      }
    });

    if (totalMessages) totalMessages.textContent = messageCount;

    // Load private chats count
    const privateRef = ref(database, 'privateChats');
    const privateSnapshot = await get(privateRef);
    let privateChatCount = 0;
    privateSnapshot.forEach(() => privateChatCount++);

    if (privateChats) privateChats.textContent = privateChatCount;

  } catch (error) {
    console.error('Load stats error:', error);
  }
}

// Load Recent Activity
async function loadRecentActivity() {
  try {
    const activities = [];

    // Get recent user registrations
    const usersRef = ref(database, 'users');
    const usersSnapshot = await get(usersRef);
    
    usersSnapshot.forEach((child) => {
      const user = child.val();
      if (user.createdAt) {
        activities.push({
          type: 'registration',
          text: `${user.name || 'User'} joined the platform`,
          timestamp: user.createdAt
        });
      }
    });

    // Get recent support messages
    const supportRef = ref(database, 'support');
    const supportSnapshot = await get(supportRef);
    
    supportSnapshot.forEach((child) => {
      const ticket = child.val();
      if (ticket.createdAt) {
        activities.push({
          type: 'support',
          text: `${ticket.userName || 'User'} sent a support message`,
          timestamp: ticket.createdAt
        });
      }
    });

    // Sort by timestamp and get last 10
    activities.sort((a, b) => b.timestamp - a.timestamp);
    const recentActivities = activities.slice(0, 10);

    displayRecentActivity(recentActivities);

  } catch (error) {
    console.error('Load activity error:', error);
  }
}

// Display Recent Activity
function displayRecentActivity(activities) {
  if (!recentActivity) return;

  if (activities.length === 0) {
    recentActivity.innerHTML = '<p style="color: var(--text-secondary);">No recent activity</p>';
    return;
  }

  recentActivity.innerHTML = activities.map(activity => `
    <div class="activity-item">
      <p>${activity.text}</p>
      <span class="activity-time">${formatTimeAgo(activity.timestamp)}</span>
    </div>
  `).join('');
}

// Load Admin Users
async function loadAdminUsers() {
  try {
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    
    allUsers = [];
    snapshot.forEach((child) => {
      allUsers.push(child.val());
    });

    displayAdminUsers(allUsers);

  } catch (error) {
    console.error('Load admin users error:', error);
    showNotification('Failed to load users', 'error');
  }
}

// Display Admin Users
function displayAdminUsers(users) {
  if (!adminUsersList) return;

  if (users.length === 0) {
    adminUsersList.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-secondary);">No users found</p>';
    return;
  }

  adminUsersList.innerHTML = users.map(user => `
    <div class="admin-user-item">
      <div class="admin-user-info">
        <div class="admin-user-avatar">${user.avatar || user.name?.charAt(0) || 'U'}</div>
        <div class="admin-user-details">
          <h4>${user.name || 'User'}</h4>
          <p>${user.email || 'No email'} • ${user.phone || 'No phone'}</p>
          <p style="font-size: 12px; color: var(--text-secondary); margin-top: 3px;">
            Joined: ${formatDate(user.createdAt)} • 
            Last seen: ${formatTimeAgo(user.lastSeen)}
          </p>
        </div>
      </div>
      <div class="admin-user-actions">
        <button class="admin-action-btn" onclick="window.viewUserDetails('${user.uid}')">
          View
        </button>
        <button class="admin-action-btn ${user.blocked ? 'blocked' : ''}" 
                onclick="window.toggleBlockUser('${user.uid}', ${!user.blocked})">
          ${user.blocked ? 'Unblock' : 'Block'}
        </button>
        <button class="admin-action-btn danger" onclick="window.deleteUser('${user.uid}')">
          Delete
        </button>
      </div>
    </div>
  `).join('');
}

// Filter Admin Users
function filterAdminUsers(searchTerm) {
  const filtered = allUsers.filter(user => {
    const name = (user.name || '').toLowerCase();
    const email = (user.email || '').toLowerCase();
    return name.includes(searchTerm) || email.includes(searchTerm);
  });
  displayAdminUsers(filtered);
}

// View User Details
window.viewUserDetails = async function(uid) {
  try {
    const userRef = ref(database, `users/${uid}`);
    const snapshot = await get(userRef);
    
    if (!snapshot.exists()) {
      showNotification('User not found', 'error');
      return;
    }

    const user = snapshot.val();
    const modal = document.getElementById('userDetailsModal');
    const overlay = document.getElementById('modalOverlay');
    const content = document.getElementById('userDetailsContent');

    if (!modal || !overlay || !content) return;

    content.innerHTML = `
      <div style="text-align: center;">
        <div style="width: 100px; height: 100px; margin: 0 auto 20px; border-radius: 50%;
                    background: linear-gradient(135deg, var(--neon-blue), var(--neon-purple));
                    display: flex; align-items: center; justify-content: center;
                    font-size: 40px; font-weight: 700;">
          ${user.avatar || 'U'}
        </div>
        <h3 style="margin-bottom: 10px;">${user.name || 'User'}</h3>
        <p style="color: var(--text-secondary); margin-bottom: 25px;">${user.email || 'No email'}</p>
      </div>
      
      <div style="background: rgba(0, 243, 255, 0.05); border-radius: 12px; padding: 20px;
                  border: 1px solid var(--border-color); margin-bottom: 15px;">
        <h4 style="margin-bottom: 15px;">User Information</h4>
        <div style="display: grid; gap: 12px;">
          <div><strong>User ID:</strong> ${user.uid}</div>
          <div><strong>Phone:</strong> ${user.phone || 'Not provided'}</div>
          <div><strong>Status:</strong> 
            <span style="color: ${user.online ? 'var(--success)' : 'var(--text-secondary)'};">
              ${user.online ? '🟢 Online' : '⚪ Offline'}
            </span>
          </div>
          <div><strong>Account Status:</strong> 
            <span style="color: ${user.blocked ? 'var(--danger)' : 'var(--success)'};">
              ${user.blocked ? '🚫 Blocked' : '✅ Active'}
            </span>
          </div>
          <div><strong>Joined:</strong> ${formatDate(user.createdAt)}</div>
          <div><strong>Last Seen:</strong> ${formatTimeAgo(user.lastSeen)}</div>
        </div>
      </div>

      <div style="display: flex; gap: 10px;">
        <button class="neon-button" style="flex: 1;" onclick="window.messageUser('${user.uid}')">
          Send Message
        </button>
        <button class="admin-action-btn ${user.blocked ? '' : 'danger'}" 
                onclick="window.toggleBlockUser('${user.uid}', ${!user.blocked}); 
                        document.getElementById('userDetailsModal').classList.remove('active');
                        document.getElementById('modalOverlay').classList.remove('active');">
          ${user.blocked ? 'Unblock' : 'Block'} User
        </button>
      </div>
    `;

    overlay.classList.add('active');
    modal.classList.add('active');

    // Close handlers
    const closeButtons = modal.querySelectorAll('.close-modal');
    closeButtons.forEach(btn => {
      btn.onclick = () => {
        modal.classList.remove('active');
        overlay.classList.remove('active');
      };
    });

    overlay.onclick = (e) => {
      if (e.target === overlay) {
        modal.classList.remove('active');
        overlay.classList.remove('active');
      }
    };

  } catch (error) {
    console.error('View user details error:', error);
    showNotification('Failed to load user details', 'error');
  }
};