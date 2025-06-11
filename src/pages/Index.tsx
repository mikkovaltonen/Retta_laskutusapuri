import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, FileText, Brain, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { RegisterButton } from "@/components/RegisterButton";

const Index = () => {
  return (
    <div className="min-h-screen bg-white font-sans">
      <nav className="flex justify-between items-center px-8 py-6 bg-white shadow-sm">
        <Link to="/" className="flex flex-col">
          <span className="text-2xl font-light tracking-wide" style={{color: '#003d3b'}}>RETTA AI</span>
          <span className="text-sm font-light" style={{color: '#1e2a54'}}>Property Manager Assistant</span>
        </Link>
        <div className="flex gap-4">
          <Button
            variant="ghost"
            className="font-light hover:bg-green-50"
            style={{color: '#003d3b'}}
            asChild
          >
            <Link to="/login">Login</Link>
          </Button>
          <RegisterButton />
        </div>
      </nav>

      <main className="container mx-auto px-8 py-20 text-center">
        <h1 className="text-6xl font-light mb-8 leading-tight">
          <span style={{color: '#003d3b'}}>Retta AI Property</span>
          <br />
          <span style={{color: '#1e2a54'}}>Manager Assistant</span>
        </h1>
        <p className="text-xl mb-6 font-light max-w-3xl mx-auto" style={{color: '#003d3b'}}>
          Intelligent property management automation and AI-powered document analysis.
        </p>
        <p className="text-lg mb-12 font-light max-w-2xl mx-auto" style={{color: '#1e2a54'}}>
          Upload property documents, manage tenant communications, and evaluate AI Assistant performance with your own property management data
        </p>
        <div className="flex justify-center gap-6 flex-wrap">
          <RegisterButton />
          <Button
            variant="outline"
            className="px-10 py-4 rounded-full text-lg font-light shadow-lg transition-all duration-300 hover:bg-green-50"
            style={{borderColor: '#003d3b', color: '#003d3b'}}
            asChild
          >
            <Link to="/login">Login</Link>
          </Button>
        </div>

        <section className="mt-32">
          <h2 className="text-4xl font-light mb-16" style={{color: '#003d3b'}}>The Property Management Challenge</h2>
          <div className="mb-20 bg-white rounded-2xl shadow-xl overflow-hidden" style={{borderColor: '#80ffb7', border: '1px solid'}}>
            <img src="/problem.png" alt="Property Management Cost Problem Analysis" className="w-full h-auto" />
          </div>
        </section>

        <section className="mt-32">
          <h2 className="text-4xl font-light mb-16" style={{color: '#003d3b'}}>Key Property Management Benefits</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <Card className="p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:transform hover:-translate-y-2 rounded-2xl" style={{borderColor: '#80ffb7', border: '1px solid'}}>
              <CardContent className="space-y-6">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{backgroundColor: '#003d3b'}}>
                  <DollarSign className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-light" style={{color: '#003d3b'}}>Cost Optimization</h3>
                <p className="font-light leading-relaxed" style={{color: '#1e2a54'}}>
                  Evaluate how AI can optimize property management costs through intelligent maintenance scheduling and vendor management.
                </p>
              </CardContent>
            </Card>

            <Card className="p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:transform hover:-translate-y-2 rounded-2xl" style={{borderColor: '#80ffb7', border: '1px solid'}}>
              <CardContent className="space-y-6">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{backgroundColor: '#003d3b'}}>
                  <Upload className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-light" style={{color: '#003d3b'}}>Document Intelligence</h3>
                <p className="font-light leading-relaxed" style={{color: '#1e2a54'}}>
                  Test AI's ability to extract and analyze data from property documents, lease agreements, and maintenance reports.
                </p>
              </CardContent>
            </Card>

            <Card className="p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:transform hover:-translate-y-2 rounded-2xl" style={{borderColor: '#80ffb7', border: '1px solid'}}>
              <CardContent className="space-y-6">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{backgroundColor: '#003d3b'}}>
                  <Brain className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-light" style={{color: '#003d3b'}}>Professional Property Management</h3>
                <p className="font-light leading-relaxed" style={{color: '#1e2a54'}}>
                  Experience how AI can transform property management with intelligent tenant communication and automated maintenance workflows.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mt-32">
          <h2 className="text-4xl font-light mb-16" style={{color: '#003d3b'}}>Our Property Management Solution</h2>
          <div className="grid md:grid-cols-2 gap-12 items-start p-10 rounded-3xl shadow-xl" style={{backgroundColor: '#ffede5', borderColor: '#80ffb7', border: '1px solid'}}>
            <div>
              <h3 className="text-3xl font-light mb-6" style={{color: '#003d3b'}}>Solution Overview</h3>
              <p className="mb-8 font-light leading-relaxed" style={{color: '#1e2a54'}}>A diagram illustrating the main components and flow of our property management solution.</p>
              <img src="/solution_overview.png" alt="Solution Overview" className="rounded-2xl shadow-lg w-full h-auto" style={{borderColor: '#80ffb7', border: '1px solid'}} />
            </div>
            <div>
              <h3 className="text-3xl font-light mb-6" style={{color: '#003d3b'}}>Enhanced Solution Architecture</h3>
              <p className="mb-8 font-light leading-relaxed" style={{color: '#1e2a54'}}>Advanced architecture showing the complete property management automation system.</p>
              <img src="/solution_overview2.png" alt="Enhanced Solution Overview" className="rounded-2xl shadow-lg w-full h-auto" style={{borderColor: '#80ffb7', border: '1px solid'}} />
            </div>
          </div>
        </section>

        <section className="mt-32 mb-20">
          <h2 className="text-4xl font-light mb-10 text-center" style={{color: '#003d3b'}}>
            Start Your <span style={{color: '#1e2a54'}}>Property Management AI Evaluation</span>
          </h2>
          <div className="flex justify-center gap-6 flex-wrap">
            <RegisterButton />
            <Button
              variant="outline"
              className="px-10 py-4 rounded-full text-lg font-light shadow-lg transition-all duration-300 hover:bg-green-50"
              style={{borderColor: '#003d3b', color: '#003d3b'}}
              asChild
            >
              <Link to="/login">Already have an account? Login</Link>
            </Button>
            <Button
              variant="outline"
              className="px-10 py-4 rounded-full text-lg font-light shadow-lg transition-all duration-300 hover:bg-green-50"
              style={{borderColor: '#003d3b', color: '#003d3b'}}
              onClick={() => window.open('https://github.com/mikkovaltonen/professional_buyer', '_blank', 'noopener,noreferrer')}
            >
              View Full Solution →
            </Button>
          </div>
        </section>

        <section className="mt-32 mb-20">
          <h2 className="text-4xl font-light mb-16 text-center" style={{color: '#003d3b'}}>About Retta</h2>
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden" style={{borderColor: '#80ffb7', border: '1px solid'}}>
            <img src="/retta.png" alt="Retta - Luotettavaa ja mutkatonta isännöintiä" className="w-full h-auto" />
          </div>
          <div className="text-center mt-12">
            <p className="text-xl mb-8 font-light max-w-2xl mx-auto" style={{color: '#1e2a54'}}>
              Luotettavaa ja mutkatonta isännöintiä - Professional property management solutions that transform how properties are managed.
            </p>
            <div className="flex justify-center gap-6">
              <Button
                variant="outline"
                className="px-8 py-3 rounded-full font-light shadow-lg transition-all duration-300 hover:bg-green-50"
                style={{borderColor: '#003d3b', color: '#003d3b'}}
                onClick={() => window.open('https://retta.fi', '_blank', 'noopener,noreferrer')}
              >
                Visit retta.fi
              </Button>
              <Button
                variant="outline"
                className="px-8 py-3 rounded-full font-light shadow-lg transition-all duration-300 hover:bg-green-50"
                style={{borderColor: '#003d3b', color: '#003d3b'}}
                onClick={() => window.open('https://linkedin.com/company/retta', '_blank', 'noopener,noreferrer')}
              >
                LinkedIn
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-20 mt-20" style={{backgroundColor: '#003d3b'}}>
        <div className="container mx-auto px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
            <div>
              <h3 className="font-light text-lg mb-6 text-white">Palvelumme</h3>
              <ul className="space-y-3">
                <li><a href="https://retta.fi/palvelumme" className="font-light transition-colors duration-300 text-white hover:opacity-80" style={{color: '#80ffb7'}}>Property Management Services</a></li>
                <li><a href="https://retta.fi/rakennuttajille-ja-suurasiakkaille" className="font-light transition-colors duration-300 text-white hover:opacity-80" style={{color: '#80ffb7'}}>For Developers & Major Clients</a></li>
                <li><a href="https://retta.fi/tietoa-asumisesta" className="font-light transition-colors duration-300 text-white hover:opacity-80" style={{color: '#80ffb7'}}>Housing Information</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-light text-lg mb-6 text-white">Asiakkuus</h3>
              <ul className="space-y-3">
                <li><a href="https://retta.fi/tule-asiakkaaksi" className="font-light transition-colors duration-300 text-white hover:opacity-80" style={{color: '#80ffb7'}}>Become a Customer</a></li>
                <li><a href="https://retta.fi/omaretta" className="font-light transition-colors duration-300 text-white hover:opacity-80" style={{color: '#80ffb7'}}>OmaRetta Portal</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-light text-lg mb-6 text-white">Tietoa meistä</h3>
              <ul className="space-y-3">
                <li><a href="https://retta.fi/tietoa-meista" className="font-light transition-colors duration-300 text-white hover:opacity-80" style={{color: '#80ffb7'}}>About Us</a></li>
                <li><a href="https://retta.fi/toihin-rettalle" className="font-light transition-colors duration-300 text-white hover:opacity-80" style={{color: '#80ffb7'}}>Work at Retta</a></li>
                <li><a href="https://retta.fi" className="font-light transition-colors duration-300 text-white hover:opacity-80" style={{color: '#80ffb7'}}>Visit Retta.fi</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-16 pt-8 text-center" style={{borderTop: '1px solid #1e2a54'}}>
            <p className="font-light" style={{color: '#80ffb7'}}>© 2024 Retta. All rights reserved.</p>
            <p className="font-light mt-2" style={{color: '#bedaff'}}>AI Assistant developed by Mikko Valtonen for Retta</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
