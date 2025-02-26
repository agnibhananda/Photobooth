// This is code to select your generated character, i.e. male/female and age
// and produce prompt keywords for each style.

// select a gender
export const genders = [ "Female", "Couple", "Friends", "Male" ] as const;
export type Genders = typeof genders[number];

// select an age
export const ages = [ "Young", "Middle", "Old" ] as const;
export type Ages = typeof ages[number];

// combine both to select a suitable prompt
export type Characterizer = (gender: Genders, age: Ages) => string;
/** matrix with preset strings, used as `matrix[gender]c[age]`, i.e. `[[ "young girl", "woman", "grandmother" ], ... ]` */
export type CharacterMatrix = [[ string, string, string ], [ string, string, string ], [ string, string, string ], [ string, string, string ]];
export function characterbuilder(mat: CharacterMatrix): Characterizer {
  return (gender, age) => {
    let char = mat[genders.indexOf(gender)][ages.indexOf(age)];
    console.debug(`Selection (${age}, ${gender}) is '${char}'`);
    return char;
  };
};

// a few pre-made characterizers
export const chars = {

  healthyboy: characterbuilder([
    [ "young girl", "mother", "grandmother" ],
    [ "young couple", "couple", "elderly couple" ],
    [ "group of young friends", "group of friends", "group of elderly friends" ],
    [ "young boy", "father", "grandfather" ],
  ]),
  
  persons: characterbuilder([
    [ "young girl", "woman", "old woman" ],
    [ "young couple", "couple", "elderly couple" ],
    [ "group of young friends", "group of friends", "group of elderly friends" ],
    [ "young boy", "man", "old man" ],
  ]),
  
  homosapiens: characterbuilder([
    [ "young female", "female", "old female" ],
    [ "young couple", "couple", "elderly couple" ],
    [ "group of young friends", "group of friends", "group of elderly friends" ],
    [ "young male", "male", "old male" ],
  ]),
  
  anime: characterbuilder([
    [ "1girl", "1woman", "old 1woman grandmother" ],
    [ "anime couple", "anime couple", "elderly anime couple" ],
    [ "group of anime friends", "group of anime friends", "group of elderly anime friends" ],
    [ "1boy", "1man", "old 1man grandfather" ],
  ]),

  superman: characterbuilder([ // superman
    [ "young supergirl", "supergirl", "old supergirl" ],
    [ "young superhero couple", "superhero couple", "elderly superhero couple" ],
    [ "group of young superhero friends", "group of superhero friends", "group of elderly superhero friends" ],
    [ "young superman", "superman", "old superman" ],
  ]),
  batman: characterbuilder([ // batman
    [ "young batgirl", "batgirl", "old batgirl" ],
    [ "young batman and batgirl couple", "batman and batgirl couple", "elderly batman and batgirl couple" ],
    [ "group of young friends in batman costumes", "group of friends in batman costumes", "group of elderly friends in batman costumes" ],
    [ "young batman", "batman", "old batman" ],
  ]),
  joker: characterbuilder([ // the joker
    [ "young female joker villain", "female joker villain", "old female joker villain" ],
    [ "young joker and harley quinn couple", "joker and harley quinn couple", "elderly joker and harley quinn couple" ],
    [ "group of young joker villains", "group of joker villains", "group of elderly joker villains" ],
    [ "young joker villain", "joker villain", "old joker villain" ],
  ]),
  hulk: characterbuilder([ // hulk
    [ "young she-hulk", "she-hulk", "old she-hulk" ],
    [ "young hulk couple", "hulk couple", "elderly hulk couple" ],
    [ "group of young hulk characters", "group of hulk characters", "group of elderly hulk characters" ],
    [ "young hulk", "hulk", "old hulk" ],
  ]),
  witch: characterbuilder([ // scarlet witch x doctor strange
    [ "young scarlet witch", "scarlet witch", "old scarlet witch" ],
    [ "young magical couple", "magical couple", "elderly magical couple" ],
    [ "group of young sorcerers", "group of sorcerers", "group of elderly sorcerers" ],
    [ "young doctor strange", "doctor strange", "old doctor strange" ],
  ]),


  // random hero
  randomhero: (gender: Genders, age: Ages) => {
    let heroes = [ chars.superman, chars.batman, chars.joker, chars.hulk, chars.witch ];
    return heroes[crypto.getRandomValues(new Uint32Array(1))[0] % heroes.length](gender, age);
  },

};

export type CharacterType = 'friends' | 'couple' | 'family' | 'pet';

export const characterOptions: { value: CharacterType; label: string }[] = [
  { value: 'friends', label: 'Friends' },
  { value: 'couple', label: 'Couple' },
  { value: 'family', label: 'Family' },
  { value: 'pet', label: 'Pet' },
];