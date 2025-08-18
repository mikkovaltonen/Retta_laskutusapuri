import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, User, LogOut, MessageSquare, Settings, Home } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import { useWorkspace } from '../hooks/useWorkspace';
import { useAuth } from '../hooks/useAuth';

interface WorkspaceNavigationProps {
  onLogout?: () => void;
}

export const WorkspaceNavigation: React.FC<WorkspaceNavigationProps> = ({ onLogout }) => {
  const { currentWorkspace, setWorkspace, workspaceConfig } = useWorkspace();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdminPage = location.pathname.includes('/admin');
  const isWorkbenchPage = location.pathname.includes('/workspace');

  const handleLogout = () => {
    logout();
    onLogout?.();
    navigate('/');
  };

  const handleTabSwitch = (tab: 'chat' | 'admin') => {
    const basePath = `/workspace/${currentWorkspace}`;
    navigate(tab === 'admin' ? `${basePath}/admin` : basePath);
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side - Brand and Workspace */}
        <div className="flex items-center space-x-6">
          {/* Brand */}
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="text-xl font-semibold p-0 h-auto"
              style={{ color: '#003d3b' }}
            >
              <Home className="w-5 h-5 mr-2" />
              Retta
            </Button>
          </div>

          {/* Workspace Switcher */}
          {isWorkbenchPage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center space-x-2">
                  <span>{workspaceConfig[currentWorkspace].name}</span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem
                  onClick={() => setWorkspace('invoicer')}
                  className={currentWorkspace === 'invoicer' ? 'bg-blue-50' : ''}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">Retta Laskutus</span>
                    <span className="text-sm text-gray-500">Myyntilaskujen hallinta</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Tab Navigation */}
          {isWorkbenchPage && (
            <div className="flex space-x-1">
              <Button
                variant={!isAdminPage ? "default" : "ghost"}
                size="sm"
                onClick={() => handleTabSwitch('chat')}
                className="flex items-center space-x-2"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Chat</span>
              </Button>
              <Button
                variant={isAdminPage ? "default" : "ghost"}
                size="sm"
                onClick={() => handleTabSwitch('admin')}
                className="flex items-center space-x-2"
              >
                <Settings className="w-4 h-4" />
                <span>Admin</span>
              </Button>
            </div>
          )}
        </div>

        {/* Right side - User menu */}
        <div className="flex items-center space-x-4">
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span>{user.email}</span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </nav>
  );
};