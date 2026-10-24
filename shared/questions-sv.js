// Swedish question bank (the same shape as shared/questions.js): each question has exactly four options; `correct` is the
// index of the right one. It mirrors the Norwegian bank one to one, in the same order and with the same ids, so the right
// answer letters come out the same way.
//
// - General world-knowledge questions are translations of the Norwegian ones (same id, same options in the same order,
//   same `correct`).
// - Questions whose subject was Norway or something Norwegian are replaced by new questions about Sweden or Swedish
//   culture of the same kind, in the same place in the bank and with the right answer in the same position, with new ids.
//   Every fact in them was checked against a source (Wikipedia, riksdagen.se, NATO, Nobel Prize and similar).
// - Numbers and records that change over time say "per 2026" (or a fixed year) in the text.
//
// What makes a good Disputt question: something people feel they once knew but are not sure of, so the group has to
// argue its way to the answer (and the impostor, who knows it, has something to bend). test/questions.test.js keeps count.

export const QUESTIONS_SV = [
  // ---- the first four test questions
  {
    id: 'turister',
    text: 'Vilket land har flest turister per år?',
    options: ['USA', 'Japan', 'Frankrike', 'Kina'],
    correct: 2,
  },
  {
    id: 'orken',
    text: 'Vilken är världens största öken?',
    options: ['Sahara', 'Antarktis', 'Gobi', 'Arabiska öknen'],
    correct: 1,
  },
  {
    id: 'elv',
    text: 'Vilken är Europas längsta flod?',
    options: ['Donau', 'Rhen', 'Dnepr', 'Volga'],
    correct: 3,
  },
  {
    id: 'blekksprut',
    text: 'Hur många hjärtan har en bläckfisk?',
    options: ['Tre', 'Ett', 'Fyra', 'Två'],
    correct: 0,
  },

  // ---- Sverige: historia och samhälle
  { id: 'swish-lansering', text: 'Vilket år lanserades Swish?', options: ['2010', '2012', '2014', '2016'], correct: 1 },
  { id: 'unionen', text: 'Vilket år upplöstes unionen mellan Sverige och Norge?', options: ['1814', '1884', '1905', '1920'], correct: 2 },
  {
    id: 'kvinnor-valde',
    text: 'När röstade svenska kvinnor först i ett riksdagsval?',
    options: ['1905', '1911', '1916', '1921'],
    correct: 3,
  },
  {
    id: 'eu-folkomrostning',
    text: 'Vilket år röstade svenskarna ja till EU i folkomröstningen?',
    options: ['1990', '1994', '1997', '2003'],
    correct: 1,
  },
  { id: 'ikea-grundades', text: 'Vilket år grundades IKEA av Ingvar Kamprad?', options: ['1943', '1951', '1958', '1964'], correct: 0 },
  { id: 'hogertrafik', text: 'Vilket år gick Sverige över till högertrafik?', options: ['1953', '1957', '1962', '1967'], correct: 3 },
  { id: 'blodbadet', text: 'Vilket år var Stockholms blodbad?', options: ['1520', '1523', '1397', '1632'], correct: 0 },
  {
    id: 'vasa-sjonk',
    text: 'Vilket år sjönk regalskeppet Vasa?',
    options: ['1520', '1611', '1628', '1658'],
    correct: 2,
  },
  { id: 'sommar-os-stockholm', text: 'Vilket år var det sommar-OS i Stockholm?', options: ['1912', '1908', '1920', '1924'], correct: 0 },
  { id: 'oresundsbron', text: 'Vilket år öppnades Öresundsbron?', options: ['1988', '1992', '1996', '2000'], correct: 3 },
  { id: 'nobelpriset-forsta', text: 'Vilket år delades Nobelpriset ut för första gången?', options: ['1896', '1899', '1901', '1905'], correct: 2 },
  {
    id: 'pippi-boken',
    text: 'Vilket år kom den första boken om Pippi Långstrump?',
    options: ['1935', '1945', '1955', '1965'],
    correct: 1,
  },
  { id: 'waterloo', text: 'Vilket år vann ABBA Eurovision med «Waterloo»?', options: ['1974', '1976', '1979', '1982'], correct: 0 },
  {
    id: 'nationaldagen',
    text: 'Vilket datum är Sveriges nationaldag?',
    options: ['30 april', '1 maj', '21 juni', '6 juni'],
    correct: 3,
  },
  { id: 'spotify', text: 'Vilket år grundades Spotify?', options: ['2006', '2009', '2011', '2013'], correct: 0 },
  { id: 'riksdagen', text: 'Hur många ledamöter har Sveriges riksdag?', options: ['299', '325', '349', '375'], correct: 2 },

  // ---- Sverige: natur och kultur
  {
    id: 'lagerlof-nobel',
    text: 'Vem var första kvinna med Nobelpriset i litteratur?',
    options: ['Astrid Lindgren', 'Karin Boye', 'Elin Wägner', 'Selma Lagerlöf'],
    correct: 3,
  },
  { id: 'andree-ornen', text: 'Vad hette ballongen som Andrée flög med 1897?', options: ['Svanen', 'Falken', 'Örnen', 'Fenix'], correct: 2 },
  {
    id: 'midsommarvaka',
    text: 'Vem komponerade «Midsommarvaka»?',
    options: ['Wilhelm Stenhammar', 'Hugo Alfvén', 'Franz Berwald', 'Wilhelm Peterson-Berger'],
    correct: 1,
  },
  {
    id: 'roda-rummet',
    text: 'Vem skrev romanen «Röda rummet»?',
    options: ['August Strindberg', 'Hjalmar Söderberg', 'Verner von Heidenstam', 'Pär Lagerkvist'],
    correct: 0,
  },

  // ---- Världen: historia och teknologi
  { id: 'apollo', text: 'Vilket år var den senaste månlandningen med människor?', options: ['1970', '1972', '1975', '1979'], correct: 1 },
  { id: 'muren', text: 'Vilket år byggdes Berlinmuren?', options: ['1945', '1949', '1953', '1961'], correct: 3 },
  { id: 'mandela', text: 'Vilket år släpptes Nelson Mandela ur fängelset?', options: ['1976', '1980', '1986', '1990'], correct: 3 },
  { id: 'facebook', text: 'Vilket år startades Facebook?', options: ['2004', '2006', '2008', '2010'], correct: 0 },
  { id: 'iphone', text: 'Vilket år kom den första iPhonen?', options: ['2003', '2005', '2007', '2009'], correct: 2 },
  { id: 'sms', text: 'Vilket år skickades det första sms:et?', options: ['1992', '1994', '1996', '1998'], correct: 0 },
  { id: 'potter', text: 'Vilket år kom den första Harry Potter-boken?', options: ['1991', '1994', '1997', '2000'], correct: 2 },
  {
    id: 'wozniak',
    text: 'Vem grundade Apple tillsammans med Steve Jobs?',
    options: ['Bill Gates', 'Steve Wozniak', 'Tim Cook', 'Elon Musk'],
    correct: 1,
  },
  {
    id: 'teresjkova',
    text: 'Vem var den första kvinnan i rymden?',
    options: ['Sally Ride', 'Valentina Teresjkova', 'Svetlana Savitskaja', 'Eileen Collins'],
    correct: 1,
  },

  // ---- Världen: geografi
  { id: 'ankara', text: 'Vilken är Turkiets huvudstad?', options: ['Istanbul', 'Izmir', 'Antalya', 'Ankara'], correct: 3 },
  { id: 'tidssoner', text: 'Hur många tidszoner har Ryssland?', options: ['6', '9', '11', '13'], correct: 2 },
  { id: 'bajkal', text: 'Vilken är världens djupaste sjö?', options: ['Bajkal', 'Tanganyika', 'Lake Superior', 'Victoriasjön'], correct: 0 },
  { id: 'kystlinje', text: 'Vilket land har världens längsta kustlinje?', options: ['Norge', 'Ryssland', 'Indonesien', 'Kanada'], correct: 3 },
  { id: 'sveits', text: 'Hur många nationalspråk har Schweiz?', options: ['2', '3', '4', '5'], correct: 2 },
  {
    id: 'aconcagua',
    text: 'Vilket är det högsta berget utanför Asien?',
    options: ['Mont Blanc', 'Aconcagua', 'Denali', 'Kilimanjaro'],
    correct: 1,
  },

  // ---- Världen: natur och vetenskap
  { id: 'venus', text: 'Vilken planet är varmast?', options: ['Venus', 'Merkurius', 'Mars', 'Jupiter'], correct: 0 },
  { id: 'planeter', text: 'Hur många planeter har vårt solsystem?', options: ['7', '8', '9', '10'], correct: 1 },
  {
    id: 'atmosfaere',
    text: 'Vilken gas finns det mest av i jordens atmosfär?',
    options: ['Syre', 'Koldioxid', 'Argon', 'Kväve'],
    correct: 3,
  },
  { id: 'kromosomer', text: 'Hur många kromosomer har en människa?', options: ['23', '44', '46', '48'], correct: 2 },
  {
    id: 'pilgrimsfalk',
    text: 'Vilket djur har högst toppfart i världen?',
    options: ['Pilgrimsfalk', 'Gepard', 'Svärdfisk', 'Struts'],
    correct: 0,
  },
  { id: 'elefant', text: 'Vilket däggdjur har längst dräktighet?', options: ['Blåval', 'Giraff', 'Elefant', 'Noshörning'], correct: 2 },

  // ---- Mat och dryck
  { id: 'safran', text: 'Vilken krydda är dyrast per kilo?', options: ['Saffran', 'Vanilj', 'Kardemumma', 'Kanel'], correct: 0 },
  { id: 'kaffe', text: 'Vilket land producerar mest kaffe?', options: ['Colombia', 'Vietnam', 'Etiopien', 'Brasilien'], correct: 3 },

  // ---- From the printed question cards (translated; the right answers were checked against sources)
  {
    id: 'delstat',
    text: 'I vilken amerikansk delstat bor flest människor?',
    options: ['Kalifornien', 'Washington', 'Texas', 'New York'],
    correct: 0,
  },
  {
    id: 'sorligste-hovedstad',
    text: 'Vilken är världens sydligaste huvudstad?',
    options: ['Wellington', 'Canberra', 'Santiago de Chile', 'Kapstaden'],
    correct: 0,
  },
  {
    id: 'ukraina-hav',
    text: 'Vilket hav gränsar Ukraina till?',
    options: ['Östersjön', 'Medelhavet', 'Kaspiska havet', 'Svarta havet'],
    correct: 3,
  },
  { id: 'gutenberg', text: 'Ungefär vilket år uppfann Gutenberg boktryckarkonsten?', options: ['1450', '1540', '1630', '1720'], correct: 0 },
  {
    id: 'ekvator-storst',
    text: 'Vilket är det största landet (till ytan) som ekvatorn korsar?',
    options: ['DR Kongo', 'Brasilien', 'Indien', 'Colombia'],
    correct: 1,
  },
  {
    id: 'absolut-ahus',
    text: 'Vilken vodka tillverkas i Åhus i Skåne?',
    options: ['Absolut Vodka', 'Smirnoff', 'Finlandia', 'Grey Goose'],
    correct: 0,
  },
  { id: 'franz-ferdinand', text: 'I vilken stad sköts Franz Ferdinand 1914?', options: ['Moskva', 'Dallas', 'Berlin', 'Sarajevo'], correct: 3 },
  { id: 'afrika-land', text: 'Hur många länder består Afrika av?', options: ['22', '34', '46', '54'], correct: 3 },
  { id: 'ekvator-land', text: 'Hur många länder går ekvatorn genom?', options: ['3', '6', '9', '13'], correct: 3 },
  {
    id: 'mosambik',
    text: 'Vad finns på Moçambiques flagga?',
    options: ['Ett lejon med vingar', 'En naken dam', 'Ett AK-47-gevär', 'Ett skeppsratt'],
    correct: 2,
  },
  {
    id: 'janssons-frestelse',
    text: 'Vad är Janssons frestelse gjord på?',
    options: ['Sill, ägg och gräslök', 'Potatis, lök, ansjovis', 'Fläsk och kålrot', 'Lax, dill och potatis'],
    correct: 1,
  },

  // ---- More in the same style: Sverige
  {
    id: 'vanern',
    text: 'Vilken är Sveriges största sjö?',
    options: ['Vättern', 'Vänern', 'Mälaren', 'Hjälmaren'],
    correct: 1,
  },
  { id: 'kebnekaise', text: 'Vilket är Sveriges högsta berg?', options: ['Sarektjåkka', 'Kebnekaise', 'Åreskutan', 'Helagsfjället'], correct: 1 },
  {
    id: 'hammarskjold',
    text: 'Vilken svensk var FN:s generalsekreterare?',
    options: ['Folke Bernadotte', 'Olof Palme', 'Dag Hammarskjöld', 'Hans Blix'],
    correct: 2,
  },
  { id: 'nato-sverige', text: 'Vilket år blev Sverige medlem i Nato?', options: ['1995', '2024', '2022', '1949'], correct: 1 },
  {
    id: 'systembolaget-alder',
    text: 'Hur gammal måste man vara för att handla på Systembolaget?',
    options: ['18 år', '20 år', '21 år', '25 år'],
    correct: 1,
  },

  // ---- More in the same style: geografi och flaggor
  { id: 'nigeria', text: 'Vilket land har flest invånare i Afrika?', options: ['Etiopien', 'Egypten', 'Sydafrika', 'Nigeria'], correct: 3 },
  { id: 'rabat', text: 'Vilken är Marockos huvudstad?', options: ['Casablanca', 'Marrakech', 'Rabat', 'Fès'], correct: 2 },
  { id: 'kilimanjaro', text: 'I vilket land ligger Kilimanjaro?', options: ['Kenya', 'Tanzania', 'Uganda', 'Etiopien'], correct: 1 },
  { id: 'angkor-wat', text: 'I vilket land ligger Angkor Wat?', options: ['Thailand', 'Vietnam', 'Kambodja', 'Laos'], correct: 2 },
  { id: 'petra', text: 'I vilket land ligger ruinstaden Petra?', options: ['Egypten', 'Syrien', 'Israel', 'Jordanien'], correct: 3 },
  {
    id: 'angel-falls',
    text: 'Vilket är världens högsta vattenfall?',
    options: ['Niagarafallen', 'Victoriafallen', 'Angel Falls', 'Iguazú'],
    correct: 2,
  },
  { id: 'timbuktu', text: 'I vilket land ligger staden Timbuktu?', options: ['Niger', 'Mali', 'Mauretanien', 'Tchad'], correct: 1 },
  { id: 'nepal', text: 'Vilket land har en flagga som inte är fyrkantig?', options: ['Nepal', 'Bhutan', 'Brunei', 'Sri Lanka'], correct: 0 },
  { id: 'libanon', text: 'Vilket land har en grön ceder i flaggan?', options: ['Syrien', 'Libanon', 'Cypern', 'Jordanien'], correct: 1 },

  // ---- More in the same style: historia
  { id: 'revolusjonen', text: 'Vilket år bröt franska revolutionen ut?', options: ['1689', '1776', '1789', '1815'], correct: 2 },
  { id: 'augustus', text: 'Vem var Romarrikets förste kejsare?', options: ['Julius Caesar', 'Augustus', 'Nero', 'Konstantin'], correct: 1 },
  {
    id: 'mayflower',
    text: 'Vad hette skeppet pilgrimsfäderna seglade med 1620?',
    options: ['Mayflower', 'Santa Maria', 'Beagle', 'Endeavour'],
    correct: 0,
  },
  { id: 'tsjernobyl', text: 'Vilket år inträffade Tjernobylolyckan?', options: ['1976', '1979', '1983', '1986'], correct: 3 },

  // ---- More in the same style: mat och dryck
  { id: 'pilsner', text: 'Vilket land kommer ölsorten pilsner från?', options: ['Tjeckien', 'Tyskland', 'Belgien', 'Danmark'], correct: 0 },
  { id: 'tequila', text: 'Vad görs tequila av?', options: ['Kaktus', 'Sockerrör', 'Majs', 'Agave'], correct: 3 },
  {
    id: 'chianti',
    text: 'Vilken druva är rödvinet Chianti huvudsakligen gjort på?',
    options: ['Merlot', 'Nebbiolo', 'Sangiovese', 'Barbera'],
    correct: 2,
  },
  {
    id: 'gravlaks',
    text: 'Vad kommer namnet gravlax från?',
    options: ['Rökt i en jordhåla', 'Uppkallad efter en kock', 'Serverad på begravning', 'Nedgrävd i marken'],
    correct: 3,
  },

  // ---- More in the same style: kropp och rymden
  { id: 'bein', text: 'Hur många ben har en vuxen människa?', options: ['106', '156', '206', '256'], correct: 2 },
  { id: 'blodtype', text: 'Vilken blodgrupp är universell givare?', options: ['A positiv', 'AB positiv', 'O negativ', 'B negativ'], correct: 2 },
  { id: 'maaner', text: 'Vilken planet har flest kända månar per 2026?', options: ['Saturnus', 'Jupiter', 'Uranus', 'Neptunus'], correct: 0 },
  // ---- Jämförelser: längd, vikt, dräktighet, livslängd, yta, ekonomi, födelse och död, invånare
  // (two of the four options are close on purpose, so it is mostly a choice between two)
  { id: 'putin-hoyde', text: 'Hur lång är Vladimir Putin?', options: ['160 cm', '165 cm', '170 cm', '175 cm'], correct: 2 },
  { id: 'trump-hoyde', text: 'Hur lång är Donald Trump?', options: ['175 cm', '180 cm', '185 cm', '190 cm'], correct: 3 },
  { id: 'obama-hoyde', text: 'Hur lång är Barack Obama?', options: ['180 cm', '185 cm', '190 cm', '195 cm'], correct: 1 },
  {
    id: 'hoyest-politikere',
    text: 'Vem är längst av dessa?',
    options: ['Barack Obama', 'Joe Biden', 'Donald Trump', 'Vladimir Putin'],
    correct: 2,
  },
  {
    id: 'hoyest-basket',
    text: 'Vem är längst av dessa basketspelare?',
    options: ['Kevin Durant', 'Stephen Curry', 'Michael Jordan', 'LeBron James'],
    correct: 0,
  },
  {
    id: 'hoyest-skuespillere',
    text: 'Vem är längst av dessa skådespelare?',
    options: ['Sylvester Stallone', 'Dwayne Johnson', 'Tom Cruise', 'Arnold Schwarzenegger'],
    correct: 1,
  },
  {
    id: 'hoyest-presidenter',
    text: 'Vilken av dessa presidenter var längst?',
    options: ['George Washington', 'Theodore Roosevelt', 'John F. Kennedy', 'Abraham Lincoln'],
    correct: 3,
  },
  {
    id: 'drektighet-kamel',
    text: 'Vilket av dessa djur har längst dräktighetstid?',
    options: ['Ko', 'Gris', 'Kamel', 'Häst'],
    correct: 2,
  },
  {
    id: 'drektighet-spekkhogger',
    text: 'Vilket av dessa däggdjur går dräktigt längst?',
    options: ['Blåval', 'Flodhäst', 'Späckhuggare', 'Giraff'],
    correct: 2,
  },
  { id: 'drektighet-ku', text: 'Vilket av dessa djur är dräktigt längst?', options: ['Älg', 'Get', 'Ren', 'Ko'], correct: 3 },
  { id: 'drektighet-sau', text: 'Vilket av dessa husdjur är dräktigt längst?', options: ['Hund', 'Kanin', 'Får', 'Gris'], correct: 2 },
  {
    id: 'veier-mest-neshorn',
    text: 'Vilket av dessa djur väger mest?',
    options: ['Isbjörn', 'Flodhäst', 'Vit noshörning', 'Giraff'],
    correct: 2,
  },
  {
    id: 'veier-mest-landdyr',
    text: 'Vilket landdjur väger mest?',
    options: ['Asiatisk elefant', 'Vit noshörning', 'Flodhäst', 'Afrikansk elefant'],
    correct: 3,
  },
  { id: 'veier-mest-hai', text: 'Vilken av dessa hajar väger mest?', options: ['Tigerhaj', 'Brugd', 'Vithaj', 'Valhaj'], correct: 3 },
  {
    id: 'veier-mest-rovdyr',
    text: 'Vilket av dessa rovdjur väger mest?',
    options: ['Grizzlybjörn', 'Isbjörn', 'Tiger', 'Lejon'],
    correct: 1,
  },
  { id: 'veier-mest-norske', text: 'Vilket av dessa svenska djur väger mest?', options: ['Ren', 'Älg', 'Brunbjörn', 'Varg'], correct: 1 },
  {
    id: 'veier-minst-spissmus',
    text: 'Vilket av dessa djur väger minst?',
    options: ['Husmus', 'Lämmel', 'Hamster', 'Vanlig näbbmus'],
    correct: 3,
  },
  {
    id: 'veier-minst-fugl',
    text: 'Vilken av dessa fåglar väger minst?',
    options: ['Kungsfågel', 'Gråsparv', 'Koltrast', 'Blåmes'],
    correct: 0,
  },
  {
    id: 'lever-lengst-musling',
    text: 'Vilket av dessa djur lever längst?',
    options: ['Grönlandsval', 'Islandsmussla', 'Jättesköldpadda', 'Afrikansk elefant'],
    correct: 1,
  },
  {
    id: 'lever-lengst-hai',
    text: 'Vilken av dessa hajar lever längst?',
    options: ['Håkäring', 'Vithaj', 'Valhaj', 'Brugd'],
    correct: 0,
  },
  {
    id: 'lever-lengst-pattedyr',
    text: 'Vilket däggdjur lever längst?',
    options: ['Blåval', 'Grönlandsval', 'Afrikansk elefant', 'Späckhuggare'],
    correct: 1,
  },
  {
    id: 'storst-argentina',
    text: 'Vilket land är störst till ytan av dessa?',
    options: ['Argentina', 'Kazakstan', 'DR Kongo', 'Algeriet'],
    correct: 0,
  },
  {
    id: 'storst-mexico',
    text: 'Vilket av dessa länder är störst till ytan?',
    options: ['Iran', 'Indonesien', 'Peru', 'Mexiko'],
    correct: 3,
  },
  {
    id: 'storst-frankrike',
    text: 'Vilket av dessa europeiska länder är störst till ytan?',
    options: ['Tyskland', 'Sverige', 'Frankrike', 'Spanien'],
    correct: 2,
  },
  {
    id: 'minst-vatikan',
    text: 'Vilket av dessa länder är minst till ytan?',
    options: ['Vatikanstaten', 'Liechtenstein', 'Monaco', 'San Marino'],
    correct: 0,
  },
  {
    id: 'minst-nauru',
    text: 'Vilket land är minst till ytan av dessa?',
    options: ['Nauru', 'Maldiverna', 'Marshallöarna', 'Tuvalu'],
    correct: 0,
  },
  {
    id: 'minst-maldivene',
    text: 'Till landarealen: vilket av dessa länder är minst?',
    options: ['Malta', 'Luxemburg', 'Maldiverna', 'Barbados'],
    correct: 2,
  },
  {
    id: 'minst-sanmarino',
    text: 'Vilket av dessa europeiska länder är minst till ytan?',
    options: ['San Marino', 'Liechtenstein', 'Andorra', 'Malta'],
    correct: 0,
  },
  {
    id: 'bil-flest-merke',
    text: 'Vilken bilkoncern tillverkar flest bilar per år?',
    options: ['Ford', 'Toyota', 'Volkswagen', 'Hyundai'],
    correct: 1,
  },
  {
    id: 'bil-mest-solgt',
    text: 'Vilken bilmodell är världens mest sålda genom tiderna?',
    options: ['Volkswagen Golf', 'Ford F-serien', 'Volkswagen Bubbla', 'Toyota Corolla'],
    correct: 3,
  },
  {
    id: 'bil-flest-land',
    text: 'Vilket av dessa länder tillverkar flest bilar?',
    options: ['USA', 'Indien', 'Tyskland', 'Japan'],
    correct: 0,
  },
  {
    id: 'okonomi-usa',
    text: 'Vilket land har störst ekonomi, mätt i nominell BNP?',
    options: ['Tyskland', 'USA', 'Japan', 'Kina'],
    correct: 1,
  },
  {
    id: 'okonomi-europa',
    text: 'Vilket av dessa länder har störst ekonomi (nominell BNP)?',
    options: ['Italien', 'Storbritannien', 'Tyskland', 'Frankrike'],
    correct: 2,
  },
  {
    id: 'okonomi-norden',
    text: 'Vilket nordiskt land har störst ekonomi (nominell BNP)?',
    options: ['Sverige', 'Norge', 'Finland', 'Danmark'],
    correct: 0,
  },
  {
    id: 'fodt-forst-renessanse',
    text: 'Vem av dessa föddes först?',
    options: ['Rafael', 'Sandro Botticelli', 'Michelangelo', 'Leonardo da Vinci'],
    correct: 1,
  },
  {
    id: 'fodt-forst-svenskar',
    text: 'Vem av dessa svenskar föddes först?',
    options: ['August Strindberg', 'Carl Larsson', 'Selma Lagerlöf', 'Anders Zorn'],
    correct: 0,
  },
  {
    id: 'fodt-forst-forskere',
    text: 'Vem av dessa forskare föddes först?',
    options: ['Marie Curie', 'Max Planck', 'Albert Einstein', 'Niels Bohr'],
    correct: 1,
  },
  {
    id: 'fodt-forst-upptackare',
    text: 'Vilken svensk upptäcktsresande föddes först?',
    options: ['Sven Hedin', 'S. A. Andrée', 'Otto Nordenskjöld', 'A. E. Nordenskiöld'],
    correct: 3,
  },
  {
    id: 'fodt-forst-presidenter',
    text: 'Vilken av dessa presidenter föddes först?',
    options: ['John Adams', 'Thomas Jefferson', 'James Madison', 'George Washington'],
    correct: 3,
  },
  {
    id: 'dode-sist-musikere',
    text: 'Vem av dessa musiker dog sist?',
    options: ['Jim Morrison', 'John Lennon', 'Elvis Presley', 'Jimi Hendrix'],
    correct: 1,
  },
  {
    id: 'dode-sist-historie',
    text: 'Vem av dessa historiska personer dog sist?',
    options: ['Napoleon', 'Beethoven', 'Goethe', 'Mozart'],
    correct: 2,
  },
  {
    id: 'dode-sist-berommelser',
    text: 'Vem av dessa berömda personer dog sist?',
    options: ['Mahatma Gandhi', 'Franklin D. Roosevelt', 'Winston Churchill', 'Albert Einstein'],
    correct: 2,
  },
  {
    id: 'dode-sist-svenskar',
    text: 'Vem av dessa svenskar dog sist?',
    options: ['Selma Lagerlöf', 'August Strindberg', 'Alfred Nobel', 'Carl Larsson'],
    correct: 0,
  },
  {
    id: 'dode-sist-artister',
    text: 'Vem av dessa artister dog sist?',
    options: ['Amy Winehouse', 'Whitney Houston', 'Michael Jackson', 'Prince'],
    correct: 3,
  },
  {
    id: 'by-flest-istanbul',
    text: 'Vilken av dessa städer har flest invånare i själva staden?',
    options: ['London', 'Moskva', 'Paris', 'Istanbul'],
    correct: 3,
  },
  {
    id: 'by-flest-berlin',
    text: 'Vilken av dessa EU-städer har flest invånare i själva staden?',
    options: ['Rom', 'Berlin', 'Paris', 'Madrid'],
    correct: 1,
  },
  {
    id: 'by-flest-hamburg',
    text: 'Vilken europeisk stad har flest invånare i själva staden?',
    options: ['Hamburg', 'Milano', 'München', 'Barcelona'],
    correct: 0,
  },
  {
    id: 'by-flest-toronto',
    text: 'Vilken nordamerikansk stad har flest invånare i själva staden?',
    options: ['Houston', 'Montréal', 'Toronto', 'Chicago'],
    correct: 2,
  },
  // ---- Sport, film, TV och serier, musik, litteratur och konst (the five categories that had the fewest questions)
  // (two of the four options are close on purpose, so it is mostly a choice between two)
  {
    id: 'grand-slam-svensk',
    text: 'Vilken svensk har vunnit flest grand slam-titlar i singel?',
    options: ['Mats Wilander', 'Stefan Edberg', 'Björn Borg', 'Thomas Johansson'],
    correct: 2,
  },
  {
    id: 'landslagsmal-herrar',
    text: 'Vem har gjort flest mål för Sveriges herrlandslag per 2026?',
    options: ['Henrik Larsson', 'Gunnar Nordahl', 'Sven Rydell', 'Zlatan Ibrahimović'],
    correct: 3,
  },
  {
    id: 'duplantis-os-guld',
    text: 'Vem tog OS-guld i stavhopp i både Tokyo och Paris?',
    options: ['Armand Duplantis', 'Kajsa Bergqvist', 'Patrik Sjöberg', 'Stefan Holm'],
    correct: 0,
  },
  {
    id: 'rekord-100m',
    text: 'Vad är världsrekordet på 100 meter för herrar per 2026?',
    options: ['9,48 sek', '9,58 sek', '9,69 sek', '9,79 sek'],
    correct: 1,
  },
  {
    id: 'ol-vertskap',
    text: 'Vilket land har varit värd för sommar-OS flest gånger?',
    options: ['USA', 'Tyskland', 'Storbritannien', 'Frankrike'],
    correct: 0,
  },
  {
    id: 'ballon-dor',
    text: "Vem har vunnit flest Ballon d'Or?",
    options: ['Lionel Messi', 'Cristiano Ronaldo', 'Michel Platini', 'Johan Cruyff'],
    correct: 0,
  },
  {
    id: 'fotbolls-vm-sverige',
    text: 'Vilket år arrangerades fotbolls-VM i Sverige?',
    options: ['1954', '1958', '1962', '1966'],
    correct: 1,
  },
  {
    id: 'grand-slam',
    text: 'Vem har vunnit flest grand slam-titlar bland herrarna per 2026?',
    options: ['Pete Sampras', 'Rafael Nadal', 'Roger Federer', 'Novak Djokovic'],
    correct: 3,
  },
  { id: 'boksing-runder', text: 'Hur många ronder går en VM-match i boxning?', options: ['10', '12', '14', '15'], correct: 1 },
  {
    id: 'em-2024',
    text: 'Vilket land vann fotbolls-EM för herrar 2024?',
    options: ['Tyskland', 'England', 'Frankrike', 'Spanien'],
    correct: 3,
  },
  {
    id: 'film-mest-penger',
    text: 'Vilken film har tjänat mest pengar genom tiderna?',
    options: ['Spider-Man: No Way Home', 'Avengers: Endgame', 'Avatar', 'Titanic'],
    correct: 2,
  },
  {
    id: 'oscar-2020',
    text: 'Vilken film vann bästa film vid Oscarsgalan 2020?',
    options: ['Joker', 'Parasite', 'The Irishman', '1917'],
    correct: 1,
  },
  { id: 'titanic-oscar', text: 'Hur många Oscarsstatyetter vann «Titanic»?', options: ['9', '11', '12', '14'], correct: 1 },
  {
    id: 'fanny-alexander-oscar',
    text: 'Vilken av dessa svenska filmer vann en Oscar?',
    options: ['Ondskan', 'Så som i himmelen', 'Fanny och Alexander', 'Låt den rätte komma in'],
    correct: 2,
  },
  {
    id: 'oscar-hovedrolle-mann',
    text: 'Vem har flest Oscar för bästa manliga huvudroll?',
    options: ['Daniel Day-Lewis', 'Tom Hanks', 'Marlon Brando', 'Jack Nicholson'],
    correct: 0,
  },
  {
    id: 'oscar-hovedrolle-kvinne',
    text: 'Vem har flest Oscar för bästa kvinnliga huvudroll?',
    options: ['Frances McDormand', 'Meryl Streep', 'Ingrid Bergman', 'Katharine Hepburn'],
    correct: 3,
  },
  {
    id: 'star-wars-vader',
    text: 'I vilken «Star Wars»-film avslöjas att Vader är Lukes far?',
    options: ['A New Hope', 'The Empire Strikes Back', 'The Phantom Menace', 'Return of the Jedi'],
    correct: 1,
  },
  {
    id: 'joker-ledger',
    text: 'Vem spelade Jokern i «The Dark Knight» från 2008?',
    options: ['Jack Nicholson', 'Joaquin Phoenix', 'Jared Leto', 'Heath Ledger'],
    correct: 3,
  },
  {
    id: 'disney-forste',
    text: 'Vilken var Disneys första långa tecknade film?',
    options: ['Snövit', 'Dumbo', 'Pinocchio', 'Bambi'],
    correct: 0,
  },
  {
    id: 'wallander-ystad',
    text: 'I vilken stad bor kommissarie Wallander?',
    options: ['Ystad', 'Malmö', 'Kristianstad', 'Helsingborg'],
    correct: 0,
  },
  { id: 'bron-premiar', text: 'Vilket år hade «Bron» premiär?', options: ['2009', '2011', '2013', '2015'], correct: 1 },
  { id: 'got-sesonger', text: 'Hur många säsonger har «Game of Thrones»?', options: ['6', '7', '8', '9'], correct: 2 },
  {
    id: 'central-perk',
    text: 'Vad heter kaffebaren i «Friends»?',
    options: ["Monk's Café", 'The Peach Pit', "MacLaren's Pub", 'Central Perk'],
    correct: 3,
  },
  {
    id: 'simpsons-lengst',
    text: 'Vilken animerad serie har gått längst på amerikansk TV?',
    options: ['Futurama', 'The Simpsons', 'South Park', 'Family Guy'],
    correct: 1,
  },
  {
    id: 'pippi-skadespelerska',
    text: 'Vem spelade Pippi Långstrump i TV-serien från 1969?',
    options: ['Lena Nyman', 'Lill-Babs', 'Pernilla August', 'Inger Nilsson'],
    correct: 3,
  },
  {
    id: 'demogorgon',
    text: 'Vad heter monstret i första säsongen av «Stranger Things»?',
    options: ['Demogorgon', 'Mind Flayer', 'Dart', 'Vecna'],
    correct: 0,
  },
  {
    id: 'the-office-by',
    text: 'Var utspelar sig den amerikanska versionen av «The Office»?',
    options: ['Pittsburgh', 'Buffalo', 'Philadelphia', 'Scranton'],
    correct: 3,
  },
  {
    id: 'squid-game-lek',
    text: 'Vilken är den första leken i «Squid Game»?',
    options: ['Kulspel', 'Rött ljus, grönt ljus', 'Dragkamp', 'Dalgona-godis'],
    correct: 1,
  },
  {
    id: 'loreen-2012',
    text: 'Vilket år vann Loreen Eurovision med «Euphoria»?',
    options: ['2009', '2010', '2012', '2014'],
    correct: 2,
  },
  {
    id: 'avicii-levels',
    text: 'Vilken svensk DJ står bakom låten «Levels»?',
    options: ['Alesso', 'Avicii', 'Axwell', 'Eric Prydz'],
    correct: 1,
  },
  {
    id: 'best-solgte-album',
    text: 'Vilket album har sålt flest exemplar genom tiderna?',
    options: ['Thriller', 'Back in Black', 'Rumours', 'Dark Side of the Moon'],
    correct: 0,
  },
  { id: 'bohemian-rhapsody', text: 'Vilket år kom Queens «Bohemian Rhapsody»?', options: ['1973', '1975', '1977', '1979'], correct: 1 },
  {
    id: 'the-boss',
    text: 'Vilken artist kallas «The Boss»?',
    options: ['Bon Jovi', 'Billy Joel', 'Bruce Springsteen', 'Bob Dylan'],
    correct: 2,
  },
  {
    id: 'vivaldi',
    text: 'Vem komponerade «De fyra årstiderna»?',
    options: ['Georg Friedrich Händel', 'Wolfgang Amadeus Mozart', 'Johann Sebastian Bach', 'Antonio Vivaldi'],
    correct: 3,
  },
  {
    id: 'nyckelharpa',
    text: 'Vilket instrument kallas ofta Sveriges nationalinstrument?',
    options: ['Nyckelharpa', 'Hardingfele', 'Kantele', 'Munspel'],
    correct: 0,
  },
  { id: 'guernica', text: 'Vem målade «Guernica»?', options: ['Salvador Dalí', 'Joan Miró', 'Henri Matisse', 'Pablo Picasso'], correct: 3 },
  {
    id: 'orwell-1984',
    text: 'Vem skrev romanen «1984»?',
    options: ['Ray Bradbury', 'George Orwell', 'H.G. Wells', 'Aldous Huxley'],
    correct: 1,
  },
  {
    id: 'sjunde-inseglet',
    text: 'Vilket år kom Ingmar Bergmans «Det sjunde inseglet»?',
    options: ['1951', '1957', '1963', '1968'],
    correct: 1,
  },
  {
    id: 'man-som-hatar-kvinnor',
    text: 'Vem skrev romanen «Män som hatar kvinnor»?',
    options: ['Henning Mankell', 'Håkan Nesser', 'Stieg Larsson', 'Jens Lapidus'],
    correct: 2,
  },
  {
    id: 'warhol-suppe',
    text: 'Vem är känd för konstverk med Campbells soppburkar?',
    options: ['Andy Warhol', 'Keith Haring', 'Jackson Pollock', 'Roy Lichtenstein'],
    correct: 0,
  },
];
