// Chat Module
import { auth, database, supabase } from './firebase-config.js';
import { showNotification } from './auth.js';
import {
  ref,
  push,
  set,
  get,
  query,
  orderByChild,
  limitToLast,
  onValue,
  off,
  serverTimestamp,
  update
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// DOM Elements
const usersList = document.getElementById('usersList');
const privateList = document.getElementById('privateList');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const searchUsers = document.getElementById('searchUsers');
const chatUserName = document.getElementById('chatUserName');
const chatAvatar = document.getElementById('chatAvatar');
const chatUserStatus = document.getElementById('chatUserStatus');
const contactAdminBtn = document.getElementById('contactAdminBtn');
const createPrivateBtn = document.getElementById('createPrivateBtn');
const joinPrivateBtn = document.getElementById('joinPrivateBtn');
const chatInfoBtn = document.getElementById('chatInfoBtn');

// Tab management
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// Global state
let currentChatId = null;
let currentChatType = 'user'; // 'user', 'private', 'admin'
let messagesListener = null; // callback reference
let messagesQuery = null; // active query ref for detaching listeners
let typingTimeout = null;

// Initialize Chat
function initChat() {
  setupChatEventListeners();
  loadUsers();
  loadPrivateChats();
}

// Setup Event Listeners
function setupChatEventListeners() {
  // Tab switching
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      button.classList.add('active');
      document.getElementById(`${tabName}Tab`).classList.add('active');
    });
  });

  // Message sending
  sendBtn?.addEventListener('click', sendMessage);
  messageInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Typing indicator
  messageInput?.addEventListener('input', handleTyping);

  // Search users
  searchUsers?.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    filterUsers(searchTerm);
  });

  // Private chat actions
  createPrivateBtn?.addEventListener('click', createPrivateChat);
  joinPrivateBtn?.addEventListener('click', showJoinPrivateModal);
  
  // Contact admin
  contactAdminBtn?.addEventListener('click', contactAdmin);
  
  // Chat info
  chatInfoBtn?.addEventListener('click', showChatInfo);
}

// Load Users
async function loadUsers() {
  try {
    const usersRef = ref(database, 'users');
    
    onValue(usersRef, (snapshot) => {
      const users = [];
      snapshot.forEach((childSnapshot) => {
        const user = childSnapshot.val();
        if (user.uid !== auth.currentUser?.uid && !user.blocked) {
          users.push(user);
        }
      });

      displayUsers(users);
      window.appState.users = new Map(users.map(u => [u.uid, u]));
    });
  } catch (error) {
    console.error('Load users error:', error);
    showNotification('Failed to load users', 'error');
  }
}

