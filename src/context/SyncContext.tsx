import React, { createContext, useContext, useEffect, useState } from "react";
// 注意：不使用 @tauri-apps/plugin-http 的 fetch —— 在 Android 上 reqwest/rustls 无法发送 HTTPS 请求
import { cloudSyncService } from "../services/cloud-sync-service";

interface SyncContextType {
  isLoggedIn: boolean;
  token: string | null;
  user: UserInfo | null;
  login: (username?: string, password?: string) => Promise<boolean>;
  register: (username?: string, password?: string, email?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  sync: () => Promise<void>;
  isSyncing: boolean;
  lastSyncTime: number;
  syncError: string | null;
  syncLogs: string[];
  generateShareCode: () => Promise<{ code: string; expiresAt: number } | null>;
  importShareCode: (code: string) => Promise<boolean>;
  resetPasswordRequest: (email: string) => Promise<boolean>;
  resetPasswordVerify: (email: string, code: string, newPassword: string) => Promise<boolean>;
  bindEmailRequest: (email: string) => Promise<boolean>;
  bindEmailVerify: (code: string) => Promise<boolean>;
  changeUsername: (newUsername: string) => Promise<boolean>;
}

interface UserInfo {
  id: string;
  name?: string;
  email?: string;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

// Worker URL
const WORKER_URL = "https://nais2-sync-worker.liuanjay.workers.dev";
const STORE_KEY_TOKEN = "auth_token";
const STORE_KEY_LAST_SYNC = "last_sync_time";

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    const ts = new Date().toLocaleTimeString();
    const entry = `[${ts}] ${msg}`;
    console.log(entry);
    setSyncLogs(prev => [...prev, entry]);
  };

