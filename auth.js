// Authentication Module
import { 
  auth, 
  database, 
  googleProvider,
  supabase,
  ADMIN_USERNAME,
  ADMIN_PASSWORD 
} from './firebase-config.js';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  ref,
  set,
  get,
  update,
  onValue,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// DOM Elements
const authContainer = document.getElementById('authContainer');
const chatContainer = document.getElementById('chatContainer');
const adminPanel = document.getElementById('adminPanel');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const phoneVerification = document.getElementById('phoneVerification');
const adminLoginForm = document.getElementById('adminLoginForm');

// Auth Buttons
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const verifyBtn = document.getElementById('verifyBtn');
const resendCode = document.getElementById('resendCode');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');

// Auth Inputs
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const registerName = document.getElementById('registerName');
const registerEmail = document.getElementById('registerEmail');
const registerPhone = document.getElementById('registerPhone');
const registerPassword = document.getElementById('registerPassword');
const verificationCode = document.getElementById('verificationCode');
const adminUsername = document.getElementById('adminUsername');
const adminPassword = document.getElementById('adminPassword');

// Switch Links
const showRegister = document.getElementById('showRegister');
const showLogin = document.getElementById('showLogin');
const showAdminLogin = document.getElementById('showAdminLogin');
const backToLogin = document.getElementById('backToLogin');

// Global variables
let confirmationResult = null;
let recaptchaVerifier = null;

// Debug / error reporting helper - dispatches an ErrorEvent so the overlay captures it
function reportError(error, context = '') {
  try {
    console.error(context, error);
    // Show a compact notification for users (do not expose raw error in production)
    showNotification((error && error.message) ? `${context} - ${error.message}` : `${context} - An error occurred`, 'error');

    // Dispatch an ErrorEvent so the runtime overlay can capture stack traces
    const ev = new ErrorEvent('error', {
      message: (error && error.message) ? `${context}: ${error.message}` : context || 'Error',
      filename: error && error.fileName ? error.fileName : window.location.href,
      lineno: error && error.lineNumber ? error.lineNumber : 0,
      colno: error && error.columnNumber ? error.columnNumber : 0,
      error: error
    });

    window.dispatchEvent(ev);
  } catch (e) {
    console.error('reportError failed', e);
  }
}

// Initialize Authentication
function initAuth() {
  setupEventListeners();
  setupAuthStateListener();
}

// Setup Event Listeners
function setupEventListeners() {
  // Form switches
  showRegister?.addEventListener('click', () => {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
  });

  showLogin?.addEventListener('click', () => {
    registerForm.style.display = 'none';
    phoneVerification.style.display = 'none';
    loginForm.style.display = 'block';
  });

  showAdminLogin?.addEventListener('click', () => {
    loginForm.style.display = 'none';
    adminLoginForm.style.display = 'block';
  });

  backToLogin?.addEventListener('click', () => {
    adminLoginForm.style.display = 'none';
    loginForm.style.display = 'block';
  });

  // Auth actions
  loginBtn?.addEventListener('click', handleLogin);
  registerBtn?.addEventListener('click', handleRegister);
  googleLoginBtn?.addEventListener('click', handleGoogleLogin);
  verifyBtn?.addEventListener('click', handlePhoneVerification);
  resendCode?.addEventListener('click', resendVerificationCode);
  adminLoginBtn?.addEventListener('click', handleAdminLogin);
  logoutBtn?.addEventListener('click', handleLogout);
  adminLogoutBtn?.addEventListener('click', handleLogout);

  // Enter key handlers
  loginEmail?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginPassword.focus();
  });
  loginPassword?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  registerPassword?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleRegister();
  });
  verificationCode?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handlePhoneVerification();
  });
  adminPassword?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAdminLogin();
  });
}

// Handle Login
async function handleLogin() {
  const email = loginEmail.value.trim();
  const password = loginPassword.value.trim();

  if (!email || !password) {
    showNotification('Please fill all fields', 'error');
    return;
  }

  try {
    showLoading(loginBtn);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // Check if user is blocked
    const userRef = ref(database, `users/${userCredential.user.uid}`);
    const snapshot = await get(userRef);
    
    if (snapshot.exists() && snapshot.val().blocked) {
      await signOut(auth);
      showNotification('Your account has been blocked. Contact admin.', 'error');
      hideLoading(loginBtn, 'Sign In');
      return;
    }

    // Update user status
    await updateUserStatus(userCredential.user.uid, true);
    showNotification('Login successful!', 'success');
    
  } catch (error) {
    reportError(error, 'Login error');
    let message = 'Login failed';
    if (error.code === 'auth/user-not-found') {
      message = 'User not found';
    } else if (error.code === 'auth/wrong-password') {
      message = 'Incorrect password';
    } else if (error.code === 'auth/invalid-email') {
      message = 'Invalid email';
    }
    showNotification(message, 'error');
    hideLoading(loginBtn, 'Sign In');
  }
}

