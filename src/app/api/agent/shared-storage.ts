// src/app/api/agent/shared-storage.ts

/**
 * Shared storage for pending actions across API routes
 * Using global to ensure shared state across Next.js API routes
 * In production, this would be replaced with Redis or database storage
 */

// Use global to persist across module reloads in development
declare global {
  var _pendingActionsStorage: Map<string, any> | undefined;
}

if (!global._pendingActionsStorage) {
  global._pendingActionsStorage = new Map<string, any>();
}

export const pendingActions = {
  get(key: string) { 
    return global._pendingActionsStorage!.get(key); 
  },

  set(key: string, value: any) { 
    global._pendingActionsStorage!.set(key, value); 
  },

  delete(key: string) { 
    return global._pendingActionsStorage!.delete(key); 
  },

  has(key: string) {
    return global._pendingActionsStorage!.has(key);
  },

  clear() {
    global._pendingActionsStorage!.clear();
  },

  size() {
    return global._pendingActionsStorage!.size;
  }
};