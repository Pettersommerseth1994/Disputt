// Danish question bank (the Danish edition of shared/questions.js). Each question has exactly four options; `correct` is
// the index of the right one. Same rules as the Norwegian bank: test/questions.test.js runs them on this bank too.
//
// How it was made: the general-knowledge questions are translated from the Norwegian bank with the same id, the same four
// options in the same order and the same `correct` index. The questions whose subject was Norway or something Norwegian
// are replaced by new questions about Denmark or Danish culture of the same kind (new kebab-case ids, marked "Danmark"
// below). Every new fact was checked against a source; numbers that change over time say "per 2026" or a fixed year.
//
// What makes a good Disputt question: something people feel they once knew but are not sure of, so the group has to
// argue its way to the answer (and the impostor, who knows it, has something to bend).

export const QUESTIONS_DA = [
  // ---- the first four test questions
  {
    id: 'turister',
    text: 'Hvilket land har flest turister om året?',
    options: ['USA', 'Japan', 'Frankrig', 'Kina'],
    correct: 2,
  },
  {
    id: 'orken',
    text: 'Hvad er verdens største ørken?',
    options: ['Sahara', 'Antarktis', 'Gobi', 'Den arabiske ørken'],
    correct: 1,
  },
  {
    id: 'elv',
    text: 'Hvad er Europas længste flod?',
    options: ['Donau', 'Rhinen', 'Dnepr', 'Volga'],
    correct: 3,
  },
  {
    id: 'blekksprut',
    text: 'Hvor mange hjerter har en blæksprutte?',
    options: ['Tre', 'Et', 'Fire', 'To'],
    correct: 0,
  },

  // ---- Danmark: historie og samfund (replaces the Norwegian history and society questions)
  { id: 'mobilepay', text: 'Hvornår blev MobilePay lanceret i Danmark?', options: ['2011', '2013', '2015', '2017'], correct: 1 },
  { id: 'grundloven-1849', text: 'Hvilket år fik Danmark sin første grundlov?', options: ['1849', '1814', '1866', '1915'], correct: 0 },
  { id: 'kvinders-stemmeret', text: 'Hvilket år fik danske kvinder stemmeret?', options: ['1849', '1889', '1915', '1920'], correct: 2 },
  {
    id: 'euro-afstemning',
    text: 'Hvilket år stemte danskerne nej til at indføre euroen?',
    options: ['1992', '1998', '2000', '2003'],
    correct: 2,
  },
  { id: 'oresundsbroen', text: 'Hvilket år blev Øresundsbroen åbnet for trafik?', options: ['1995', '1998', '2000', '2003'], correct: 2 },
  { id: 'tivoli', text: 'Hvilket år åbnede Tivoli i København?', options: ['1801', '1843', '1889', '1912'], correct: 1 },
  {
    id: 'kobenhavns-universitet',
    text: 'Hvilket år blev Københavns Universitet grundlagt?',
    options: ['1379', '1479', '1536', '1621'],
    correct: 1,
  },
  { id: 'kalmarunionen', text: 'Hvilket år blev Kalmarunionen stiftet?', options: ['1319', '1397', '1448', '1523'], correct: 1 },
  {
    id: 'vingegaard-tour',
    text: 'Hvilket år vandt Jonas Vingegaard Tour de France første gang?',
    options: ['2020', '2021', '2022', '2023'],
    correct: 2,
  },
  { id: 'metroen', text: 'Hvilket år åbnede Københavns Metro?', options: ['1998', '2002', '2006', '2010'], correct: 1 },
  {
    id: 'bohr-nobelpris',
    text: 'Hvilket år fik Niels Bohr Nobelprisen i fysik?',
    options: ['1922', '1912', '1932', '1945'],
    correct: 0,
  },
  {
    id: 'utzon-operahuset',
    text: 'Hvem tegnede operahuset i Sydney?',
    options: ['Arne Jacobsen', 'Bjarke Ingels', 'Henning Larsen', 'Jørn Utzon'],
    correct: 3,
  },
  {
    id: 'roskilde-festival',
    text: 'Hvilket år blev Roskilde Festival holdt første gang?',
    options: ['1966', '1971', '1976', '1981'],
    correct: 1,
  },
  {
    id: 'grundlovsdag',
    text: 'Hvilken dato fejrer danskerne Grundlovsdag?',
    options: ['9. april', '5. maj', '5. juni', '23. juni'],
    correct: 2,
  },
  {
    id: 'stroustrup',
    text: 'Hvem skabte programmeringssproget C++?',
    options: ['Dennis Ritchie', 'Guido van Rossum', 'James Gosling', 'Bjarne Stroustrup'],
    correct: 3,
  },
  { id: 'folketinget', text: 'Hvor mange medlemmer har Folketinget?', options: ['150', '169', '175', '179'], correct: 3 },

  // ---- Danmark: natur og kultur
  {
    id: 'johannes-v-jensen',
    text: 'Hvilken dansker fik Nobels litteraturpris i 1944?',
    options: ['Johannes V. Jensen', 'Martin Andersen Nexø', 'Karen Blixen', 'Tom Kristensen'],
    correct: 0,
  },
  { id: 'dannebrog', text: 'Hvad hedder det danske kongeskib?', options: ['Dannebrog', 'Danmark', 'Absalon', 'Peder Skram'], correct: 0 },
  {
    id: 'maskarade',
    text: 'Hvem komponerede operaen «Maskarade»?',
    options: ['Niels W. Gade', 'Peter Heise', 'Carl Nielsen', 'Rued Langgaard'],
    correct: 2,
  },
  {
    id: 'karen-blixen',
    text: 'Hvem skrev «Den afrikanske farm»?',
    options: ['Tove Ditlevsen', 'Inger Christensen', 'Dorrit Willumsen', 'Karen Blixen'],
    correct: 3,
  },

  // ---- Verden: historie og teknologi
  { id: 'apollo', text: 'Hvilket år var den sidste månelanding med mennesker?', options: ['1970', '1972', '1975', '1979'], correct: 1 },
  { id: 'muren', text: 'Hvilket år blev Berlinmuren bygget?', options: ['1945', '1949', '1953', '1961'], correct: 3 },
  { id: 'mandela', text: 'Hvilket år blev Nelson Mandela løsladt fra fængslet?', options: ['1976', '1980', '1986', '1990'], correct: 3 },
  { id: 'facebook', text: 'Hvilket år blev Facebook startet?', options: ['2004', '2006', '2008', '2010'], correct: 0 },
  { id: 'iphone', text: 'Hvilket år kom den første iPhone?', options: ['2003', '2005', '2007', '2009'], correct: 2 },
  { id: 'sms', text: 'Hvilket år blev den første sms sendt?', options: ['1992', '1994', '1996', '1998'], correct: 0 },
  { id: 'potter', text: 'Hvilket år udkom den første Harry Potter-bog?', options: ['1991', '1994', '1997', '2000'], correct: 2 },
  {
    id: 'wozniak',
    text: 'Hvem grundlagde Apple sammen med Steve Jobs?',
    options: ['Bill Gates', 'Steve Wozniak', 'Tim Cook', 'Elon Musk'],
    correct: 1,
  },
  {
    id: 'teresjkova',
    text: 'Hvem var den første kvinde i rummet?',
    options: ['Sally Ride', 'Valentina Teresjkova', 'Svetlana Savitskaja', 'Eileen Collins'],
    correct: 1,
  },

  // ---- Verden: geografi
  { id: 'ankara', text: 'Hvad er Tyrkiets hovedstad?', options: ['Istanbul', 'Izmir', 'Antalya', 'Ankara'], correct: 3 },
  { id: 'tidssoner', text: 'Hvor mange tidszoner har Rusland?', options: ['6', '9', '11', '13'], correct: 2 },
  { id: 'bajkal', text: 'Hvad er verdens dybeste sø?', options: ['Bajkal', 'Tanganyika', 'Superior', 'Victoria'], correct: 0 },
  { id: 'kystlinje', text: 'Hvilket land har verdens længste kystlinje?', options: ['Norge', 'Rusland', 'Indonesien', 'Canada'], correct: 3 },
  { id: 'sveits', text: 'Hvor mange nationalsprog har Schweiz?', options: ['2', '3', '4', '5'], correct: 2 },
  {
    id: 'aconcagua',
    text: 'Hvad er det højeste bjerg uden for Asien?',
    options: ['Mont Blanc', 'Aconcagua', 'Denali', 'Kilimanjaro'],
    correct: 1,
  },

  // ---- Verden: natur og videnskab
  { id: 'venus', text: 'Hvilken planet er varmest?', options: ['Venus', 'Merkur', 'Mars', 'Jupiter'], correct: 0 },
  { id: 'planeter', text: 'Hvor mange planeter har vores solsystem?', options: ['7', '8', '9', '10'], correct: 1 },
  {
    id: 'atmosfaere',
    text: 'Hvilken gas er der mest af i jordens atmosfære?',
    options: ['Ilt', 'Kuldioxid', 'Argon', 'Kvælstof'],
    correct: 3,
  },
  { id: 'kromosomer', text: 'Hvor mange kromosomer har et menneske?', options: ['23', '44', '46', '48'], correct: 2 },
  {
    id: 'pilgrimsfalk',
    text: 'Hvilket dyr har den højeste tophastighed i verden?',
    options: ['Vandrefalk', 'Gepard', 'Sværdfisk', 'Struds'],
    correct: 0,
  },
  { id: 'elefant', text: 'Hvilket pattedyr har den længste drægtighed?', options: ['Blåhval', 'Giraf', 'Elefant', 'Næsehorn'], correct: 2 },

  // ---- Mad og drikke
  { id: 'safran', text: 'Hvilket krydderi er dyrest per kilo?', options: ['Safran', 'Vanilje', 'Kardemomme', 'Kanel'], correct: 0 },
  { id: 'kaffe', text: 'Hvilket land producerer mest kaffe?', options: ['Colombia', 'Vietnam', 'Etiopien', 'Brasilien'], correct: 3 },

  // ---- From the printed question cards (each card has its right answer circled in red)
  // Translated from the Norwegian bank, same order of options. The Vinmonopolet card is replaced by a Carlsberg question.
  {
    id: 'delstat',
    text: 'I hvilken amerikansk delstat bor der flest mennesker?',
    options: ['Californien', 'Washington', 'Texas', 'New York'],
    correct: 0,
  },
  {
    id: 'sorligste-hovedstad',
    text: 'Hvad er verdens sydligste hovedstad?',
    options: ['Wellington', 'Canberra', 'Santiago de Chile', 'Cape Town'],
    correct: 0,
  },
  {
    id: 'ukraina-hav',
    text: 'Hvilket hav grænser Ukraine op til?',
    options: ['Østersøen', 'Middelhavet', 'Det Kaspiske Hav', 'Sortehavet'],
    correct: 3,
  },
  { id: 'gutenberg', text: 'Omkring hvilket år opfandt Gutenberg bogtrykkerkunsten?', options: ['1450', '1540', '1630', '1720'], correct: 0 },
  {
    id: 'ekvator-storst',
    text: 'Hvad er det største land (i areal), ækvator krydser?',
    options: ['DR Congo', 'Brasilien', 'Indien', 'Colombia'],
    correct: 1,
  },
  { id: 'carlsberg', text: 'Hvilket år blev Carlsberg grundlagt?', options: ['1827', '1847', '1867', '1887'], correct: 1 },
  { id: 'franz-ferdinand', text: 'I hvilken by blev Franz Ferdinand skudt i 1914?', options: ['Moskva', 'Dallas', 'Berlin', 'Sarajevo'], correct: 3 },
  { id: 'afrika-land', text: 'Hvor mange lande består Afrika af?', options: ['22', '34', '46', '54'], correct: 3 },
  { id: 'ekvator-land', text: 'Hvor mange lande går ækvator igennem?', options: ['3', '6', '9', '13'], correct: 3 },
  {
    id: 'mosambik',
    text: 'Hvad er afbildet i Mozambiques flag?',
    options: ['En løve med vinger', 'En nøgen dame', 'En AK-47-riffel', 'Et skibsrat'],
    correct: 2,
  },
  {
    id: 'sol-over-gudhjem',
    text: 'Hvad er «Sol over Gudhjem»?',
    options: ['Rugbrød med røget sild', 'En bornholmsk dessert', 'En færge til Bornholm', 'En dansk cocktail'],
    correct: 0,
  },

  // ---- More in the same style: Danmark (replaces the Norwegian ones)
  { id: 'limfjorden', text: 'Hvad er Danmarks længste fjord?', options: ['Roskilde Fjord', 'Isefjorden', 'Limfjorden', 'Flensborg Fjord'], correct: 2 },
  { id: 'rigsvaben', text: 'Hvilken farve har løverne i Danmarks rigsvåben?', options: ['Blå', 'Rød', 'Sort', 'Grøn'], correct: 0 },
  {
    id: 'thorning-schmidt',
    text: 'Hvem var Danmarks første kvindelige statsminister?',
    options: ['Mette Frederiksen', 'Margrethe Vestager', 'Pia Kjærsgaard', 'Helle Thorning-Schmidt'],
    correct: 3,
  },
  { id: 'nato-danmark', text: 'Hvilket år blev Danmark medlem af NATO?', options: ['1945', '1949', '1952', '1957'], correct: 1 },
  { id: 'maersk', text: 'Hvilket år blev A.P. Møller - Mærsk grundlagt?', options: ['1904', '1884', '1924', '1945'], correct: 0 },

  // ---- More in the same style: geografi og flag
  { id: 'nigeria', text: 'Hvilket land har flest indbyggere i Afrika?', options: ['Etiopien', 'Egypten', 'Sydafrika', 'Nigeria'], correct: 3 },
  { id: 'rabat', text: 'Hvad er Marokkos hovedstad?', options: ['Casablanca', 'Marrakech', 'Rabat', 'Fès'], correct: 2 },
  { id: 'kilimanjaro', text: 'I hvilket land ligger Kilimanjaro?', options: ['Kenya', 'Tanzania', 'Uganda', 'Etiopien'], correct: 1 },
  { id: 'angkor-wat', text: 'I hvilket land ligger Angkor Wat?', options: ['Thailand', 'Vietnam', 'Cambodja', 'Laos'], correct: 2 },
  { id: 'petra', text: 'I hvilket land ligger ruinbyen Petra?', options: ['Egypten', 'Syrien', 'Israel', 'Jordan'], correct: 3 },
  {
    id: 'angel-falls',
    text: 'Hvad er verdens højeste vandfald?',
    options: ['Niagarafaldene', 'Victoriafaldene', 'Angel Falls', 'Iguazú'],
    correct: 2,
  },
  { id: 'timbuktu', text: 'I hvilket land ligger byen Timbuktu?', options: ['Niger', 'Mali', 'Mauretanien', 'Tchad'], correct: 1 },
  { id: 'nepal', text: 'Hvilket land har et flag, der ikke er firkantet?', options: ['Nepal', 'Bhutan', 'Brunei', 'Sri Lanka'], correct: 0 },
  { id: 'libanon', text: 'Hvilket land har et grønt cedertræ i flaget?', options: ['Syrien', 'Libanon', 'Cypern', 'Jordan'], correct: 1 },

  // ---- More in the same style: historie
  { id: 'revolusjonen', text: 'Hvilket år brød den franske revolution ud?', options: ['1689', '1776', '1789', '1815'], correct: 2 },
  { id: 'augustus', text: 'Hvem var Romerrigets første kejser?', options: ['Julius Cæsar', 'Augustus', 'Nero', 'Konstantin'], correct: 1 },
  {
    id: 'mayflower',
    text: 'Hvad hed skibet, pilgrimsfædrene sejlede med i 1620?',
    options: ['Mayflower', 'Santa Maria', 'Beagle', 'Endeavour'],
    correct: 0,
  },
  { id: 'tsjernobyl', text: 'Hvilket år skete Tjernobyl-ulykken?', options: ['1976', '1979', '1983', '1986'], correct: 3 },

  // ---- More in the same style: mad og drikke
  { id: 'pilsner', text: 'Hvilket land stammer ølsorten pilsner fra?', options: ['Tjekkiet', 'Tyskland', 'Belgien', 'Danmark'], correct: 0 },
  { id: 'tequila', text: 'Hvad laves tequila af?', options: ['Kaktus', 'Sukkerrør', 'Majs', 'Agave'], correct: 3 },
  {
    id: 'chianti',
    text: 'Hvilken drue er rødvinen Chianti hovedsageligt lavet af?',
    options: ['Merlot', 'Nebbiolo', 'Sangiovese', 'Barbera'],
    correct: 2,
  },
  {
    id: 'gravlaks',
    text: 'Hvad er oprindelsen til navnet gravad laks?',
    options: ['Røget i en jordhule', 'Opkaldt efter en kok', 'Serveret ved begravelser', 'Gravet ned i jorden'],
    correct: 3,
  },

  // ---- More in the same style: krop og verdensrum
  { id: 'bein', text: 'Hvor mange knogler har en voksen person?', options: ['106', '156', '206', '256'], correct: 2 },
  { id: 'blodtype', text: 'Hvilken blodtype er universaldonor?', options: ['A positiv', 'AB positiv', 'O negativ', 'B negativ'], correct: 2 },
  { id: 'maaner', text: 'Hvilken planet har flest kendte måner per 2026?', options: ['Saturn', 'Jupiter', 'Uranus', 'Neptun'], correct: 0 },
  // ---- Sammenligninger: højde, vægt, drægtighed, levealder, areal, økonomi, fødsel og død, indbyggere
  // (two of the four options are close on purpose, so it is mostly a choice between two)
  { id: 'putin-hoyde', text: 'Hvor høj er Vladimir Putin?', options: ['160 cm', '165 cm', '170 cm', '175 cm'], correct: 2 },
  { id: 'trump-hoyde', text: 'Hvor høj er Donald Trump?', options: ['175 cm', '180 cm', '185 cm', '190 cm'], correct: 3 },
  { id: 'obama-hoyde', text: 'Hvor høj er Barack Obama?', options: ['180 cm', '185 cm', '190 cm', '195 cm'], correct: 1 },
  {
    id: 'hoyest-politikere',
    text: 'Hvem er højest af disse?',
    options: ['Barack Obama', 'Joe Biden', 'Donald Trump', 'Vladimir Putin'],
    correct: 2,
  },
  {
    id: 'hoyest-basket',
    text: 'Hvem er højest af disse basketballspillere?',
    options: ['Kevin Durant', 'Stephen Curry', 'Michael Jordan', 'LeBron James'],
    correct: 0,
  },
  {
    id: 'hoyest-skuespillere',
    text: 'Hvem er højest af disse skuespillere?',
    options: ['Sylvester Stallone', 'Dwayne Johnson', 'Tom Cruise', 'Arnold Schwarzenegger'],
    correct: 1,
  },
  {
    id: 'hoyest-presidenter',
    text: 'Hvem af disse præsidenter var højest?',
    options: ['George Washington', 'Theodore Roosevelt', 'John F. Kennedy', 'Abraham Lincoln'],
    correct: 3,
  },
  {
    id: 'drektighet-kamel',
    text: 'Hvilket af disse dyr har den længste drægtighed?',
    options: ['Ko', 'Gris', 'Kamel', 'Hest'],
    correct: 2,
  },
  {
    id: 'drektighet-spekkhogger',
    text: 'Hvilket af disse pattedyr er drægtigt længst?',
    options: ['Blåhval', 'Flodhest', 'Spækhugger', 'Giraf'],
    correct: 2,
  },
  { id: 'drektighet-ku', text: 'Hvilket af disse dyr er drægtigt længst?', options: ['Elg', 'Ged', 'Rensdyr', 'Ko'], correct: 3 },
  { id: 'drektighet-sau', text: 'Hvilket af disse husdyr er drægtigt længst?', options: ['Hund', 'Kanin', 'Får', 'Gris'], correct: 2 },
  {
    id: 'veier-mest-neshorn',
    text: 'Hvilket af disse dyr vejer mest?',
    options: ['Isbjørn', 'Flodhest', 'Hvidt næsehorn', 'Giraf'],
    correct: 2,
  },
  {
    id: 'veier-mest-landdyr',
    text: 'Hvilket landdyr vejer mest?',
    options: ['Asiatisk elefant', 'Hvidt næsehorn', 'Flodhest', 'Afrikansk elefant'],
    correct: 3,
  },
  { id: 'veier-mest-hai', text: 'Hvilken af disse hajer vejer mest?', options: ['Tigerhaj', 'Brugde', 'Hvidhaj', 'Hvalhaj'], correct: 3 },
  {
    id: 'veier-mest-rovdyr',
    text: 'Hvilket af disse rovdyr vejer mest?',
    options: ['Grizzlybjørn', 'Isbjørn', 'Tiger', 'Løve'],
    correct: 1,
  },
  { id: 'veier-mest-danske', text: 'Hvilket af disse danske dyr vejer mest?', options: ['Rådyr', 'Dådyr', 'Ræv', 'Kronhjort'], correct: 3 },
  {
    id: 'veier-minst-spissmus',
    text: 'Hvilket af disse dyr vejer mindst?',
    options: ['Husmus', 'Lemming', 'Hamster', 'Almindelig spidsmus'],
    correct: 3,
  },
  {
    id: 'veier-minst-fugl',
    text: 'Hvilken af disse fugle vejer mindst?',
    options: ['Fuglekonge', 'Gråspurv', 'Solsort', 'Blåmejse'],
    correct: 0,
  },
  {
    id: 'lever-lengst-musling',
    text: 'Hvilket af disse dyr lever længst?',
    options: ['Grønlandshval', 'Islandsmusling', 'Kæmpeskildpadde', 'Afrikansk elefant'],
    correct: 1,
  },
  {
    id: 'lever-lengst-hai',
    text: 'Hvilken af disse hajer lever længst?',
    options: ['Grønlandshaj', 'Hvidhaj', 'Hvalhaj', 'Brugde'],
    correct: 0,
  },
  {
    id: 'lever-lengst-pattedyr',
    text: 'Hvilket pattedyr lever længst?',
    options: ['Blåhval', 'Grønlandshval', 'Afrikansk elefant', 'Spækhugger'],
    correct: 1,
  },
  {
    id: 'storst-argentina',
    text: 'Hvilket land er størst i areal af disse?',
    options: ['Argentina', 'Kasakhstan', 'DR Congo', 'Algeriet'],
    correct: 0,
  },
  {
    id: 'storst-mexico',
    text: 'Hvilket af disse lande er størst i areal?',
    options: ['Iran', 'Indonesien', 'Peru', 'Mexico'],
    correct: 3,
  },
  {
    id: 'storst-frankrike',
    text: 'Hvilket af disse europæiske lande er størst i areal?',
    options: ['Tyskland', 'Sverige', 'Frankrig', 'Spanien'],
    correct: 2,
  },
  {
    id: 'minst-vatikan',
    text: 'Hvilket af disse lande er mindst i areal?',
    options: ['Vatikanstaten', 'Liechtenstein', 'Monaco', 'San Marino'],
    correct: 0,
  },
  {
    id: 'minst-nauru',
    text: 'Hvilket land er mindst i areal af disse?',
    options: ['Nauru', 'Maldiverne', 'Marshalløerne', 'Tuvalu'],
    correct: 0,
  },
  {
    id: 'minst-maldivene',
    text: 'I landareal: hvilket af disse lande er mindst?',
    options: ['Malta', 'Luxembourg', 'Maldiverne', 'Barbados'],
    correct: 2,
  },
  {
    id: 'minst-sanmarino',
    text: 'Hvilket af disse europæiske lande er mindst i areal?',
    options: ['San Marino', 'Liechtenstein', 'Andorra', 'Malta'],
    correct: 0,
  },
  {
    id: 'bil-flest-merke',
    text: 'Hvilket bilkoncern producerer flest biler om året?',
    options: ['Ford', 'Toyota', 'Volkswagen', 'Hyundai'],
    correct: 1,
  },
  {
    id: 'bil-mest-solgt',
    text: 'Hvilken bilmodel er verdens mest solgte nogensinde?',
    options: ['Volkswagen Golf', 'Ford F-serien', 'Volkswagen Boble', 'Toyota Corolla'],
    correct: 3,
  },
  {
    id: 'bil-flest-land',
    text: 'Hvilket af disse lande producerer flest biler?',
    options: ['USA', 'Indien', 'Tyskland', 'Japan'],
    correct: 0,
  },
  {
    id: 'okonomi-usa',
    text: 'Hvilket land har den største økonomi, målt i nominelt BNP?',
    options: ['Tyskland', 'USA', 'Japan', 'Kina'],
    correct: 1,
  },
  {
    id: 'okonomi-europa',
    text: 'Hvilket af disse lande har størst økonomi (nominelt BNP)?',
    options: ['Italien', 'Storbritannien', 'Tyskland', 'Frankrig'],
    correct: 2,
  },
  {
    id: 'okonomi-norden',
    text: 'Hvilket nordisk land har størst økonomi (nominelt BNP)?',
    options: ['Sverige', 'Norge', 'Finland', 'Danmark'],
    correct: 0,
  },
  {
    id: 'fodt-forst-renessanse',
    text: 'Hvem af disse blev født først?',
    options: ['Rafael', 'Sandro Botticelli', 'Michelangelo', 'Leonardo da Vinci'],
    correct: 1,
  },
  {
    id: 'fodt-forst-danskere',
    text: 'Hvem af disse danskere blev født først?',
    options: ['Søren Kierkegaard', 'H.C. Andersen', 'Carl Nielsen', 'Niels Bohr'],
    correct: 1,
  },
  {
    id: 'fodt-forst-forskere',
    text: 'Hvem af disse forskere blev født først?',
    options: ['Marie Curie', 'Max Planck', 'Albert Einstein', 'Niels Bohr'],
    correct: 1,
  },
  {
    id: 'fodt-forst-opdagere',
    text: 'Hvilken dansk opdagelsesrejsende blev født først?',
    options: ['Ejnar Mikkelsen', 'Peter Freuchen', 'Knud Rasmussen', 'Lauge Koch'],
    correct: 2,
  },
  {
    id: 'fodt-forst-presidenter',
    text: 'Hvem af disse præsidenter blev født først?',
    options: ['John Adams', 'Thomas Jefferson', 'James Madison', 'George Washington'],
    correct: 3,
  },
  {
    id: 'dode-sist-musikere',
    text: 'Hvem af disse musikere døde sidst?',
    options: ['Jim Morrison', 'John Lennon', 'Elvis Presley', 'Jimi Hendrix'],
    correct: 1,
  },
  {
    id: 'dode-sist-historie',
    text: 'Hvem af disse historiske personer døde sidst?',
    options: ['Napoleon', 'Beethoven', 'Goethe', 'Mozart'],
    correct: 2,
  },
  {
    id: 'dode-sist-berommelser',
    text: 'Hvem af disse berømte personer døde sidst?',
    options: ['Mahatma Gandhi', 'Franklin D. Roosevelt', 'Winston Churchill', 'Albert Einstein'],
    correct: 2,
  },
  {
    id: 'dode-sist-danskere',
    text: 'Hvem af disse danskere døde sidst?',
    options: ['Niels Bohr', 'Carl Nielsen', 'H.C. Andersen', 'Søren Kierkegaard'],
    correct: 0,
  },
  {
    id: 'dode-sist-artister',
    text: 'Hvem af disse artister døde sidst?',
    options: ['Amy Winehouse', 'Whitney Houston', 'Michael Jackson', 'Prince'],
    correct: 3,
  },
  {
    id: 'by-flest-istanbul',
    text: 'Hvilken af disse byer har flest indbyggere i selve byen?',
    options: ['London', 'Moskva', 'Paris', 'Istanbul'],
    correct: 3,
  },
  {
    id: 'by-flest-berlin',
    text: 'Hvilken af disse EU-byer har flest indbyggere i selve byen?',
    options: ['Rom', 'Berlin', 'Paris', 'Madrid'],
    correct: 1,
  },
  {
    id: 'by-flest-hamburg',
    text: 'Hvilken europæisk by har flest indbyggere i selve byen?',
    options: ['Hamborg', 'Milano', 'München', 'Barcelona'],
    correct: 0,
  },
  {
    id: 'by-flest-toronto',
    text: 'Hvilken nordamerikansk by har flest indbyggere i selve byen?',
    options: ['Houston', 'Montréal', 'Toronto', 'Chicago'],
    correct: 2,
  },
  // ---- Sport, film, tv og serier, musik, litteratur og kunst
  // (two of the four options are close on purpose, so it is mostly a choice between two)
  {
    id: 'elvstrom',
    text: 'Hvilken dansker vandt OL-guld i sejlsport fire gange i træk?',
    options: ['Jesper Bank', 'Steen Secher', 'Paul Elvstrøm', 'Jesper Seier'],
    correct: 2,
  },
  {
    id: 'axelsen',
    text: 'Hvem vandt OL-guld i herresingle i badminton i 2024?',
    options: ['Anders Antonsen', 'Kunlavut Vitidsarn', 'Lee Zii Jia', 'Viktor Axelsen'],
    correct: 3,
  },
  {
    id: 'handbold-ol',
    text: 'Hvilket år vandt de danske håndboldherrer OL-guld første gang?',
    options: ['2008', '2012', '2016', '2020'],
    correct: 2,
  },
  {
    id: 'rekord-100m',
    text: 'Hvad er verdensrekorden på 100 meter for mænd per 2026?',
    options: ['9,48 sek', '9,58 sek', '9,69 sek', '9,79 sek'],
    correct: 1,
  },
  {
    id: 'ol-vertskap',
    text: 'Hvilket land har været vært for sommer-OL flest gange?',
    options: ['USA', 'Tyskland', 'Storbritannien', 'Frankrig'],
    correct: 0,
  },
  {
    id: 'ballon-dor',
    text: "Hvem har vundet flest Ballon d'Or?",
    options: ['Lionel Messi', 'Cristiano Ronaldo', 'Michel Platini', 'Johan Cruyff'],
    correct: 0,
  },
  {
    id: 'laudrup-real',
    text: 'Hvilken klub skiftede Laudrup til fra Barcelona i 1994?',
    options: ['Juventus', 'Ajax', 'Lazio', 'Real Madrid'],
    correct: 3,
  },
  {
    id: 'grand-slam',
    text: 'Hvem har flest grand slam-titler blandt herrerne per 2026?',
    options: ['Pete Sampras', 'Rafael Nadal', 'Roger Federer', 'Novak Djokovic'],
    correct: 3,
  },
  { id: 'boksing-runder', text: 'Hvor mange runder går en VM-kamp i boksning?', options: ['10', '12', '14', '15'], correct: 1 },
  {
    id: 'em-2024',
    text: 'Hvilket land vandt EM i fodbold for mænd i 2024?',
    options: ['Tyskland', 'England', 'Frankrig', 'Spanien'],
    correct: 3,
  },
  {
    id: 'film-mest-penger',
    text: 'Hvilken film har tjent flest penge nogensinde?',
    options: ['Spider-Man: No Way Home', 'Avengers: Endgame', 'Avatar', 'Titanic'],
    correct: 2,
  },
  {
    id: 'oscar-2020',
    text: 'Hvilken film vandt bedste film ved Oscar-uddelingen i 2020?',
    options: ['Joker', 'Parasite', 'The Irishman', '1917'],
    correct: 1,
  },
  { id: 'titanic-oscar', text: 'Hvor mange Oscar-statuetter vandt «Titanic»?', options: ['9', '11', '12', '14'], correct: 1 },
  {
    id: 'haevnen-oscar',
    text: 'Hvilken dansk film vandt Oscar for bedste udenlandske film?',
    options: ['Festen', 'Jagten', 'Hævnen', 'Dancer in the Dark'],
    correct: 2,
  },
  {
    id: 'oscar-hovedrolle-mann',
    text: 'Hvem har flest Oscars for bedste mandlige hovedrolle?',
    options: ['Daniel Day-Lewis', 'Tom Hanks', 'Marlon Brando', 'Jack Nicholson'],
    correct: 0,
  },
  {
    id: 'oscar-hovedrolle-kvinne',
    text: 'Hvem har flest Oscars for bedste kvindelige hovedrolle?',
    options: ['Frances McDormand', 'Meryl Streep', 'Ingrid Bergman', 'Katharine Hepburn'],
    correct: 3,
  },
  {
    id: 'star-wars-vader',
    text: 'I hvilken «Star Wars»-film afsløres det, at Vader er Lukes far?',
    options: ['A New Hope', 'The Empire Strikes Back', 'The Phantom Menace', 'Return of the Jedi'],
    correct: 1,
  },
  {
    id: 'joker-ledger',
    text: 'Hvem spillede Jokeren i «The Dark Knight» fra 2008?',
    options: ['Jack Nicholson', 'Joaquin Phoenix', 'Jared Leto', 'Heath Ledger'],
    correct: 3,
  },
  {
    id: 'disney-forste',
    text: 'Hvilken var Disneys første lange tegnefilm?',
    options: ['Snehvide', 'Dumbo', 'Pinocchio', 'Bambi'],
    correct: 0,
  },
  {
    id: 'borgen',
    text: 'Hvilken tv-serie handler om statsminister Birgitte Nyborg?',
    options: ['Forbrydelsen', 'Borgen', 'Rejseholdet', 'Matador'],
    correct: 1,
  },
  { id: 'forbrydelsen-ar', text: 'Hvilket år havde «Forbrydelsen» premiere?', options: ['2005', '2007', '2009', '2011'], correct: 1 },
  { id: 'got-sesonger', text: 'Hvor mange sæsoner har «Game of Thrones»?', options: ['6', '7', '8', '9'], correct: 2 },
  {
    id: 'central-perk',
    text: 'Hvad hedder kaffebaren i «Friends»?',
    options: ["Monk's Café", 'The Peach Pit', "MacLaren's Pub", 'Central Perk'],
    correct: 3,
  },
  {
    id: 'simpsons-lengst',
    text: 'Hvilken animationsserie har kørt længst på amerikansk tv?',
    options: ['Futurama', 'The Simpsons', 'South Park', 'Family Guy'],
    correct: 1,
  },
  {
    id: 'egon-olsen',
    text: 'Hvem spillede Egon Olsen i Olsen-banden-filmene?',
    options: ['Morten Grunwald', 'Poul Bundgaard', 'Dirch Passer', 'Ove Sprogøe'],
    correct: 3,
  },
  {
    id: 'demogorgon',
    text: 'Hvad hedder monstret i første sæson af «Stranger Things»?',
    options: ['Demogorgon', 'Mind Flayer', 'Dart', 'Vecna'],
    correct: 0,
  },
  {
    id: 'the-office-by',
    text: 'Hvor foregår den amerikanske version af «The Office»?',
    options: ['Pittsburgh', 'Buffalo', 'Philadelphia', 'Scranton'],
    correct: 3,
  },
  {
    id: 'squid-game-lek',
    text: 'Hvad er den første leg i «Squid Game»?',
    options: ['Kuglespil', 'Rødt lys, grønt lys', 'Tovtrækning', 'Dalgona (honningkage)'],
    correct: 1,
  },
  {
    id: 'olsen-brothers',
    text: 'Hvilket år vandt Olsen Brothers Eurovision Song Contest?',
    options: ['1996', '1998', '2000', '2002'],
    correct: 2,
  },
  {
    id: 'lukas-graham',
    text: 'Hvilket dansk band står bag «7 Years»?',
    options: ['Lukas Graham', 'Alphabeat', 'Aqua', 'Volbeat'],
    correct: 0,
  },
  {
    id: 'best-solgte-album',
    text: 'Hvilket album har solgt flest eksemplarer nogensinde?',
    options: ['Thriller', 'Back in Black', 'Rumours', 'Dark Side of the Moon'],
    correct: 0,
  },
  { id: 'bohemian-rhapsody', text: 'Hvilket år udkom Queens «Bohemian Rhapsody»?', options: ['1973', '1975', '1977', '1979'], correct: 1 },
  {
    id: 'the-boss',
    text: 'Hvilken kunstner kaldes «The Boss»?',
    options: ['Bon Jovi', 'Billy Joel', 'Bruce Springsteen', 'Bob Dylan'],
    correct: 2,
  },
  {
    id: 'vivaldi',
    text: 'Hvem komponerede «De fire årstider»?',
    options: ['Georg Friedrich Händel', 'Wolfgang Amadeus Mozart', 'Johann Sebastian Bach', 'Antonio Vivaldi'],
    correct: 3,
  },
  {
    id: 'gasolin',
    text: 'Hvilket band var Kim Larsen forsanger i fra 1969 til 1978?',
    options: ['Shu-bi-dua', "Gasolin'", 'TV-2', 'D-A-D'],
    correct: 1,
  },
  { id: 'guernica', text: 'Hvem malede «Guernica»?', options: ['Salvador Dalí', 'Joan Miró', 'Henri Matisse', 'Pablo Picasso'], correct: 3 },
  {
    id: 'orwell-1984',
    text: 'Hvem skrev romanen «1984»?',
    options: ['Ray Bradbury', 'George Orwell', 'H.G. Wells', 'Aldous Huxley'],
    correct: 1,
  },
  {
    id: 'lille-havfrue-ar',
    text: 'Hvilket år udkom H.C. Andersens «Den lille havfrue»?',
    options: ['1825', '1837', '1845', '1859'],
    correct: 1,
  },
  {
    id: 'pelle-erobreren',
    text: 'Hvem skrev romanen «Pelle Erobreren»?',
    options: ['Herman Bang', 'Johannes V. Jensen', 'Martin Andersen Nexø', 'Henrik Pontoppidan'],
    correct: 2,
  },
  {
    id: 'warhol-suppe',
    text: "Hvem er kendt for kunstværker med Campbell's suppedåser?",
    options: ['Andy Warhol', 'Keith Haring', 'Jackson Pollock', 'Roy Lichtenstein'],
    correct: 0,
  },
];
