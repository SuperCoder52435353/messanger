// Firebase Configuration and Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAoqmMk6OMma0qAFQ5ZBWSlWkjoRMtFJ3A",
  authDomain: "messnger-1bd7c.firebaseapp.com",
  databaseURL: "https://messnger-1bd7c-default-rtdb.firebaseio.com",
  projectId: "messnger-1bd7c",
  storageBucket: "messnger-1bd7c.firebasestorage.app",
  messagingSenderId: "835742186578",
  appId: "1:835742186578:web:5b8dc659032bdf3817b38b",
  measurementId: "G-MQWBJ9X3Z8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const analytics = getAnalytics(app);
const googleProvider = new GoogleAuthProvider();

// Supabase Configuration
const SUPABASE_URL = 'https://mdmhkspraiyetjoblzsm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kbWhrc3ByYWl5ZXRqb2JsenNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMDQyMTEsImV4cCI6MjA4MjY4MDIxMX0.Ib2jbOK575bPgQ3enBK2tLnGvAWYLLlWfnB9O29aHIc';

// Supabase Helper Functions
class SupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
    this.headers = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    };
  }

  async query(table, params = {}) {
    try {
      let url = `${this.url}/rest/v1/${table}`;
      const queryParams = new URLSearchParams(params);
      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`Supabase query error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Supabase query error:', error);
      return null;
    }
  }

  async insert(table, data) {
    try {
      const response = await fetch(`${this.url}/rest/v1/${table}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`Supabase insert error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Supabase insert error:', error);
      return null;
    }
  }

  async update(table, id, data) {
    try {
      const response = await fetch(`${this.url}/rest/v1/${table}?id=eq.${id}`, {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`Supabase update error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Supabase update error:', error);
      return null;
    }
  }

  async delete(table, id) {
    try {
      const response = await fetch(`${this.url}/rest/v1/${table}?id=eq.${id}`, {
        method: 'DELETE',
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`Supabase delete error: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Supabase delete error:', error);
      return false;
    }
  }
}

const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Admin credentials
const ADMIN_USERNAME = 'agent';
const ADMIN_PASSWORD = 'PASSWORDABDURAXMON';

// Global state
window.appState = {
  currentUser: null,
  currentChat: null,
  isAdmin: false,
  users: new Map(),
  messages: new Map(),
  privateChats: new Map(),
  blockedUsers: new Set()
};

// Export configurations
export { 
  app, 
  auth, 
  database, 
  analytics, 
  googleProvider,
  supabase,
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  SUPABASE_URL,
  SUPABASE_ANON_KEY
};