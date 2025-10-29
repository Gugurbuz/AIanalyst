// services/authService.ts
// NOTE: This is a mock authentication service for demonstration purposes.
// It uses localStorage and stores passwords in plain text.
// DO NOT use this in a production environment.

import type { User } from '../types';

const USERS_KEY = 'ba_assistant_users';
const SESSION_KEY = 'ba_assistant_session';
const TEST_USER_EMAIL = 'test@example.com';
const TEST_USER_PASSWORD = 'password123';

const getUsers = (): User[] => {
    try {
        const users = localStorage.getItem(USERS_KEY);
        return users ? JSON.parse(users) : [];
    } catch (error) {
        console.error("Failed to parse users from localStorage", error);
        return [];
    }
};

const saveUsers = (users: User[]): void => {
    try {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch (error) {
        console.error("Failed to save users to localStorage", error);
    }
};

export const authService = {
    signup: async (email: string, password: string): Promise<User> => {
        return new Promise((resolve, reject) => {
            setTimeout(() => { // Simulate network delay
                const users = getUsers();
                const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

                if (existingUser) {
                    reject(new Error("Bu e-posta adresi zaten kullanılıyor."));
                    return;
                }

                const newUser: User = {
                    id: `user_${Date.now()}`,
                    email,
                    password // Storing plain text password - NOT FOR PRODUCTION
                };

                users.push(newUser);
                saveUsers(users);
                resolve(newUser);
            }, 500);
        });
    },

    login: async (email: string, password: string): Promise<User> => {
        return new Promise((resolve, reject) => {
            setTimeout(() => { // Simulate network delay
                const users = getUsers();
                const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

                if (!user || user.password !== password) {
                    reject(new Error("Geçersiz e-posta veya şifre."));
                    return;
                }
                
                // Set session
                try {
                   localStorage.setItem(SESSION_KEY, JSON.stringify(user));
                   resolve(user);
                } catch (error) {
                   reject(new Error("Oturum başlatılamadı."));
                }
            }, 500);
        });
    },

    logout: (): void => {
        try {
            localStorage.removeItem(SESSION_KEY);
        } catch (error) {
            console.error("Failed to remove session from localStorage", error);
        }
    },

    getCurrentUser: (): User | null => {
         try {
            const session = localStorage.getItem(SESSION_KEY);
            return session ? JSON.parse(session) : null;
        } catch (error) {
            console.error("Failed to parse session from localStorage", error);
            return null;
        }
    },

    getOrCreateTestUser: async (): Promise<User> => {
        return new Promise((resolve) => {
            setTimeout(() => { // Simulate async operation
                const users = getUsers();
                let testUser = users.find(u => u.email.toLowerCase() === TEST_USER_EMAIL);

                if (!testUser) {
                    // Create the user if it doesn't exist
                    testUser = {
                        id: `user_test_${Date.now()}`,
                        email: TEST_USER_EMAIL,
                        password: TEST_USER_PASSWORD
                    };
                    users.push(testUser);
                    saveUsers(users);
                }
                
                resolve(testUser);
            }, 100); // Shorter delay for this internal operation
        });
    },
};