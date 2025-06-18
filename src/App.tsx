import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Workbench from "./pages/Workbench";
import Admin from "./pages/Admin";
import IssueReportPage from "./pages/IssueReport";
import LoginForm from "./components/LoginForm";
import ProtectedRoute from "./components/ProtectedRoute";
import { WorkspaceProvider } from "./components/WorkspaceProvider";
import WorkspaceChat from "./pages/workspace/WorkspaceChat";
import WorkspaceAdmin from "./pages/workspace/WorkspaceAdmin";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<LoginForm />} />
      
      {/* Legacy routes - redirect to new workspace structure */}
      <Route path="/workbench" element={<Navigate to="/workspace/purchaser" replace />} />
      <Route path="/admin" element={<Navigate to="/workspace/purchaser/admin" replace />} />
      
      {/* New workspace routes */}
      <Route 
        path="/workspace/:workspace/*" 
        element={
          <ProtectedRoute>
            <WorkspaceProvider>
              <Routes>
                <Route path="/" element={<WorkspaceChat />} />
                <Route path="/admin" element={<WorkspaceAdmin />} />
                <Route path="*" element={<Navigate to="/workspace/purchaser" replace />} />
              </Routes>
            </WorkspaceProvider>
          </ProtectedRoute>
        }
      />
      
      {/* Shared routes */}
      <Route 
        path="/issues" 
        element={
          <ProtectedRoute>
            <WorkspaceProvider>
              <IssueReportPage />
            </WorkspaceProvider>
          </ProtectedRoute>
        }
      />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App = () => {
  return (
    <BrowserRouter 
      basename="/"
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <AppRoutes />
    </BrowserRouter>
  );
};

export default App;
