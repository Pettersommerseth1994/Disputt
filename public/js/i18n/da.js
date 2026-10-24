// Danish: the dictionaries of the areas of the app (the Norwegian text is the key). See docs/I18N.md.
import start from './da/start.js';
import play from './da/play.js';
import pay from './da/pay.js';
import regler from './da/regler.js';
import pages from './da/pages.js';
import server from './da/server.js';

export default { ...start, ...play, ...pay, ...regler, ...pages, ...server };
