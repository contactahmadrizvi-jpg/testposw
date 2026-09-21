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
  authReady: boolean;
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
  authReady: false,
  initialized: false,

  setProfile: (profile) => {
    if (profile && typeof window !== "undefined") {
      try {
        localStorage.setItem("auth_profile_cache", JSON.stringify(profile));
      } catch {}
    }
    set({ profile });
  },

  setSession: (user, profile) => {
    if (profile && typeof window !== "undefined") {
      try {
        localStorage.setItem("auth_profile_cache", JSON.stringify(profile));
      } catch {}
    }
    set({ firebaseUser: user, profile, loading: false, authReady: true });
  },

  refreshProfile: async () => {
    const uid = get().firebaseUser?.uid;
    if (!uid) {
      set({ profile: null, loading: false });
      return null;
    }
    set({ loading: true });
    const profile = await getUserProfile(uid);
    if (profile && typeof window !== "undefined") {
      try {
        localStorage.setItem("auth_profile_cache", JSON.stringify(profile));
      } catch {}
    }
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
    set({ initialized: true });

    // Read cached profile immediately for fast UI availability
    let cachedProfile: AppUser | null = null;
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("auth_profile_cache");
        if (raw) {
          cachedProfile = JSON.parse(raw) as AppUser;
          if (cachedProfile && cachedProfile.id) {
            set({ profile: cachedProfile });
          }
        }
      } catch (e) {
        console.warn("[auth] Failed to parse cached profile:", e);
      }
    }

    // Safety timeout — if Firebase auth hasn't resolved in 6 seconds,
    // force authReady and loading: false so the UI doesn't hang forever.
    const authTimeout = setTimeout(() => {
      if (!get().authReady) {
        console.warn("[auth] Firebase auth timed out — forcing authReady: true");
        set({ authReady: true, loading: false });
      }
    }, 6000);

    const unsub = subscribeAuth(async (user) => {
      clearTimeout(authTimeout);
      if (!user) {
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem("auth_profile_cache");
          } catch {}
        }
        set({ firebaseUser: null, profile: null, loading: false, authReady: true });
        return;
      }

      // Confirmed Firebase authenticated user!
      const currentProfile = get().profile;
      set({
        firebaseUser: user,
        authReady: true,
        // If we already have a profile from local cache, stop loading immediately
        loading: !currentProfile,
      });

      // Now fetch fresh profile from Firestore to ensure permissions/status are fresh
      try {
        const freshProfile = await getUserProfile(user.uid);
        if (freshProfile) {
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("auth_profile_cache", JSON.stringify(freshProfile));
            } catch {}
          }
          set({ profile: freshProfile, loading: false });
        } else {
          set({ loading: false });
        }
      } catch (err) {
        console.warn("[auth] Error fetching Firestore profile:", err);
        set({ loading: false });
      }
    });

    return () => {
      clearTimeout(authTimeout);
      unsub();
    };
  },

  logout: async () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("auth_profile_cache");
      } catch {}
    }
    await logoutUser();
    set({ firebaseUser: null, profile: null, loading: false, authReady: true });
  },
}));
