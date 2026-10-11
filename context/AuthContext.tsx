import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured, ProfileRecord, supabaseUrl, supabaseAnonKey } from '../utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User, createClient } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type UserRole = 'admin' | 'hoa' | 'guard' | 'resident';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: ProfileRecord | null;
  role: UserRole;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string, role: UserRole) => Promise<{ error: Error | null }>;
  registerOfficer: (email: string, password: string, name: string, roleToSet: UserRole) => Promise<{ error: Error | null; user?: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  loginAsDemo: (role: UserRole) => Promise<void>;
  registerPushToken: () => Promise<string | null>;
  setDemoRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [role, setRole] = useState<UserRole>('admin');
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        // Strict role check: If user is registered as a resident and not an officer, revoke session
        const isOfficer = data.is_admin === true || data.role === 'admin' || data.role === 'hoa' || data.role === 'guard';
        if (data.role === 'resident' && !isOfficer) {
          console.warn('[AuthContext] Resident account detected in Admin app. Revoking session.');
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setProfile(null);
          return;
        }

        setProfile(data as ProfileRecord);
        const resolvedRole = (data.role === 'hoa' || data.role === 'guard') ? data.role : 'admin';
        setRole(resolvedRole as UserRole);
      } else {
        // Create profile row if it doesn't exist yet
        const defaultProfile: ProfileRecord = {
          id: userId,
          name: user?.user_metadata?.name || user?.email?.split('@')[0] || 'Monitoring Admin',
          role: 'admin',
          is_admin: true,
          email: user?.email,
          updated_at: new Date().toISOString(),
        };

        try {
          await supabase.from('profiles').upsert(defaultProfile, { onConflict: 'id' });
        } catch {
          // ignore
        }
        setProfile(defaultProfile);
        setRole('admin');
      }
    } catch (e) {
      console.warn('Failed to fetch profile:', e);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const savedDemo = await AsyncStorage.getItem('hfire_demo_user');
        if (savedDemo && mounted) {
          const parsed = JSON.parse(savedDemo);
          setProfile(parsed);
          setRole(parsed.role || 'admin');
        }

        if (isSupabaseConfigured) {
          const { data: { session: initialSession } } = await supabase.auth.getSession();
          if (mounted && initialSession) {
            setSession(initialSession);
            setUser(initialSession.user);
            await fetchProfile(initialSession.user.id);
          }
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    initAuth();

    if (isSupabaseConfigured) {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
        if (mounted) {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          if (currentSession?.user) {
            await fetchProfile(currentSession.user.id);
          }
          setIsLoading(false);
        }
      });

      return () => {
        mounted = false;
        authListener?.subscription.unsubscribe();
      };
    }

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error };

      if (data.user) {
        // Query profile to verify user role
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        const isOfficer = profileData && (
          profileData.is_admin === true || 
          profileData.role === 'admin' || 
          profileData.role === 'hoa' || 
          profileData.role === 'guard'
        );

        // Strict role check: Block resident accounts
        if (profileData && profileData.role === 'resident' && !isOfficer) {
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setProfile(null);
          return {
            error: new Error(
              'Access Denied: Resident accounts cannot access the H-Fire Admin Command Center. Please use the H-Fire Resident Mobile App.'
            ),
          };
        }

        if (profileData) {
          setProfile(profileData as ProfileRecord);
          const resolvedRole = (profileData.role === 'hoa' || profileData.role === 'guard') ? profileData.role : 'admin';
          setRole(resolvedRole as UserRole);
        } else {
          await fetchProfile(data.user.id);
        }

        await registerPushToken();
      }
      return { error: null };
    } catch (err: any) {
      return { error: err };
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string, roleToSet: UserRole) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, role: roleToSet },
        },
      });

      if (error) return { error };

      if (data.user) {
        const newProfile: ProfileRecord = {
          id: data.user.id,
          name,
          role: roleToSet,
          is_admin: true,
          email,
          updated_at: new Date().toISOString(),
        };
        try {
          await supabase.from('profiles').upsert(newProfile, { onConflict: 'id' });
        } catch {
          // ignore
        }
        setProfile(newProfile);
        setRole(roleToSet);
      }
      return { error: null };
    } catch (err: any) {
      return { error: err };
    } finally {
      setIsLoading(false);
    }
  };

  const registerOfficer = async (email: string, password: string, name: string, roleToSet: UserRole) => {
    if (role !== 'admin') {
      return { error: new Error('Unauthorized: Only Administrators have permission to register officers.') };
    }

    try {
      if (!isSupabaseConfigured) {
        // Local mock / demo registration mode
        const mockUser = {
          id: `officer-${Date.now()}`,
          name,
          email,
          role: roleToSet,
        };
        return { error: null, user: mockUser };
      }

      // Use isolated secondary Supabase client so the logged-in Chief Admin is NOT logged out!
      const isolatedAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      const { data: authData, error: authError } = await isolatedAuthClient.auth.signUp({
        email,
        password,
        options: {
          data: { name, role: roleToSet },
        },
      });

      if (authError) return { error: authError };

      if (authData.user) {
        const newProfile: ProfileRecord = {
          id: authData.user.id,
          name,
          role: roleToSet,
          is_admin: true,
          email,
          updated_at: new Date().toISOString(),
        };
        try {
          await supabase.from('profiles').upsert(newProfile, { onConflict: 'id' });
        } catch (e) {
          console.warn('Could not auto-upsert new officer profile:', e);
        }
      }

      return { error: null, user: authData.user };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await AsyncStorage.removeItem('hfire_demo_user');
      if (isSupabaseConfigured) {
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore
        }
      }
      setSession(null);
      setUser(null);
      setProfile(null);
      setRole('admin');
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error };
  };

  const loginAsDemo = async (roleToUse: UserRole) => {
    setIsLoading(true);
    const roleNames: Record<UserRole, string> = {
      admin: 'Chief Monitoring Officer (Admin)',
      hoa: 'HOA President / Director',
      guard: 'Main Gate Security Officer',
      resident: 'Community Household Resident',
    };

    const demoProfile: ProfileRecord = {
      id: `demo-${roleToUse}-user`,
      name: roleNames[roleToUse],
      role: roleToUse,
      is_admin: true,
      email: `${roleToUse}@hfire.community.local`,
    };

    await AsyncStorage.setItem('hfire_demo_user', JSON.stringify(demoProfile));
    setProfile(demoProfile);
    setRole(roleToUse);
    setIsLoading(false);
  };

  const setDemoRole = (newRole: UserRole) => {
    setRole(newRole);
    if (profile) {
      const updated = { ...profile, role: newRole };
      setProfile(updated);
      AsyncStorage.setItem('hfire_demo_user', JSON.stringify(updated)).catch(() => {});
    }
  };

  const registerPushToken = async (): Promise<string | null> => {
    if (Platform.OS === 'web') return null;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') return null;

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId || process.env.EXPO_PUBLIC_PROJECT_ID || '634392a5-65a6-4b1b-af6c-41c3d7ecea78',
      }).catch((err) => {
        console.warn('Push token retrieval error:', err);
        return null;
      });

      const pushToken = tokenData?.data;

      if (pushToken && isSupabaseConfigured) {
        const targetId = user?.id || profile?.id;
        if (targetId) {
          try {
            await supabase
              .from('profiles')
              .update({ push_token: pushToken, updated_at: new Date().toISOString() })
              .eq('id', targetId);

            await supabase
              .from('user_push_tokens')
              .upsert({ profile_id: targetId, token: pushToken }, { onConflict: 'token' });
          } catch {
            // ignore
          }
        }
      }

      return pushToken || null;
    } catch (e) {
      console.warn('Could not register push token:', e);
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        role,
        isLoading,
        isConfigured: isSupabaseConfigured,
        signIn,
        signUp,
        registerOfficer,
        signOut,
        resetPassword,
        loginAsDemo,
        registerPushToken,
        setDemoRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
