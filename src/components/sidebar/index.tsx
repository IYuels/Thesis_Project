import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useUserAuth } from '@/context/userAuthContext';
import { BellIcon } from 'lucide-react';
import NotificationToast from '@/pages/notification';
import { subscribeToNotifications } from '@/repository/notification.service';

// SVG icons as components for optimization
const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    <polyline points="9 22 9 12 15 12 15 22"></polyline>
  </svg>
);

const ProfileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
    <polyline points="16 17 21 12 16 7"></polyline>
    <line x1="21" y1="12" x2="9" y2="12"></line>
  </svg>
);

interface ISidebarProps {
  onClose: () => void; // Method to close sidebar
}

const Sidebar: React.FunctionComponent<ISidebarProps> = ({ onClose }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { logout, user } = useUserAuth();
  const navigate = useNavigate();
  const notificationButtonRef = useRef<HTMLDivElement>(null);

  // Track window size
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initial check
    handleResize();
    
    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Get unread notification count
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

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      toast.success("Logged out successfully");
      
      // Close the sidebar if on mobile
      if (isMobile) onClose();
      
      // Redirect to login page
      navigate("/login");
    } catch (error: any) {
      console.error("Logout error:", error);
      toast.error("Logout failed", {
        description: error.message || "An error occurred during logout"
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const toggleNotifications = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowNotifications(!showNotifications);
  };

  const navItems = [
    {
      name: 'Home', 
      link: '/', 
      icon: HomeIcon,
      action: () => {
        if (isMobile) onClose();
        navigate('/');
      }
    },
    {
      name: 'Profile',
      link: '/profile', 
      icon: ProfileIcon,
      action: () => {
        if (isMobile) onClose();
        navigate('/profile');
      }
    },
    {
      name: 'Notifications',
      link: '#', 
      icon: BellIcon,
      action: toggleNotifications,
      ref: notificationButtonRef,
      badge: unreadCount > 0
    },
  ];

  return (
    <nav className="flex flex-col h-full bg-white">
      {/* Logo/App Name */}
      <div className='flex justify-center p-6 border-b border-gray-200'>
        <div className='text-gray-800 text-xl font-bold'>Thesis Project</div>
      </div>
      
      {/* Navigation Items */}
      <div className='flex flex-col flex-grow px-4 py-6 space-y-4'>
        {navItems.map((item) => (
          <div 
            className="relative"
            key={item.name}
            ref={item.name === 'Notifications' ? notificationButtonRef : null}
          >
            <button 
              onClick={item.action}
              className='w-full flex items-center p-3 rounded-lg hover:bg-gray-100 transition-all duration-200 text-gray-700 font-medium'
            >
              <span className="flex-shrink-0 mr-3 text-gray-500">
                <item.icon />
              </span>
              <span>{item.name}</span>
              
              {/* Notification Badge */}
              {item.name === 'Notifications' && unreadCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification panel positioned as a fixed overlay */}
            {item.name === 'Notifications' && showNotifications && (
              <div className="fixed top-0 left-0 md:left-72 bottom-0 h-full z-50">
                <NotificationToast className="h-full" />
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Logout Button */}
      <div className="mt-auto px-4 mb-6 pt-4 border-t border-gray-200">
        <button 
          className='flex items-center p-3 w-full text-left rounded-lg hover:bg-red-50 transition-all duration-200 text-red-600 font-medium' 
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <span className="flex-shrink-0 mr-3">
            {isLoggingOut ? (
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <LogoutIcon />
            )}
          </span>
          <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
        </button>
      </div>
    </nav>
  );
};

export default Sidebar;