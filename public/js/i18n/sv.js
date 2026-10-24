// Swedish: the dictionaries of the areas of the app (the Norwegian text is the key). See docs/I18N.md.
import start from './sv/start.js';
import play from './sv/play.js';
import pay from './sv/pay.js';
import regler from './sv/regler.js';
import pages from './sv/pages.js';
import server from './sv/server.js';

export default { ...start, ...play, ...pay, ...regler, ...pages, ...server };
