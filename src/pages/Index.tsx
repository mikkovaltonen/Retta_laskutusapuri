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
          <span className="text-2xl font-light tracking-wide" style={{color: '#003d3b'}}>PROPERTIUS</span>
          <span className="text-sm font-light" style={{color: '#1e2a54'}}>Ammattitaitoinen Kiinteistönhallinta</span>
        </Link>
        <div className="flex gap-4">
          <Button
            variant="ghost"
            className="font-light hover:bg-green-50"
            style={{color: '#003d3b'}}
            asChild
          >
            <Link to="/login">Kirjaudu</Link>
          </Button>
          <RegisterButton />
        </div>
      </nav>

      <main className="container mx-auto px-8 py-20 text-center">
        <h1 className="text-6xl font-light mb-8 leading-tight">
          <span style={{color: '#003d3b'}}>Propertius</span>
        </h1>
        <p className="text-xl mb-6 font-light max-w-3xl mx-auto" style={{color: '#003d3b'}}>
          Tutustu Propertiukseen – tekoälyavustajasi korkeatasoista kiinteistönhallintaa varten
        </p>
        <p className="text-lg mb-12 font-light max-w-2xl mx-auto" style={{color: '#1e2a54'}}>
          Ammattimaiseen ostamiseen ja laskutukseen keskittyvä avustaja, jolla säästät aikaa ja rahaa sekä parannat päätöksenteon läpinäkyvyyttä ja laatua kiinteistönhallinnan päivittäisissä tehtävissä
        </p>
        <div className="flex justify-center gap-6 flex-wrap">
          <RegisterButton />
          <Button
            variant="outline"
            className="px-10 py-4 rounded-full text-lg font-light shadow-lg transition-all duration-300 hover:bg-green-50"
            style={{borderColor: '#003d3b', color: '#003d3b'}}
            asChild
          >
            <Link to="/login">Kirjaudu</Link>
          </Button>
        </div>

        <section className="mt-20">
          <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-3xl p-12 shadow-lg" style={{borderColor: '#80ffb7', border: '1px solid'}}>
            <h2 className="text-4xl font-light mb-8 text-center" style={{color: '#003d3b'}}>Miksi tekoälyagentit voisivat olla vaihtoehto?</h2>
            <div className="max-w-4xl mx-auto space-y-6 text-lg font-light leading-relaxed" style={{color: '#1e2a54'}}>
              <p>
                AI-agentit voivat säästää aikaa kiinteistönhoitajilta (KH). AI-agentti voi myös parantaa työn laatua tarjoamalla enemmän tietoa aiemmin käytetyistä toimittajista.
              </p>
              <p>
                AI-agentit voisivat myös automatisoida transaktionaalisia tehtäviä, mikä mahdollistaisi kiinteistönhoitajien keskittymisen laskutettavaan lisätyöhön. AI-agentit voisivat myös säästää aikaa muista transaktionaalisista tehtävistä organisaatiossa.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-32">
          <h2 className="text-4xl font-light mb-16" style={{color: '#003d3b'}}>Ammattimaisen Hankinnan Haaste</h2>
          <div className="mb-20 bg-white rounded-2xl shadow-xl overflow-hidden" style={{borderColor: '#80ffb7', border: '1px solid'}}>
            <img src="/problem.png" alt="Professional Procurement Cost Problem Analysis" className="w-full h-auto" />
          </div>
        </section>

        <section className="mt-32">
          <h2 className="text-4xl font-light mb-16" style={{color: '#003d3b'}}>Ammattiostojan Keskeiset Hyödyt</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <Card className="p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:transform hover:-translate-y-2 rounded-2xl" style={{borderColor: '#80ffb7', border: '1px solid'}}>
              <CardContent className="space-y-6">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{backgroundColor: '#003d3b'}}>
                  <DollarSign className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-light" style={{color: '#003d3b'}}>Säästä 1-5% Hankintakustannuksista</h3>
                <p className="font-light leading-relaxed" style={{color: '#1e2a54'}}>
                  Tämä tapahtuu käyttämällä ennalta neuvoteltuja sopimuksia ja helpolla AI-avusteisella ammattimaisella ostamisella.
                </p>
              </CardContent>
            </Card>

            <Card className="p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:transform hover:-translate-y-2 rounded-2xl" style={{borderColor: '#80ffb7', border: '1px solid'}}>
              <CardContent className="space-y-6">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{backgroundColor: '#003d3b'}}>
                  <Upload className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-light" style={{color: '#003d3b'}}>Palvele Enemmän Asiakkaita Samalla Resurssivarauksella</h3>
                <p className="font-light leading-relaxed" style={{color: '#1e2a54'}}>
                  Tämä tapahtuu kiinteistönhoitajien aikansäästön kautta.
                </p>
              </CardContent>
            </Card>

            <Card className="p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:transform hover:-translate-y-2 rounded-2xl" style={{borderColor: '#80ffb7', border: '1px solid'}}>
              <CardContent className="space-y-6">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{backgroundColor: '#003d3b'}}>
                  <Brain className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-light" style={{color: '#003d3b'}}>Tarjoa Läpinäkyvyyttä Kiinteistönhoitajien Ostopäätöksiin</h3>
                <p className="font-light leading-relaxed" style={{color: '#1e2a54'}}>
                  Tämä tapahtuu AI:n dokumentoidessa hankintapäätökset keskusteluhistoriaan.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mt-32">
          <h2 className="text-4xl font-light mb-16" style={{color: '#003d3b'}}>Ammattiostojaratkaisumme</h2>
          <div className="grid md:grid-cols-3 gap-8 items-start p-10 rounded-3xl shadow-xl" style={{backgroundColor: '#ffede5', borderColor: '#80ffb7', border: '1px solid'}}>
            <div>
              <h3 className="text-2xl font-light mb-4" style={{color: '#003d3b'}}>Ratkaisun Yleiskatsaus</h3>
              <p className="mb-6 font-light leading-relaxed text-sm" style={{color: '#1e2a54'}}>Kaavio, joka havainnollistaa ammattiostojaratkaisumme pääkomponentit ja työnkulun.</p>
              <img src="/solution_overview.png" alt="Solution Overview" className="rounded-2xl shadow-lg w-full h-auto" style={{borderColor: '#80ffb7', border: '1px solid'}} />
            </div>
            <div>
              <h3 className="text-2xl font-light mb-4" style={{color: '#003d3b'}}>Kehittynyt Arkkitehtuuri</h3>
              <p className="mb-6 font-light leading-relaxed text-sm" style={{color: '#1e2a54'}}>Kehittynyt arkkitehtuuri, joka esittää kokonaisvaltaisen hankinta-automaatiojärjestelmän.</p>
              <img src="/solution_overview2.png" alt="Enhanced Architecture" className="rounded-2xl shadow-lg w-full h-auto" style={{borderColor: '#80ffb7', border: '1px solid'}} />
            </div>
            <div>
              <h3 className="text-2xl font-light mb-4" style={{color: '#003d3b'}}>Ammattiostojan Teknologiapino</h3>
              <p className="mb-6 font-light leading-relaxed text-sm" style={{color: '#1e2a54'}}>Täydellinen teknologiapino ja työkalut ammattimaisen hankinnan automaatioon.</p>
              <img src="/professiona_buyer_tech_stack.png" alt="Professional Buyer Tech Stack" className="rounded-2xl shadow-lg w-full h-auto" style={{borderColor: '#80ffb7', border: '1px solid'}} />
            </div>
          </div>
        </section>

        <section className="mt-32 mb-20">
          <h2 className="text-4xl font-light mb-10 text-center" style={{color: '#003d3b'}}>
            Aloita <span style={{color: '#1e2a54'}}>Ammattiostojan AI-Arviointi</span>
          </h2>
          <div className="flex justify-center gap-6 flex-wrap">
            <RegisterButton />
            <Button
              variant="outline"
              className="px-10 py-4 rounded-full text-lg font-light shadow-lg transition-all duration-300 hover:bg-green-50"
              style={{borderColor: '#003d3b', color: '#003d3b'}}
              asChild
            >
              <Link to="/login">Onko sinulla jo tili? Kirjaudu</Link>
            </Button>
            <Button
              variant="outline"
              className="px-10 py-4 rounded-full text-lg font-light shadow-lg transition-all duration-300 hover:bg-green-50"
              style={{borderColor: '#003d3b', color: '#003d3b'}}
              onClick={() => window.open('https://github.com/mikkovaltonen/professional_buyer', '_blank', 'noopener,noreferrer')}
            >
              Katso Täydellinen Ratkaisu →
            </Button>
          </div>
        </section>

        <section className="mt-32 mb-20">
          <h2 className="text-4xl font-light mb-16 text-center" style={{color: '#003d3b'}}>Tietosuoja Google Cloudin Kanssa</h2>
          <div className="max-w-6xl mx-auto p-8 bg-white rounded-3xl shadow-xl" style={{borderColor: '#80ffb7', border: '1px solid'}}>
            <div className="space-y-8">
              <div>
                <p className="text-lg font-light leading-relaxed mb-6" style={{color: '#1e2a54'}}>
                  Gemini API on suunniteltu Googlen vahvojen yritystason turvallisuus- ja yksityisyysperiaatteiden mukaisesti. Tämä tarkoittaa käytännössä:
                </p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-2xl font-light mb-4" style={{color: '#003d3b'}}>Tietojen Omistajuus ja Turvallisuus</h3>
                  <ul className="space-y-3 font-light" style={{color: '#1e2a54'}}>
                    <li>• <strong>Omistat tietosi:</strong> Google ei käytä Gemini API:n kautta käsiteltäviä tietoja omien malliensa kouluttamiseen tai mainosten kohdentamiseen ilman nimeänomaälista lupaa.</li>
                    <li>• <strong>Luottamuksellisuus:</strong> Tietosi käsitellään luottamuksellisesti rajoitetulla pääsyllä.</li>
                    <li>• <strong>Säädöstenmukaisuus:</strong> Palvelu noudattaa alan standardeja ja säädöksiä, kuten ISO-sertifiointeja, ja auttaa yrityksiä täyttämään GDPR-vaatimukset.</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-2xl font-light mb-4" style={{color: '#003d3b'}}>Viiteasiakkaat</h3>
                  <div className="font-light space-y-3" style={{color: '#1e2a54'}}>
                    <p>Vaikka yksittäisiä Gemini API -asiakaslistoja ei julkaista, käyttäjäkunta on laaja ja jatkuvasti kasvava, mukaan lukien:</p>
                    <ul className="space-y-2 ml-4">
                      <li>• <strong>Eri toimialojen yrityksiä:</strong> Teknologiayrityksiä, valmistusteollisuuden toimijoita ja monia muita organisaatioita</li>
                      <li>• <strong>Google Workspace -käyttäjiä:</strong> Yritykset kuten Neste, Uber ja Sports Basement käyttävät Gemini-teknologiaa</li>
                      <li>• <strong>Sovelluskehittäjiä:</strong> Suuri yhteisö, joka rakentaa älykkäitä sovelluksia</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="pt-6 border-t" style={{borderColor: '#80ffb7'}}>
                <h3 className="text-2xl font-light mb-4" style={{color: '#003d3b'}}>Haminan Datakeskus ja Tietojen Sijainti</h3>
                <div className="font-light space-y-4" style={{color: '#1e2a54'}}>
                  <p>
                    Googlella on merkittävä ja moderni datakeskus Haminassa, Suomessa, joka on osa Google Cloud Platformin (GCP) europe-north1-aluetta. Google mahdollistaa tietojen käsittelyn ja tallennuksen europe-north1-alueella, mikä auttaa täyttämään paikalliset säädökset ja voi tarjota matalamman viiveen pohjoismaisille käyttäjille.
                  </p>
                  <p>
                    Yhteenvetona, Gemini API tarjoaa vahvan tietosuojan ja sitä käyttävät monet eri organisaatiot. Vaikka API-tietojen suora reititys Haminaan ei ole oletusominaisuus, Haminan datakeskuksen hyödyntäminen on mahdollista, jos tietojen maantieteellinen sijainti on liiketoiminnallesi kriittinen tekijä.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-32 mb-20">
          <h2 className="text-4xl font-light mb-16 text-center" style={{color: '#003d3b'}}>Tietoa Rettasta</h2>
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
                Vieraile retta.fi-sivustolla
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
                <li><a href="https://retta.fi/palvelumme" className="font-light transition-colors duration-300 text-white hover:opacity-80" style={{color: '#80ffb7'}}>Kiinteistönhallinnan Palvelut</a></li>
                <li><a href="https://retta.fi/rakennuttajille-ja-suurasiakkaille" className="font-light transition-colors duration-300 text-white hover:opacity-80" style={{color: '#80ffb7'}}>Rakennuttajille ja Suurasiakkaille</a></li>
                <li><a href="https://retta.fi/tietoa-asumisesta" className="font-light transition-colors duration-300 text-white hover:opacity-80" style={{color: '#80ffb7'}}>Tietoa Asumisesta</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-light text-lg mb-6 text-white">Asiakkuus</h3>
              <ul className="space-y-3">
                <li><a href="https://retta.fi/tule-asiakkaaksi" className="font-light transition-colors duration-300 text-white hover:opacity-80" style={{color: '#80ffb7'}}>Tule Asiakkaaksi</a></li>
                <li><a href="https://retta.fi/omaretta" className="font-light transition-colors duration-300 text-white hover:opacity-80" style={{color: '#80ffb7'}}>OmaRetta-portaali</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-light text-lg mb-6 text-white">Tietoa meistä</h3>
              <ul className="space-y-3">
                <li><a href="https://retta.fi/tietoa-meista" className="font-light transition-colors duration-300 text-white hover:opacity-80" style={{color: '#80ffb7'}}>Tietoa Meistä</a></li>
                <li><a href="https://retta.fi/toihin-rettalle" className="font-light transition-colors duration-300 text-white hover:opacity-80" style={{color: '#80ffb7'}}>Töihin Rettalle</a></li>
                <li><a href="https://retta.fi" className="font-light transition-colors duration-300 text-white hover:opacity-80" style={{color: '#80ffb7'}}>Vieraile Retta.fi-sivustolla</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-16 pt-8 text-center" style={{borderTop: '1px solid #1e2a54'}}>
            <p className="font-light" style={{color: '#80ffb7'}}>© 2024 Retta. Kaikki oikeudet pidätetään.</p>
            <p className="font-light mt-2" style={{color: '#bedaff'}}>AI-assistentti kehittynyt Mikko Valtosen toimesta Rettalle</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
