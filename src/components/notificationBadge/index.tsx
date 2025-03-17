import * as React from 'react';
import { useState, useEffect } from 'react';
import { useUserAuth } from '@/context/userAuthContext';
import { subscribeToNotifications } from '@/repository/notification.service';

const NotificationBadge: React.FC = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useUserAuth();

  useEffect(() => {
    let unsubscribe: () => void;
    
    if (user) {
      unsubscribe = subscribeToNotifications(user.uid, (notificationsData) => {
        const unreadNotifications = notificationsData.filter(n => !n.read).length;
        setUnreadCount(unreadNotifications);
      });
    }
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);

  if (unreadCount === 0) return null;

  return (
    <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
      {unreadCount > 9 ? '9+' : unreadCount}
    </span>
  );
};

export default NotificationBadge;