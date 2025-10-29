// services/authService.ts
import { supabase } from './supabaseClient';
import type { User } from '../types';
import type { Session } from '@supabase/supabase-js';

const TEST_USER_EMAIL = 'test@example.com';
const TEST_USER_PASSWORD = 'password123';

export const authService = {
    signup: async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });
        if (error) throw error;
        return data;
    },

    login: async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        return data.user as User;
    },

    logout: async (): Promise<void> => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    getCurrentUser: async (): Promise<User | null> => {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    },

    getSession: async (): Promise<Session | null> => {
        const { data: { session } } = await supabase.auth.getSession();
        return session;
    },
    
    onAuthStateChange: (callback: (event: string, session: Session | null) => void) => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
        return subscription;
    },

    loginWithTestUser: async (): Promise<User> => {
        try {
            // First, try to log in
            return await authService.login(TEST_USER_EMAIL, TEST_USER_PASSWORD);
        } catch (error) {
            // If login fails (likely because the user doesn't exist), try to sign up
            console.warn("Test user login failed, attempting to create test user.", error);
            try {
                const { data, error: signupError } = await supabase.auth.signUp({
                    email: TEST_USER_EMAIL,
                    password: TEST_USER_PASSWORD,
                });

                if (signupError) throw signupError;
                
                if (data.user) {
                    // Supabase now automatically signs in the user upon successful signup
                    return data.user as User;
                }
                
                throw new Error("Could not log in or create the test user account. Please check your Supabase instance rules.");

            } catch (signupError) {
                 // If signup fails because user already exists, it means the password was wrong on the first attempt
                if (signupError instanceof Error && signupError.message.includes('User already registered')) {
                     throw new Error("Geçersiz e-posta veya şifre.");
                }
                throw signupError;
            }
        }
    }
};