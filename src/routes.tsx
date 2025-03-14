import { createBrowserRouter, Navigate } from "react-router-dom";
import Login from "./pages/login";
import Error from "./pages/error";
import Signup from "./pages/signup";
import CreatePost from "./pages/post";
import Home from "./pages/home";
import Profile from "./pages/profile";
import ProtectedRoutes from "./components/ProtectedRoutes";
import EditProfile from "./pages/profile/editProfile";
import VerifyEmail from "./pages/emailVerification";

export const router = createBrowserRouter([
    {
        element: <ProtectedRoutes />,
        children: [
            {
                path: "/",
                element: <Home />,
                errorElement: <Error />    
            },
            {
                path: "/post",
                element: <CreatePost />,
                errorElement: <Error />,
            },
            {
                path: "/profile",
                element: <Profile />,
                errorElement: <Error />,
            },
            {
                // Update to use URL parameters
                path: "/editProfile/:userId",
                element: <EditProfile />,
                errorElement: <Error />,
            },
            {
                // Add a redirect for the old route pattern (without parameters)
                path: "/editProfile",
                element: <Navigate to="/profile" />,
                errorElement: <Error />,
            },
            {
                // Add a catch-all route to handle 404 errors within protected routes
                path: "*",
                element: <Navigate to="/" />,
                errorElement: <Error />,
            }
        ]
    },
    {
        path: "/login",
        element: <Login />,
        errorElement: <Error />,
    },
    {
        path: "/signup",
        element: <Signup />,
        errorElement: <Error />,
    },
    {
        path: "/emailVerification",
        element: <VerifyEmail/>,
        errorElement: <Error />,
    },
    {
        // Add a catch-all route outside of protected routes
        path: "*",
        element: <Navigate to="/login" />,
        errorElement: <Error />,
    }
]);

export default router;