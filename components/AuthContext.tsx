
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, getUserSettings } from '../services/firebase';
import { ClickUpConfig } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userSettings: ClickUpConfig | null;
  setUserSettings: (settings: ClickUpConfig | null) => void;
  refreshSettings: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userSettings, setUserSettings] = useState<ClickUpConfig | null>(null);

  const fetchSettings = async (uid: string) => {
    try {
      const settings = await getUserSettings(uid);
      if (settings) {
        setUserSettings(settings as ClickUpConfig);
      } else {
        setUserSettings(null);
      }
    } catch (error) {
      console.error("Error fetching user settings", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        await fetchSettings(user.uid);
      } else {
        setUserSettings(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshSettings = async () => {
    if (user) {
      await fetchSettings(user.uid);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, userSettings, setUserSettings, refreshSettings }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
