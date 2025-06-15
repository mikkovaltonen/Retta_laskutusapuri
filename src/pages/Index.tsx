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
          <span className="text-sm font-light" style={{color: '#1e2a54'}}>Professional Buyer</span>
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
          <span style={{color: '#003d3b'}}>Retta</span>
          <br />
          <span style={{color: '#1e2a54'}}>Professional Buyer</span>
        </h1>
        <p className="text-xl mb-6 font-light max-w-3xl mx-auto" style={{color: '#003d3b'}}>
          Intelligent procurement automation and AI-powered purchasing document analysis.
        </p>
        <p className="text-lg mb-12 font-light max-w-2xl mx-auto" style={{color: '#1e2a54'}}>
          Upload procurement documents, manage supplier communications, and evaluate AI Assistant performance with your own purchasing data
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

        <section className="mt-20">
          <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-3xl p-12 shadow-lg" style={{borderColor: '#80ffb7', border: '1px solid'}}>
            <h2 className="text-4xl font-light mb-8 text-center" style={{color: '#003d3b'}}>Why AI Agents Could Be an Option?</h2>
            <div className="max-w-4xl mx-auto space-y-6 text-lg font-light leading-relaxed" style={{color: '#1e2a54'}}>
              <p>
                AI agents can save time from the property managers (PM). AI agent can also improve quality of the work by providing more info about previously used suppliers.
              </p>
              <p>
                AI agents could also automate transactional tasks allowing the property managers to focus on billable additional work. AI Agents could also save time from other transactional duties within the organization.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-32">
          <h2 className="text-4xl font-light mb-16" style={{color: '#003d3b'}}>The Professional Procurement Challenge</h2>
          <div className="mb-20 bg-white rounded-2xl shadow-xl overflow-hidden" style={{borderColor: '#80ffb7', border: '1px solid'}}>
            <img src="/problem.png" alt="Professional Procurement Cost Problem Analysis" className="w-full h-auto" />
          </div>
        </section>

        <section className="mt-32">
          <h2 className="text-4xl font-light mb-16" style={{color: '#003d3b'}}>Key Professional Buyer Benefits</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <Card className="p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:transform hover:-translate-y-2 rounded-2xl" style={{borderColor: '#80ffb7', border: '1px solid'}}>
              <CardContent className="space-y-6">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{backgroundColor: '#003d3b'}}>
                  <DollarSign className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-light" style={{color: '#003d3b'}}>Save 1-5% on Procurement Cost</h3>
                <p className="font-light leading-relaxed" style={{color: '#1e2a54'}}>
                  This happens by aligning to pre-negotiated contracts and easy AI assisted professional buying.
                </p>
              </CardContent>
            </Card>

            <Card className="p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:transform hover:-translate-y-2 rounded-2xl" style={{borderColor: '#80ffb7', border: '1px solid'}}>
              <CardContent className="space-y-6">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{backgroundColor: '#003d3b'}}>
                  <Upload className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-light" style={{color: '#003d3b'}}>Serve More Customers with Same Resource Pool</h3>
                <p className="font-light leading-relaxed" style={{color: '#1e2a54'}}>
                  This happens via property manager time savings.
                </p>
              </CardContent>
            </Card>

            <Card className="p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:transform hover:-translate-y-2 rounded-2xl" style={{borderColor: '#80ffb7', border: '1px solid'}}>
              <CardContent className="space-y-6">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{backgroundColor: '#003d3b'}}>
                  <Brain className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-light" style={{color: '#003d3b'}}>Provide Transparency to Property Manager Purchasing Decisions</h3>
                <p className="font-light leading-relaxed" style={{color: '#1e2a54'}}>
                  This happens by AI documenting the procurement decisions in chat history.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mt-32">
          <h2 className="text-4xl font-light mb-16" style={{color: '#003d3b'}}>Our Professional Buyer Solution</h2>
          <div className="grid md:grid-cols-3 gap-8 items-start p-10 rounded-3xl shadow-xl" style={{backgroundColor: '#ffede5', borderColor: '#80ffb7', border: '1px solid'}}>
            <div>
              <h3 className="text-2xl font-light mb-4" style={{color: '#003d3b'}}>Solution Overview</h3>
              <p className="mb-6 font-light leading-relaxed text-sm" style={{color: '#1e2a54'}}>A diagram illustrating the main components and flow of our professional buyer solution.</p>
              <img src="/solution_overview.png" alt="Solution Overview" className="rounded-2xl shadow-lg w-full h-auto" style={{borderColor: '#80ffb7', border: '1px solid'}} />
            </div>
            <div>
              <h3 className="text-2xl font-light mb-4" style={{color: '#003d3b'}}>Enhanced Architecture</h3>
              <p className="mb-6 font-light leading-relaxed text-sm" style={{color: '#1e2a54'}}>Advanced architecture showing the complete procurement automation system.</p>
              <img src="/solution_overview3.png" alt="Enhanced Architecture" className="rounded-2xl shadow-lg w-full h-auto" style={{borderColor: '#80ffb7', border: '1px solid'}} />
            </div>
            <div>
              <h3 className="text-2xl font-light mb-4" style={{color: '#003d3b'}}>Professional Buyer Tech Stack</h3>
              <p className="mb-6 font-light leading-relaxed text-sm" style={{color: '#1e2a54'}}>Complete technology stack and tools for professional procurement automation.</p>
              <img src="/professiona_buyer_tech_stack.png" alt="Professional Buyer Tech Stack" className="rounded-2xl shadow-lg w-full h-auto" style={{borderColor: '#80ffb7', border: '1px solid'}} />
            </div>
          </div>
        </section>

        <section className="mt-32 mb-20">
          <h2 className="text-4xl font-light mb-10 text-center" style={{color: '#003d3b'}}>
            Start Your <span style={{color: '#1e2a54'}}>Professional Buyer AI Evaluation</span>
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
          <h2 className="text-4xl font-light mb-16 text-center" style={{color: '#003d3b'}}>Data Privacy with Google Cloud</h2>
          <div className="max-w-6xl mx-auto p-8 bg-white rounded-3xl shadow-xl" style={{borderColor: '#80ffb7', border: '1px solid'}}>
            <div className="space-y-8">
              <div>
                <p className="text-lg font-light leading-relaxed mb-6" style={{color: '#1e2a54'}}>
                  The Gemini API is designed according to Google's strong enterprise-level security and privacy principles. This means in practice:
                </p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-2xl font-light mb-4" style={{color: '#003d3b'}}>Data Ownership & Security</h3>
                  <ul className="space-y-3 font-light" style={{color: '#1e2a54'}}>
                    <li>• <strong>You own your data:</strong> Google does not use data processed through the Gemini API to train its own models or target advertisements without explicit permission.</li>
                    <li>• <strong>Confidentiality:</strong> Your data is processed confidentially with restricted access.</li>
                    <li>• <strong>Compliance:</strong> The service follows industry standards and regulations, such as ISO certifications, and helps companies meet GDPR requirements.</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-2xl font-light mb-4" style={{color: '#003d3b'}}>Reference Customers</h3>
                  <div className="font-light space-y-3" style={{color: '#1e2a54'}}>
                    <p>While individual Gemini API customer lists are not public, the user base is broad and continuously growing, including:</p>
                    <ul className="space-y-2 ml-4">
                      <li>• <strong>Cross-industry companies:</strong> Technology companies, manufacturing industry players, and many other organizations</li>
                      <li>• <strong>Google Workspace users:</strong> Companies like Neste, Uber, and Sports Basement use Gemini technology</li>
                      <li>• <strong>Application developers:</strong> Large community building intelligent applications</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="pt-6 border-t" style={{borderColor: '#80ffb7'}}>
                <h3 className="text-2xl font-light mb-4" style={{color: '#003d3b'}}>Hamina Data Center and Data Location</h3>
                <div className="font-light space-y-4" style={{color: '#1e2a54'}}>
                  <p>
                    Google has a significant and modern data center in Hamina, Finland, which is part of Google Cloud Platform's (GCP) europe-north1 region. Google enables data processing and storage in the europe-north1 region, which helps meet local regulations and can provide lower latency for Nordic users.
                  </p>
                  <p>
                    In summary, the Gemini API offers strong data protection and is used by many different organizations. While direct routing of API data to Hamina is not a default feature, utilizing the Hamina data center is possible if the geographical location of data is a critical factor for your business.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-32 mb-20">
          <h2 className="text-4xl font-light mb-16 text-center" style={{color: '#003d3b'}}>About Retta</h2>
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden max-w-2xl mx-auto" style={{borderColor: '#80ffb7', border: '1px solid'}}>
            <img src="/retta.png" alt="Retta - Luotettavaa ja mutkatonta isännöintiä" className="w-full h-auto" />
          </div>
          <div className="text-center mt-12">
            <p className="text-xl mb-8 font-light max-w-2xl mx-auto" style={{color: '#1e2a54'}}>
              Luotettavaa ja mutkatonta isännöintiä - Professional procurement solutions that transform how purchasing is managed.
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
