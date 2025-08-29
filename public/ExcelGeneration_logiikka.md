
# MyyntiExcel-generointi - Toiminnallinen määrittely

## Yleiskuvaus
MyyntiExcel-painike on Retta-laskutusapurin keskeinen ominaisuus, joka muuntaa TARKASTUSTAULUKOSTA (Verification Table) varmennetut hintatiedot Housewise-laskutusjärjestelmään yhteensopivaksi Excel-tiedostoksi.

## Toiminnalliset vaatimukset

### 2. Taulukon rakenteen tunnistus

#### Odotettu TARKASTUSTAULUKKO-muoto (Yleinen rakenne)
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

## Toteutetut isännöitsijäkohtaiset rakenteet

### HOAS-rakenne
**Tunnistus**: Asiakasnumero 65763, Laskutettava yhtiö sisältää "HOAS" tai "Helsingin seudun opiskelija-asuntosäätiö"

**MyyntiExcel-sarakkeet**:
| Sarake | Kentän nimi | Tyyppi | Sisältö | Esimerkki |
|--------|-------------|--------|---------|-----------|
| A | KP | Numero | Kustannuspaikka | 720 |
| B | Asiakasnumero /Tampuuri nro | Numero | Tampuuri/Asiakasnumero | 65763 |
| C | Laskutettava yhtiö | Teksti | Yhtiön nimi | "Helsingin seudun opiskelija-asuntosäätiö sr" |
| D | Kohde | Teksti | Kiinteistön kohdetiedot | "166, HOAS kurkisuontie 9" |
| E | Reskontra | Teksti | Reskontrakoodi | "MM" |
| F | Tuotekoodi | Numero | Tuotekoodi | 1571 |
| G | määrä | Numero | Kappalemäärä | 1 |
| H | ahinta alv 0% | Numero | Hinta ilman ALV | 281.50 |
| I | Kuvaus | Teksti | Tuotekuvaus | "Leikkihiekan vaihto..." |
| J | yksikkö, kpl | Numero | Yksikkömäärä | 1.0 |
| K | alvkoodi | Teksti | ALV-koodi | "255SN" |
| L | Laskutusaikataulu | Teksti | Aikataulu | - |
| M | Verkkolaskuosoite | Numero | E-laskuosoite | 3701011385 |
| N | Operaattoritunnus | Teksti | Operaattori | "TE003701165149HOAS" |
| O | Välittäjä | Teksti | Välittäjä | "TietoEVRY Oyj" |

### Kontu ja Onni -rakenne (Tytäryhtiörakenne)
**Tunnistus**: Isännöitsijä-kenttä sisältää "Kontu" tai "Onni"

**MyyntiExcel-sarakkeet**:
| Sarake | Kentän nimi | Tyyppi | Sisältö | Esimerkki |
|--------|-------------|--------|---------|-----------|
| A | Yhtiö | Teksti | Asunto-osakeyhtiön nimi | "Asunto Oy Hesperiankatu 30" |
| B | Tuote | Teksti | Tuotekuvaus | "Kontu Palovaroittimien asennuspalvelu (paristo)" |
| C | Määrä | Numero | Kappalemäärä | 50.0 |
| D | alv 0% | Numero | Hinta ilman ALV | 2212.50 |
| E | alv 25,5% | Numero | Hinta ALV:n kanssa | 2776.69 |
| F | Selite | Teksti | Tuoteselite | "Kontu Palovaroittimien asennus (paristo)" |
| G | Työnumero (Safetumin käyttöön) | Numero | Työtilausnumero | 30995.0 |
| H | Isännöitsijä | Teksti | Isännöitsijä | "Kontu" tai "Onni" |
| I | Huomautukset | Teksti | Lisätiedot | "Laskutetaan heinäkuussa" |

**Tytäryhtiökohtainen jako**:
- **Kontu-kiinteistöt**: Tunnistetaan Isännöitsijä-kentän arvolla "Kontu"
- **Onni-kiinteistöt**: Tunnistetaan Isännöitsijä-kentän arvolla "Onni" tai "Onni "

### Retta Management -rakenne
**Tunnistus**: Käytetään kun isännöitsijä ei ole HOAS, Kontu tai Onni. Asiakasnumero voi olla pitkä numerokoodi (esim. 3733264563)

