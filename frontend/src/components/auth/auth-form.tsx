import { useState } from 'react';
import { useAuth } from '../../features/admin/hooks/use-auth';

export function AuthForm() {
    const { login, register } = useAuth();
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        try {
            if (isRegister) {
                await register(email, password, name);
            } else {
                await login(email, password);
            }
        } catch (err: any) {
            setError(err?.message || (isRegister ? 'Registration failed' : 'Login failed'));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="w-full space-y-4">
            {isRegister && (
                <div>
                    <label htmlFor="name" className="block text-sm font-medium mb-1.5">
                        Name
                    </label>
                    <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                        className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Your name"
                    />
                </div>
            )}

            <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                    Email
                </label>
                <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="you@example.com"
                />
            </div>

            <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1.5">
                    Password
                </label>
                <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={isRegister ? 'Min 8 characters' : 'Your password'}
                />
            </div>

            {error && (
                <p className="text-sm text-destructive">{error}</p>
            )}

            <button
                type="submit"
                disabled={submitting}
                className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
                {submitting
                    ? (isRegister ? 'Creating account...' : 'Signing in...')
                    : (isRegister ? 'Create Account' : 'Sign In')
                }
            </button>

            <p className="text-center text-sm text-muted-foreground">
                {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                    type="button"
                    onClick={() => { setIsRegister(!isRegister); setError(''); }}
                    className="text-primary hover:underline font-medium"
                >
                    {isRegister ? 'Sign in' : 'Create one'}
                </button>
            </p>
        </form>
    );
}
