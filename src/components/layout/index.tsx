import * as React from 'react';
import { useState } from 'react';
import Sidebar from '../sidebar';

interface ILayoutProps {
    children: React.ReactNode;
}

const Layout: React.FunctionComponent<ILayoutProps> = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };
    
    const closeSidebar = () => {
        setSidebarOpen(false);
    };

    return (
        <div className="flex flex-col md:flex-row bg-gray-100 min-h-screen relative">
            {/* Mobile sidebar toggle button */}
            <button 
                onClick={toggleSidebar}
                className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-white shadow-md text-gray-700 focus:outline-none"
                aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
                <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-6 w-6" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                >
                    {sidebarOpen ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                </svg>
            </button>

            {/* Left Sidebar - Fixed on desktop, sliding on mobile */}
            <div 
                className={`
                    transition-all duration-300 ease-in-out
                    fixed md:fixed top-0 left-0 z-40 
                    h-screen 
                    w-64
                    border-r-2 border-gray-300 shadow-lg
                    bg-white
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                `}
            >
                <Sidebar 
                    onClose={closeSidebar}
                    // Pass logout function directly to Sidebar - removed onLogoutClick
                />
            </div>

            {/* Backdrop for mobile sidebar */}
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
                    onClick={closeSidebar}
                    aria-hidden="true"
                ></div>
            )}

            {/* Main content area with proper centering */}
            <div className="flex-1 md:ml-64 lg:mr-64 w-full min-h-screen">
                <main className="p-4 sm:p-6 md:p-8 flex justify-center">
                    <div className="w-full max-w-5xl">
                        {children}
                    </div>
                </main>
            </div>

            {/* Right sidebar - only on larger screens */}
            <aside className="hidden lg:block border-l-2 border-gray-300 shadow-lg w-64 h-screen fixed top-0 right-0 bg-white">
                {/* Right sidebar content goes here */}
                <div className="p-4">
                    <h3 className="text-lg font-medium text-gray-700"></h3>
                    {/* Additional content */}
                </div>
            </aside>

            {/* Removed the Logout Confirmation Modal - now handled in Sidebar */}
        </div>
    );
};

export default Layout;