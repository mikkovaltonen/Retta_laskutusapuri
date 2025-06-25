import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate, Link } from "react-router-dom";
import { LogOut, Settings, FileText, Database, ArrowLeft, Bot, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import DocumentAnalysis from "@/components/DocumentAnalysis";
import { PriceListUpload } from "@/components/PriceListUpload";
import { OrderUpload } from "@/components/OrderUpload";
import { HinnastoApiTester } from "@/components/HinnastoApiTester";
import { TilausApiTester } from "@/components/TilausApiTester";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import PromptEditor from "../components/PromptEditor";

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
  const [showHinnastoApiTester, setShowHinnastoApiTester] = useState(false);
  const [showTilausApiTester, setShowTilausApiTester] = useState(false);

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
                  <h1 className="text-2xl font-bold">Reatta Admin</h1>
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
                <DialogContent className="sm:max-w-[700px]">
                  <DialogHeader>
                    <DialogTitle>System Prompt Version Manager</DialogTitle>
                    <DialogDescription>
                      Create, edit, and evaluate different versions of the AI system prompt. This is a key evaluation feature for testing different AI configurations.
                    </DialogDescription>
                  </DialogHeader>
                  <PromptEditor />
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

          {/* Hinnasto API Testing - Hidden for competitive_bidding workspace */}
          {currentWorkspace !== 'competitive_bidding' && (
          <Card className="border-gray-300 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="bg-gray-700 text-white rounded-t-lg">
              <CardTitle className="flex items-center">
                <Database className="mr-3 h-6 w-6" />
                Hinnasto API Testaus
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-gray-600 mb-4">
                Testaa hinnasto-datan hakutoiminnallisuutta. Hae tuotetunnuksen, tuotteen tai hintojen perusteella.
              </p>
              <Dialog open={showHinnastoApiTester} onOpenChange={setShowHinnastoApiTester}>
                <DialogTrigger asChild>
                  <Button 
                    className="w-full bg-gray-700 hover:bg-gray-600 text-white"
                  >
                    <Database className="mr-2 h-4 w-4" />
                    Test Hinnasto API
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[1000px] max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Hinnasto API Testaus Interface</DialogTitle>
                    <DialogDescription>
                      Testaa hinnasto haku-API:a eri hakukriteereillä ja varmista toiminnallisuus.
                    </DialogDescription>
                  </DialogHeader>
                  <HinnastoApiTester />
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
          )}

          {/* Tilaus API Testing - Hidden for competitive_bidding workspace */}
          {currentWorkspace !== 'competitive_bidding' && (
          <Card className="border-gray-300 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="bg-gray-700 text-white rounded-t-lg">
              <CardTitle className="flex items-center">
                <Database className="mr-3 h-6 w-6" />
                Tilaus API Testaus
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-gray-600 mb-4">
                Testaa tilaus-datan hakutoiminnallisuutta. Hae kaikkien saatavilla olevien kenttien perusteella.
              </p>
              <Dialog open={showTilausApiTester} onOpenChange={setShowTilausApiTester}>
                <DialogTrigger asChild>
                  <Button 
                    className="w-full bg-gray-700 hover:bg-gray-600 text-white"
                  >
                    <Database className="mr-2 h-4 w-4" />
                    Test Tilaus API
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[1000px] max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Tilaus API Testaus Interface</DialogTitle>
                    <DialogDescription>
                      Testaa tilaus haku-API:a eri hakukriteereillä ja varmista toiminnallisuus.
                    </DialogDescription>
                  </DialogHeader>
                  <TilausApiTester />
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
              <Link to="/issues">
                <Button 
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  View Issues
                </Button>
              </Link>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
};

export default Admin;