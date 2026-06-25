'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(() => Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;

    void (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      setIsLoading(false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, isLoading, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
