import * as React from 'react';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useUserAuth } from '@/context/userAuthContext';

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

const navItems = [
  {
    name: 'Home', 
    link: '/', 
    icon: HomeIcon
  },
  {
    name: 'Profile',
    link: '/profile', 
    icon: ProfileIcon
  },
];

const Sidebar: React.FunctionComponent<ISidebarProps> = ({ onClose }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { logout } = useUserAuth();
  const navigate = useNavigate();

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

  return (
    <nav className="flex flex-col h-full bg-white shadow-lg">
      <div className='flex justify-center p-5 border-b'>
        <div className='text-black text-xl font-bold'>Thesis Project</div>
      </div>
      
      <div className='flex flex-col flex-grow px-4 py-2'>
        {navItems.map((item) => (
          <div 
            className="rounded-md w-full mb-2 mt-3 hover:bg-gray-100 transition-colors"
            key={item.name}
          >
            <Link 
              to={item.link} 
              className='flex items-center p-3'
              onClick={() => {
                if (isMobile) onClose();
              }}
            >
              <span className="flex-shrink-0 mr-3 text-gray-500">
                <item.icon />
              </span>
              <span className="font-medium">{item.name}</span>
            </Link>
          </div>
        ))}
      </div>
      
      <div className="mt-auto px-4 mb-6 border-t pt-4">
        <div className="rounded-md w-full mb-2 mt-3 hover:bg-red-50 transition-colors">
          <button 
            className='flex items-center p-3 w-full text-left text-red-600 font-medium' 
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
      </div>
    </nav>
  );
};

export default Sidebar;