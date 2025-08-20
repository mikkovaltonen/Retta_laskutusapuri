import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate, Link } from "react-router-dom";
import { LogOut, Settings, FileText, Database, ArrowLeft, Bot, AlertTriangle, UserPlus, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import DocumentAnalysis from "@/components/DocumentAnalysis";
import { PriceListUpload } from "@/components/PriceListUpload";
import { OrderUpload } from "@/components/OrderUpload";
import { UserCreation } from "@/components/UserCreation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import PromptEditor from "../components/PromptEditor";
import AdminIssueReport from "../components/AdminIssueReport";
import PasswordReset from "../components/PasswordReset";

interface AdminProps {
  hideNavigation?: boolean;
}

const Admin = ({ hideNavigation = false }: AdminProps) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [isLoading, setIsLoading] = useState(false);
  const [showPriceListUpload, setShowPriceListUpload] = useState(false);
  const [showOrderUpload, setShowOrderUpload] = useState(false);
  const [showAdminIssueReport, setShowAdminIssueReport] = useState(false);
  const [showUserCreation, setShowUserCreation] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleBackToWorkbench = () => {
    navigate('/workbench');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-black text-white p-6">
        <div className="container mx-auto">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              {!hideNavigation && (
                <Button
                  variant="ghost"
                  onClick={handleBackToWorkbench}
                  className="text-white hover:bg-white/20"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Chat
                </Button>
              )}
              <div className="flex items-center gap-3">
                <Bot className="h-8 w-8" />
                <div>
                  <h1 className="text-2xl font-bold">Retta Admin</h1>
                  <p className="text-gray-300">Laskutusapurin Konfiguraatio</p>
                </div>
              </div>
            </div>
            {!hideNavigation && (
              <div className="flex items-center gap-4">
                {/* User info */}
                {user && (
                  <div className="text-sm text-gray-300">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="text-white font-medium">{user.email}</span>
                    </span>
                  </div>
                )}
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="text-white hover:bg-white/20"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {/* AI Prompt Management - Featured */}
        <div className="mb-8">
          <Card className="border-gray-300 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="bg-gray-800 text-white rounded-t-lg p-8">
              <CardTitle className="flex items-center text-2xl">
                <Settings className="mr-4 h-8 w-8" />
                AI Prompt Management
              </CardTitle>
              <p className="text-gray-300 mt-2 text-lg">
                Primary configuration tool for evaluating AI performance
              </p>
            </CardHeader>
            <CardContent className="p-8">
              <p className="text-gray-600 mb-6 text-lg">
                Create, edit, and evaluate different versions of the AI system prompt. This is the most important evaluation feature for testing different AI configurations and measuring performance improvements.
              </p>
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    className="w-full bg-black hover:bg-gray-800 py-4 text-lg text-white"
                  >
                    <Settings className="mr-2 h-5 w-5" />
                    Open Prompt Manager
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>System Prompt Version Manager</DialogTitle>
                    <DialogDescription>
                      Create, edit, and evaluate different versions of the AI system prompt. This is a key evaluation feature for testing different AI configurations.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="max-h-[calc(90vh-120px)] overflow-y-auto">
                    <PromptEditor />
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>


        {/* User Management */}
        <div className="mb-8">
          <Card className="border-gray-300 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="bg-blue-700 text-white rounded-t-lg p-6">
              <CardTitle className="flex items-center text-xl">
                <UserPlus className="mr-3 h-7 w-7" />
                Käyttäjähallinta
              </CardTitle>
              <p className="text-blue-100 mt-2">
                Luo uusia käyttäjiä järjestelmään
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-gray-600 mb-4">
                Vain nykyiset käyttäjät voivat luoda uusia käyttäjiä. Kaikki käyttäjät jakavat samat hinnastot, tilaukset ja AI-promptit.
              </p>
              <Dialog open={showUserCreation} onOpenChange={setShowUserCreation}>
                <DialogTrigger asChild>
                  <Button 
                    className="w-full bg-blue-700 hover:bg-blue-600 text-white"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Luo Uusi Käyttäjä
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Luo Uusi Käyttäjä</DialogTitle>
                    <DialogDescription>
                      Luo uusi käyttäjätili Retta Laskutusapuriin. Käyttäjä saa pääsyn kaikkiin jaettuihin tietoihin.
                    </DialogDescription>
                  </DialogHeader>
                  <UserCreation />
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>

        {/* Password Management */}
        <div className="mb-8">
          <Card className="border-gray-300 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="bg-purple-700 text-white rounded-t-lg p-6">
              <CardTitle className="flex items-center text-xl">
                <Lock className="mr-3 h-7 w-7" />
                Salasanan hallinta
              </CardTitle>
              <p className="text-purple-100 mt-2">
                Vaihda oman tilisi salasana
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-gray-600 mb-4">
                Voit vaihtaa oman tilisi salasanan turvallisuussyistä tai jos olet unohtanut sen.
              </p>
              <Dialog open={showPasswordReset} onOpenChange={setShowPasswordReset}>
                <DialogTrigger asChild>
                  <Button 
                    className="w-full bg-purple-700 hover:bg-purple-600 text-white"
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    Vaihda salasana
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Vaihda salasana</DialogTitle>
                    <DialogDescription>
                      Vaihda tilisi salasana. Tarvitset nykyisen salasanasi vahvistaaksesi muutoksen.
                    </DialogDescription>
                  </DialogHeader>
                  <PasswordReset />
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Tools */}
        <div className="grid md:grid-cols-3 gap-6">
          
          {/* AI Prompt Management - Moved to featured section above */}


          {/* Price List Upload - Hidden for competitive_bidding workspace */}
          {currentWorkspace !== 'competitive_bidding' && (
          <Card className="border-gray-300 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="bg-gray-700 text-white rounded-t-lg">
              <CardTitle className="flex items-center">
                <Database className="mr-3 h-6 w-6" />
                Hinnasto Data
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-gray-600 mb-4">
                Lataa hinnasto-data Excel-tiedostosta (Hinnasto välilehti).
              </p>
              <Dialog open={showPriceListUpload} onOpenChange={setShowPriceListUpload}>
                <DialogTrigger asChild>
                  <Button 
                    className="w-full bg-gray-700 hover:bg-gray-600 text-white"
                  >
                    <Database className="mr-2 h-4 w-4" />
                    Manage Price List Data
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Hinnasto Datan Hallinta</DialogTitle>
                    <DialogDescription>
                      Lataa ja hallinnoi hinnasto-dataa Excel-tiedostosta.
                    </DialogDescription>
                  </DialogHeader>
                  <PriceListUpload />
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
          )}

          {/* Order Upload - Hidden for competitive_bidding workspace */}
          {currentWorkspace !== 'competitive_bidding' && (
          <Card className="border-gray-300 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="bg-gray-700 text-white rounded-t-lg">
              <CardTitle className="flex items-center">
                <Database className="mr-3 h-6 w-6" />
                Tilaus Data
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-gray-600 mb-4">
                Lataa tilaus-data Excel-tiedostosta (Tilaus välilehti).
              </p>
              <Dialog open={showOrderUpload} onOpenChange={setShowOrderUpload}>
                <DialogTrigger asChild>
                  <Button 
                    className="w-full bg-gray-700 hover:bg-gray-600 text-white"
                  >
                    <Database className="mr-2 h-4 w-4" />
                    Manage Order Data
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Tilaus Datan Hallinta</DialogTitle>
                    <DialogDescription>
                      Lataa ja hallinnoi tilaus-dataa Excel-tiedostosta.
                    </DialogDescription>
                  </DialogHeader>
                  <OrderUpload />
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
          )}


          {/* Issue Report */}
          <Card className="border-gray-300 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="bg-red-600 text-white rounded-t-lg">
              <CardTitle className="flex items-center">
                <AlertTriangle className="mr-3 h-6 w-6" />
                Issue Report
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-gray-600 mb-4">
                View and manage negative feedback issues from user interactions. Track resolution status.
              </p>
              <Dialog open={showAdminIssueReport} onOpenChange={setShowAdminIssueReport}>
                <DialogTrigger asChild>
                  <Button 
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    View Issue Report
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Admin Issue Report - All Users</DialogTitle>
                    <DialogDescription>
                      View and manage all users' negative feedback issues. Track resolution status across all users.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="max-h-[calc(90vh-120px)] overflow-y-auto">
                    <AdminIssueReport />
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
};

export default Admin;