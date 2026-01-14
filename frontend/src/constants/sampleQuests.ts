// Pre-written fantasy quests for testing the full creation flow
// without waiting for Groq API responses

export interface SampleQuest {
  title: string;
  display_name: string;
  description: string;
  tags: string;
  time: number;
  effort: number;
  dread: number;
}

export const SAMPLE_QUESTS: SampleQuest[] = [
  {
    title: "Clean Kitchen",
    display_name: "The Grease Wars",
    description:
      "Wage war against the stubborn residue that clings to the sacred cooking surfaces. Victory awaits the persistent.",
    tags: "chores,cleaning",
    time: 3,
    effort: 3,
    dread: 2,
  },
  {
    title: "Do Laundry",
    display_name: "Conquest of the Textile Mountains",
    description:
      "The cloth peaks have grown treacherous. Sort, cleanse, and fold until order is restored to the fabric realm.",
    tags: "chores",
    time: 4,
    effort: 2,
    dread: 3,
  },
  {
    title: "Vacuum Living Room",
    display_name: "Purging the Dust Spirits",
    description:
      "Armed with the Roaring Beast, banish the dust spirits that have claimed dominion over your floors.",
    tags: "chores,cleaning",
    time: 2,
    effort: 2,
    dread: 1,
  },
  {
    title: "Take Out Trash",
    display_name: "Exile of the Refuse Horde",
    description:
      "The foul-smelling horde grows restless. Escort them to the outer realms before they multiply.",
    tags: "chores",
    time: 1,
    effort: 1,
    dread: 2,
  },
  {
    title: "Clean Bathroom",
    display_name: "Purification of the Porcelain Sanctum",
    description:
      "The sacred chambers of cleansing have fallen to grime. Restore their gleaming dignity.",
    tags: "chores,cleaning",
    time: 3,
    effort: 3,
    dread: 4,
  },
  {
    title: "Wash Dishes",
    display_name: "The Sinkhole Crusade",
    description:
      "Towers of ceramic and steel await redemption in the Basin of Renewal. None shall remain.",
    tags: "chores,cleaning",
    time: 2,
    effort: 2,
    dread: 2,
  },
  {
    title: "Organize Desk",
    display_name: "Reclaiming the Command Post",
    description:
      "Your strategic headquarters has fallen to chaos. Restore order so that great works may continue.",
    tags: "organization",
    time: 2,
    effort: 1,
    dread: 1,
  },
  {
    title: "Exercise 30 Minutes",
    display_name: "The Trial of Endurance",
    description: "Steel your body through movement and sweat. Emerge stronger than you began.",
    tags: "exercise,health",
    time: 3,
    effort: 4,
    dread: 3,
  },
  {
    title: "Go for a Walk",
    display_name: "The Wanderer's Path",
    description:
      "Venture forth into the outside realm. Fresh air and movement shall clear the mind.",
    tags: "exercise,health",
    time: 2,
    effort: 1,
    dread: 1,
  },
  {
    title: "Meal Prep",
    display_name: "The Alchemist's Preparation",
    description:
      "Transform raw ingredients into sustenance for the days ahead. Future you will be grateful.",
    tags: "chores,health",
    time: 4,
    effort: 3,
    dread: 2,
  },
  {
    title: "Water Plants",
    display_name: "Tending the Grove",
    description: "Your leafy companions thirst for the essence of life. Do not let them wither.",
    tags: "chores",
    time: 1,
    effort: 1,
    dread: 1,
  },
  {
    title: "Read for 30 Minutes",
    display_name: "Communion with the Tomes",
    description: "Seek wisdom within the bound pages. Knowledge awaits those who are patient.",
    tags: "learning",
    time: 3,
    effort: 1,
    dread: 1,
  },
  {
    title: "Sort Mail",
    display_name: "Deciphering the Scrolls",
    description:
      "The messenger's deliveries pile high. Separate the vital from the worthless parchments.",
    tags: "organization",
    time: 1,
    effort: 1,
    dread: 2,
  },
  {
    title: "Clean Windows",
    display_name: "Restoring the Crystal Portals",
    description:
      "The windows to the outside world have grown clouded. Let the light flow freely once more.",
    tags: "chores,cleaning",
    time: 3,
    effort: 3,
    dread: 3,
  },
  {
    title: "Change Bed Sheets",
    display_name: "Refreshing the Resting Chamber",
    description: "The sleeping quarters demand fresh linens. A hero rests best on clean fabric.",
    tags: "chores",
    time: 2,
    effort: 2,
    dread: 2,
  },
  {
    title: "Declutter Closet",
    display_name: "Excavating the Garment Cavern",
    description:
      "Ancient artifacts and forgotten garments lurk within. Decide their fate with ruthless efficiency.",
    tags: "organization",
    time: 4,
    effort: 2,
    dread: 4,
  },
  {
    title: "Meditate",
    display_name: "The Inner Stillness",
    description: "Quiet the chaos of thought. Find peace in the silence between heartbeats.",
    tags: "health",
    time: 2,
    effort: 1,
    dread: 1,
  },
  {
    title: "Wipe Down Surfaces",
    display_name: "Banishing the Surface Dwellers",
    description: "Crumbs and smudges have colonized every flat surface. Reclaim your territory.",
    tags: "chores,cleaning",
    time: 2,
    effort: 1,
    dread: 1,
  },
];

// Get a random sample quest
export const getRandomSampleQuest = (): SampleQuest => {
  const index = Math.floor(Math.random() * SAMPLE_QUESTS.length);
  return SAMPLE_QUESTS[index];
};
