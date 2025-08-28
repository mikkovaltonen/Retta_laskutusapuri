import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, FileText, Brain, Upload } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-white font-sans">
      <nav className="flex justify-between items-center px-8 py-6 bg-white shadow-sm">
        <Link to="/" className="flex flex-col">
          <span className="text-2xl font-light tracking-wide" style={{color: '#003d3b'}}>RETTA</span>
          <span className="text-sm font-light" style={{color: '#1e2a54'}}>Invoicing Assistant</span>
        </Link>
        <div className="flex gap-4">
          <Button
            variant="ghost"
            className="font-light hover:bg-green-50"
            style={{color: '#003d3b'}}
            asChild
          >
            <Link to="/login">Sign In</Link>
          </Button>
        </div>
      </nav>

      <main className="container mx-auto px-8 py-20 text-center">
        <h1 className="text-6xl font-light mb-8 leading-tight">
          <span style={{color: '#003d3b'}}>Retta Invoicing Assistant</span>
        </h1>
        <p className="text-xl mb-6 font-light max-w-3xl mx-auto" style={{color: '#003d3b'}}>
          Discover Retta Invoicing Assistant – Your AI Assistant for Streamlining Invoicing
        </p>
        <p className="text-lg mb-12 font-light max-w-2xl mx-auto" style={{color: '#1e2a54'}}>
          An intelligent invoicing assistant that saves time and improves the quality and efficiency of your invoicing process
        </p>
        <div className="flex justify-center gap-6 flex-wrap">
          <Button
            variant="outline"
            className="px-10 py-4 rounded-full text-lg font-light shadow-lg transition-all duration-300 hover:bg-green-50"
            style={{borderColor: '#003d3b', color: '#003d3b'}}
            asChild
          >
            <Link to="/login">Sign In</Link>
          </Button>
        </div>

        <section className="mt-20">
          <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-3xl p-12 shadow-lg" style={{borderColor: '#80ffb7', border: '1px solid'}}>
            <h2 className="text-4xl font-light mb-8 text-center" style={{color: '#003d3b'}}>Why AI Assistant for Invoicing?</h2>
            <div className="max-w-4xl mx-auto space-y-6 text-lg font-light leading-relaxed" style={{color: '#1e2a54'}}>
              <p>
                AI assistant can save time in invoicing processes and improve invoicing quality. The assistant can automate routine invoicing tasks and ensure invoice accuracy.
              </p>
              <p>
                The invoicing assistant can also speed up the invoicing process, which improves cash flow and reduces errors. This enables focusing on customer service and other value-creating tasks.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-32">
          <h2 className="text-4xl font-light mb-16" style={{color: '#003d3b'}}>Key Benefits of the Invoicing Assistant</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <Card className="p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:transform hover:-translate-y-2 rounded-2xl" style={{borderColor: '#80ffb7', border: '1px solid'}}>
              <CardContent className="space-y-6">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{backgroundColor: '#003d3b'}}>
                  <DollarSign className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-light" style={{color: '#003d3b'}}>Faster Cash Flow</h3>
                <p className="font-light leading-relaxed" style={{color: '#1e2a54'}}>
                  Automated invoicing process speeds up invoice processing and reduces payment delays.
                </p>
              </CardContent>
            </Card>

            <Card className="p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:transform hover:-translate-y-2 rounded-2xl" style={{borderColor: '#80ffb7', border: '1px solid'}}>
              <CardContent className="space-y-6">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{backgroundColor: '#003d3b'}}>
                  <FileText className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-light" style={{color: '#003d3b'}}>Fewer Errors</h3>
                <p className="font-light leading-relaxed" style={{color: '#1e2a54'}}>
                  AI automatically verifies invoice accuracy and reduces human errors.
                </p>
              </CardContent>
            </Card>

            <Card className="p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:transform hover:-translate-y-2 rounded-2xl" style={{borderColor: '#80ffb7', border: '1px solid'}}>
              <CardContent className="space-y-6">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{backgroundColor: '#003d3b'}}>
                  <Brain className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-light" style={{color: '#003d3b'}}>Clear Invoicing for Housing Companies</h3>
                <p className="font-light leading-relaxed" style={{color: '#1e2a54'}}>
                  Each invoice line includes AI-generated clarification of billing basis and pricing.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mt-32">
          <h2 className="text-4xl font-light mb-16" style={{color: '#003d3b'}}>Invoicing Challenges</h2>
          <div className="mb-20 bg-white rounded-2xl shadow-xl overflow-hidden" style={{borderColor: '#80ffb7', border: '1px solid'}}>
            <img src="/problem.png" alt="Invoicing challenges and cost analysis" className="w-full h-auto" />
          </div>
        </section>

        <section className="mt-32">
          <h2 className="text-4xl font-light mb-16" style={{color: '#003d3b'}}>Our Solution</h2>
          <div className="grid md:grid-cols-2 gap-8 items-start p-10 rounded-3xl shadow-xl" style={{backgroundColor: '#ffede5', borderColor: '#80ffb7', border: '1px solid'}}>
            <div>
              <h3 className="text-2xl font-light mb-4" style={{color: '#003d3b'}}>Solution Overview</h3>
              <p className="mb-6 font-light leading-relaxed text-sm" style={{color: '#1e2a54'}}>A diagram illustrating the main components and workflow of our invoicing solution.</p>
              <img src="/solution_overview.png" alt="Invoicing solution overview" className="rounded-2xl shadow-lg w-full h-auto" style={{borderColor: '#80ffb7', border: '1px solid'}} />
            </div>
            <div>
              <h3 className="text-2xl font-light mb-4" style={{color: '#003d3b'}}>Advanced Architecture</h3>
              <p className="mb-6 font-light leading-relaxed text-sm" style={{color: '#1e2a54'}}>Advanced architecture presenting a comprehensive invoicing automation system.</p>
              <img src="/solution_overview1.png" alt="Advanced invoicing architecture" className="rounded-2xl shadow-lg w-full h-auto" style={{borderColor: '#80ffb7', border: '1px solid'}} />
            </div>
          </div>
        </section>

        <section className="mt-32 mb-20">
          <h2 className="text-4xl font-light mb-10 text-center" style={{color: '#003d3b'}}>
            Start Using <span style={{color: '#1e2a54'}}>The Invoicing Assistant</span>
          </h2>
          <div className="flex justify-center gap-6 flex-wrap">
            <Button
              variant="outline"
              className="px-10 py-4 rounded-full text-lg font-light shadow-lg transition-all duration-300 hover:bg-green-50"
              style={{borderColor: '#003d3b', color: '#003d3b'}}
              asChild
            >
              <Link to="/login">Sign In</Link>
            </Button>
            <Button
              variant="outline"
              className="px-10 py-4 rounded-full text-lg font-light shadow-lg transition-all duration-300 hover:bg-green-50"
              style={{borderColor: '#003d3b', color: '#003d3b'}}
              onClick={() => window.location.href = 'mailto:mikko@zealsourcing.fi'}
            >
              Contact the Developer →
            </Button>
          </div>
        </section>

        <section className="mt-32 mb-20">
          <h2 className="text-4xl font-light mb-16 text-center" style={{color: '#003d3b'}}>Data Privacy with Google Cloud</h2>
          <div className="max-w-6xl mx-auto p-8 bg-white rounded-3xl shadow-xl" style={{borderColor: '#80ffb7', border: '1px solid'}}>
            <div className="space-y-8">
              <div>
                <p className="text-lg font-light leading-relaxed mb-6" style={{color: '#1e2a54'}}>
                  Gemini API is designed according to Google's strong enterprise-level security and privacy principles. In practice, this means:
                </p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-2xl font-light mb-4" style={{color: '#003d3b'}}>Data Ownership and Security</h3>
                  <ul className="space-y-3 font-light" style={{color: '#1e2a54'}}>
                    <li>• <strong>You own your data:</strong> Google does not use data processed through Gemini API to train its own models or target ads without explicit permission.</li>
                    <li>• <strong>Confidentiality:</strong> Your data is handled confidentially with restricted access.</li>
                    <li>• <strong>Compliance:</strong> The service follows industry standards and regulations, such as ISO certifications, and helps companies meet GDPR requirements.</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-2xl font-light mb-4" style={{color: '#003d3b'}}>Reference Customers</h3>
                  <div className="font-light space-y-3" style={{color: '#1e2a54'}}>
                    <p>While individual Gemini API customer lists are not published, the user base is broad and continuously growing, including:</p>
                    <ul className="space-y-2 ml-4">
                      <li>• <strong>Companies from various industries:</strong> Technology companies, manufacturing industry actors, and many other organizations</li>
                      <li>• <strong>Google Workspace users:</strong> Companies like Neste, Uber, and Sports Basement use Gemini technology</li>
                      <li>• <strong>Application developers:</strong> A large community building intelligent applications</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="pt-6 border-t" style={{borderColor: '#80ffb7'}}>
                <h3 className="text-2xl font-light mb-4" style={{color: '#003d3b'}}>Hamina Data Center and Data Location</h3>
                <div className="font-light space-y-4" style={{color: '#1e2a54'}}>
                  <p>
                    Google has a significant and modern data center in Hamina, Finland, which is part of the Google Cloud Platform (GCP) europe-north1 region. Google enables data processing and storage in the europe-north1 region, which helps meet local regulations and can provide lower latency for Nordic users.
                  </p>
                  <p>
                    In summary, Gemini API provides strong data privacy and is used by many different organizations. While direct routing of API data to Hamina is not a default feature, utilizing the Hamina data center is possible if the geographical location of data is a critical factor for your business.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-32 mb-20">
          <h2 className="text-4xl font-light mb-16 text-center" style={{color: '#003d3b'}}>About Retta</h2>
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden max-w-2xl mx-auto" style={{borderColor: '#80ffb7', border: '1px solid'}}>
            <img src="/retta.png" alt="Retta - Reliable and straightforward property management" className="w-full h-auto" />
          </div>
          <div className="text-center mt-12">
            <p className="text-xl mb-8 font-light max-w-2xl mx-auto" style={{color: '#1e2a54'}}>
              Reliable and straightforward property management - Intelligent invoicing solutions that streamline the billing process.
            </p>
            <div className="flex justify-center gap-6">
              <Button
                variant="outline"
                className="px-8 py-3 rounded-full font-light shadow-lg transition-all duration-300 hover:bg-green-50"
                style={{borderColor: '#003d3b', color: '#003d3b'}}
                onClick={() => window.open('https://retta.fi', '_blank', 'noopener,noreferrer')}
              >
                Visit retta.fi website
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
              <h3 className="font-light text-lg mb-6 text-white">Our Services</h3>
              <ul className="space-y-3">
                <li><a href="https://retta.fi/palvelumme" className="font-light transition-colors duration-300 text-white hover:opacity-80" style={{color: '#80ffb7'}}>Property Management Services</a></li>
                <li><a href="https://retta.fi/rakennuttajille-ja-suurasiakkaille" className="font-light transition-colors duration-300 text-white hover:opacity-80" style={{color: '#80ffb7'}}>For Developers and Key Accounts</a></li>
                <li><a href="https://retta.fi/tietoa-asumisesta" className="font-light transition-colors duration-300 text-white hover:opacity-80" style={{color: '#80ffb7'}}>About Living</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-light text-lg mb-6 text-white">Customer Relations</h3>
              <ul className="space-y-3">
                <li><a href="https://retta.fi/tule-asiakkaaksi" className="font-light transition-colors duration-300 text-white hover:opacity-80" style={{color: '#80ffb7'}}>Become a Customer</a></li>
                <li><a href="https://retta.fi/omaretta" className="font-light transition-colors duration-300 text-white hover:opacity-80" style={{color: '#80ffb7'}}>OmaRetta Portal</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-light text-lg mb-6 text-white">About Us</h3>
              <ul className="space-y-3">
                <li><a href="https://retta.fi/tietoa-meista" className="font-light transition-colors duration-300 text-white hover:opacity-80" style={{color: '#80ffb7'}}>About Us</a></li>
                <li><a href="https://retta.fi/toihin-rettalle" className="font-light transition-colors duration-300 text-white hover:opacity-80" style={{color: '#80ffb7'}}>Work at Retta</a></li>
                <li><a href="https://retta.fi" className="font-light transition-colors duration-300 text-white hover:opacity-80" style={{color: '#80ffb7'}}>Visit Retta.fi Website</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-16 pt-8 text-center" style={{borderTop: '1px solid #1e2a54'}}>
            <p className="font-light" style={{color: '#80ffb7'}}>© 2024 Retta. All rights reserved.</p>
            <p className="font-light mt-2" style={{color: '#bedaff'}}>
              Developed by{' '}
              <a 
                href="https://fi.linkedin.com/in/mikkojohannesvaltonen" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:opacity-80 transition-opacity"
                style={{color: '#bedaff'}}
              >
                Mikko Valtosen
              </a>{' '}
              
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
