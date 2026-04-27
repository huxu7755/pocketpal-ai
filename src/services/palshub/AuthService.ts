import {makeAutoObservable, runInAction} from 'mobx';
import {makePersistable} from 'mobx-persist-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {supabase} from './supabase';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  APP_URL,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from '@env';
import type {User, Session} from '@supabase/supabase-js';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';

export interface Profile {
  id: string;
  email?: string;
  full_name?: string;
  username?: string;
  avatar_url?: string;
  provider_user_id?: string;
  provider_profile_url?: string;
  provider: string;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

class AuthService {
  user: User | null = null;
  profile: Profile | null = null;
  session: Session | null = null;
  isLoading: boolean = false;
  isAuthenticated: boolean = false;
  error: string | null = null;

  constructor() {
    try {
      makeAutoObservable(this);
      makePersistable(this, {
        name: 'AuthService',
        properties: ['profile'], // Only persist profile, let Supabase handle session
        storage: AsyncStorage,
      });

      // Check if Supabase is properly configured
      if (this.isSupabaseConfigured()) {
        // Listen for auth state changes
        this.initAuthListener();
        // Configure Google Sign-In
        this.configureGoogleSignIn();
        // Check for existing session
        this.checkExistingSession().then(() => {});
      } else {
        this.isAuthenticated = false;
      }
    } catch (error) {
      throw error;
    }
  }

  private isSupabaseConfigured(): boolean {
    return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  }

  private initAuthListener() {
    if (!supabase) {
      return;
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      runInAction(() => {
        this.session = session;
        this.user = session?.user ?? null;
        this.isAuthenticated = !!session?.user;
        this.error = null;
      });

      if (event === 'SIGNED_IN' && session?.user) {
        await this.loadUserProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        runInAction(() => {
          this.profile = null;
        });
      }
    });
  }

  private async checkExistingSession() {
    if (!supabase) {
      return;
    }

    try {
      const {
        data: {session},
        error,
      } = await supabase.auth.getSession();

      if (error) {
        runInAction(() => {
          this.session = null;
          this.user = null;
          this.isAuthenticated = false;
          this.error = error.message;
        });
        return;
      }

      if (session) {
        runInAction(() => {
          this.session = session;
          this.user = session.user;
          this.isAuthenticated = true;
          this.error = null;
        });

        if (session.user) {
          await this.loadUserProfile(session.user.id);
        }
      } else {
        runInAction(() => {
          this.session = null;
          this.user = null;
          this.isAuthenticated = false;
          this.error = null;
        });
      }
    } catch (error) {
      runInAction(() => {
        this.session = null;
        this.user = null;
        this.isAuthenticated = false;
        this.error = 'Session check failed';
      });
    }
  }

  private async loadUserProfile(userId: string) {
    if (!supabase) {
      return;
    }

    try {
      const {data: profile, error} = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned
        return;
      }

      runInAction(() => {
        this.profile = profile;
      });
    } catch (error) {}
  }

  private configureGoogleSignIn() {
    try {
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        iosClientId: GOOGLE_IOS_CLIENT_ID,
        offlineAccess: false,
      });
    } catch (error) {}
  }

  async signInWithGoogle() {
    if (!this.isSupabaseConfigured()) {
      runInAction(() => {
        this.error = 'Authentication not configured';
      });
      return;
    }

    try {
      runInAction(() => {
        this.isLoading = true;
        this.error = null;
      });

      // Check if Google Play Services are available
      await GoogleSignin.hasPlayServices();

      // Check if user is already signed in
      try {
        const currentUser = GoogleSignin.getCurrentUser();
        if (currentUser) {
          await GoogleSignin.signOut();
        }
      } catch (error) {}

      // Sign in with Google
      const userInfo = await GoogleSignin.signIn();

      if (userInfo.data?.idToken) {
        // Use the ID token to sign in with Supabase (nonce disabled)
        const {data, error} = await supabase!.auth.signInWithIdToken({
          provider: 'google',
          token: userInfo.data.idToken,
        });

        if (error) {
          runInAction(() => {
            this.error = error.message;
          });
        }
      } else {
        runInAction(() => {
          this.error = 'No ID token received from Google';
        });
      }
    } catch (error: any) {
      let errorMessage = 'Failed to sign in with Google';

      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        errorMessage = 'Sign-in was cancelled';
      } else if (error.code === statusCodes.IN_PROGRESS) {
        errorMessage = 'Sign-in is already in progress';
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        errorMessage = 'Google Play Services not available';
      }

      runInAction(() => {
        this.error = errorMessage;
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  async signInWithEmail(email: string, password: string) {
    if (!this.isSupabaseConfigured()) {
      runInAction(() => {
        this.error = 'Authentication not configured';
      });
      return;
    }

    try {
      runInAction(() => {
        this.isLoading = true;
        this.error = null;
      });

      const {error} = await supabase!.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        runInAction(() => {
          this.error = error.message;
        });
      }
    } catch (error) {
      runInAction(() => {
        this.error = 'Failed to sign in with email';
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  async signUpWithEmail(email: string, password: string, fullName?: string) {
    if (!this.isSupabaseConfigured()) {
      runInAction(() => {
        this.error = 'Authentication not configured';
      });
      return;
    }

    try {
      runInAction(() => {
        this.isLoading = true;
        this.error = null;
      });

      const {error} = await supabase!.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        runInAction(() => {
          this.error = error.message;
        });
      }
    } catch (error) {
      runInAction(() => {
        this.error = 'Failed to sign up with email';
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  async signOut() {
    try {
      runInAction(() => {
        this.isLoading = true;
        this.error = null;
      });

      // Sign out from Supabase if configured
      if (supabase) {
        await supabase.auth.signOut();
      }

      // Also sign out from Google if user was signed in with Google
      try {
        await GoogleSignin.signOut();
      } catch (googleError) {
        // Don't fail the entire sign-out process if Google sign-out fails
      }
    } catch (error) {
      runInAction(() => {
        this.error = 'Failed to sign out';
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  async resetPassword(email: string) {
    if (!this.isSupabaseConfigured()) {
      runInAction(() => {
        this.error = 'Authentication not configured';
      });
      return;
    }

    try {
      runInAction(() => {
        this.isLoading = true;
        this.error = null;
      });

      const {error} = await supabase!.auth.resetPasswordForEmail(email, {
        redirectTo: `${APP_URL}/auth/reset-password`,
      });

      if (error) {
        runInAction(() => {
          this.error = error.message;
        });
      }
    } catch (error) {
      runInAction(() => {
        this.error = 'Failed to send password reset email';
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  async updateProfile(updates: Partial<Profile>) {
    if (!this.user) {
      runInAction(() => {
        this.error = 'User not authenticated';
      });
      return;
    }

    if (!this.isSupabaseConfigured()) {
      runInAction(() => {
        this.error = 'Authentication not configured';
      });
      return;
    }

    try {
      runInAction(() => {
        this.isLoading = true;
        this.error = null;
      });

      const {error} = await supabase!.from('profiles').upsert({
        id: this.user.id,
        ...updates,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        runInAction(() => {
          this.error = error.message;
        });
      } else {
        // Reload profile
        await this.loadUserProfile(this.user.id);
      }
    } catch (error) {
      runInAction(() => {
        this.error = 'Failed to update profile';
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  clearError() {
    runInAction(() => {
      this.error = null;
    });
  }

  get authState(): AuthState {
    return {
      user: this.user,
      profile: this.profile,
      session: this.session,
      isLoading: this.isLoading,
      isAuthenticated: this.isAuthenticated,
      error: this.error,
    };
  }
}

export const authService = new AuthService();
