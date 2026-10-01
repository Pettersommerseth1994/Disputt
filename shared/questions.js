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
  {
    id: 'galdhopiggen',
    text: 'Hva er Norges høyeste fjell?',
    options: ['Glittertind', 'Snøhetta', 'Galdhøpiggen', 'Store Skagastølstind'],
    correct: 2,
  },
  { id: 'mjosa', text: 'Hva er Norges største innsjø?', options: ['Mjøsa', 'Femunden', 'Røssvatnet', 'Tyrifjorden'], correct: 0 },
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
  { id: 'canberra', text: 'Hva er hovedstaden i Australia?', options: ['Sydney', 'Melbourne', 'Perth', 'Canberra'], correct: 3 },
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
  {
    id: 'sollys',
    text: 'Hvor lang tid bruker lyset fra sola på å nå Jorden?',
    options: ['Åtte sekunder', 'Åtte minutter', 'Åtte timer', 'Åtte dager'],
    correct: 1,
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
];

export const LETTERS = ['A', 'B', 'C', 'D'];
