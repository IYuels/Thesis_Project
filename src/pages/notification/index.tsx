import * as React from 'react';
import { useState, useEffect } from 'react';
import { X, MessageCircleIcon, ThumbsUpIcon} from 'lucide-react';
import { useUserAuth } from '@/context/userAuthContext';
import { Notification, NotificationType } from '@/types';
import { subscribeToNotifications, markNotificationAsRead } from '@/repository/notification.service';
import { subscribeToUserProfile } from '@/repository/user.service';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import avatar from "@/assets/images/avatar.png";

interface NotificationToastProps {
  className?: string;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ className }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(true); // Always open when shown from sidebar
  const [expanded] = useState(false); // New state for expanded view
  const { user } = useUserAuth();
  const navigate = useNavigate();
  const notificationRef = React.useRef<HTMLDivElement>(null);
  
  // Track profile updates
  const [profileUpdates, setProfileUpdates] = useState<Record<string, {
    displayName: string;
    photoURL: string;
  }>>({});

  useEffect(() => {
    let unsubscribe: () => void;
    
    if (user) {
      unsubscribe = subscribeToNotifications(user.uid, (notificationsData) => {
        const notifs = notificationsData as Notification[];
        setNotifications(notifs);
        setUnreadCount(notifs.filter(n => !n.read).length);
      });
    }
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);

  // Subscribe to profile updates for each notification sender
  useEffect(() => {
    const unsubscribes: (() => void)[] = [];
    
    // Get unique sender IDs from notifications
    const senderIds = [...new Set(notifications.map(notification => notification.senderId))];
    
    // Subscribe to profile updates for each sender
    senderIds.forEach(senderId => {
      if (!senderId) return;
      
      const unsubscribe = subscribeToUserProfile(senderId, (profileData) => {
        if (profileData && Object.keys(profileData).length > 0) {
          setProfileUpdates(prev => ({
            ...prev,
            [senderId]: {
              displayName: profileData.displayName || 'Unknown User',
              photoURL: profileData.photoURL || ''
            }
          }));
        }
      });
      
      unsubscribes.push(unsubscribe);
    });
    
    // Clean up subscriptions when component unmounts or notifications change
    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [notifications]);

  const handleNotificationClick = async (notification: Notification) => {
    if (notification.id && !notification.read) {
      await markNotificationAsRead(notification.id);
      
      // Update the local state
      setNotifications(prevNotifications => 
        prevNotifications.map(n => 
          n.id === notification.id ? { ...n, read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    
    // Navigate to the post but keep the toast open
    navigate(`/post/${notification.postId}`);
    // Removed: setIsOpen(false);
  };

  const markAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.read);
    
    if (unreadNotifications.length === 0) return;
    
    try {
      const promises = unreadNotifications
        .filter(n => n.id)
        .map(n => markNotificationAsRead(n.id!));
      
      await Promise.all(promises);
      
      // Update the local state
      setNotifications(prevNotifications => 
        prevNotifications.map(n => ({ ...n, read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    }
  };

  const renderNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case NotificationType.LIKE:
        return <ThumbsUpIcon className="h-4 w-4 mr-2 text-blue-500" />;
      case NotificationType.COMMENT:
        return <MessageCircleIcon className="h-4 w-4 mr-2 text-green-500" />;
      default:
        return null;
    }
  };

  const formatTimeAgo = (date: Date | { toDate: () => Date } | undefined | null) => {
    if (!date) return '';
    
    let dateObj: Date;
    
    if (typeof date === 'object' && date !== null && 'toDate' in date) {
      dateObj = date.toDate();
    } else if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string') {
      dateObj = new Date(date);
    } else {
      return '';
    }
    
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    return dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Sort notifications by date
  const sortedNotifications = [...notifications].sort((a, b) => {
    const dateA = a.createdAt instanceof Date 
      ? a.createdAt 
      : (a.createdAt && typeof a.createdAt === 'object' && 'toDate' in a.createdAt)
        ? a.createdAt.toDate()
        : new Date(0);
        
    const dateB = b.createdAt instanceof Date 
      ? b.createdAt 
      : (b.createdAt && typeof b.createdAt === 'object' && 'toDate' in b.createdAt)
        ? b.createdAt.toDate()
        : new Date(0);
        
    return dateB.getTime() - dateA.getTime();
  });

  const displayNotifications = expanded ? sortedNotifications : sortedNotifications.slice(0, 10);

  return (
    <div className={cn("relative h-full", className)} ref={notificationRef}>
      {isOpen && (
        <div className="w-80 sm:w-96 bg-white rounded-lg shadow-xl z-50 flex flex-col h-screen max-h-screen border border-gray-200">
          <div className="p-3 border-b flex items-center justify-between bg-gray-50">
            <h3 className="font-semibold text-gray-800">Notifications</h3>
            <div className="flex space-x-2">
              {unreadCount > 0 && (
                <button 
                  className="text-xs text-blue-600 hover:text-blue-800"
                  onClick={markAllAsRead}
                >
                  Mark all as read
                </button>
              )}
              <button 
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          <div className="flex-grow overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No notifications yet
              </div>
            ) : (
              displayNotifications.map((notification) => {
                // Get updated profile information if available
                const updatedProfile = notification.senderId && profileUpdates[notification.senderId];
                const displayName = updatedProfile ? updatedProfile.displayName : notification.senderName;
                const photoURL = updatedProfile ? updatedProfile.photoURL : notification.senderPhoto;
                
                return (
                  <div 
                    key={notification.id} 
                    className={`flex items-start p-3 border-b cursor-pointer transition-colors ${notification.read ? 'bg-white' : 'bg-blue-50'} hover:bg-gray-50`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex-shrink-0 mr-3">
                      <img 
                        src={photoURL ? photoURL : avatar} // Fallback to default avatar if no photoURL
                        alt={displayName}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-start">
                        <div className="flex items-center">
                          {renderNotificationIcon(notification.type)}
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm">
                            <span className="font-semibold">{displayName}</span>
                            {notification.type === NotificationType.LIKE
                              ? ' liked your post'
                              : ' commented on your post'}
                          </p>
                          <p className="text-xs text-gray-600 mt-1 line-clamp-1">
                            {notification.postContent}
                          </p>
                          <div className="flex items-center mt-1 text-xs text-gray-500">
                            {formatTimeAgo(notification.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                    {!notification.read && (
                      <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationToast;