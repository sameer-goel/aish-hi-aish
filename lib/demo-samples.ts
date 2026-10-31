export interface DemoSampleComment {
  who: string;
  text: string;
}

export interface DemoSampleMoment {
  id: number;
  url: string;
  guest: string;
  relationship: string;
  caption: string;
  event: 'Mehendi' | 'Sangeet' | 'Wedding';
  sha256: string;
  likes: number;
  comments: DemoSampleComment[];
}

const SB_STORAGE = 'https://wxzluylkxkbuesykwnov.supabase.co/storage/v1/object/public/wedding-photos/seed';

export const DEMO_SAMPLES: DemoSampleMoment[] = [
  {
    id: 1,
    url: `${SB_STORAGE}/sample-1.jpg`,
    guest: 'Neha',
    relationship: "Bride's Sister / Cousin",
    caption: 'Mehendi magic ✨',
    event: 'Mehendi',
    sha256: '5e9ea54367bc975068e2d75699240307140d6b6237f5a753797076d625279648',
    likes: 14,
    comments: [],
  },
  {
    id: 2,
    url: `${SB_STORAGE}/sample-2.jpg`,
    guest: 'Rohan',
    relationship: "Groom's Squad",
    caption: 'The Sangeet squad has entered the chat 😂',
    event: 'Sangeet',
    sha256: 'f82e01b61e8f963a8d4ca68a146fb1a9a9d2224a7b5df6b7bf1a850e4c9f0803',
    likes: 23,
    comments: [{ who: 'Family', text: 'This is going straight into the highlight reel 😂' }],
  },
  {
    id: 3,
    url: `${SB_STORAGE}/sample-3.jpg`,
    guest: 'Tanya',
    relationship: "Bride's Best Friend",
    caption: 'Our mandap looking like a dream 🌼',
    event: 'Wedding',
    sha256: 'b9db4d6796c261ce26c627804643f5df8c8c5b1e61e2063bd75c0d52b3b4e904',
    likes: 31,
    comments: [],
  },
  {
    id: 4,
    url: `${SB_STORAGE}/sample-4.jpg`,
    guest: 'Kriti',
    relationship: 'Family',
    caption: 'All the little bridal details 💕',
    event: 'Wedding',
    sha256: 'f6354648c915db1c3f8b2d5a4e93c4bd7bd5f3d85d406b13c44b2c43a8f28b02',
    likes: 19,
    comments: [],
  },
  {
    id: 5,
    url: `${SB_STORAGE}/sample-5.jpg`,
    guest: 'Aman',
    relationship: 'College Friend',
    caption: 'Caught laughing at the speeches 😂',
    event: 'Sangeet',
    sha256: '88c53121bf586e8e02f3f5f81d18a92ef5c9082b47c8e99d6e22f89d2219e847',
    likes: 27,
    comments: [{ who: 'Family', text: 'Everyone is having the best time!' }],
  },
  {
    id: 6,
    url: `${SB_STORAGE}/sample-6.jpg`,
    guest: 'Wedding Crew',
    relationship: 'Organizing Team',
    caption: 'A walk into forever ♡',
    event: 'Wedding',
    sha256: 'f2a2f4271f48cd93d7f04db77c5b22ec607e19750773b27e49e8a9c6760b67d1',
    likes: 42,
    comments: [],
  },
];

export type DemoSample = DemoSampleMoment;