**MyyntiExcel-sarakkeet**:
| Sarake | Kentän nimi | Tyyppi | Sisältö | Esimerkki |
|--------|-------------|--------|---------|-----------|
| A | asiakasnumero (kuvaus) | Numero | Asiakkaan tunniste | 3733264563 |
| B | reskontra | Teksti | Reskontrakoodi | "MK" |
| C | tuotekoodi | Numero | Tuotekoodi | 1578 |
| D | määrä | Numero | Kappalemäärä | 51.0 |
| E | ahinta | Numero | A-hinta ilman ALV | 48.0 |
| F | kuvaus | Teksti | Tuotekuvaus | "Palovaroittimien asennus (paristo)" |
| G | yksikkö | Teksti | Mittayksikkö | - |
| H | tuotenimi | Teksti | Tuotteen nimi | - |
| I | alvkoodi | Teksti | ALV-koodi | "255SN" |
| J | Isännöitsijä | Teksti | Isännöitsijä | - |
| K | Kustannuspaikka | Teksti | Kustannuspaikka | - |
| L | Tilausnumero (kuvaus) | Numero | Tilausnumero | 2508008 |
| M | Yhteensä | Numero | Laskettu summa (määrä × ahinta) | 2448.0 |
| N | Kohde (kuvaus) | Teksti | Kiinteistön kohdetiedot | "Vivada Helsinki 2B Oy / Espoon Suopurontie 1" |
| O | Verkkolaskuosoite | Numero | E-laskuosoite | 3733264563 |
| P | Operaatiotunnus | Teksti | Operaattori | "E204503" |
| Q | Välittäjä | Teksti | Välittäjä | "OpusCapita Solutions Oy" |

**Erityispiirteet**:
- Sisältää verkkolaskutustiedot (3 viimeistä saraketta)
- Kentät päättyvät usein "(kuvaus)" -tekstiin
- Yhteensä-sarake lasketaan automaattisesti
- Kohdetieto on yksityiskohtaisempi kuin muissa rakenteissa

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

### 2. Automaattinen isännöitsijän tunnistus TARKASTUSTAULUKOSTA
**Vaatimus**: Tunnista isännöitsijätyyppi automaattisesti TARKASTUSTAULUKKO-datasta

**Tunnistuslogiikka**:
- Analysoi Tampuuri-numerot ja muut kentät
- Kartoita automaattisesti oikeaan isännöitsijärakenteeseen
- Varoita käyttäjää, jos tunnistus epävarma

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
LÄHDEDATA
│
├─ Analysoi kentät
│   ├─ Isännöitsijä-kenttä olemassa?
│   ├─ Asiakasnumero/Tampuuri?
│   └─ Laskutettava yhtiö?
│
├─ ONKO HOAS?
│   │
│   ├─ Asiakasnumero = 65763? TAI
│   ├─ Laskutettava yhtiö sisältää "HOAS"? TAI
│   ├─ Laskutettava yhtiö = "Helsingin seudun opiskelija-asuntosäätiö"?
│   │
│   └─ KYLLÄ → Käytä HOAS-rakennetta
│       └─ Luo HOAS MyyntiExcel (15 saraketta)
│
├─ ONKO TYTÄRYHTIÖ (Kontu/Onni)?
│   │
│   ├─ Isännöitsijä-kenttä = "Kontu"?
│   │   └─ KYLLÄ → Käytä Kontu-rakennetta
│   │       └─ Luo Kontu MyyntiExcel (9 saraketta)
│   │
│   └─ Isännöitsijä-kenttä = "Onni" TAI "Onni "?
│       └─ KYLLÄ → Käytä Onni-rakennetta
│           └─ Luo Onni MyyntiExcel (9 saraketta)
│
├─ ONKO RETTA MANAGEMENT?
│   │
│   └─ Muut tapaukset → Käytä Retta Management -rakennetta
│       └─ Luo Retta MyyntiExcel (yleinen 13 saraketta)
│
└─ VIRHEKÄSITTELY
    │
    └─ Jos tunnistus epäonnistuu
        └─ Käytä oletusrakennetta
            └─ Varoita: "Isännöitsijää ei voitu tunnistaa"
