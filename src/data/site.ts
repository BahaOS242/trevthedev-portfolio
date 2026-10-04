// Single source of truth for business details, links and SEO copy.
// Anything set to `null` is hidden on the site until you fill it in.

export const SITE_URL = 'https://www.trevthewebdev.com';

export const site = {
  brand: 'TrevTheDev',
  name: 'Trevor Armstrong',
  locale: 'en_US',
  email: 'tcarmstrong96@icloud.com',
  phone: '+1-242-801-2847',
  whatsapp: '12428012847',
  city: 'Nassau',
  region: 'New Providence',
  country: 'BS',
  countryName: 'The Bahamas',
  geo: { lat: 25.0443, lng: -77.3504 },
  github: 'https://github.com/trevthedev',
  linkedin: 'https://linkedin.com/in/trevthedev',

  // Hidden until set.
  capacity: null as null | { slots: number; nextOpening: string },
  resumeUrl: null as null | string, // e.g. '/trevor-armstrong-resume.pdf' (put the file in /public)
  testimonial: null as null | { quote: string; name: string; role: string },
  fuelFlowResult: null as null | { before: string; after: string },

} as const;

export const wa = (text?: string) =>
  `https://wa.me/${site.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export const discoveryCall = wa('Hi Trev, I want to book a free discovery call');

export const faqs = [
  {
    q: "I'm not technical. How much of my time does this take?",
    a: 'A kickoff chat and a review before launch. I handle the build, setup and content structure.',
  },
  {
    q: 'Will the WhatsApp AI say the wrong thing to customers?',
    a: "It's set up with your hours, services and FAQs, and hands off to you for anything it shouldn't decide.",
  },
  {
    q: 'What does a website cost in the Bahamas?',
    a: 'Custom — every business needs something different. The discovery call and first strategy meeting are free, and you get a fixed quote before any work starts. No surprise invoices.',
  },
  {
    q: 'What happens on the free discovery call?',
    a: "We talk through your business, your customers and where you're losing them. If it's a fit, we book the free strategy meeting where you get the plan and quote. If not, you still leave with ideas.",
  },
];
