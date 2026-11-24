// Everything the host says. She only speaks when a visitor clicks her or asks for the tour.
// Facts about her work come only from her own portfolio text; jokes are clearly play.

export const SECTIONS = {
  start: { tour: "This is the start. My name is soft, by the way. Go on, poke a letter.", prop: null },
  projects: { tour: "All my projects, newest first. For my MSc I predicted how soft widgets bend; right now I print graphene sensors you can bend.", prop: 'widget' },
  next: { tour: "Here's what I'd love to work on next. If it sounds like your team, let's talk.", prop: 'notebook' },
  contact: { tour: "That's everything. Thanks for exploring with me; my contact details are right here.", prop: null },
};

export const ORDER = ['start', 'projects', 'next', 'contact'];
export const NAMES = { start: 'the start', projects: 'all projects', next: "what's next", contact: 'contact' };

export const JOKES = [
  'Why do soft robots never win arguments? They fold under pressure.',
  'Inflation is usually bad news. In my lab it means the experiment worked.',
  'Nature walks are just field research with better snacks.',
  'If a door needs a sign that says PULL, the door is the problem. Every HCI researcher is contractually obliged to tell you this.',
  'I asked my model how the teeth widget would bend. It said "it depends". Honestly? Same.',
  'My soft robots and I have a lot in common. We both deflate after a long day of testing.',
  'I told a neural network a joke about overfitting. Now it only laughs at that one joke.',
  'Why did the pixel apply to grad school? It wanted more depth. Now it\'s a voxel.',
];

export const REACTIONS = {
  poke: ['Hey, that tickles!', 'Still here!', 'Boop received.', "You're very curious. I approve."],
  pokeSpam: "Okay, okay! I'm awake! I'm awake!",
  menu: 'Need something?',
  tourStart: 'Brilliant. I\'ll walk you through it, one stop at a time. Use "next stop" whenever you\'re ready, or just scroll.',
  nextStop: 'Next stop',
};
