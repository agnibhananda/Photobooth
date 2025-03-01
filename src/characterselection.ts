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
    [ "young indian girl", "indian mother", "indian grandmother" ],
    [ "young indian couple", "indian couple", "elderly indian couple" ],
    [ "group of young indian friends", "group of indian friends", "group of elderly indian friends" ],
    [ "young indian boy", "indian father", "indian grandfather" ],
  ]),
  
  persons: characterbuilder([
    [ "young indian girl", "indian woman", "indian old woman" ],
    [ "young indian couple", "indian couple", "elderly indian couple" ],
    [ "group of young indian friends", "group of indian friends", "group of elderly indian friends" ],
    [ "young indian boy", "indian man", "indian old man" ],
  ]),
  
  homosapiens: characterbuilder([
    [ "young indian female", "indian female", "old indian female" ],
    [ "young indian couple", "indian couple", "elderly indian couple" ],
    [ "group of young indian friends", "group of indian friends", "group of elderly indian friends" ],
    [ "young indian male", "indian male", "old indian male" ],
  ]),
  
  anime: characterbuilder([
    [ "indian 1girl", "indian 1woman", "indian old 1woman grandmother" ],
    [ "indian anime couple", "indian anime couple", "elderly indian anime couple" ],
    [ "indian group of anime friends", "indian group of anime friends", "indian group of elderly anime friends" ],
    [ "indian 1boy", "indian 1man", "indian old 1man grandfather" ],
  ]),

  superman: characterbuilder([ // superman
    [ "indian young supergirl", "supergirl", "old supergirl" ],
    [ "young indian superhero couple", "superhero indian couple", "elderly superhero indian couple" ],
    [ "group of young indian superhero friends", "group of superhero indian friends", "group of elderly superhero indian friends" ],
    [ "young indian superman", "indian superman", "indian old superman" ],
  ]),
  batman: characterbuilder([ // batman
    [ "young indian batgirl", "indian batgirl", "indian old batgirl" ],
    [ "young indian batman and batgirl couple", "indian batman and batgirl couple", "elderly indian batman and batgirl couple" ],
    [ "group of young indian friends in batman costumes", "group of indian friends in batman costumes", "group of elderly indian friends in batman costumes" ],
    [ "young indian batman", "indian batman", "indian old batman" ],
  ]),
  joker: characterbuilder([ // the joker
    [ "young indian female joker villain", "indian female joker villain", "indian old female joker villain" ],
    [ "young indian joker and harley quinn couple", "indian joker and harley quinn couple", "elderly indian joker and harley quinn couple" ],
    [ "group of young indian joker villains", "group of indian joker villains", "group of elderly indian joker villains" ],
    [ "indian young joker villain", "indian joker villain", "indian old joker villain" ],
  ]),
  hulk: characterbuilder([ // hulk
    [ "indian young she-hulk", "indian she-hulk", "indian old she-hulk" ],
    [ "indian young hulk couple", "indian hulk couple", "elderly indian hulk couple" ],
    [ "indian group of young hulk characters", "indian group of hulk characters", "indian group of elderly hulk characters" ],
    [ "indian young hulk", "indian hulk", "indian old hulk" ],
  ]),
  witch: characterbuilder([ // scarlet witch x doctor strange
    [ "indian young scarlet witch", "indian scarlet witch", "indian old scarlet witch" ],
    [ "indian young magical couple", "indian magical couple", "elderly indian magical couple" ],
    [ "indian group of young sorcerers", "indian group of sorcerers", "indian group of elderly sorcerers" ],
    [ "indian young doctor strange", "indian doctor strange", "indian old doctor strange" ],
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