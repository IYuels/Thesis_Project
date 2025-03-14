// src/components/notification/NotificationBadge.tsx
import React from 'react';
import { useNotifications } from '@/context/notificationContext';
import { BellIcon } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface NotificationBadgeProps {
  onClick?: () => void;
  showCount?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({ 
  onClick, 
  showCount = true,
  size = 'md'
}) => {
  const { unreadCount } = useNotifications();
  
  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };
  
  const buttonSizes = {
    sm: 'p-1',
    md: 'p-2',
    lg: 'p-3'
  };
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className={`relative ${buttonSizes[size]}`}
            onClick={onClick}
          >
            <BellIcon className={iconSizes[size]} />
            {showCount && unreadCount > 0 && (
              <Badge 
                className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-red-500 text-white text-xs"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{unreadCount > 0 ? `${unreadCount} unread notifications` : 'No new notifications'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default NotificationBadge;