// services/authService.ts
import { supabase } from './supabaseClient';
import type { User, UserProfile, Template, AIProvider, AIModel } from '../types';
import type { Session } from '@supabase/supabase-js';

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
        if (error) {
            throw error;
        }
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
        return supabase.auth.onAuthStateChange(callback);
    },

    getProfile: async (userId: string): Promise<UserProfile | null> => {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (error) {
            console.error("Error fetching user profile:", error);
            throw new Error(`Kullanıcı profili yüklenemedi: ${error.message}`);
        }

        if (!data) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: newProfile, error: insertError } = await supabase
                    .from('user_profiles')
                    .insert({
                        id: userId,
                        email: user.email,
                        full_name: user.email?.split('@')[0] || 'User',
                        ai_provider: 'openai',
                        ai_model: 'gpt-4-turbo'
                    })
                    .select()
                    .single();

                if (insertError) {
                    throw new Error(`Kullanıcı profili oluşturulamadı: ${insertError.message}`);
                }
                return newProfile as UserProfile;
            }
            throw new Error("Kullanıcı profiliniz bulunamadı.");
        }

        return data as UserProfile;
    },
    
    fetchTemplates: async (userId: string): Promise<Template[]> => {
        const { data, error } = await supabase
            .from('templates')
            .select('*')
            .or(`user_id.eq.${userId},is_system_template.eq.true`);

        if (error) {
            console.error("Error fetching templates:", error);
            throw new Error(`Şablonlar yüklenemedi: ${error.message}`);
        }
        return data as Template[];
    },

    updateModelPreference: async (userId: string, provider: AIProvider, model: AIModel): Promise<void> => {
        const { error } = await supabase
            .from('user_profiles')
            .update({ ai_provider: provider, ai_model: model, updated_at: new Date().toISOString() })
            .eq('id', userId);

        if (error) {
            throw new Error(`Model tercihi güncellenemedi: ${error.message}`);
        }
    },

    loginWithTestUser: async (): Promise<User> => {
        const testUserEmail = localStorage.getItem('devTestUserEmail') || 'gurkangurbuz@hotmail.com.tr';
        const testUserPassword = localStorage.getItem('devTestUserPassword') || '12345678';
        
        try {
            // First, try to log in. This is the fastest path if the user exists and password is correct.
            return await authService.login(testUserEmail, testUserPassword);
        } catch (loginError) {
            // If login fails, it could be a wrong password or a non-existent user.
            // We attempt to sign up to create the user if they don't exist.
            console.warn("Test user login failed, attempting to sign up the user.", loginError);
            
            try {
                const { error: signupError } = await supabase.auth.signUp({
                    email: testUserEmail,
                    password: testUserPassword,
                });

                if (signupError) {
                    // If signup fails because the user already exists, it confirms our initial login failed due to a wrong password.
                    if (signupError.message && signupError.message.includes('User already registered')) {
                        throw new Error(`Test kullanıcısı girişi başarısız. Geliştirici Panelinde belirtilen şifre yanlış görünüyor. Lütfen şifreyi kontrol edin.`);
                    }
                    if (signupError.message && signupError.message.toLowerCase().includes('invalid email')) {
                         throw new Error(`'${testUserEmail}' e-postası geçersiz. Lütfen Geliştirici Panelinden farklı bir e-posta ayarlayın.`);
                    }
                    // For any other signup error, re-throw it.
                    throw signupError;
                }

                // If signup succeeds, we must now log in to get a session.
                console.log("Test user created successfully. Logging in...");
                return await authService.login(testUserEmail, testUserPassword);

            } catch (finalError) {
                // Re-throw the refined error from the inner try-catch block for the UI to display.
                throw finalError;
            }
        }
    }
};