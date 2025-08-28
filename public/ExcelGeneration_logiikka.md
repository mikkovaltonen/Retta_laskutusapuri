
# MyyntiExcel-generointi - Toiminnallinen määrittely

## Yleiskuvaus
MyyntiExcel-painike on Retta-laskutusapurin keskeinen ominaisuus, joka muuntaa TARKASTUSTAULUKOSTA (Verification Table) varmennetut hintatiedot Housewise-laskutusjärjestelmään yhteensopivaksi Excel-tiedostoksi.

## Toiminnalliset vaatimukset

### 2. Taulukon rakenteen tunnistus

#### Odotettu TARKASTUSTAULUKKO-muoto
| Sarake | Kentän nimi | Kuvaus | Kartoitetaan |
|--------|-------------|--------|--------------|
| 1 | Tampuuri | Asiakaskiinteistön ID | asiakasnumero |
| 2 | RP-numero | Tilausnumero | tilausnumero |
| 3 | Tuote | Tuotekuvaus (max 80 merkkiä) | kuvaus |
| 4 | O.hinta (o) | Ostohinta laskusta | - |
| 5 | O.hinta (h) | Ostohinta hinnastosta | - |
| 6 | M.hinta (o) | Myyntihinta laskusta | - |
| 7 | M.hinta (h) | Myyntihinta hinnastosta | - |
| 8 | M.hinta (t) | Myyntihinta tilauksesta | - |
| 9 | Tarkastus | Varmennusmuistiinpanot | - |
| 10 | A-hinta | Lopullinen hyväksytty hinta | ahinta |
| 11 | Määrä | Kappalemäärä | määrä |
| 12 | Yksikkö | Mittayksikkö | yksikkö |
| 13 | ALV-koodi | ALV-koodi | alvkoodi |

### 3. Tietojen muunnossäännöt

#### Kenttien kartoitus
```javascript
{
  asiakasnumero: tampuuri,        // Sarake 1: Asiakastunnus
  reskontra: 'MK',                // Kiinteä arvo
  tuotekoodi: '',                 // Aina tyhjä
  määrä: määrä,                   // Sarake 11: Määrä
  ahinta: a_hinta,                // Sarake 10: Yksikköhinta
  yhteensä: määrä * a_hinta,     // Laskettu: yhteensä
  kuvaus: tuote,                  // Sarake 3: Tuotekuvaus
  yksikkö: yksikkö,              // Sarake 12: Yksikkö
  tuotenimi: '',                  // Aina tyhjä
  alvkoodi: alvkoodi,            // Sarake 13: ALV-koodi (ilman %)
  isännöitsijä: '',              // Aina tyhjä
  kustannuspaikka: '',           // Aina tyhjä
  tilausnumero: rp_numero        // Sarake 2: Tilausnumero
}
```

#### Tietojen validointisäännöt
1. **Tampuuri (Asiakastunnus)**: Pakollinen, ei saa olla tyhjä
2. **A-hinta (Hinta)**: Täytyy olla > 0
3. **Määrä**: Oletusarvo 1, jos puuttuu tai virheellinen
4. **Yksikkö**: Oletusarvo 'kpl', jos puuttuu
5. **ALV-koodi**: Oletusarvo '24', jos puuttuu, poista %-merkki
6. **RP-numero**: Korvaa "---" -kuviot tyhjällä merkkijonolla

#### Sarakerakenne
| Sarake | Otsikko | Tyyppi | Muoto |
|--------|---------|--------|-------|
| A | Asiakasnumero | Teksti | Merkkijono |
| B | Reskontra | Teksti | "MK" |
| C | Tuotekoodi | Teksti | Tyhjä |
| D | Määrä | Numero | Desimaali |
| E | A-hinta | Numero | Valuutta (€) |
| F | Yhteensä | Numero | Valuutta (€) |
| G | Kuvaus | Teksti | Merkkijono (max 80 merkkiä) |
| H | Yksikkö | Teksti | Merkkijono |
| I | Tuotenimi | Teksti | Tyhjä |
| J | ALV-koodi | Teksti | Numero merkkijonona |
| K | Isännöitsijä | Teksti | Tyhjä |
| L | Kustannuspaikka | Teksti | Tyhjä |
| M | Tilausnumero | Teksti | Merkkijono |

## Tulevat toiminnallisuusvaatimukset

### 1. TarkastusExcel-välilehden generointi
**Vaatimus**: Luo lisävälilehti "TarkastusExcel", joka sisältää samat tiedot kuin TARKASTUSTAULUKKO

**Toteutuksen yksityiskohdat**:
- Lisää Excel-tiedostoon toinen välilehti nimeltä "TarkastusExcel"
- Sisällytä kaikki 13 saraketta TARKASTUSTAULUKOSTA alkuperäisillä otsikoilla
- Säilytä varmennusmuistiinpanot ja vertailutiedot (O.hinta, M.hinta -variantit)
- Säilytä alkuperäinen muotoilu ja sarakeleveydet