// Display Users
function displayUsers(users) {
  if (!usersList) return;

  if (users.length === 0) {
    usersList.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; color: var(--text-secondary);">
        <p>No users found</p>
      </div>
    `;
    return;
  }

  usersList.innerHTML = users.map(user => `
    <div class="user-item" data-uid="${user.uid}" onclick="window.selectChat('${user.uid}', 'user')">
      <div class="user-item-avatar">${user.avatar || user.name?.charAt(0) || 'U'}</div>
      <div class="user-item-info">
        <div class="user-item-name">${user.name || 'User'}</div>
        <div class="user-item-message">
          <span class="status-dot ${user.online ? 'online' : 'offline'}"></span>
          ${user.online ? 'Online' : 'Offline'}
        </div>
      </div>
    </div>
  `).join('');
}

// Filter Users
function filterUsers(searchTerm) {
  const userItems = usersList?.querySelectorAll('.user-item');
  userItems?.forEach(item => {
    const name = item.querySelector('.user-item-name').textContent.toLowerCase();
    item.style.display = name.includes(searchTerm) ? 'flex' : 'none';
  });
}

// Select Chat
window.selectChat = async function(chatId, type = 'user') {
  try {
    currentChatId = chatId;
    currentChatType = type;

    // Remove active class from all items
    document.querySelectorAll('.user-item').forEach(item => {
      item.classList.remove('active');
    });

    // Add active class to selected item
    const selectedItem = document.querySelector(`[data-uid="${chatId}"]`);
    if (selectedItem) {
      selectedItem.classList.add('active');
    }

    // Update chat header
    if (type === 'user') {
      const user = window.appState.users.get(chatId);
      if (user) {
        chatUserName.textContent = user.name || 'User';
        chatAvatar.textContent = user.avatar || 'U';
        chatUserStatus.textContent = user.online ? 'Online' : 'Offline';
        chatUserStatus.style.color = user.online ? 'var(--success)' : 'var(--text-secondary)';
      }
    } else if (type === 'private') {
      const chat = window.appState.privateChats.get(chatId);
      if (chat) {
        chatUserName.textContent = `Private Chat`;
        chatAvatar.textContent = '🔒';
        chatUserStatus.textContent = `${chat.members?.length || 0} members`;
      }
    } else if (type === 'admin') {
      chatUserName.textContent = 'Admin Support';
      chatAvatar.textContent = '👨‍💼';
      chatUserStatus.textContent = 'Available';
    }

    // Load messages
    await loadMessages(chatId, type);

  } catch (error) {
    console.error('Select chat error:', error);
    showNotification('Failed to load chat', 'error');
  }
};

// Load Messages
async function loadMessages(chatId, type) {
  try {
    // Clear previous listener/query
    if (messagesQuery) {
      try { off(messagesQuery); } catch (err) { console.warn('Failed to detach previous messages listener', err); }
      messagesQuery = null;
      messagesListener = null;
    }

    // Clear messages container
    messagesContainer.innerHTML = '';

    // Determine message path
    let messagesPath;
    if (type === 'user') {
      if (!auth.currentUser) {
        showNotification('Please sign in to view chats', 'error');
        return;
      }
      const userId1 = auth.currentUser.uid;
      const userId2 = chatId;
      const chatPath = [userId1, userId2].sort().join('_');
      messagesPath = `chats/${chatPath}/messages`;
    } else if (type === 'private') {
      messagesPath = `privateChats/${chatId}/messages`;
    } else if (type === 'admin') {
      if (!auth.currentUser) {
        showNotification('Please sign in to contact admin', 'error');
        return;
      }
      messagesPath = `support/${auth.currentUser.uid}/messages`;
    }

    const messagesRef = query(
      ref(database, messagesPath),
      orderByChild('timestamp'),
      limitToLast(50)
    );

    // Store active query to detach later
    messagesQuery = messagesRef;

    // Listen for messages
    messagesListener = onValue(messagesRef, (snapshot) => {
      const messages = [];
      snapshot.forEach((childSnapshot) => {
        messages.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });

      displayMessages(messages);
      scrollToBottom();
    });

  } catch (error) {
    console.error('Load messages error:', error);
    showNotification('Failed to load messages', 'error');
  }
}

// Display Messages
function displayMessages(messages) {
  if (!messagesContainer) return;

  if (messages.length === 0) {
    messagesContainer.innerHTML = `
      <div class="welcome-message">
        <div class="welcome-icon">💬</div>
        <h2>Start Conversation</h2>
        <p>Send a message to begin chatting</p>
      </div>
    `;
    return;
  }

  messagesContainer.innerHTML = messages.map(msg => {
    const isSent = msg.senderId === auth.currentUser?.uid;
    const sender = isSent ? window.appState.currentUser : (window.appState.users.get(msg.senderId) || { name: 'User', avatar: 'U' });
    const avatar = sender?.avatar || sender?.name?.charAt(0) || 'U';
    const time = msg.timestamp ? formatTime(msg.timestamp) : 'Just now';

    return `
      <div class="message ${isSent ? 'sent' : ''}">
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
          ${!isSent && currentChatType === 'private' ? `<strong>${sender?.name || 'User'}</strong><br>` : ''}
          <div class="message-text">${escapeHtml(msg.text)}</div>
          <span class="message-time">${time}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Send Message
async function sendMessage() {
  if (!auth.currentUser) {
    showNotification('Please sign in to send messages', 'error');
    return;
  }

  const text = messageInput?.value.trim();
  
  if (!text || !currentChatId) {
    return;
  }

  try {
    const message = {
      text: text,
      senderId: auth.currentUser.uid,
      senderName: window.appState.currentUser?.name || 'User',
      timestamp: serverTimestamp()
    };

    let messagesPath;
    if (currentChatType === 'user') {
      const userId1 = auth.currentUser.uid;
      const userId2 = currentChatId;
      const chatPath = [userId1, userId2].sort().join('_');
      messagesPath = `chats/${chatPath}/messages`;
      
      // Update chat metadata
      await update(ref(database, `chats/${chatPath}`), {
        lastMessage: text,
        lastMessageTime: serverTimestamp(),
        participants: { [userId1]: true, [userId2]: true }
      });
    } else if (currentChatType === 'private') {
      messagesPath = `privateChats/${currentChatId}/messages`;
    } else if (currentChatType === 'admin') {
      messagesPath = `support/${auth.currentUser.uid}/messages`;
      
      // Create support ticket if not exists
      await update(ref(database, `support/${auth.currentUser.uid}`), {
        userName: window.appState.currentUser?.name,
        userEmail: window.appState.currentUser?.email,
        status: 'open',
        createdAt: serverTimestamp()
      });
    }

    // Send message
    await push(ref(database, messagesPath), message);

    // Save to Supabase (best-effort)
    try {
      await supabase.insert('messages', {
        chat_id: currentChatId,
        sender_id: auth.currentUser.uid,
        text: text,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Failed to save to Supabase', err);
    }

    // Clear input
    messageInput.value = '';
    
  } catch (error) {
    console.error('Send message error:', error);
    showNotification('Failed to send message', 'error');
  }
}// Typing Indicator
function handleTyping() {
  if (!currentChatId || currentChatType !== 'user' || !auth.currentUser) return;

  clearTimeout(typingTimeout);
  
  const userId1 = auth.currentUser.uid;
  const userId2 = currentChatId;
  const chatPath = [userId1, userId2].sort().join('_');
  
  // Set typing status
  update(ref(database, `chats/${chatPath}/typing`), {
    [auth.currentUser.uid]: true
  });

  // Clear after 3 seconds
  typingTimeout = setTimeout(() => {
    update(ref(database, `chats/${chatPath}/typing`), {
      [auth.currentUser.uid]: false
    });
  }, 3000);
}

// Create Private Chat
async function createPrivateChat() {
  if (!auth.currentUser) {
    showNotification('Please sign in to create a private chat', 'error');
    return;
  }

  try {
    // Generate 8-digit random code
    const code = generatePrivateCode();
    
    const chatData = {
      code: code,
      createdBy: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      members: {
        [auth.currentUser.uid]: {
          name: window.appState.currentUser?.name,
          joinedAt: serverTimestamp()
        }
      },
      maxMembers: 15
    };

    // Save to Firebase
    await set(ref(database, `privateChats/${code}`), chatData);

    // Save to Supabase (best-effort)
    try {
      await supabase.insert('private_chats', {
        code: code,
        created_by: auth.currentUser.uid,
        created_at: new Date().toISOString(),
        max_members: 15
      });
    } catch (err) {
      console.warn('Failed to save private chat to Supabase', err);
    }

    // Show modal with code
    showPrivateCodeModal(code);
    
    // Reload private chats
    await loadPrivateChats();
    
    showNotification('Private chat created!', 'success');

  } catch (error) {
    console.error('Create private chat error:', error);
    showNotification('Failed to create private chat', 'error');
  }
}

// Generate Private Code
function generatePrivateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Show Private Code Modal
function showPrivateCodeModal(code) {
  const modal = document.getElementById('createPrivateModal');
  const overlay = document.getElementById('modalOverlay');
  const codeDisplay = document.getElementById('privateCode');
  const copyBtn = document.getElementById('copyCodeBtn');

  if (codeDisplay) {
    codeDisplay.textContent = code;
  }

  if (copyBtn) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(code);
      showNotification('Code copied!', 'success');
    };
  }

  overlay?.classList.add('active');
  modal?.classList.add('active');

  // Close modal handlers
  const closeButtons = modal?.querySelectorAll('.close-modal');
  closeButtons?.forEach(btn => {
    btn.onclick = () => {
      modal.classList.remove('active');
      overlay.classList.remove('active');
    };
  });

  overlay.onclick = (e) => {
    if (e.target === overlay) {
      modal?.classList.remove('active');
      overlay.classList.remove('active');
    }
  };
}

// Show Join Private Modal
function showJoinPrivateModal() {
  const modal = document.getElementById('joinPrivateModal');
  const overlay = document.getElementById('modalOverlay');
  const joinCodeInput = document.getElementById('joinCode');
  const joinBtn = document.getElementById('joinCodeBtn');

  overlay?.classList.add('active');
  modal?.classList.add('active');

  if (joinBtn) {
    joinBtn.onclick = async () => {
      const code = joinCodeInput?.value.trim().toUpperCase();
      if (code && code.length === 8) {
        await joinPrivateChat(code);
        modal?.classList.remove('active');
        overlay.classList.remove('active');
        if (joinCodeInput) joinCodeInput.value = '';
      } else {
        showNotification('Enter valid 8-digit code', 'error');
      }
    };
  }

  // Close modal handlers
  const closeButtons = modal?.querySelectorAll('.close-modal');
  closeButtons?.forEach(btn => {
    btn.onclick = () => {
      modal.classList.remove('active');
      overlay.classList.remove('active');
    };
  });

  overlay.onclick = (e) => {
    if (e.target === overlay) {
      modal?.classList.remove('active');
      overlay.classList.remove('active');
    }
  };
}

// Join Private Chat
async function joinPrivateChat(code) {
  if (!auth.currentUser) {
    showNotification('Please sign in to join private chats', 'error');
    return;
  }

  try {
    const chatRef = ref(database, `privateChats/${code}`);
    const snapshot = await get(chatRef);

    if (!snapshot.exists()) {
      showNotification('Invalid code', 'error');
      return;
    }

    const chat = snapshot.val();
    const members = chat.members || {};
    const memberCount = Object.keys(members).length;

    if (memberCount >= (chat.maxMembers || 15)) {
      showNotification('Chat is full', 'error');
      return;
    }

    if (members[auth.currentUser.uid]) {
      showNotification('Already in this chat', 'info');
      await loadPrivateChats();
      return;
    }

    // Add member
    await update(ref(database, `privateChats/${code}/members/${auth.currentUser.uid}`), {
      name: window.appState.currentUser.name,
      joinedAt: serverTimestamp()
    });

    showNotification('Joined private chat!', 'success');
    await loadPrivateChats();

  } catch (error) {
    console.error('Join private chat error:', error);
    showNotification('Failed to join chat', 'error');
  }
}

// Load Private Chats
async function loadPrivateChats() {
  try {
    const chatsRef = ref(database, 'privateChats');
    
    onValue(chatsRef, (snapshot) => {
      const chats = [];
      snapshot.forEach((childSnapshot) => {
        const chat = { code: childSnapshot.key, ...childSnapshot.val() };
        
        // Only show chats where user is a member
        if (chat.members && chat.members[auth.currentUser?.uid]) {
          chats.push(chat);
        }
      });

      displayPrivateChats(chats);
      window.appState.privateChats = new Map(chats.map(c => [c.code, c]));
    });
  } catch (error) {
    console.error('Load private chats error:', error);
  }
}

// Display Private Chats
function displayPrivateChats(chats) {
  if (!privateList) return;

  if (chats.length === 0) {
    privateList.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; color: var(--text-secondary);">
        <p>No private chats</p>
        <p style="font-size: 12px; margin-top: 10px;">Create or join one to start</p>
      </div>
    `;
    return;
  }

  privateList.innerHTML = chats.map(chat => {
    const memberCount = Object.keys(chat.members || {}).length;
    return `
      <div class="user-item" data-uid="${chat.code}" onclick="window.selectChat('${chat.code}', 'private')">
        <div class="user-item-avatar">🔒</div>
        <div class="user-item-info">
          <div class="user-item-name">Private Chat</div>
          <div class="user-item-message">
            Code: ${chat.code} • ${memberCount}/15 members
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Contact Admin
function contactAdmin() {
  window.selectChat('admin_support', 'admin');
  showNotification('You can now message the admin', 'info');
}

// Show Chat Info
async function showChatInfo() {
  const modal = document.getElementById('chatInfoModal');
  const overlay = document.getElementById('modalOverlay');
  const content = document.getElementById('chatInfoContent');

  if (!currentChatId || !modal || !overlay || !content) return;

  let infoHTML = '';

  if (currentChatType === 'user') {
    const user = window.appState.users.get(currentChatId);
    if (user) {
      infoHTML = `
        <div style="text-align: center;">
          <div style="width: 80px; height: 80px; margin: 0 auto 15px; border-radius: 50%; 
                      background: linear-gradient(135deg, var(--neon-blue), var(--neon-purple));
                      display: flex; align-items: center; justify-content: center;
                      font-size: 32px; font-weight: 700;">
            ${user.avatar || 'U'}
          </div>
          <h3 style="margin-bottom: 5px;">${user.name || 'User'}</h3>
          <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 20px;">
            ${user.email || 'No email'}
          </p>
          <div style="padding: 15px; background: rgba(0, 243, 255, 0.05); border-radius: 10px; 
                      border: 1px solid var(--border-color); text-align: left;">
            <p style="margin-bottom: 10px;"><strong>Status:</strong> 
              <span style="color: ${user.online ? 'var(--success)' : 'var(--text-secondary)'};">
                ${user.online ? 'Online' : 'Offline'}
              </span>
            </p>
            <p style="margin-bottom: 10px;"><strong>Phone:</strong> ${user.phone || 'Not provided'}</p>
            <p><strong>Member since:</strong> ${user.createdAt ? formatDate(user.createdAt) : 'Unknown'}</p>
          </div>
        </div>
      `;
    }
  } else if (currentChatType === 'private') {
    const chat = window.appState.privateChats.get(currentChatId);
    if (chat) {
      const members = Object.entries(chat.members || {});
      infoHTML = `
        <div>
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="width: 80px; height: 80px; margin: 0 auto 15px; border-radius: 50%; 
                        background: linear-gradient(135deg, var(--neon-purple), var(--neon-pink));
                        display: flex; align-items: center; justify-content: center; font-size: 32px;">
              🔒
            </div>
            <h3>Private Chat</h3>
            <p style="color: var(--text-secondary); margin: 10px 0;">Code: <strong>${chat.code}</strong></p>
            <p style="color: var(--text-secondary); font-size: 14px;">${members.length}/15 members</p>
          </div>
          <div style="padding: 15px; background: rgba(157, 0, 255, 0.05); border-radius: 10px; 
                      border: 1px solid var(--border-color);">
            <h4 style="margin-bottom: 15px;">Members</h4>
            ${members.map(([uid, data]) => `
              <div style="padding: 10px; margin-bottom: 8px; background: rgba(255, 255, 255, 0.02);
                          border-radius: 8px; display: flex; align-items: center; gap: 10px;">
                <div style="width: 35px; height: 35px; border-radius: 50%;
                            background: linear-gradient(135deg, var(--neon-blue), var(--neon-green));
                            display: flex; align-items: center; justify-content: center; font-weight: 600;">
                  ${data.name?.charAt(0) || 'U'}
                </div>
                <div>
                  <div style="font-weight: 600;">${data.name || 'User'}</div>
                  <div style="font-size: 12px; color: var(--text-secondary);">
                    Joined ${data.joinedAt ? formatDate(data.joinedAt) : 'recently'}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  }

  content.innerHTML = infoHTML;
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
}// Utility Functions

// Scroll to bottom
function scrollToBottom() {
  if (messagesContainer) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

// Format time
function formatTime(timestamp) {
  if (!timestamp) return 'Just now';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

// Format date
function formatDate(timestamp) {
  if (!timestamp) return 'Unknown';
  
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Escape HTML
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Export loadChatData function
window.loadChatData = function() {
  initChat();
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChat);
} else {
  // DOM is already ready
  if (auth.currentUser) {
    initChat();
  }
}

// Create a local binding for selectChat (window property) so it can be exported
const selectChat = window.selectChat;

export {
  initChat,
  sendMessage,
  selectChat,
  createPrivateChat,
  joinPrivateChat,
  loadUsers,
  loadPrivateChats,
  formatTime,
  formatDate
};