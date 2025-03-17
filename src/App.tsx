import * as React from "react";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import router from "./routes";
import { UserAuthContextProvider } from "./context/userAuthContext";


interface IAppProps {}

const App: React.FunctionComponent<IAppProps> = () => {
  return (
    <UserAuthContextProvider>
      <Toaster position="top-right" richColors />
      <RouterProvider router={router} />
    </UserAuthContextProvider>
  );
};

export default App;