// Handle Register
async function handleRegister() {
  const name = registerName.value.trim();
  const email = registerEmail.value.trim();
  const phone = registerPhone.value.trim();
  const password = registerPassword.value.trim();

  if (!name || !email || !phone || !password) {
    showNotification('Please fill all fields', 'error');
    return;
  }

  if (password.length < 6) {
    showNotification('Password must be at least 6 characters', 'error');
    return;
  }

  if (!phone.startsWith('+998')) {
    showNotification('Phone must start with +998', 'error');
    return;
  }

  try {
    showLoading(registerBtn);
    
    // Create user account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Save user data to Firebase
    await set(ref(database, `users/${user.uid}`), {
      uid: user.uid,
      name: name,
      email: email,
      phone: phone,
      avatar: name.charAt(0).toUpperCase(),
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
      online: true,
      blocked: false
    });

    // Save to Supabase
    await supabase.insert('users', {
      uid: user.uid,
      name: name,
      email: email,
      phone: phone,
      avatar: name.charAt(0).toUpperCase(),
      created_at: new Date().toISOString(),
      blocked: false
    });

    showNotification('Account created successfully!', 'success');
    
    // Show phone verification
    registerForm.style.display = 'none';
    phoneVerification.style.display = 'block';
    await initPhoneVerification(phone);

  } catch (error) {
    reportError(error, 'Registration error');
    let message = 'Registration failed';
    if (error.code === 'auth/email-already-in-use') {
      message = 'Email already registered';
    } else if (error.code === 'auth/weak-password') {
      message = 'Password is too weak';
    } else if (error.code === 'auth/invalid-email') {
      message = 'Invalid email';
    }
    showNotification(message, 'error');
    hideLoading(registerBtn, 'Create Account');
  }
}

