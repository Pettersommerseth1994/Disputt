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
  { id: 'ekvator-storst', text: 'Hva er det største landet (i areal) ekvator krysser?', options: ['DR Kongo', 'Brasil', 'India', 'Colombia'], correct: 1 },
  // The card says that Falling Feather is what Vinmonopolet sells most of. In 2025 it came second (1 004 058 litres), just
  // behind Marqués de Nombrevilla (1 038 717), which is not among the options: hence "av disse", which is right either way.
  {
    id: 'vinmonopolet-liter',
    text: 'Hvilket av disse solgte Vinmonopolet mest av i liter i 2025?',
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
  { id: 'maaner', text: 'Hvilken planet har flest kjente måner per 2026?', options: ['Saturn', 'Jupiter', 'Uranus', 'Neptun'], correct: 0 },
  // ---- Sammenligninger: høyde, vekt, drektighet, levealder, areal, økonomi, fødsel og død, innbyggere
  // (two of the four options are close on purpose, so it is mostly a choice between two)
  { id: 'putin-hoyde', text: 'Hvor høy er Vladimir Putin?', options: ['160 cm', '165 cm', '170 cm', '175 cm'], correct: 2 },
  { id: 'trump-hoyde', text: 'Hvor høy er Donald Trump?', options: ['175 cm', '180 cm', '185 cm', '190 cm'], correct: 3 },
  { id: 'obama-hoyde', text: 'Hvor høy er Barack Obama?', options: ['180 cm', '185 cm', '190 cm', '195 cm'], correct: 1 },
  {
    id: 'hoyest-politikere',
    text: 'Hvem er høyest av disse?',
    options: ['Barack Obama', 'Joe Biden', 'Donald Trump', 'Vladimir Putin'],
    correct: 2,
  },
  {
    id: 'hoyest-basket',
    text: 'Hvem er høyest av disse basketballspillerne?',
    options: ['Kevin Durant', 'Stephen Curry', 'Michael Jordan', 'LeBron James'],
    correct: 0,
  },
  {
    id: 'hoyest-skuespillere',
    text: 'Hvem er høyest av disse skuespillerne?',
    options: ['Sylvester Stallone', 'Dwayne Johnson', 'Tom Cruise', 'Arnold Schwarzenegger'],
    correct: 1,
  },
  {
    id: 'hoyest-presidenter',
    text: 'Hvem av disse presidentene var høyest?',
    options: ['George Washington', 'Theodore Roosevelt', 'John F. Kennedy', 'Abraham Lincoln'],
    correct: 3,
  },
  {
    id: 'drektighet-kamel',
    text: 'Hvilket av disse dyrene har lengst drektighetstid?',
    options: ['Ku', 'Gris', 'Kamel', 'Hest'],
    correct: 2,
  },
  {
    id: 'drektighet-spekkhogger',
    text: 'Hvilket av disse pattedyrene går drektig lengst?',
    options: ['Blåhval', 'Flodhest', 'Spekkhogger', 'Giraff'],
    correct: 2,
  },
  { id: 'drektighet-ku', text: 'Hvilket av disse dyrene er drektig lengst?', options: ['Elg', 'Geit', 'Rein', 'Ku'], correct: 3 },
  { id: 'drektighet-sau', text: 'Hvilket av disse husdyrene er drektig lengst?', options: ['Hund', 'Kanin', 'Sau', 'Gris'], correct: 2 },
  {
    id: 'veier-mest-neshorn',
    text: 'Hvilket av disse dyrene veier mest?',
    options: ['Isbjørn', 'Flodhest', 'Hvitt neshorn', 'Giraff'],
    correct: 2,
  },
  {
    id: 'veier-mest-landdyr',
    text: 'Hvilket landdyr veier mest?',
    options: ['Asiatisk elefant', 'Hvitt neshorn', 'Flodhest', 'Afrikansk elefant'],
    correct: 3,
  },
  { id: 'veier-mest-hai', text: 'Hvilken av disse haiene veier mest?', options: ['Tigerhai', 'Brugde', 'Hvithai', 'Hvalhai'], correct: 3 },
  {
    id: 'veier-mest-rovdyr',
    text: 'Hvilket av disse rovdyrene veier mest?',
    options: ['Grizzlybjørn', 'Isbjørn', 'Tiger', 'Løve'],
    correct: 1,
  },
  { id: 'veier-mest-norske', text: 'Hvilket av disse norske dyrene veier mest?', options: ['Rein', 'Elg', 'Brunbjørn', 'Ulv'], correct: 1 },
  {
    id: 'veier-minst-spissmus',
    text: 'Hvilket av disse dyrene veier minst?',
    options: ['Husmus', 'Lemen', 'Hamster', 'Vanlig spissmus'],
    correct: 3,
  },
  {
    id: 'veier-minst-fugl',
    text: 'Hvilken av disse fuglene veier minst?',
    options: ['Fuglekonge', 'Gråspurv', 'Svarttrost', 'Blåmeis'],
    correct: 0,
  },
  {
    id: 'lever-lengst-musling',
    text: 'Hvilket av disse dyrene lever lengst?',
    options: ['Grønlandshval', 'Islandsmusling', 'Gigantskilpadde', 'Afrikansk elefant'],
    correct: 1,
  },
  {
    id: 'lever-lengst-hai',
    text: 'Hvilken av disse haiene lever lengst?',
    options: ['Grønlandshai', 'Hvithai', 'Hvalhai', 'Brugde'],
    correct: 0,
  },
  {
    id: 'lever-lengst-pattedyr',
    text: 'Hvilket pattedyr lever lengst?',
    options: ['Blåhval', 'Grønlandshval', 'Afrikansk elefant', 'Spekkhogger'],
    correct: 1,
  },
  {
    id: 'storst-argentina',
    text: 'Hvilket land er størst i areal av disse?',
    options: ['Argentina', 'Kasakhstan', 'DR Kongo', 'Algerie'],
    correct: 0,
  },
  {
    id: 'storst-mexico',
    text: 'Hvilket av disse landene er størst i areal?',
    options: ['Iran', 'Indonesia', 'Peru', 'Mexico'],
    correct: 3,
  },
  {
    id: 'storst-frankrike',
    text: 'Hvilket av disse europeiske landene er størst i areal?',
    options: ['Tyskland', 'Sverige', 'Frankrike', 'Spania'],
    correct: 2,
  },
  {
    id: 'minst-vatikan',
    text: 'Hvilket av disse landene er minst i areal?',
    options: ['Vatikanstaten', 'Liechtenstein', 'Monaco', 'San Marino'],
    correct: 0,
  },
  {
    id: 'minst-nauru',
    text: 'Hvilket land er minst i areal av disse?',
    options: ['Nauru', 'Maldivene', 'Marshalløyene', 'Tuvalu'],
    correct: 0,
  },
  {
    id: 'minst-maldivene',
    text: 'I landareal: hvilket av disse landene er minst?',
    options: ['Malta', 'Luxembourg', 'Maldivene', 'Barbados'],
    correct: 2,
  },
  {
    id: 'minst-sanmarino',
    text: 'Hvilket av disse europeiske landene er minst i areal?',
    options: ['San Marino', 'Liechtenstein', 'Andorra', 'Malta'],
    correct: 0,
  },
  {
    id: 'bil-flest-merke',
    text: 'Hvilket bilkonsern produserer flest biler i året?',
    options: ['Ford', 'Toyota', 'Volkswagen', 'Hyundai'],
    correct: 1,
  },
  {
    id: 'bil-mest-solgt',
    text: 'Hvilken bilmodell er verdens mest solgte gjennom tidene?',
    options: ['Volkswagen Golf', 'Ford F-serien', 'Volkswagen Boble', 'Toyota Corolla'],
    correct: 3,
  },
  {
    id: 'bil-flest-land',
    text: 'Hvilket av disse landene produserer flest biler?',
    options: ['USA', 'India', 'Tyskland', 'Japan'],
    correct: 0,
  },
  {
    id: 'okonomi-usa',
    text: 'Hvilket land har størst økonomi, målt i nominelt BNP?',
    options: ['Tyskland', 'USA', 'Japan', 'Kina'],
    correct: 1,
  },
  {
    id: 'okonomi-europa',
    text: 'Hvilket av disse landene har størst økonomi (nominelt BNP)?',
    options: ['Italia', 'Storbritannia', 'Tyskland', 'Frankrike'],
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
    text: 'Hvem av disse ble født først?',
    options: ['Rafael', 'Sandro Botticelli', 'Michelangelo', 'Leonardo da Vinci'],
    correct: 1,
  },
  {
    id: 'fodt-forst-nordmenn',
    text: 'Hvem av disse nordmennene ble født først?',
    options: ['Henrik Ibsen', 'Edvard Grieg', 'Edvard Munch', 'Bjørnstjerne Bjørnson'],
    correct: 0,
  },
  {
    id: 'fodt-forst-forskere',
    text: 'Hvem av disse forskerne ble født først?',
    options: ['Marie Curie', 'Max Planck', 'Albert Einstein', 'Niels Bohr'],
    correct: 1,
  },
  {
    id: 'fodt-forst-oppdagere',
    text: 'Hvilken norsk oppdager ble født først?',
    options: ['Thor Heyerdahl', 'Roald Amundsen', 'Fridtjof Nansen', 'Otto Sverdrup'],
    correct: 3,
  },
  {
    id: 'fodt-forst-presidenter',
    text: 'Hvem av disse presidentene ble født først?',
    options: ['John Adams', 'Thomas Jefferson', 'James Madison', 'George Washington'],
    correct: 3,
  },
  {
    id: 'dode-sist-musikere',
    text: 'Hvem av disse musikerne døde sist?',
    options: ['Jim Morrison', 'John Lennon', 'Elvis Presley', 'Jimi Hendrix'],
    correct: 1,
  },
  {
    id: 'dode-sist-historie',
    text: 'Hvem av disse historiske personene døde sist?',
    options: ['Napoleon', 'Beethoven', 'Goethe', 'Mozart'],
    correct: 2,
  },
  {
    id: 'dode-sist-berommelser',
    text: 'Hvem av disse berømte personene døde sist?',
    options: ['Mahatma Gandhi', 'Franklin D. Roosevelt', 'Winston Churchill', 'Albert Einstein'],
    correct: 2,
  },
  {
    id: 'dode-sist-nordmenn',
    text: 'Hvem av disse nordmennene døde sist?',
    options: ['Fridtjof Nansen', 'Henrik Ibsen', 'Edvard Grieg', 'Roald Amundsen'],
    correct: 0,
  },
  {
    id: 'dode-sist-artister',
    text: 'Hvem av disse artistene døde sist?',
    options: ['Amy Winehouse', 'Whitney Houston', 'Michael Jackson', 'Prince'],
    correct: 3,
  },
  {
    id: 'by-flest-istanbul',
    text: 'Hvilken av disse byene har flest innbyggere i selve byen?',
    options: ['London', 'Moskva', 'Paris', 'Istanbul'],
    correct: 3,
  },
  {
    id: 'by-flest-berlin',
    text: 'Hvilken av disse EU-byene har flest innbyggere i selve byen?',
    options: ['Roma', 'Berlin', 'Paris', 'Madrid'],
    correct: 1,
  },
  {
    id: 'by-flest-hamburg',
    text: 'Hvilken europeisk by har flest innbyggere i selve byen?',
    options: ['Hamburg', 'Milano', 'München', 'Barcelona'],
    correct: 0,
  },
  {
    id: 'by-flest-toronto',
    text: 'Hvilken nordamerikansk by har flest innbyggere i selve byen?',
    options: ['Houston', 'Montréal', 'Toronto', 'Chicago'],
    correct: 2,
  },
  // ---- Sport, film, TV og serier, musikk, litteratur og kunst (the five categories that had the fewest questions)
  // (two of the four options are close on purpose, so it is mostly a choice between two)
  {
    id: 'vinter-ol-medaljer',
    text: 'Hvem har vunnet flest medaljer i vinter-OL gjennom tidene?',
    options: ['Kjetil André Aamodt', 'Bjørn Dæhlie', 'Marit Bjørgen', 'Ole Einar Bjørndalen'],
    correct: 2,
  },
  {
    id: 'vinter-ol-gull',
    text: 'Hvem har vunnet flest gullmedaljer i vinter-OL per 2026?',
    options: ['Ole Einar Bjørndalen', 'Bjørn Dæhlie', 'Marit Bjørgen', 'Johannes Høsflot Klæbo'],
    correct: 3,
  },
  {
    id: 'warholm-rekord',
    text: 'Hvem satte verdensrekord på 400 meter hekk i Tokyo-OL?',
    options: ['Karsten Warholm', 'Kyron McMaster', 'Rai Benjamin', 'Alison dos Santos'],
    correct: 0,
  },
  {
    id: 'rekord-100m',
    text: 'Hva er verdensrekorden på 100 meter for menn per 2026?',
    options: ['9,48 sek', '9,58 sek', '9,69 sek', '9,79 sek'],
    correct: 1,
  },
  {
    id: 'ol-vertskap',
    text: 'Hvilket land har vært vertskap for sommer-OL flest ganger?',
    options: ['USA', 'Tyskland', 'Storbritannia', 'Frankrike'],
    correct: 0,
  },
  {
    id: 'ballon-dor',
    text: "Hvem har vunnet flest Ballon d'Or?",
    options: ['Lionel Messi', 'Cristiano Ronaldo', 'Michel Platini', 'Johan Cruyff'],
    correct: 0,
  },
  {
    id: 'maskoter-lillehammer',
    text: 'Hva het maskotene under OL på Lillehammer i 1994?',
    options: ['Olav og Astrid', 'Håkon og Kristin', 'Magnus og Ingrid', 'Harald og Sonja'],
    correct: 1,
  },
  {
    id: 'grand-slam',
    text: 'Hvem har vunnet flest grand slam-titler blant herrene per 2026?',
    options: ['Pete Sampras', 'Rafael Nadal', 'Roger Federer', 'Novak Djokovic'],
    correct: 3,
  },
  { id: 'boksing-runder', text: 'Hvor mange runder går en VM-kamp i boksing?', options: ['10', '12', '14', '15'], correct: 1 },
  {
    id: 'em-2024',
    text: 'Hvilket land vant fotball-EM for menn i 2024?',
    options: ['Tyskland', 'England', 'Frankrike', 'Spania'],
    correct: 3,
  },
  {
    id: 'film-mest-penger',
    text: 'Hvilken film har tjent mest penger gjennom tidene?',
    options: ['Spider-Man: No Way Home', 'Avengers: Endgame', 'Avatar', 'Titanic'],
    correct: 2,
  },
  {
    id: 'oscar-2020',
    text: 'Hvilken film vant beste film ved Oscar-utdelingen i 2020?',
    options: ['Joker', 'Parasite', 'The Irishman', '1917'],
    correct: 1,
  },
  { id: 'titanic-oscar', text: 'Hvor mange Oscar-statuetter vant «Titanic»?', options: ['9', '11', '12', '14'], correct: 1 },
  {
    id: 'kon-tiki-oscar',
    text: 'Hvilken av disse norske filmene er nominert til en Oscar?',
    options: ['Trolljegeren', 'Fritt vilt', 'Kon-Tiki', 'Max Manus'],
    correct: 2,
  },
  {
    id: 'oscar-hovedrolle-mann',
    text: 'Hvem har flest Oscar for beste mannlige hovedrolle?',
    options: ['Daniel Day-Lewis', 'Tom Hanks', 'Marlon Brando', 'Jack Nicholson'],
    correct: 0,
  },
  {
    id: 'oscar-hovedrolle-kvinne',
    text: 'Hvem har flest Oscar for beste kvinnelige hovedrolle?',
    options: ['Frances McDormand', 'Meryl Streep', 'Ingrid Bergman', 'Katharine Hepburn'],
    correct: 3,
  },
  {
    id: 'star-wars-vader',
    text: 'I hvilken «Star Wars»-film avsløres at Vader er Lukes far?',
    options: ['A New Hope', 'The Empire Strikes Back', 'The Phantom Menace', 'Return of the Jedi'],
    correct: 1,
  },
  {
    id: 'joker-ledger',
    text: 'Hvem spilte Jokeren i «The Dark Knight» fra 2008?',
    options: ['Jack Nicholson', 'Joaquin Phoenix', 'Jared Leto', 'Heath Ledger'],
    correct: 3,
  },
  {
    id: 'disney-forste',
    text: 'Hvilken var Disneys første lange tegnefilm?',
    options: ['Snøhvit', 'Dumbo', 'Pinocchio', 'Bambi'],
    correct: 0,
  },
  {
    id: 'lilyhammer-netflix',
    text: 'Hvilken norsk serie var en av de første Netflix-originalene?',
    options: ['Lilyhammer', 'Okkupert', 'Skam', 'Mammon'],
    correct: 0,
  },
  { id: 'skam-ar', text: 'Hvilket år hadde «Skam» premiere?', options: ['2014', '2015', '2016', '2017'], correct: 1 },
  { id: 'got-sesonger', text: 'Hvor mange sesonger har «Game of Thrones»?', options: ['6', '7', '8', '9'], correct: 2 },
  {
    id: 'central-perk',
    text: 'Hva heter kaffebaren i «Friends»?',
    options: ["Monk's Café", 'The Peach Pit', "MacLaren's Pub", 'Central Perk'],
    correct: 3,
  },
  {
    id: 'simpsons-lengst',
    text: 'Hvilken animasjonsserie har gått lengst på amerikansk TV?',
    options: ['Futurama', 'The Simpsons', 'South Park', 'Family Guy'],
    correct: 1,
  },
  {
    id: 'fleksnes',
    text: 'Hvem spilte Marve Fleksnes i «Fleksnes Fataliteter»?',
    options: ['Harald Heide-Steen jr.', 'Arve Opsahl', 'Trond Kirkvaag', 'Rolv Wesenlund'],
    correct: 3,
  },
  {
    id: 'demogorgon',
    text: 'Hva heter monsteret i første sesong av «Stranger Things»?',
    options: ['Demogorgon', 'Mind Flayer', 'Dart', 'Vecna'],
    correct: 0,
  },
  {
    id: 'the-office-by',
    text: 'Hvor foregår den amerikanske versjonen av «The Office»?',
    options: ['Pittsburgh', 'Buffalo', 'Philadelphia', 'Scranton'],
    correct: 3,
  },
  {
    id: 'squid-game-lek',
    text: 'Hva er den første leken i «Squid Game»?',
    options: ['Kulespill', 'Rødt lys, grønt lys', 'Tautrekking', 'Dalgona (honningkake)'],
    correct: 1,
  },
  {
    id: 'rybak-2009',
    text: 'Hvilket år vant Alexander Rybak Eurovision med «Fairytale»?',
    options: ['2007', '2008', '2009', '2010'],
    correct: 2,
  },
  {
    id: 'alan-walker',
    text: 'Hvilken norsk DJ står bak låten «Faded»?',
    options: ['Cashmere Cat', 'Alan Walker', 'Matoma', 'Kygo'],
    correct: 1,
  },
  {
    id: 'best-solgte-album',
    text: 'Hvilket album har solgt flest eksemplarer gjennom tidene?',
    options: ['Thriller', 'Back in Black', 'Rumours', 'Dark Side of the Moon'],
    correct: 0,
  },
  { id: 'bohemian-rhapsody', text: 'Hvilket år kom Queens «Bohemian Rhapsody»?', options: ['1973', '1975', '1977', '1979'], correct: 1 },
  {
    id: 'the-boss',
    text: 'Hvilken artist kalles «The Boss»?',
    options: ['Bon Jovi', 'Billy Joel', 'Bruce Springsteen', 'Bob Dylan'],
    correct: 2,
  },
  {
    id: 'vivaldi',
    text: 'Hvem komponerte «De fire årstider»?',
    options: ['Georg Friedrich Händel', 'Wolfgang Amadeus Mozart', 'Johann Sebastian Bach', 'Antonio Vivaldi'],
    correct: 3,
  },
  {
    id: 'hardingfele',
    text: 'Hvilket instrument regnes som Norges nasjonalinstrument?',
    options: ['Hardingfele', 'Munnharpe', 'Langeleik', 'Seljefløyte'],
    correct: 0,
  },
  { id: 'guernica', text: 'Hvem malte «Guernica»?', options: ['Salvador Dalí', 'Joan Miró', 'Henri Matisse', 'Pablo Picasso'], correct: 3 },
  {
    id: 'orwell-1984',
    text: 'Hvem skrev romanen «1984»?',
    options: ['Ray Bradbury', 'George Orwell', 'H.G. Wells', 'Aldous Huxley'],
    correct: 1,
  },
  { id: 'dukkehjem-ar', text: 'Hvilket år kom Ibsens «Et dukkehjem»?', options: ['1867', '1879', '1884', '1890'], correct: 1 },
  {
    id: 'hamsun-sult',
    text: 'Hvem skrev romanen «Sult» fra 1890?',
    options: ['Alexander Kielland', 'Arne Garborg', 'Knut Hamsun', 'Henrik Ibsen'],
    correct: 2,
  },
  {
    id: 'warhol-suppe',
    text: 'Hvem er kjent for kunstverk med Campbells suppebokser?',
    options: ['Andy Warhol', 'Keith Haring', 'Jackson Pollock', 'Roy Lichtenstein'],
    correct: 0,
  },
];

export const LETTERS = ['A', 'B', 'C', 'D'];
