// src/components/notification/index.tsx
import * as React from 'react';
import { useNotifications } from '@/context/notificationContext';
import { NotificationType } from '@/types';
import { CheckIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { formatDistanceToNow } from 'date-fns';
import NotificationBadge from './notificationBadge';

const NotificationComponent: React.FC = () => {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead,
    refreshNotifications,
    isLoading 
  } = useNotifications();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = React.useState(false);

  // Handle opening the notification popover
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      refreshNotifications();
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notificationId: string, postId: string) => {
    // Mark as read
    await markAsRead(notificationId);
    
    // Navigate to the post
    navigate(`/post/${postId}`);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <div>
          <NotificationBadge/>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-medium">Notifications</h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={markAllAsRead}
              className="text-xs flex items-center"
            >
              <CheckIcon className="h-3 w-3 mr-1" /> Mark all as read
            </Button>
          )}
        </div>
        
        <div className="max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-gray-500">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">No notifications yet</div>
          ) : (
            <div>
              {notifications.map((notification) => (
                <div 
                  key={notification.id} 
                  className={`p-3 border-b hover:bg-gray-50 cursor-pointer ${!notification.read ? 'bg-blue-50' : ''}`}
                  onClick={() => notification.id && handleNotificationClick(notification.id, notification.postId)}
                >
                  <div className="flex items-start">
                    {/* User avatar */}
                    <div className="mr-3">
                      <img 
                        src={notification.senderPhoto || '/avatar.png'} 
                        alt={notification.senderName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    </div>
                    
                    {/* Notification content */}
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-sm">{notification.senderName}</span>
                        <span className="text-xs text-gray-500">
                          {notification.createdAt && formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true })}
                        </span>
                      </div>
                      
                      {/* Notification message based on type */}
                      <p className="text-sm">
                        {notification.type === NotificationType.LIKE ? (
                          <>liked your post: <span className="text-gray-500">{notification.postContent}</span></>
                        ) : notification.type === NotificationType.COMMENT ? (
                          <>commented on your post: <span className="text-gray-500">{notification.commentContent}</span></>
                        ) : (
                          'interacted with your content'
                        )}
                      </p>
                    </div>
                    
                    {/* Unread indicator */}
                    {!notification.read && (
                      <div className="ml-2 w-2 h-2 bg-blue-500 rounded-full"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer with refresh button */}
        <div className="p-2 border-t text-center">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={refreshNotifications}
            className="text-xs w-full"
          >
            Refresh
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationComponent;