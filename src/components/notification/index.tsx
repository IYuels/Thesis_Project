import * as React from 'react';
import { useUserAuth } from '@/context/userAuthContext';import 
{ Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { BellIcon, MessageCircleMore, ThumbsUpIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { NotificationType, Notification } from '@/types';
import { getUserNotifications, markNotificationAsRead } from '@/repository/notification.service';
import { formatDistanceToNow } from 'date-fns';
import avatar from "@/assets/images/avatar.png"; // Import default avatar as you do in PostCard

const NotificationTab: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { user } = useUserAuth();
  const notificationRef = React.useRef<HTMLDivElement>(null);

  // Close notification panel when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch notifications when user is available or tab is opened
  React.useEffect(() => {
    if (user && isOpen) {
      fetchNotifications();
    }
  }, [user, isOpen]);

  const fetchNotifications = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      console.log("Fetching notifications for user:", user.uid);
      const fetchedNotifications = await getUserNotifications(user.uid);
      console.log("Fetched notifications:", fetchedNotifications);
      setNotifications(fetchedNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
};

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, read: true } 
            : notification
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const promises = notifications
        .filter(notification => !notification.read && notification.id) // Add check for id
        .map(notification => markNotificationAsRead(notification.id!)); // Use non-null assertion
      
      await Promise.all(promises);
      
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, read: true }))
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const renderNotificationContent = (notification: Notification) => {
    switch (notification.type) {
      case NotificationType.LIKE:
        return (
          <div className="flex items-start">
            <div className="bg-blue-50 p-2 rounded-full mr-3">
              <ThumbsUpIcon className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <span className="font-medium">{notification.senderName}</span>
              <span className="text-gray-600"> liked your post</span>
              {notification.postContent && (
                <p className="text-sm text-gray-500 mt-1 italic">"{notification.postContent}"</p>
              )}
            </div>
          </div>
        );
        
      case NotificationType.COMMENT:
        return (
          <div className="flex items-start">
            <div className="bg-green-50 p-2 rounded-full mr-3">
              <MessageCircleMore className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <span className="font-medium">{notification.senderName}</span>
              <span className="text-gray-600"> commented on your post</span>
              {notification.commentContent && (
                <p className="text-sm text-gray-500 mt-1 italic">"{notification.commentContent}"</p>
              )}
            </div>
          </div>
        );
        
      default:
        return (
          <div className="flex items-start">
            <div className="bg-gray-100 p-2 rounded-full mr-3">
              <BellIcon className="h-4 w-4 text-gray-500" />
            </div>
            <div>
              <span className="text-gray-600">You have a new notification</span>
            </div>
          </div>
        );
    }
  };
  
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (user) {
        fetchNotifications();
      }
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [user]);

  return (
    <div className="relative" ref={notificationRef}>
      <Button 
        variant="ghost" 
        size="sm" 
        className="relative p-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>
      
      {isOpen && (
        <Card className="absolute right-0 mt-2 w-80 sm:w-96 z-50 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Notifications</CardTitle>
              {unreadCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-xs"
                  onClick={handleMarkAllAsRead}
                >
                  Mark all as read
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="py-4 text-center text-gray-500">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="py-4 text-center text-gray-500">No notifications yet</div>
            ) : (
              <div className="space-y-3">
                {notifications.map(notification => (
                  <div 
                    key={notification.id} 
                    className={`p-3 rounded-lg ${notification.read ? 'bg-white' : 'bg-blue-50'}`}
                    onClick={() => !notification.read && handleMarkAsRead(notification.id!)}
                  >
                    <div className="flex items-center mb-2">
                      {/* Using img tag with fallback pattern from your PostCard component */}
                      <div className="mr-2">
                        <img 
                          src={notification.senderPhoto || avatar}
                          className="w-8 h-8 rounded-full border-2 border-transparent object-cover"
                          alt={`${notification.senderName}'s profile`}
                        />
                      </div>
                      {renderNotificationContent(notification)}
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
                      <span>{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}</span>
                      {!notification.read && (
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer">
                          New
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NotificationTab;