// Handle Google Login
async function handleGoogleLogin() {
  try {
    showLoading(googleLoginBtn);
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Check if user exists in database
    const userRef = ref(database, `users/${user.uid}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      // New user - create profile
      await set(userRef, {
        uid: user.uid,
        name: user.displayName || 'Google User',
        email: user.email,
        phone: user.phoneNumber || '',
        avatar: user.displayName?.charAt(0).toUpperCase() || 'G',
        photoURL: user.photoURL || '',
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
        online: true,
        blocked: false
      });

      // Save to Supabase
      await supabase.insert('users', {
        uid: user.uid,
        name: user.displayName || 'Google User',
        email: user.email,
        phone: user.phoneNumber || '',
        avatar: user.displayName?.charAt(0).toUpperCase() || 'G',
        photo_url: user.photoURL || '',
        created_at: new Date().toISOString(),
        blocked: false
      });
    } else if (snapshot.val().blocked) {
      await signOut(auth);
      showNotification('Your account has been blocked', 'error');
      hideLoading(googleLoginBtn, 'Sign in with Google');
      return;
    }

    await updateUserStatus(user.uid, true);
    showNotification('Signed in with Google!', 'success');

  } catch (error) {
    reportError(error, 'Google login error');
    showNotification('Google sign-in failed', 'error');
    hideLoading(googleLoginBtn, 'Sign in with Google');
  }
}// Phone Verification Functions
async function initPhoneVerification(phoneNumber) {
  try {
    if (!recaptchaVerifier) {
      recaptchaVerifier = new RecaptchaVerifier(auth, 'verifyBtn', {
        size: 'invisible',
        callback: () => {
          console.log('reCAPTCHA solved');
        }
      });
    }

    confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    showNotification('Verification code sent!', 'success');
  } catch (error) {
    reportError(error, 'Phone verification error');
    showNotification('Failed to send code', 'error');
  }
}

async function handlePhoneVerification() {
  const code = verificationCode.value.trim();

  if (!code || code.length !== 6) {
    showNotification('Enter valid 6-digit code', 'error');
    return;
  }

  if (!confirmationResult) {
    showNotification('Please request code first', 'error');
    return;
  }

  try {
    showLoading(verifyBtn);
    await confirmationResult.confirm(code);
    showNotification('Phone verified!', 'success');
    phoneVerification.style.display = 'none';
  } catch (error) {
    reportError(error, 'Verification error');
    showNotification('Invalid code', 'error');
    hideLoading(verifyBtn, 'Verify');
  }
}

async function resendVerificationCode() {
  const phone = registerPhone.value.trim();
  if (!phone) {
    showNotification('Enter phone number first', 'error');
    return;
  }
  await initPhoneVerification(phone);
}

// Handle Admin Login
async function handleAdminLogin() {
  const username = adminUsername.value.trim();
  const password = adminPassword.value.trim();

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    window.appState.isAdmin = true;
    window.appState.currentUser = { 
      uid: 'admin', 
      name: 'Administrator', 
      email: 'admin@neonmessenger.com' 
    };
    
    authContainer.style.display = 'none';
    adminPanel.style.display = 'flex';
    
    // Load admin data
    if (window.loadAdminData) {
      window.loadAdminData();
    }
    
    showNotification('Admin login successful!', 'success');
  } else {
    showNotification('Invalid admin credentials', 'error');
  }
}

// Handle Logout
async function handleLogout() {
  try {
    if (window.appState.isAdmin) {
      window.appState.isAdmin = false;
      window.appState.currentUser = null;
      adminPanel.style.display = 'none';
      authContainer.style.display = 'flex';
      showNotification('Admin logged out', 'success');
    } else if (auth.currentUser) {
      await updateUserStatus(auth.currentUser.uid, false);
      await signOut(auth);
      showNotification('Logged out successfully', 'success');
    }
  } catch (error) {
    reportError(error, 'Logout error');
    showNotification('Logout failed', 'error');
  }
}

// Update User Status
async function updateUserStatus(uid, online) {
  try {
    const updates = {
      online: online,
      lastSeen: serverTimestamp()
    };
    await update(ref(database, `users/${uid}`), updates);
  } catch (error) {
    reportError(error, 'Status update error');
  }
}

// Setup Auth State Listener
function setupAuthStateListener() {
  onAuthStateChanged(auth, async (user) => {
    try {
      console.log('Auth state changed:', user);

      if (user && !window.appState.isAdmin) {
        // Check if blocked
        const userRef = ref(database, `users/${user.uid}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists() && snapshot.val().blocked) {
          await signOut(auth);
          showNotification('Your account is blocked', 'error');
          return;
        }

        // Load user data
        window.appState.currentUser = {
          uid: user.uid,
          email: user.email,
          ...snapshot.val()
        };

        // Update UI
        authContainer.style.display = 'none';
        chatContainer.style.display = 'flex';
        
        // Update profile display
        const currentUserName = document.getElementById('currentUserName');
        const currentUserAvatar = document.getElementById('currentUserAvatar');
        
        if (currentUserName && window.appState.currentUser.name) {
          currentUserName.textContent = window.appState.currentUser.name;
        }
        if (currentUserAvatar && window.appState.currentUser.avatar) {
          currentUserAvatar.textContent = window.appState.currentUser.avatar;
        }

        // Load chat data
        if (window.loadChatData) {
          window.loadChatData();
        }

        // Set user online
        await updateUserStatus(user.uid, true);

        // Handle offline status
        window.addEventListener('beforeunload', () => {
          updateUserStatus(user.uid, false);
        });

      } else if (!window.appState.isAdmin) {
        authContainer.style.display = 'flex';
        chatContainer.style.display = 'none';
        adminPanel.style.display = 'none';
      }
    } catch (error) {
      reportError(error, 'Auth state handler error');
    }
  });
}

// Utility Functions
function showLoading(button) {
  if (!button) return;
  button.disabled = true;
  button.innerHTML = '<span class="loading"></span>';
}

function hideLoading(button, text) {
  if (!button) return;
  button.disabled = false;
  button.textContent = text;
}

function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  Object.assign(notification.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '15px 20px',
    borderRadius: '12px',
    color: 'white',
    fontWeight: '600',
    fontSize: '14px',
    zIndex: '10000',
    animation: 'slideIn 0.3s ease',
    boxShadow: '0 5px 20px rgba(0, 0, 0, 0.3)'
  });

  if (type === 'success') {
    notification.style.background = 'linear-gradient(135deg, #00ff88, #00d4ff)';
  } else if (type === 'error') {
    notification.style.background = 'linear-gradient(135deg, #ff4757, #ff6348)';
  } else {
    notification.style.background = 'linear-gradient(135deg, #00f3ff, #9d00ff)';
  }

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Initialize
initAuth();

// Export functions
export {
  handleLogin,
  handleLogout,
  updateUserStatus,
  showNotification,
  showLoading,
  hideLoading
};