```

## Implementoitu tunnistuslogiikka todellisten esimerkkien perusteella

### Isännöitsijän automaattinen tunnistus
1. **HOAS-tunnistus**
   - Asiakasnumero = 65763
   - Laskutettava yhtiö sisältää "HOAS" tai "Helsingin seudun opiskelija-asuntosäätiö"
   - Kohde-kenttä alkaa numerolla ja sisältää "HOAS"

2. **Kontu/Onni-tunnistus**
   - Isännöitsijä-kenttä eksplisiittisesti määritetty
   - Tuote-kenttä alkaa tekstillä "Kontu" (historiallinen merkintätapa)
   - Yhtiö-kenttä sisältää asunto-osakeyhtiön nimen

3. **Retta Management -oletusrakenne**
   - Käytetään kun ei tunnisteta HOAS tai Kontu/Onni

### Puuttuvat tiedot jatkokehitykseen
1. **Tampuuri-kiinteistökartoitus**
   - Täydellinen lista kiinteistöjen Tampuuri-koodeista
   - Isännöitsijäkohtainen kiinteistöluettelo

2. **LaskuerittelyExcel-muoto**
   - Yksityiskohtaisten laskujen rakenne tytäryhtiöille
   - Keskitetyn laskutuksen koontisäännöt

3. **Liiketoimintasäännöt**
   - Miten käsitellä sekaisännöitsijälaskuja
   - Virheenkäsittely epäselvissä tapauksissa

### Ehdotettu ratkaisuarkkitehtuuri

```javascript
// Tunnistuslogiikka todellisten esimerkkien perusteella
const isannoitsijaKonfiguraatio = {
  hoas: {
    tunnistus: {
      asiakasnumero: [65763],
      laskutettavaYhtio: ['HOAS', 'Helsingin seudun opiskelija-asuntosäätiö'],
      kohdePattern: /^\d+,\s*HOAS/
    },
    sarakkeet: ['KP', 'Asiakasnumero /Tampuuri nro', 'Laskutettava yhtiö', 
                'Kohde', 'Reskontra', 'Tuotekoodi', 'määrä', 'ahinta alv 0%',
                'Kuvaus', 'yksikkö, kpl', 'alvkoodi', 'Laskutusaikataulu',
                'Verkkolaskuosoite', 'Operaattoritunnus', 'Välittäjä']
  },
  kontu: {
    tunnistus: {
      isannoitsijaKentta: 'Kontu',
      tuotePrefix: 'Kontu'
    },
    sarakkeet: ['Yhtiö', 'Tuote', 'Määrä', 'alv 0%', 'alv 25,5%', 
                'Selite', 'Työnumero (Safetumin käyttöön)', 'Isännöitsijä', 
                'Huomautukset']
  },
  onni: {
    tunnistus: {
      isannoitsijaKentta: ['Onni', 'Onni ']
    },
    sarakkeet: ['Yhtiö', 'Tuote', 'Määrä', 'alv 0%', 'alv 25,5%', 
                'Selite', 'Työnumero (Safetumin käyttöön)', 'Isännöitsijä', 
                'Huomautukset']
  },
  rettaManagement: {
    tunnistus: {
      oletus: true // Käytetään kun muut eivät täsmää
    },
    sarakkeet: ['asiakasnumero (kuvaus)', 'reskontra', 'tuotekoodi', 'määrä', 
                'ahinta', 'kuvaus', 'yksikkö', 'tuotenimi', 'alvkoodi',
                'Isännöitsijä', 'Kustannuspaikka', 'Tilausnumero (kuvaus)',
                'Yhteensä', 'Kohde (kuvaus)', 'Verkkolaskuosoite', 
                'Operaatiotunnus', 'Välittäjä']
  }
};

// Funktio isännöitsijän tunnistamiseksi
function tunnistaIsannoitsija(rivi) {
  // HOAS-tunnistus
  if (rivi['Asiakasnumero /Tampuuri nro'] === 65763 ||
      rivi['Laskutettava yhtiö']?.includes('HOAS') ||
      rivi['Laskutettava yhtiö']?.includes('Helsingin seudun opiskelija-asuntosäätiö')) {
    return 'hoas';
  }
  
  // Kontu/Onni-tunnistus
  if (rivi['Isännöitsijä'] === 'Kontu' || 
      rivi['Tuote']?.startsWith('Kontu')) {
    return 'kontu';
  }
  
  if (rivi['Isännöitsijä'] === 'Onni' || 
      rivi['Isännöitsijä'] === 'Onni ') {
    return 'onni';
  }
  
  // Oletusrakenne
  return 'rettaManagement';
}

// Funktio MyyntiExcelin luomiseksi
function luoMyyntiExcel(data, isannoitsija) {
  const config = isannoitsijaKonfiguraatio[isannoitsija];
  const sarakkeet = config.sarakkeet;
  
  // Luo Excel-tiedosto oikealla sarakerakenteella
  return generoiExcel(data, sarakkeet);
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

## Yhteenveto todellisista MyyntiExcel-rakenteista

### Rakenteiden vertailu
| Ominaisuus | HOAS | Kontu/Onni | Retta Management |
|------------|------|------------|------------------|
| Sarakkeiden määrä | 15 | 9 | 17 |
| Tunnistusperuste | Asiakasnumero 65763, HOAS-teksti | Isännöitsijä-kenttä | Oletusrakenne |
| Reskontra | MM | - | MK |
| ALV-käsittely | alvkoodi (255SN) | alv 0% ja alv 25,5% erillisinä | alvkoodi (255SN) |
| Verkkolaskutus | Kyllä (3 saraketta) | Ei | Kyllä (3 saraketta) |
| Työnumero | Ei | Kyllä | Tilausnumero |
| Kustannuspaikka | KP (720) | - | Tyhjä |
| Yhtiötieto | Laskutettava yhtiö + Kohde | Yhtiö | Kohde (kuvaus) |
| Yhteensä-sarake | Ei | Ei | Kyllä (laskettu) |
| Kenttien nimeäminen | Normaali | Normaali | "(kuvaus)" -liitteet |

### Keskeisimmät erot
1. **HOAS**: 15 saraketta, verkkolaskutustiedot, kiinteä kustannuspaikka (720), reskontra MM
2. **Kontu/Onni**: 9 saraketta, ALV laskettu valmiiksi kahdessa sarakkeessa, työnumerot mukana
3. **Retta Management**: 17 saraketta (laajin), verkkolaskutustiedot, yhteensä-sarake, kentät päättyvät "(kuvaus)"-tekstiin

*Päivitetty: 29.8.2025*
*Versio: 2.0*
*Tekijä: Retta-kehitystiimi*
*Muutos: Lisätty todelliset MyyntiExcel-rakenteet esimerkkien perusteella*