  // Helper functions defined before usage
  const logout = async () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORE_KEY_TOKEN);
    localStorage.removeItem(STORE_KEY_LAST_SYNC);
    setLastSyncTime(0);
  };

  const parseUserFromToken = (jwt: string) => {
    try {
      const payload = JSON.parse(atob(jwt));
      // Support sub (id) and name
      setUser({ id: payload.sub, name: payload.name });
    } catch (e) {
      console.error("Invalid token:", e);
      logout();
    }
  };

  const loadToken = () => {
    try {
      const savedToken = localStorage.getItem(STORE_KEY_TOKEN);
      const savedTime = localStorage.getItem(STORE_KEY_LAST_SYNC);
      
      if (savedToken) {
        setToken(savedToken);
        parseUserFromToken(savedToken);
      }
      if (savedTime) setLastSyncTime(parseInt(savedTime, 10));
    } catch (e) {
      console.error("Failed to load auth settings:", e);
    }
  };

  const handleLoginSuccess = (newToken: string, userInfo?: any) => {
    setToken(newToken);
    if (userInfo) {
       setUser(userInfo);
    } else {
       parseUserFromToken(newToken);
    }
    
    localStorage.setItem(STORE_KEY_TOKEN, newToken);
  };

  // Load token on mount
  useEffect(() => {
    loadToken();
    // setupDeepLinkListener(); // Removed
  }, []);

  const login = async (username?: string, password?: string): Promise<boolean> => {
    if (!username || !password) return false;
    
    try {
      const res = await fetch(`${WORKER_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password: password.trim() })
      });
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
         throw new Error(`Server Error (${res.status}): ${text.slice(0, 100)}`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }
      
      handleLoginSuccess(data.token, data.user);
      return true;
    } catch (e) {
      console.error("Login error:", e);
      throw e;
    }
  };

  const register = async (username?: string, password?: string, email?: string): Promise<boolean> => {
    if (!username || !password) return false;

    try {
      const res = await fetch(`${WORKER_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password: password.trim(), email: email?.trim().toLowerCase() })
      });
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
         throw new Error(`Server Error (${res.status}): ${text.slice(0, 100)}`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      
      handleLoginSuccess(data.token, data.user);
      return true;
    } catch (e: any) {
      console.error("Registration error details:", {
        message: e.message,
        stack: e.stack,
        cause: e.cause
      });
      // Re-throw to be caught by UI
      throw new Error(`Registration failed: ${e.message}`);
    }
  };

  // Check if account exists in cloud, if not, try to re-register silently or prompt
  const syncAccount = async (): Promise<boolean> => {
      if (!token || !user) return false;
      
      try {
          // Try a simple auth check or pull to see if user exists
          const res = await fetch(`${WORKER_URL}/auth/check`, {
              headers: { Authorization: `Bearer ${token}` }
          });
          
          if (res.status === 401 || res.status === 404) {
              console.warn("Account missing in cloud. Attempting re-registration...");
              // We don't have the password here to re-register automatically securely.
              // But we can check if the user *should* exist.
              // For now, let's just logout and force user to login/register again to fix state.
              // Or better, return false so UI can show "Account Error" button.
              return false;
          }
          return true;
      } catch(e) {
          console.error("Account sync check failed", e);
          return false;
      }
  };


  const sync = async () => {
    if (!token || isSyncing) return;
    setIsSyncing(true);
    setSyncError(null);
    setSyncLogs([]);
    addLog('Sync started.');
    
    try {
      // 1. PULL
      addLog(`PULL: Fetching from worker (last_sync=${lastSyncTime})...`);
      const pullUrl = `${WORKER_URL}/sync/pull?last_sync=${lastSyncTime}`;
      const pullController = new AbortController();
      const pullTimeout = setTimeout(() => pullController.abort(), 30000);
      const pullRes = await fetch(pullUrl, {
        headers: { Authorization: `Bearer ${token}` },
        signal: pullController.signal
      });
      clearTimeout(pullTimeout);
      addLog(`PULL: Response status=${pullRes.status}`);
      
      let serverTimestamp = 0;

      if (pullRes.ok) {
        const data = await pullRes.json();
        addLog(`PULL: Received ${data.changes?.length ?? 0} changes.`);
        
        if (data.changes && data.changes.length > 0) {
             addLog(`MERGE: Writing ${data.changes.length} changes to local DB...`);
             await cloudSyncService.mergeRemoteChanges(data.changes);
             addLog(`MERGE: Done.`);
        }
        
        if (data.timestamp) {
             serverTimestamp = data.timestamp;
        }
      } else {
        const errBody = await pullRes.text().catch(() => '(no body)');
        addLog(`PULL FAILED: status=${pullRes.status}, body=${errBody.slice(0, 200)}`);
      }

      // 2. PUSH
      addLog('PUSH: Getting local changes...');
      const localChanges = await cloudSyncService.getLocalChanges(lastSyncTime);
      addLog(`PUSH: Found ${localChanges.length} local changes.`);
      if (localChanges.length > 0) {
          const CHUNK_SIZE = 50;
          const totalChunks = Math.ceil(localChanges.length / CHUNK_SIZE);
          for (let i = 0; i < localChanges.length; i += CHUNK_SIZE) {
              const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
              const chunk = localChanges.slice(i, i + CHUNK_SIZE);
              addLog(`PUSH: Sending chunk ${chunkNum}/${totalChunks} (${chunk.length} items)...`);
              
              const pushController = new AbortController();
              const pushTimeout = setTimeout(() => pushController.abort(), 30000);
              const pushRes = await fetch(`${WORKER_URL}/sync/push`, {
                  method: 'POST',
                  headers: { 
                      Authorization: `Bearer ${token}`,
                      'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ changes: chunk }),
                  signal: pushController.signal
              });
              clearTimeout(pushTimeout);
              
              if (!pushRes.ok) {
                  let errText = await pushRes.text().catch(() => 'Unknown error');
                  throw new Error(`Push failed chunk ${chunkNum}: ${errText.slice(0, 100)}`);
              }
              
              const pushData = await pushRes.json();
              if (pushData.timestamp && pushData.timestamp > serverTimestamp) {
                  serverTimestamp = pushData.timestamp;
              }
              addLog(`PUSH: Chunk ${chunkNum} OK.`);
          }
      }

      // Update last sync time
      if (serverTimestamp > 0) {
           setLastSyncTime(serverTimestamp);
           localStorage.setItem(STORE_KEY_LAST_SYNC, serverTimestamp.toString());
           addLog(`SUCCESS: Sync complete (ts=${serverTimestamp}).`);
      } else {
           addLog('WARN: serverTimestamp is 0, not updating lastSyncTime.');
      }

    } catch (e: any) {
      const errMsg = e?.message || String(e);
      console.error("Sync failed:", errMsg);
      setSyncError(errMsg);
      addLog(`ERROR: ${errMsg}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const generateShareCode = async (): Promise<{ code: string; expiresAt: number } | null> => {
    if (!token) return null;
    try {
      const res = await fetch(`${WORKER_URL}/share/create`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error("Failed to generate share code:", e);
    }
    return null;
  };

  const importShareCode = async (code: string): Promise<boolean> => {
    // Note: Importing does not strictly require login, but we probably want to save it to our local DB
    // For now we allow anyone to import if they have the code.
    try {
      const res = await fetch(`${WORKER_URL}/share/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      
      if (res.ok) {
        const result = await res.json();
        console.log(`Imported ${result.count} items.`);
        
        if (result.data && result.data.length > 0) {
            await cloudSyncService.mergeRemoteChanges(result.data);
        }
        
        return true;
      } else {
        const err = await res.json();
        console.error("Import failed:", err);
        throw new Error(err.error || "Import failed");
      }
    } catch (e) {
      console.error("Error importing share code:", e);
      throw e;
    }
  };

  const resetPasswordRequest = async (email: string): Promise<boolean> => {
    try {
      const res = await fetch(`${WORKER_URL}/auth/reset-password-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      return data.success;
    } catch (e) {
      console.error("Reset request failed:", e);
      return false;
    }
  };

  const resetPasswordVerify = async (email: string, code: string, newPassword: string): Promise<boolean> => {
    try {
      const res = await fetch(`${WORKER_URL}/auth/reset-password-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      return data.success;
    } catch (e) {
      console.error("Reset verify failed:", e);
      throw e;
    }
  };

  const bindEmailRequest = async (email: string): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch(`${WORKER_URL}/auth/bind-email-request`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data.success;
    } catch (e: any) {
      console.error("Bind request error:", e);
      throw new Error(e.message || "Failed to send code");
    }
  };

  const bindEmailVerify = async (code: string): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch(`${WORKER_URL}/auth/bind-email-verify`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      
      // Update local user info
      if (user && data.email) {
          const updatedUser = { ...user, email: data.email };
          setUser(updatedUser);
          localStorage.setItem('sync_user', JSON.stringify(updatedUser));
          // If token contains email, we might need to refresh it, but usually email is in user profile
      }
      return true;
    } catch (e: any) {
      console.error("Bind verify error:", e);
      throw new Error(e.message || "Verification failed");
    }
  };

  const changeUsername = async (newUsername: string): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch(`${WORKER_URL}/auth/change-username`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ newUsername })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Change username failed');
      }

      if (data.success && data.token) {
        // Automatically refresh token and user info
        handleLoginSuccess(data.token, data.user);
        return true;
      }
      return false;
    } catch (e: any) {
      console.error("Change username error:", e);
      throw new Error(e.message || "Failed to change username");
    }
  };

  return (
    <SyncContext.Provider value={{
      isLoggedIn: !!token,
      token, // Expose token
      user,
      login,
      register,
      logout,
      sync,
      isSyncing,
      lastSyncTime,
      syncError,
      syncLogs,
      generateShareCode,
      importShareCode,
      resetPasswordRequest,
      resetPasswordVerify,
      bindEmailRequest,
      bindEmailVerify,
      changeUsername
    }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error("useSync must be used within a SyncProvider");
  }
  return context;
}
