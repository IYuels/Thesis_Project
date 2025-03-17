// src/repository/notification.service.ts
import { addDoc, collection, query, where, getDocs, updateDoc, orderBy, Timestamp, deleteDoc, limit, doc } from 'firebase/firestore';
import { Notification, NotificationType } from '@/types';
import { db } from '@/firebaseConfig';

// Create a notification
export const createNotification = async (notification: Notification): Promise<string> => {
  try {
    // Check if a similar notification already exists to prevent duplicates
    // (e.g., same user liking the same post multiple times)
    if (notification.type === NotificationType.LIKE) {
      const existingNotifications = await checkForExistingNotification(notification);
      if (existingNotifications[0].id) {
        // Update the existing notification's timestamp instead of creating a new one
        const existingNotificationId = existingNotifications[0].id;
        const notificationRef = doc(db, 'notifications', existingNotificationId);
        await updateDoc(notificationRef, {
          createdAt: Timestamp.now(),
          read: false // Mark as unread again
        });
        return existingNotificationId;
      }
    }
    
    // Create a new notification
    const notificationRef = collection(db, 'notifications');
    const docRef = await addDoc(notificationRef, {
      ...notification,
      createdAt: Timestamp.now(),
      read: false
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Helper function to check for existing similar notifications
const checkForExistingNotification = async (notification: Notification): Promise<Notification[]> => {
  try {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('recipientId', '==', notification.recipientId),
      where('senderId', '==', notification.senderId),
      where('type', '==', notification.type),
      where('postId', '==', notification.postId)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Notification[];
  } catch (error) {
    console.error('Error checking for existing notifications:', error);
    return [];
  }
};

// Get all notifications for a user
export const getUserNotifications = async (userId: string, limitCount = 20): Promise<Notification[]> => {
  try {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('recipientId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() // Convert Firestore timestamp to JavaScript Date
      };
    }) as Notification[];
  } catch (error) {
    console.error('Error getting notifications:', error);
    return [];
  }
};

// Get unread notifications count
export const getUnreadNotificationsCount = async (userId: string): Promise<number> => {
  try {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('recipientId', '==', userId),
      where('read', '==', false)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error('Error getting unread notifications count:', error);
    return 0;
  }
};

// Mark notification as read
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, {
      read: true
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
  try {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('recipientId', '==', userId),
      where('read', '==', false)
    );
    
    const querySnapshot = await getDocs(q);
    const updatePromises = querySnapshot.docs.map(doc => 
      updateDoc(doc.ref, { read: true })
    );
    
    await Promise.all(updatePromises);
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

// Delete a notification
export const deleteNotification = async (notificationId: string): Promise<void> => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await deleteDoc(notificationRef);
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

// Clear all notifications for a user
export const clearAllNotifications = async (userId: string): Promise<void> => {
  try {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('recipientId', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    const deletePromises = querySnapshot.docs.map(doc => 
      deleteDoc(doc.ref)
    );
    
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error clearing all notifications:', error);
    throw error;
  }
};
export const getNotifications = getUserNotifications;