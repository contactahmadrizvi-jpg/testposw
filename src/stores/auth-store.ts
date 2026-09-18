import { create } from "zustand";
import type { AppUser } from "@/types";
import { subscribeAuth, getUserProfile, logoutUser } from "@/services/auth.service";
import type { User } from "firebase/auth";
import { ADMIN_ROLES } from "@/constants";
import { userHasPermission } from "@/lib/permissions";
import type { UserRole } from "@/types";

interface AuthState {
  firebaseUser: User | null;
  profile: AppUser | null;
  loading: boolean;
  initialized: boolean;
  setProfile: (profile: AppUser | null) => void;
  setSession: (user: User | null, profile: AppUser | null) => void;
  refreshProfile: () => Promise<AppUser | null>;
  init: () => () => void;
  logout: () => Promise<void>;
  canAccessAdmin: () => boolean;
  can: (permission: string) => boolean;
}

export function isAdminRole(role?: UserRole | string): boolean {
  return !!role && ADMIN_ROLES.includes(role as UserRole) && role !== "customer";
}

export const useAuthStore = create<AuthState>((set, get) => ({
  firebaseUser: null,
  profile: null,
  loading: true,
  initialized: false,

  setProfile: (profile) => set({ profile }),

  setSession: (user, profile) =>
    set({ firebaseUser: user, profile, loading: false }),

  refreshProfile: async () => {
    const uid = get().firebaseUser?.uid;
    if (!uid) {
      set({ profile: null, loading: false });
      return null;
    }
    set({ loading: true });
    const profile = await getUserProfile(uid);
    set({ profile, loading: false });
    return profile;
  },

  canAccessAdmin: () => {
    const { profile, firebaseUser } = get();
    return !!firebaseUser && isAdminRole(profile?.role);
  },

  can: (permission) => userHasPermission(get().profile, permission),

  init: () => {
    if (get().initialized) return () => {};
    set({ initialized: true, loading: true });

    // Try to load cached profile immediately for faster UI
    try {
      const cachedProfile = localStorage.getItem('auth_profile_cache');
      if (cachedProfile) {
        const profile = JSON.parse(cachedProfile);
        set({ profile, loading: false });
      }
    } catch (e) {
      console.warn('[auth] Failed to load cached profile:', e);
    }

    // Safety timeout — if Firebase auth hasn't resolved in 8 seconds,
    // force loading to false so the UI doesn't hang forever.
    // This can happen when a stale service worker blocks network requests.
    const authTimeout = setTimeout(() => {
      if (get().loading) {
        console.warn("[auth] Firebase auth timed out — forcing loading: false");
        set({ loading: false });
      }
    }, 8000);

    const unsub = subscribeAuth(async (user) => {
      clearTimeout(authTimeout);
      if (!user) {
        set({ firebaseUser: null, profile: null, loading: false });
        localStorage.removeItem('auth_profile_cache');
        return;
      }
      set({ firebaseUser: user, loading: true });
      const profile = await getUserProfile(user.uid);
      set({ profile, loading: false });
      
      // Cache the profile for faster subsequent loads
      if (profile) {
        try {
          localStorage.setItem('auth_profile_cache', JSON.stringify(profile));
        } catch (e) {
          console.warn('[auth] Failed to cache profile:', e);
        }
      }
    });

    return () => {
      clearTimeout(authTimeout);
      unsub();
    };
  },

  logout: async () => {
    await logoutUser();
    set({ firebaseUser: null, profile: null, loading: false });
  },
}));
