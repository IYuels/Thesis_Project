// src/context/notificationContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUserAuth } from './userAuthContext';
import { Notification } from '@/types';
import { collection, query, where, onSnapshot, orderBy, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';

interface NotificationContextProps {
  notifications: Notification[];
  unreadCount: number;
  markAllAsRead: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  refreshNotifications: () => void;
  isLoading: boolean;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useUserAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [unsubscribe, setUnsubscribe] = useState<(() => void) | null>(null);

  // Function to set up real-time listener for notifications
  const setupNotificationListener = () => {
    if (!user) return;

    setIsLoading(true);
    
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('recipientId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      const notificationData: Notification[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as Omit<Notification, 'id'>
      }));
      
      setNotifications(notificationData);
      setIsLoading(false);
    }, (error) => {
      console.error('Error listening to notifications:', error);
      setIsLoading(false);
    });
    
    setUnsubscribe(() => unsub);
  };

  // Set up listener when user changes
  useEffect(() => {
    // Clean up previous listener
    if (unsubscribe) {
      unsubscribe();
    }
    
    if (user) {
      setupNotificationListener();
    } else {
      setNotifications([]);
    }
    
    // Clean up on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Mark a notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        read: true
      });
      
      // Update local state
      setNotifications(prevNotifications => 
        prevNotifications.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!user) return;
    
    try {
      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef,
        where('recipientId', '==', user.uid),
        where('read', '==', false)
      );
      
      const querySnapshot = await getDocs(q);
      const updatePromises = querySnapshot.docs.map(doc => 
        updateDoc(doc.ref, { read: true })
      );
      
      await Promise.all(updatePromises);
      
      // Update local state
      setNotifications(prevNotifications => 
        prevNotifications.map(n => ({ ...n, read: true }))
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Function to manually refresh notifications
  const refreshNotifications = () => {
    if (unsubscribe) {
      unsubscribe();
    }
    setupNotificationListener();
  };

  // Context value
  const value = {
    notifications,
    unreadCount,
    markAllAsRead,
    markAsRead,
    refreshNotifications,
    isLoading
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;