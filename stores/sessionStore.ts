// stores/sessionStore.ts
// FIX: Changed import to be a named import, which is the correct way to import `create` from zustand.
import { create } from 'zustand';
import { supabase } from '../services/supabaseClient';
import type { User, UserProfile } from '../types';

// Debounce helper
const debounce = <F extends (...args: any[]) => any>(func: F, delay: number) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<F>): void => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
};

const saveProfileDebounced = debounce(async (profile: UserProfile) => {
    const { error } = await supabase.from('user_profiles').update({ tokens_used: profile.tokens_used }).eq('id', profile.id);
    if (error) console.error('Failed to update user profile:', error.message);
}, 2000);


interface SessionState {
  user: User | null;
  profile: UserProfile | null;
  onLogout: () => void;
  init: (user: User, profile: UserProfile | null, onLogout: () => void) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  commitTokenUsage: (tokens: number) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  profile: null,
  onLogout: () => {},
  init: (user, profile, onLogout) => set({ user, profile, onLogout }),
  setUserProfile: (profile) => set({ profile }),
  commitTokenUsage: (tokens) => {
    if (tokens <= 0) return;
    set(state => {
      if (!state.profile) return {};
      const updatedProfile = {
        ...state.profile,
        tokens_used: state.profile.tokens_used + tokens
      };
      saveProfileDebounced(updatedProfile);
      return { profile: updatedProfile };
    });
  },
}));