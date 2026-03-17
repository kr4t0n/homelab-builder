import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { toast } from "sonner";

interface User {
    id: string;
    name: string;
    email: string;
    is_admin?: boolean;
    preferences?: Record<string, any>;
}

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    async function checkAuth() {
        try {
            const token = localStorage.getItem('auth_token');
            if (token) {
                const user = await api.get<User>('/auth/me');
                setUser(user);
            }
        } catch (error) {
            console.error("Auth check failed", error);
            localStorage.removeItem('auth_token');
        } finally {
            setLoading(false);
        }
    }

    async function login(email: string, password: string) {
        setLoading(true);
        try {
            const data = await api.login(email, password);
            localStorage.setItem('auth_token', data.token);
            setUser(data.user);
            window.location.reload();
        } catch (error: any) {
            console.error("Login failed", error);
            toast.error(error?.message || "Login failed. Please try again.");
            throw error;
        } finally {
            setLoading(false);
        }
    }

    async function register(email: string, password: string, name: string) {
        setLoading(true);
        try {
            const data = await api.register(email, password, name);
            localStorage.setItem('auth_token', data.token);
            setUser(data.user);
            window.location.reload();
        } catch (error: any) {
            console.error("Registration failed", error);
            toast.error(error?.message || "Registration failed. Please try again.");
            throw error;
        } finally {
            setLoading(false);
        }
    }

    async function updatePreferences(prefs: Record<string, any>) {
        if (!user) return;
        try {
            const updatedUser = await api.put<User>('/auth/preferences', { preferences: prefs });
            setUser(updatedUser);
            return updatedUser;
        } catch (error) {
            console.error("Failed to update preferences", error);
        }
    }

    return {
        user,
        loading,
        login,
        register,
        updatePreferences,
        logout: () => {
             localStorage.removeItem('auth_token');
             setUser(null);
             window.location.reload();
        }
    };
}
