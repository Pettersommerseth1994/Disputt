// Question bank. Each question has exactly four options; `correct` is the index of the right one.
// The game cycles through a shuffled deck before repeating anything, so more questions mean fewer repeats.
//
// What makes a good Disputt question: something people feel they once knew but are not sure of, so the group has to
// argue its way to the answer (and the impostor, who knows it, has something to bend). Check every fact against a
// source, keep one clearly right option, and mix up where the right one sits (test/questions.test.js keeps count).

export const QUESTIONS = [
  // ---- the first four test questions
  {
    id: 'turister',
    text: 'Hvilket land har flest turister årlig?',
    options: ['USA', 'Japan', 'Frankrike', 'Kina'],
    correct: 2,
  },
  {
    id: 'orken',
    text: 'Hva er verdens største ørken?',
    options: ['Sahara', 'Antarktis', 'Gobi', 'Den arabiske ørken'],
    correct: 1,
  },
  {
    id: 'elv',
    text: 'Hva er Europas lengste elv?',
    options: ['Donau', 'Rhinen', 'Dnepr', 'Volga'],
    correct: 3,
  },
  {
    id: 'blekksprut',
    text: 'Hvor mange hjerter har en blekksprut?',
    options: ['Tre', 'Ett', 'Fire', 'To'],
    correct: 0,
  },

  // ---- Norge: historie og samfunn
  { id: 'vipps', text: 'Når ble Vipps lansert i Norge?', options: ['2012', '2015', '2017', '2019'], correct: 1 },
  { id: 'unionen', text: 'Hvilket år ble unionen mellom Norge og Sverige oppløst?', options: ['1814', '1884', '1905', '1920'], correct: 2 },
  { id: 'stemmerett', text: 'Hvilket år fikk norske kvinner alminnelig stemmerett?', options: ['1884', '1898', '1905', '1913'], correct: 3 },
  {
    id: 'eu',
    text: 'Hvilke år har nordmenn stemt nei til EU-medlemskap?',
    options: ['1962 og 1984', '1972 og 1994', '1975 og 1998', '1980 og 2001'],
    correct: 1,
  },
  { id: 'ekofisk', text: 'Hvilket år ble oljefeltet Ekofisk funnet?', options: ['1969', '1971', '1975', '1979'], correct: 0 },
  { id: 'oslo', text: 'Hvilket år skiftet Kristiania navn til Oslo?', options: ['1877', '1905', '1914', '1925'], correct: 3 },
  { id: 'svartedauden', text: 'Hvilket år kom svartedauden til Norge?', options: ['1349', '1397', '1450', '1537'], correct: 0 },
  {
    id: 'stiklestad',
    text: 'Hvilket år falt Olav den hellige i slaget ved Stiklestad?',
    options: ['872', '995', '1030', '1066'],
    correct: 2,
  },
  { id: 'vinter-ol', text: 'Hvilket år var det vinter-OL i Oslo?', options: ['1952', '1956', '1960', '1964'], correct: 0 },
  { id: 'gardermoen', text: 'Hvilket år åpnet Oslo lufthavn Gardermoen?', options: ['1988', '1992', '1994', '1998'], correct: 3 },
  { id: 'amundsen', text: 'Hvilket år nådde Roald Amundsen Sydpolen?', options: ['1903', '1907', '1911', '1914'], correct: 2 },
  {
    id: 'skrik',
    text: 'Hvilket år malte Edvard Munch første versjon av «Skrik»?',
    options: ['1883', '1893', '1903', '1913'],
    correct: 1,
  },
  { id: 'fox', text: 'Hvilket år kom Ylvis-låten «The Fox»?', options: ['2013', '2014', '2016', '2018'], correct: 0 },
  {
    id: 'kongen-hjem',
    text: 'Hvilken dato kom kong Haakon hjem til Norge etter krigen?',
    options: ['9. april', '8. mai', '17. mai', '7. juni'],
    correct: 3,
  },
  {
    id: 'nmt',
    text: 'Hva het det første automatiske mobilnettet i Norge?',
    options: ['NMT', 'GSM', 'UMTS', 'CDMA'],
    correct: 0,
  },
  { id: 'stortinget', text: 'Hvor mange representanter har Stortinget?', options: ['150', '165', '169', '175'], correct: 2 },

  // ---- Norge: natur og kultur
  { id: 'naboland', text: 'Hvor mange land grenser til Norge?', options: ['2', '3', '4', '5'], correct: 1 },
  { id: 'alfabet', text: 'Hvor mange bokstaver har det norske alfabetet?', options: ['26', '27', '29', '31'], correct: 2 },
  {
    id: 'hamsun',
    text: 'Hvilken nordmann fikk Nobels litteraturpris i 1920?',
    options: ['Henrik Ibsen', 'Bjørnstjerne Bjørnson', 'Sigrid Undset', 'Knut Hamsun'],
    correct: 3,
  },
  { id: 'fram', text: 'Hva het skipet Roald Amundsen brukte til Sydpolen?', options: ['Gjøa', 'Maud', 'Fram', 'Kon-Tiki'], correct: 2 },
  {
    id: 'peer-gynt',
    text: 'Hvem komponerte musikken til «Peer Gynt»?',
    options: ['Johan Svendsen', 'Edvard Grieg', 'Ole Bull', 'Christian Sinding'],
    correct: 1,
  },
  {
    id: 'kristin',
    text: 'Hvem skrev «Kristin Lavransdatter»?',
    options: ['Sigrid Undset', 'Amalie Skram', 'Camilla Collett', 'Cora Sandel'],
    correct: 0,
  },

  // ---- Verden: historie og teknologi
  { id: 'apollo', text: 'Hvilket år var den siste månelandingen med mennesker?', options: ['1970', '1972', '1975', '1979'], correct: 1 },
  { id: 'muren', text: 'Hvilket år ble Berlinmuren bygget?', options: ['1945', '1949', '1953', '1961'], correct: 3 },
  { id: 'mandela', text: 'Hvilket år ble Nelson Mandela løslatt fra fengsel?', options: ['1976', '1980', '1986', '1990'], correct: 3 },
  { id: 'facebook', text: 'Hvilket år ble Facebook startet?', options: ['2004', '2006', '2008', '2010'], correct: 0 },
  { id: 'iphone', text: 'Hvilket år kom den første iPhonen?', options: ['2003', '2005', '2007', '2009'], correct: 2 },
  { id: 'sms', text: 'Hvilket år ble den første SMS-en sendt?', options: ['1992', '1994', '1996', '1998'], correct: 0 },
  { id: 'potter', text: 'Hvilket år kom den første Harry Potter-boken?', options: ['1991', '1994', '1997', '2000'], correct: 2 },
  {
    id: 'wozniak',
    text: 'Hvem grunnla Apple sammen med Steve Jobs?',
    options: ['Bill Gates', 'Steve Wozniak', 'Tim Cook', 'Elon Musk'],
    correct: 1,
  },
  {
    id: 'teresjkova',
    text: 'Hvem var den første kvinnen i verdensrommet?',
    options: ['Sally Ride', 'Valentina Teresjkova', 'Svetlana Savitskaja', 'Eileen Collins'],
    correct: 1,
  },

  // ---- Verden: geografi
  { id: 'ankara', text: 'Hva er hovedstaden i Tyrkia?', options: ['Istanbul', 'Izmir', 'Antalya', 'Ankara'], correct: 3 },
  { id: 'tidssoner', text: 'Hvor mange tidssoner har Russland?', options: ['6', '9', '11', '13'], correct: 2 },
  { id: 'bajkal', text: 'Hva er verdens dypeste innsjø?', options: ['Bajkal', 'Tanganyika', 'Superior', 'Victoria'], correct: 0 },
  { id: 'kystlinje', text: 'Hvilket land har verdens lengste kystlinje?', options: ['Norge', 'Russland', 'Indonesia', 'Canada'], correct: 3 },
  { id: 'folketall', text: 'Hvilket land har flest innbyggere i verden?', options: ['Kina', 'India', 'USA', 'Indonesia'], correct: 1 },
  { id: 'sveits', text: 'Hvor mange nasjonalspråk har Sveits?', options: ['2', '3', '4', '5'], correct: 2 },
  {
    id: 'aconcagua',
    text: 'Hva er det høyeste fjellet utenfor Asia?',
    options: ['Mont Blanc', 'Aconcagua', 'Denali', 'Kilimanjaro'],
    correct: 1,
  },

  // ---- Verden: natur og vitenskap
  { id: 'venus', text: 'Hvilken planet er varmest?', options: ['Venus', 'Merkur', 'Mars', 'Jupiter'], correct: 0 },
  { id: 'planeter', text: 'Hvor mange planeter har solsystemet vårt?', options: ['7', '8', '9', '10'], correct: 1 },
  {
    id: 'atmosfaere',
    text: 'Hvilken gass er det mest av i jordens atmosfære?',
    options: ['Oksygen', 'Karbondioksid', 'Argon', 'Nitrogen'],
    correct: 3,
  },
  { id: 'kromosomer', text: 'Hvor mange kromosomer har et menneske?', options: ['23', '44', '46', '48'], correct: 2 },
  {
    id: 'pilgrimsfalk',
    text: 'Hvilket dyr har høyest toppfart i verden?',
    options: ['Pilgrimsfalk', 'Gepard', 'Sverdfisk', 'Struts'],
    correct: 0,
  },
  { id: 'elefant', text: 'Hvilket pattedyr har lengst svangerskap?', options: ['Blåhval', 'Giraff', 'Elefant', 'Neshorn'], correct: 2 },

  // ---- Mat og drikke
  { id: 'safran', text: 'Hvilket krydder er dyrest per kilo?', options: ['Safran', 'Vanilje', 'Kardemomme', 'Kanel'], correct: 0 },
  { id: 'kaffe', text: 'Hvilket land produserer mest kaffe?', options: ['Colombia', 'Vietnam', 'Etiopia', 'Brasil'], correct: 3 },

  // ---- From the printed question cards (each card has its right answer circled in red)
  // Typos on the cards are fixed ("Amrikansk", "dessert vin", "bred bremmet") and three questions are shorter, to keep the
  // question card short; the options are in the card's order. The right answers were checked against sources.
  {
    id: 'delstat',
    text: 'I hvilken amerikansk delstat bor det flest mennesker?',
    options: ['California', 'Washington', 'Texas', 'New York'],
    correct: 0,
  },
  { id: 'dusin', text: 'Hvor mye er et dusin?', options: ['12', '20', '25', '30'], correct: 0 },
  {
    id: 'sorligste-hovedstad',
    text: 'Hva er verdens sørligste hovedstad?',
    options: ['Wellington', 'Canberra', 'Santiago de Chile', 'Cape Town'],
    correct: 0,
  },
  {
    id: 'ukraina-hav',
    text: 'Hvilket hav grenser Ukraina til?',
    options: ['Det baltiske hav', 'Middelhavet', 'Det kaspiske hav', 'Svartehavet'],
    correct: 3,
  },
  { id: 'gutenberg', text: 'Rundt hvilket år fant Gutenberg opp boktrykkerkunsten?', options: ['1450', '1540', '1630', '1720'], correct: 0 },
  { id: 'ekvator-storst', text: 'Hva er det største landet ekvator krysser?', options: ['DR Kongo', 'Brasil', 'India', 'Colombia'], correct: 1 },
  // The card says that Falling Feather is what Vinmonopolet sells most of. In 2025 it came second (1 004 058 litres), just
  // behind Marqués de Nombrevilla (1 038 717), which is not among the options: hence "av disse", which is right either way.
  {
    id: 'vinmonopolet-liter',
    text: 'Hvilket av disse selger Vinmonopolet mest av i liter?',
    options: ['Falling Feather (rødvin)', 'Dworek Vodka', 'Jägermeister', 'Baileys'],
    correct: 0,
  },
  { id: 'franz-ferdinand', text: 'I hvilken by ble Franz Ferdinand skutt i 1914?', options: ['Moskva', 'Dallas', 'Berlin', 'Sarajevo'], correct: 3 },
  { id: 'afrika-land', text: 'Hvor mange land består Afrika av?', options: ['22', '34', '46', '54'], correct: 3 },
  { id: 'ekvator-land', text: 'Hvor mange land går ekvator gjennom?', options: ['3', '6', '9', '13'], correct: 3 },
  {
    id: 'mosambik',
    text: 'Hva er avbildet i flagget til Mosambik?',
    options: ['En løve med vinger', 'En naken dame', 'En AK-47-rifle', 'Et skipsratt'],
    correct: 2,
  },
  {
    id: 'kanari',
    text: 'Hummer og kanari er et kjent uttrykk, men hva er kanari?',
    options: ['En rotgrønnsak', 'En dessertvin', 'En teaterkikkert', 'En bredbremmet hatt'],
    correct: 1,
  },

  // ---- More in the same style: Norge
  {
    id: 'sognefjorden',
    text: 'Hva er Norges lengste fjord?',
    options: ['Hardangerfjorden', 'Sognefjorden', 'Trondheimsfjorden', 'Oslofjorden'],
    correct: 1,
  },
  { id: 'riksvapen', text: 'Hvilket dyr har Norge i riksvåpenet?', options: ['Ulv', 'Løve', 'Bjørn', 'Ørn'], correct: 1 },
  {
    id: 'trygve-lie',
    text: 'Hvilken nordmann var FNs første generalsekretær?',
    options: ['Halvdan Koht', 'Gro Harlem Brundtland', 'Trygve Lie', 'Thorvald Stoltenberg'],
    correct: 2,
  },
  { id: 'nato', text: 'Hvilket år ble Norge med i NATO?', options: ['1945', '1949', '1952', '1957'], correct: 1 },
  { id: 'vinmonopolet-1922', text: 'Hvilket år ble Vinmonopolet opprettet?', options: ['1916', '1922', '1927', '1939'], correct: 1 },

  // ---- More in the same style: geografi og flagg
  { id: 'nigeria', text: 'Hvilket land har flest innbyggere i Afrika?', options: ['Etiopia', 'Egypt', 'Sør-Afrika', 'Nigeria'], correct: 3 },
  { id: 'rabat', text: 'Hva er hovedstaden i Marokko?', options: ['Casablanca', 'Marrakech', 'Rabat', 'Fès'], correct: 2 },
  { id: 'kilimanjaro', text: 'I hvilket land ligger Kilimanjaro?', options: ['Kenya', 'Tanzania', 'Uganda', 'Etiopia'], correct: 1 },
  { id: 'angkor-wat', text: 'I hvilket land ligger Angkor Wat?', options: ['Thailand', 'Vietnam', 'Kambodsja', 'Laos'], correct: 2 },
  { id: 'petra', text: 'I hvilket land ligger ruinbyen Petra?', options: ['Egypt', 'Syria', 'Israel', 'Jordan'], correct: 3 },
  {
    id: 'angel-falls',
    text: 'Hva er verdens høyeste foss?',
    options: ['Niagarafallene', 'Victoriafallene', 'Angel Falls', 'Iguazú'],
    correct: 2,
  },
  { id: 'timbuktu', text: 'I hvilket land ligger byen Timbuktu?', options: ['Niger', 'Mali', 'Mauritania', 'Tsjad'], correct: 1 },
  { id: 'nepal', text: 'Hvilket land har et flagg som ikke er firkantet?', options: ['Nepal', 'Bhutan', 'Brunei', 'Sri Lanka'], correct: 0 },
  { id: 'libanon', text: 'Hvilket land har et grønt sedertre i flagget?', options: ['Syria', 'Libanon', 'Kypros', 'Jordan'], correct: 1 },

  // ---- More in the same style: historie
  { id: 'revolusjonen', text: 'Hvilket år brøt den franske revolusjonen ut?', options: ['1689', '1776', '1789', '1815'], correct: 2 },
  { id: 'sovjet', text: 'Hvilket år ble Sovjetunionen oppløst?', options: ['1985', '1987', '1989', '1991'], correct: 3 },
  { id: 'augustus', text: 'Hvem var Romerrikets første keiser?', options: ['Julius Cæsar', 'Augustus', 'Nero', 'Konstantin'], correct: 1 },
  {
    id: 'mayflower',
    text: 'Hva het skipet pilegrimsfedrene seilte med i 1620?',
    options: ['Mayflower', 'Santa Maria', 'Beagle', 'Endeavour'],
    correct: 0,
  },
  { id: 'tsjernobyl', text: 'Hvilket år skjedde Tsjernobyl-ulykken?', options: ['1976', '1979', '1983', '1986'], correct: 3 },

  // ---- More in the same style: mat og drikke
  { id: 'pilsner', text: 'Hvilket land stammer ølsorten pilsner fra?', options: ['Tsjekkia', 'Tyskland', 'Belgia', 'Danmark'], correct: 0 },
  { id: 'tequila', text: 'Hva lages tequila av?', options: ['Kaktus', 'Sukkerrør', 'Mais', 'Agave'], correct: 3 },
  {
    id: 'chianti',
    text: 'Hvilken drue er rødvinen Chianti hovedsakelig laget av?',
    options: ['Merlot', 'Nebbiolo', 'Sangiovese', 'Barbera'],
    correct: 2,
  },
  {
    id: 'gravlaks',
    text: 'Hva er opphavet til navnet gravlaks?',
    options: ['Røkt i en jordhule', 'Oppkalt etter en kokk', 'Servert ved begravelser', 'Gravd ned i bakken'],
    correct: 3,
  },

  // ---- More in the same style: kropp og verdensrom
  { id: 'bein', text: 'Hvor mange bein har en voksen person?', options: ['106', '156', '206', '256'], correct: 2 },
  { id: 'blodtype', text: 'Hvilken blodtype er universell giver?', options: ['A positiv', 'AB positiv', 'O negativ', 'B negativ'], correct: 2 },
  { id: 'maaner', text: 'Hvilken planet har flest kjente måner?', options: ['Saturn', 'Jupiter', 'Uranus', 'Neptun'], correct: 0 },
];

export const LETTERS = ['A', 'B', 'C', 'D'];
