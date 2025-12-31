// UI Module - Additional UI enhancements and utilities
import { showNotification } from './auth.js';

// Mobile Menu Toggle
let isMobileMenuOpen = false;

function setupMobileMenu() {
  const sidebar = document.querySelector('.sidebar');
  const menuToggleBtn = document.createElement('button');
  
  menuToggleBtn.className = 'mobile-menu-toggle';
  menuToggleBtn.innerHTML = '☰';
  menuToggleBtn.style.cssText = `
    display: none;
    position: fixed;
    top: 20px;
    left: 20px;
    z-index: 1000;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    width: 50px;
    height: 50px;
    font-size: 24px;
    color: var(--neon-blue);
    cursor: pointer;
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
  `;

  menuToggleBtn.addEventListener('click', () => {
    isMobileMenuOpen = !isMobileMenuOpen;
    sidebar?.classList.toggle('mobile-open');
    menuToggleBtn.innerHTML = isMobileMenuOpen ? '✕' : '☰';
  });

  // Show on mobile
  if (window.innerWidth <= 768) {
    menuToggleBtn.style.display = 'flex';
    document.body.appendChild(menuToggleBtn);
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth <= 768) {
      menuToggleBtn.style.display = 'flex';
      if (!document.body.contains(menuToggleBtn)) {
        document.body.appendChild(menuToggleBtn);
      }
    } else {
      menuToggleBtn.style.display = 'none';
      sidebar?.classList.remove('mobile-open');
      isMobileMenuOpen = false;
    }
  });
}

// Online Status Indicator
function setupOnlineStatusIndicator() {
  window.addEventListener('online', () => {
    showNotification('You are back online', 'success');
  });

  window.addEventListener('offline', () => {
    showNotification('You are offline', 'error');
  });
}

// Keyboard Shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K - Focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('searchUsers');
      searchInput?.focus();
    }

    // Escape - Close modals
    if (e.key === 'Escape') {
      const overlay = document.getElementById('modalOverlay');
      const activeModals = document.querySelectorAll('.modal.active');
      
      activeModals.forEach(modal => modal.classList.remove('active'));
      overlay?.classList.remove('active');
    }

    // Ctrl/Cmd + Enter - Send message
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      const messageInput = document.getElementById('messageInput');
      if (messageInput && document.activeElement === messageInput) {
        const sendBtn = document.getElementById('sendBtn');
        sendBtn?.click();
      }
    }
  });
}

// Auto-resize textarea
function setupAutoResizeTextarea() {
  const messageInput = document.getElementById('messageInput');
  
  if (messageInput && messageInput.tagName === 'TEXTAREA') {
    messageInput.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 150) + 'px';
    });
  }
}

// Theme switcher (optional enhancement)
function setupThemeToggle() {
  const themes = {
    neon: {
      '--neon-blue': '#00f3ff',
      '--neon-pink': '#ff00f7',
      '--neon-purple': '#9d00ff',
      '--neon-green': '#00ff88'
    },
    cyber: {
      '--neon-blue': '#00ffff',
      '--neon-pink': '#ff1493',
      '--neon-purple': '#8b00ff',
      '--neon-green': '#39ff14'
    },
    matrix: {
      '--neon-blue': '#00ff00',
      '--neon-pink': '#00ff00',
      '--neon-purple': '#008000',
      '--neon-green': '#00ff00'
    }
  };

  let currentTheme = 'neon';

  window.switchTheme = function(themeName) {
    if (themes[themeName]) {
      currentTheme = themeName;
      const root = document.documentElement;
      Object.entries(themes[themeName]).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
      showNotification(`Theme changed to ${themeName}`, 'info');
    }
  };
}

// Message reactions (enhancement)
function setupMessageReactions() {
  const reactionsEmojis = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

  window.addReaction = function(messageId, emoji) {
    showNotification(`Reacted with ${emoji}`, 'success');
    // Implementation would save to database
  };
}

// Emoji picker (simple)
function setupEmojiPicker() {
  const commonEmojis = ['😀', '😂', '😍', '🥰', '😎', '🤔', '👍', '👎', '❤️', '🔥', '⭐', '🎉'];
  
  const emojiButton = document.createElement('button');
  emojiButton.className = 'icon-button';
  emojiButton.innerHTML = '😀';
  emojiButton.title = 'Emoji';
  
  const messageInputContainer = document.querySelector('.message-input-container');
  const messageInput = document.getElementById('messageInput');
  
  if (messageInputContainer && messageInput) {
    messageInputContainer.insertBefore(emojiButton, messageInput);
    
    emojiButton.addEventListener('click', () => {
      const picker = document.createElement('div');
      picker.className = 'emoji-picker';
      picker.style.cssText = `
        position: absolute;
        bottom: 70px;
        left: 20px;
        background: var(--card-bg);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 10px;
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 5px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        z-index: 100;
      `;
      
      commonEmojis.forEach(emoji => {
        const btn = document.createElement('button');
        btn.textContent = emoji;
        btn.style.cssText = `
          background: transparent;
          border: none;
          font-size: 24px;
          cursor: pointer;
          padding: 5px;
          border-radius: 8px;
          transition: all 0.2s;
        `;
        btn.addEventListener('mouseover', () => {
          btn.style.background = 'rgba(0, 243, 255, 0.1)';
        });
        btn.addEventListener('mouseout', () => {
          btn.style.background = 'transparent';
        });
        btn.addEventListener('click', () => {
          messageInput.value += emoji;
          messageInput.focus();
          picker.remove();
        });
        picker.appendChild(btn);
      });
      
      messageInputContainer.appendChild(picker);
      
      // Close on click outside
      setTimeout(() => {
        document.addEventListener('click', function closeEmojiPicker(e) {
          if (!picker.contains(e.target) && e.target !== emojiButton) {
            picker.remove();
            document.removeEventListener('click', closeEmojiPicker);
          }
        });
      }, 0);
    });
  }
}

// Message timestamps update
function updateMessageTimestamps() {
  setInterval(() => {
    const timestamps = document.querySelectorAll('.message-time');
    timestamps.forEach(ts => {
      const time = ts.dataset.timestamp;
      if (time) {
        ts.textContent = formatTimeAgo(parseInt(time));
      }
    });
  }, 60000); // Update every minute
}

function formatTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// Image preview for avatars
function setupImagePreviews() {
  const avatars = document.querySelectorAll('.user-avatar, .chat-avatar');
  
  avatars.forEach(avatar => {
    avatar.addEventListener('click', () => {
      // Could show larger version or user profile
      console.log('Avatar clicked');
    });
  });
}

// Connection status banner
function setupConnectionBanner() {
  let banner = null;

  function showBanner(message, type = 'info') {
    if (banner) banner.remove();

    banner = document.createElement('div');
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      padding: 12px;
      background: ${type === 'error' ? 'var(--danger)' : 'var(--warning)'};
      color: white;
      text-align: center;
      font-size: 14px;
      font-weight: 600;
      z-index: 9999;
      animation: slideDown 0.3s ease;
    `;
    banner.textContent = message;
    document.body.appendChild(banner);
  }

  function hideBanner() {
    if (banner) {
      banner.style.animation = 'slideUp 0.3s ease';
      setTimeout(() => banner?.remove(), 300);
    }
  }

  window.addEventListener('offline', () => {
    showBanner('⚠️ No internet connection', 'error');
  });

  window.addEventListener('online', () => {
    showBanner('✅ Back online', 'info');
    setTimeout(hideBanner, 3000);
  });
}

// Sound notifications (optional)
function setupSoundNotifications() {
  window.playNotificationSound = function() {
    // Create a simple beep sound using Web Audio API
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.log('Sound not supported');
    }
  };
}

// Loading states
function setupLoadingStates() {
  window.showGlobalLoading = function(message = 'Loading...') {
    let loader = document.getElementById('global-loader');
    
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'global-loader';
      loader.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(5px);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;
      loader.innerHTML = `
        <div class="loading" style="width: 50px; height: 50px; border-width: 5px;"></div>
        <p style="color: white; margin-top: 20px; font-size: 16px;">${message}</p>
      `;
      document.body.appendChild(loader);
    }
  };

  window.hideGlobalLoading = function() {
    const loader = document.getElementById('global-loader');
    loader?.remove();
  };
}

// Initialize all UI enhancements
function initUI() {
  setupMobileMenu();
  setupOnlineStatusIndicator();
  setupKeyboardShortcuts();
  setupAutoResizeTextarea();
  setupThemeToggle();
  setupMessageReactions();
  setupEmojiPicker();
  updateMessageTimestamps();
  setupConnectionBanner();
  setupSoundNotifications();
  setupLoadingStates();

  console.log('✨ Neon Messenger UI initialized');

  // Setup a global runtime error overlay to capture console errors for debugging
  setupErrorOverlay();
}

function setupErrorOverlay() {
  if (document.getElementById('error-log-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'error-log-overlay';
  overlay.style.cssText = `position: fixed; bottom: 20px; right: 20px; width: 360px; max-height: 50vh; overflow: auto; background: rgba(0,0,0,0.85); color: #fff; border-radius: 12px; padding: 12px; z-index: 100000; display: none; font-family: monospace; font-size: 12px;`;
  overlay.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
    <strong>Runtime Errors</strong>
    <div>
      <button id="copyErrorsBtn" style="margin-right:6px;">Copy</button>
      <button id="clearErrorsBtn">Clear</button>
    </div>
  </div><pre id="error-log-content" style="white-space:pre-wrap;"></pre>`;

  document.body.appendChild(overlay);

  const content = overlay.querySelector('#error-log-content');

  function appendError(txt) {
    try {
      content.textContent += `${txt}\n\n`;
      overlay.style.display = 'block';
      console.error(txt);
    } catch (err) {
      console.error('Error appending to overlay', err);
    }
  }

  window.addEventListener('error', (e) => {
    appendError(`[Error] ${e.message} at ${e.filename}:${e.lineno}:${e.colno}\n${e.error?.stack || ''}`);
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    const text = typeof reason === 'object' ? (reason.stack || JSON.stringify(reason)) : String(reason);
    appendError(`[UnhandledRejection] ${text}`);
  });

  overlay.querySelector('#clearErrorsBtn').addEventListener('click', () => {
    content.textContent = '';
    overlay.style.display = 'none';
  });

  overlay.querySelector('#copyErrorsBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(content.textContent || '').then(()=> {
      try { showNotification('Errors copied to clipboard', 'success'); } catch (err) { console.log('copied'); }
    }).catch(()=> {
      try { showNotification('Unable to copy', 'error'); } catch (err) { console.log('copy failed'); }
    });
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}

export { initUI };