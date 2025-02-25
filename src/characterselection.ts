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
    [ "young Indian girl", "Indian mother", "Indian grandmother" ],
    [ "young Indian couple", "Indian couple", "elderly Indian couple" ],
    [ "group of young Indian friends", "group of Indian friends", "group of elderly Indian friends" ],
    [ "young Indian boy", "Indian father", "Indian grandfather" ],
  ]),
  
  persons: characterbuilder([
    [ "young fair-skinned Indian girl", "fair-skinned Indian woman", "elderly fair-skinned Indian woman" ],
    [ "young fair-skinned Indian couple", "fair-skinned Indian couple", "elderly fair-skinned Indian couple" ],
    [ "group of young fair-skinned Indian friends", "group of fair-skinned Indian friends", "group of elderly fair-skinned Indian friends" ],
    [ "young fair-skinned Indian boy", "fair-skinned Indian man", "elderly fair-skinned Indian man" ],
  ]),
  
  homosapiens: characterbuilder([
    [ "young fair-skinned Indian female", "fair-skinned Indian female", "elderly fair-skinned Indian female" ],
    [ "young fair-skinned Indian couple", "fair-skinned Indian couple", "elderly fair-skinned Indian couple" ],
    [ "group of young fair-skinned Indian friends", "group of fair-skinned Indian friends", "group of elderly fair-skinned Indian friends" ],
    [ "young fair-skinned Indian male", "fair-skinned Indian male", "elderly fair-skinned Indian male" ],
  ]),
  
  anime: characterbuilder([
    [ "1girl,  Indian, anime style", "1woman,  Indian, anime style", "elderly 1woman,  Indian, anime style" ],
    [ "Indian anime couple, fair skin", "Indian anime couple, fair skin", "elderly Indian anime couple, fair skin" ],
    [ "group of  Indian friends, anime style", "group of  Indian friends, anime style", "group of elderly  Indian friends, anime style" ],
    [ "1boy,  Indian, anime style", "1man,  Indian, anime style", "elderly 1man,  Indian, anime style" ],
  ]),

  superman: characterbuilder([ // superman
    [ "young Indian supergirl", "Indian supergirl", "elderly Indian supergirl" ],
    [ "young Indian superhero couple", "Indian superhero couple", "elderly Indian superhero couple" ],
    [ "group of young Indian friends in superhero costumes", "group of Indian friends in superhero costumes", "group of elderly Indian friends in superhero costumes"],
    [ "young Indian superman", "Indian superman", "elderly Indian superman" ],
  ]),
  batman: characterbuilder([ // batman
    [ "young Indian batgirl", "Indian batgirl", "elderly Indian batgirl" ],
    [ "young Indian batman and batgirl couple", "Indian batman and batgirl couple", "elderly Indian batman and batgirl couple" ],
    [ "group of young Indian friends in batman costume", "group of Indian friends in batman costumes", "group of elderly Indian friends in batman costumes" ],
    [ "young Indian batman", "Indian batman", "elderly Indian batman" ],
  ]),
  joker: characterbuilder([ // the joker
    [ "young Indian female joker villain", "Indian female joker villain", "elderly Indian female joker villain" ],
    [ "young Indian joker and harley quinn couple", "Indian joker and harley quinn couple", "elderly Indian joker and harley quinn couple" ],
    [ "group of young Indian joker villains", "group of Indian joker villains", "group of elderly Indian joker villains" ],
    [ "young Indian joker villain", "Indian joker villain", "elderly Indian joker villain" ],
  ]),
  hulk: characterbuilder([ // hulk
    [ "young Indian she-hulk, fair skin", "Indian she-hulk, fair skin", "elderly Indian she-hulk, fair skin" ],
    [ "young Indian hulk couple, fair skin", "Indian hulk couple, fair skin", "elderly Indian hulk couple, fair skin" ],
    [ "group of young Indian hulk characters, fair skin", "group of Indian hulk characters, fair skin", "group of elderly Indian hulk characters, fair skin" ],
    [ "young Indian hulk, fair skin", "Indian hulk, fair skin", "elderly Indian hulk, fair skin" ],
  ]),
  witch: characterbuilder([ // scarlet witch x doctor strange
    [ "young Indian scarlet witch, fair skin", "Indian scarlet witch, fair skin", "elderly Indian scarlet witch, fair skin" ],
    [ "young Indian magical couple, fair skin", "Indian magical couple, fair skin", "elderly Indian magical couple, fair skin" ],
    [ "group of young Indian sorcerers, fair skin", "group of Indian sorcerers, fair skin", "group of elderly Indian sorcerers, fair skin" ],
    [ "young Indian doctor strange, fair skin", "Indian doctor strange, fair skin", "elderly Indian doctor strange, fair skin" ],
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