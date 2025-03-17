import { collection, addDoc, query, where, getDocs, updateDoc, doc, orderBy, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { Notification } from '@/types';
import { db } from '@/firebaseConfig';

export const createNotification = async (data: Notification) => {
  try {
    // Validate essential fields
    if (!data.senderId || !data.recipientId || !data.type) {
      throw new Error('Missing required notification fields');
    }
    
    const notificationRef = collection(db, 'notifications');
    await addDoc(notificationRef, {
      ...data,
      createdAt: serverTimestamp(),
      read: false,
    });
    console.log('Notification created successfully');
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};
// Get notifications for a specific user
export const getNotifications = async (userId: string): Promise<Notification[]> => {
  try {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('recipientId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    // Execute the query to get querySnapshot
    const querySnapshot = await getDocs(q);
    
    // Use type assertion with more specific type
    const notificationsData = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data.type,
        senderId: data.senderId,
        senderName: data.senderName,
        senderPhoto: data.senderPhoto,
        recipientId: data.recipientId,
        postId: data.postId,
        postContent: data.postContent,
        commentContent: data.commentContent,
        createdAt: data.createdAt,
        read: data.read
      } as Notification;
    });
    
    return notificationsData;
  } catch (error) {
    console.error('Error getting notifications:', error);
    throw error;
  }
};
// Mark a notification as read
export const markNotificationAsRead = async (notificationId: string) => {
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

// Subscribe to notifications for real-time updates
export const subscribeToNotifications = (userId: string, callback: (notifications: any[]) => void) => {
  try {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('recipientId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const notifications = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(notifications);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Error subscribing to notifications:', error);
    throw error;
  }
};

// Get unread notification count
export const getUnreadNotificationCount = async (userId: string) => {
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
    console.error('Error getting unread notification count:', error);
    throw error;
  }
};