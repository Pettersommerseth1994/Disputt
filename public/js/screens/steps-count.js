// How many steps the set-up of Bilturmodus has (the bar at the top of each step counts them: setup.js, car.js, mode.js).
// (A file of its own: pages are cached for ten minutes, and a module that imports something an older cached copy of another module does
// not have would not load. This one is new, so everything that imports it is too.)
export const CAR_SEGMENTS = 3;