**Rakenne**:
| Sarake | Otsikko | Sisältö |
|--------|---------|---------|
| A | Tampuuri | Asiakaskiinteistön ID |
| B | RP-numero | Tilausnumero |
| C | Tuote | Tuotekuvaus |
| D | O.hinta (o) | Ostohinta laskusta |
| E | O.hinta (h) | Ostohinta hinnastosta |
| F | M.hinta (o) | Myyntihinta laskusta |
| G | M.hinta (h) | Myyntihinta hinnastosta |
| H | M.hinta (t) | Myyntihinta tilauksesta |
| I | Tarkastus | Varmennusmuistiinpanot |
| J | A-hinta | Lopullinen hyväksytty hinta |
| K | Määrä | Kappalemäärä |
| L | Yksikkö | Yksikkö |
| M | ALV-koodi | ALV-koodi |

### 2. Isännöitsijäkohtaiset rakenteet
**Vaatimus**: MyyntiExcel-rakenteen tulee vaihdella isännöitsijätyypin mukaan

**Kolme rakennetyyppiä**:
1. **Tytäryhtiörakenne**: Kontu ja Onni
2. **Retta Management -rakenne**: Retta Management -kiinteistöt
3. **HOAS-rakenne**: HOAS-kiinteistöt

**Puuttuvat syöttötiedot**:
- Isännöitsijän tunnistuskenttä OstolaskuExcelissä tai erillinen konfiguraatio
- Yksityiskohtaiset sarakemäärittelyt kullekin rakennetyypille
- Kenttien kartoitussäännöt kullekin isännöitsijätyypille
- Liiketoimintasäännöt rakenteen määrittämiseksi

### 3. Tytäryhtiöiden laskujen jakaminen
**Vaatimus**: Tytäryhtiöisännöitsijöille (Kontu ja Onni) jaetaan yhden kuukauden OstolaskuExcel neljään erilliseen tiedostoon

**Tulostiedostot**:
1. **Kontu MyyntiExcel** - Keskitettyyn laskutukseen Kontulle
2. **Onni MyyntiExcel** - Keskitettyyn laskutukseen Onnille
3. **Kontu LaskuerittelyExcel** - Yksityiskohtainen laskuerittely Kontulle
4. **Onni LaskuerittelyExcel** - Yksityiskohtainen laskuerittely Onnille

**Puuttuvat syöttötiedot**:
- Kiinteistö-tytäryhtiö-kartoitus (mitkä kiinteistöt kuuluvat Kontulle vs Onnille)
- LaskuerittelyExcel-muodon määrittely
- Jakologiikka (miten erotella kohteet tytäryhtiöiden välillä)
- Keskitetyn vs yksityiskohtaisen laskun kenttäerot

## ASCII-päätöspuu isännöitsijärakenteen valinnalle

```
TAMPUURINUMERO
│
├─ Hae isännöitsijä Tampuurin perusteella
│
├─ ONKO TYTÄRYHTIÖ?
│   │
│   ├─ KYLLÄ → Tunnista tytäryhtiö
│   │   │
│   │   ├─ Tampuuri kuuluu Kontu-listaan?
│   │   │   └─ KYLLÄ → Käytä Kontu-rakennetta
│   │   │       └─ Luo 2 tiedostoa:
│   │   │           ├─ Kontu MyyntiExcel (keskitetty)
│   │   │           └─ Kontu LaskuerittelyExcel (yksityiskohtainen)
│   │   │
│   │   └─ Tampuuri kuuluu Onni-listaan?
│   │       └─ KYLLÄ → Käytä Onni-rakennetta
│   │           └─ Luo 2 tiedostoa:
│   │               ├─ Onni MyyntiExcel (keskitetty)
│   │               └─ Onni LaskuerittelyExcel (yksityiskohtainen)
│   │
│   └─ EI → Jatka muihin isännöitsijöihin
│
├─ ONKO RETTA MANAGEMENT?
│   │
│   └─ KYLLÄ → Käytä Retta Management -rakennetta
│       └─ Luo 1 tiedosto: Retta MyyntiExcel
│
├─ ONKO HOAS?
│   │
│   └─ KYLLÄ → Käytä HOAS-rakennetta
│       └─ Luo 1 tiedosto: HOAS MyyntiExcel
│
└─ EI TUNNISTETTU
    │
    └─ Käytä oletusrakennetta (nykyinen)
        └─ Varoita käyttäjää: "Isännöitsijää ei tunnistettu"
```

## Puuttuvien syöttötietojen yhteenveto

### Kriittiset puuttuvat tiedot
1. **Isännöitsijän tunnistus**
   - Kentän nimi lähdetiedoissa isännöitsijän tunnistamiseksi
   - Lista isännöitsijöistä ja niiden tyypeistä
   - Tampuuri-koodien kartoitus isännöitsijöille

2. **Rakennespesifikaatiot**
   - Yksityiskohtaiset sarakeasetelmat kullekin kolmelle rakenteelle
   - Pakolliset vs valinnaiset kentät rakennekohtaisesti
   - Rakennekohtaiset validointisäännöt

3. **Tytäryhtiökonfiguraatio**
   - Täydellinen lista Kontu-kiinteistöistä (Tampuuri-koodit)
   - Täydellinen lista Onni-kiinteistöistä (Tampuuri-koodit)
   - Säännöt kumpaankaan kuulumattomien kiinteistöjen käsittelyyn

4. **LaskuerittelyExcel-muoto**
   - Yksityiskohtaisten laskujen sarakerakenne
   - Ero MyyntiExcelin ja LaskuerittelyExcelin välillä
   - Keskitetyn laskutuksen koontisäännöt

5. **Liiketoimintasäännöt**
   - Miten käsitellä sekaisännöitsijälaskuja
   - Oletusrakenne, kun isännöitsijää ei voida määrittää
   - Virheenkäsittely epäselvissä tapauksissa

### Ehdotettu ratkaisuarkkitehtuuri

```javascript
// Tarvittava konfiguraatio-objekti
const isannoitsijaKonfiguraatio = {
  rakenteet: {
    tytaryhtiö: {
      kontu: {
        kiinteistot: [], // Lista Tampuuri-koodeista
        myyntiSarakkeet: [], // Sarakemäärittely
        erittelySarakkeet: [] // Yksityiskohtaisen laskun sarakkeet
      },
      onni: {
        kiinteistot: [], // Lista Tampuuri-koodeista
        myyntiSarakkeet: [], // Sarakemäärittely
        erittelySarakkeet: [] // Yksityiskohtaisen laskun sarakkeet
      }
    },
    rettaManagement: {
      kiinteistot: [], // Lista Tampuuri-koodeista
      sarakkeet: [] // Sarakemäärittely
    },
    hoas: {
      kiinteistot: [], // Lista Tampuuri-koodeista
      sarakkeet: [] // Sarakemäärittely
    }
  }
};

// Funktio rakenteen määrittämiseksi
function maaritaRakenne(tampuuri) {
  // Logiikka käytettävän rakenteen tunnistamiseksi
  // Palauttaa: 'kontu', 'onni', 'rettaManagement', 'hoas'
}

// Funktio sopivien tiedostojen luomiseksi
function luoTiedostot(tarkastusTiedot) {
  const tiedostotIsannoitsijoittain = ryhmitteleIsannoitsijanMukaan(tarkastusTiedot);
  const tulosTiedostot = [];
  
  for (const [isannoitsija, tiedot] of Object.entries(tiedostotIsannoitsijoittain)) {
    switch(isannoitsija) {
      case 'kontu':
      case 'onni':
        tulosTiedostot.push(luoMyyntiExcel(tiedot, isannoitsija));
        tulosTiedostot.push(luoLaskuerittelyExcel(tiedot, isannoitsija));
        break;
      default:
        tulosTiedostot.push(luoMyyntiExcel(tiedot, isannoitsija));
    }
  }
  
  return tulosTiedostot;
}
```

### Toteutusvaiheet

**Vaihe 1**: Perus TarkastusExcel-välilehden lisäys
- Lisää toinen välilehti varmennustiedoilla
- Ei rakenteellisia muutoksia MyyntiExceliin

**Vaihe 2**: Isännöitsijän tunnistus
- Lisää konfiguraatio isännöitsijäkartoitukselle
- Toteuta rakenteen tunnistuslogiikka

**Vaihe 3**: Usean rakenteen tuki
- Toteuta kolme erilaista sarakerakennetta
- Lisää rakennekohtainen validointi

**Vaihe 4**: Tytäryhtiöiden jakaminen
- Toteuta neljän tiedoston generointi tytäryhtiöille
- Lisää LaskuerittelyExcel-muoto

### Testausvaatimukset

1. **Yksikkötestit**
   - Isännöitsijän tunnistuksen tarkkuus
   - Rakenteen valintalogiikka
   - Tiedostojen jakaminen tytäryhtiöille

2. **Integraatiotestit**
   - Usean tiedoston generointi
   - Rakenteiden välinen yhteensopivuus
   - Tietojen johdonmukaisuus jaoissa

3. **Hyväksymiskriteerit**
   - Kaikki isännöitsijät tunnistetaan oikein
   - Sopiva rakenne sovelletaan jokaiselle
   - Tytäryhtiölaskut jaetaan oikein
   - TarkastusExcel vastaa alkuperäistä taulukkoa

*Päivitetty: 28.8.2025*
*Versio: 1.1*
*Tekijä: Retta-kehitystiimi*