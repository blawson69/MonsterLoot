# MonsterLoot
> **Database updated in version 2.0!** The database is now more consistent in language and provides more craftable items. If you are using a previous version, the default database will be automatically reset. If you have imported additions or changes, you will need to update your handouts and re-import them. [See below](#bestiary) for more information.

This [Roll20](http://roll20.net/) script gives players an easy way to loot monsters and NPCs, gathering resources specific to each creature and its type. They can take the hide from griffon or the scales from a dragon, etc. If a creature wields a weapon, that actual weapon can be looted from the body. Poison can also be extracted from certain creatures that have poison. Each creature on the map can only be looted once, preventing players from trying to squeeze them all dry with multiple attempts. MonsterLoot relies on a database that can be modified to your liking, and is for use with the [5e Shaped Sheet](http://github.com/mlenser/roll20-character-sheets/tree/master/5eShaped) and the D&D 5th Edition OGL Sheet.

Although it stands alone quite nicely, MonsterLoot is intended as a companion script to [LootGenerator](https://github.com/blawson69/LootGenerator). This gives extra benefits that are explained [below](#lootgenerator-integration).

## NPC Sheets
The NPC sheet is the one typically used by default for monsters and NPCs - _not_ the one used by player characters. The script considers all character sheets using this format to be a monster, and will compare the name of the monster represented by the selected token to its database. If it cannot find the monster in question, it will estimate one based on its type. This estimated monster will have no special qualities, however, so it is best to make sure your database is [stocked](#bestiary) with all the monsters you are using in your campaign.

Monsters are considered "mooks" that may be represented multiple times on map. In order for one to possess a specific item (such as a group of goblins, only one of which carries the amulet they stole from your camp), this item can be added to that token's GM Notes. If more than one item is needed, separate them with commas. You cannot include item descriptions or random quantities in this list.

Monsters that are beasts, dragons or plants can provide an amount of edible rations. The amount looted is calculated by the monster's size.

### Spoils
"Spoils" are the items each creature's body can "give up" besides weapons: Armor the creature was wearing, special belongings, or parts that can be taken from a monster's body; hide, teeth, horns, etc. Most of these items will have a description of the item giving an immediate use (if any) in addition to items those parts can be crafted into (see [below](#crafting)). For spoils that grant an immediate special effect, you may consider requiring attunement before the effect can be used.

In order for a character to acquire any of these items, a skill check must be made, with the skill based on the type of creature and a DC based on its challenge rating. If the player controls more than one character, they will be asked to select which character is making the check. The list will only include characters to which the player has specifically been assigned control, i.e. no character with the "All Players" assignment. They will then be given a button to make the skill check. Successful checks will get all of the spoils, and those that fail by less than 5 will receive half (or none if only one exists).

### Player Macro
Upon installation, MonsterLoot creates a macro named "Loot-Body" which your players use to loot the bodies of their fallen foes. If they control more than one character, they will be prompted to select which character is doing the looting.

Players will then click a skill check button, the skill being determined by the type of monster being looted. Humanoids and Beasts, for example, require a Nature skill check, while Monstrosities demand an Arcana check.

The percentage of spoils found depend on the success of the skill check. The DMG suggests a flat DC of 20, but MonsterLoot makes a slight adjustment to this number based on the Challenge Rating of the monster being looted.

### Poison
Many monsters use poison to poison their victims, and naturally players will have the desire to get some for their own use. The poisons included in the database are only those of the "injury" type - delivered through a slashing or piercing attack - that do not simply inflict poison damage in addition to the slashing/piercing damage. This is intended to keep the percentage of harvested poisons to a manageable level and provide a poison that does not require crafting. When a monster has a poison of this nature, the dialog will provide a secondary opportunity for harvesting the poison. The character to make this attempt can be a different one than the character who looted the body.

Harvesting the poison requires a separate Nature check and follows the DMG with a base DC of 20. MonsterLoot modifies this slightly, making harvesting slightly easier for low challenge rated monsters and slightly higher for high rated ones. Players will select a character if necessary and follow the same steps as with [spoils](#spoils) for making their skill check. A fumble to harvest poison means the character accidentally poisons themselves with poison, but this can be turned off in the config menu (`!spoils --config`).

### Crafting
Most monster body parts will need some manipulation in order to become useful. For instance, hides need to be worked with leatherworker's tools in order to create armor, and eyes or a heart would require processing with alchemist's supplies to be made into a potion. Consider all crafted items that are magical in nature to require attunement.

There are two phrases used in the default bestiary regarding crafting, and are intended to mean different ideas:
- "Can be crafted into" means the item is the sole or primary component in crafting the item. Ammunition typically requires very little work to create, even for +1 ammunition. For instance, using griffon pinions to fletch an arrow requires very little extra care than fletching an arrow with common feathers.
- "Can be used in crafting" is used when the item is essential but not the primary component. The crafting formula for a Flame Tongue weapon may require an adult red dragon heart, but it would be used either in a single step during smithing the weapon or as a component for the spell used to enchant the weapon. The level of the creature is typically synonymous with the rarity of the item being created.

The exact method required, along with other components needed, the time necessary for crafting, etc. are all up to the GM and are intentionally vague in the item description to allow for all possibilities.

## LootGenerator Integration
If a monster is a humanoid, human-shaped, or formerly human, it often carries coins and personal items on its body. When [LootGenerator](https://github.com/blawson69/LootGenerator) is installed, MonsterLoot will use it to generate random coins and mundane items to be found on the body of each creature based on its challenge rating. This gives a little more realism and variety to the looting process. It will honor the default values you have set in that script, so for instance if you have mundane items turned off, none will be generated.

LootGenerator also has a simple yet robust method of distributing loot to players and saving undistributed collections for later distribution. When LootGenerator is installed, looted items including poison are sent to LootGenerator to be distributed in the same way it handles its own generated loot.

## PC Sheets
Unique NPCs created using a PC character sheet can also be looted. MonsterLoot will gather all items from the Offense, Utility, and Equipment sections of the Shaped sheet, or the Equipment section of the OGL sheet. No spoils will be determined even if the character is a monster, but you may add items into any of the sections previously listed.

For example, an ancient dragon that plays a large role may have a PC sheet to allow customization of attributes and abilities. If you wish players to receive dragon hide from looting this character, include it in the Equipment section and it will be among the items looted.

## Token Marker
You can either remove a marker from a looted creature, or add a specific one to indicate the monster has been looted. For instance, if you use the "dead" marker to show a dead monster, you can have it removed after it's been looted as a clear indication to the players that the field of battle has been picked clean. Or you can choose a marker that represents an "empty" or "looted" status and add it when the monster gets looted. This feature can be turned on and configured in the config menu (`!spoils --config`).

## Bestiary
The default bestiary includes all monsters from the SRD. If you wish to add monsters from other sources or create your own, you can add them to a handout to be imported. An import button can be found in the config menu for this purpose. MonsterLoot will look for all handouts that begin with "Bestiary" so that you may keep your lists in manageable chunks. For instance, a "Bestiary: Monster Manual" could contain all of the Monster Manual monsters not included in the SRD, while "Bestiary: VGM" contains all your favorites from Volo's Guide to Monsters. If you include a monster already in the database, the current one will be overwritten with the new one.

> If you have used previous versions of MonsterLoot and have Bestiary handouts you have imported, you will need to update those handouts and re-import them after installing this version of MonsterLoot. If you have used [the additional monsters](https://github.com/blawson69/MonsterLoot/tree/master/More%20Monsters) from the repository, simply replace the text of your current handout with the new version. If you have created your own, you must update manually. Each custom monster needs the following changes made as necessary:
> 1. If the monster has spoils that have a random quantity, make sure the name is singular. For instance, change "Whiskers (@1d12@)" to "Whisker (@1d12@)".
> 2. If the monster has poison, it needs to be updated to include the poison name (see below).

To add monsters for import, put each one on a separate line of your handout. Include the monster name, type (no subtypes), challenge rating (CR), and any spoils all separated by a pipe "|". The spoils are delimited with double colons "::". If there are no spoils, you must still include the pipe. If you need to add a description to a spoil, put a tilde "~" between it and the name of the spoil:

~~~
Name of Monster|Type|CR|
Name of Monster|Type|CR|Spoil 1::Spoil 2~Description of Spoil 2
~~~
If your monster is poisonous, the poison name and description goes last, right after another pipe. This may mean you have two pipes in the middle of your line. Use the standard "roll average (die expression)" format in your description so MonsterLoot can process die rolls correctly. Cutting and pasting from an online source makes this super easy. Separate the poison name and description with a tilde "~". The poison name _must be present._
~~~
Carrion Crawler|Monstrosity|2|Carrion Crawler Hide|Carrion Crawler Mucus~Target must succeed on a DC 13 Constitution saving throw or be poisoned for 1 minute. Until this poison ends, the target is paralyzed. The target can repeat the saving throw at the end of each of its turns, ending the poison on itself on a success.
Giant Poisonous Snake|Beast|1/4||Serpent Venom~Target must make a DC 11 Constitution saving throw, taking 10 (3d6) poison damage on a failed save, or half as much damage on a successful one.
~~~
Some spoils can be multiples, such as claws, horns, etc. To allow MonsterLoot to randomize quantity in the results, place a die expression after the name in parenthesis and surrounded by @ signs. Make sure the name **remains singular** regardless of the potential quantity. This quantity should be based on the total number found on the creature, i.e. "Tusk (@1d2@)" for a creature that has 2 tusks.
~~~
Polar Bear|Beast|2|Polar Bear Hide::Polar Bear Claw (@1d4@)
~~~
### Custom Monsters
The spoils in the default bestiary are ordered by power and difficulty/time in retrieving safely. This reserves the more valuable spoils for only the successful skill checks. If you are creating your own monster or importing an existing one, consider these guidelines:
- Tiny and low challenge rated monsters likely cannot carry anything of real value.
- Place common items, or body parts used to craft them, in the first position. If the item is armor, it is likely "tattered" and should need mending before use.
- If you allow limbs to be used as weapons, even temporarily, those should be secondary.
- If multiple parts are available (claws, eyes, etc.) but create a permanent, powerful item, consider allowing the retrieval of only one.
- Body parts that are difficult or dangerous to retrieve, such as hearts or blood, should be at least second if not third.
- Body parts that create powerful items should be last, particularly if they are the sole component needed or do not require crafting.
---
_This script and its contents are permissible under the Wizards of the Coast [Fan Content Policy](https://company.wizards.com/fancontentpolicy). Portions of the data used are property of and © Wizards of the Coast LLC.
Monster spoils inspired by a variety of online sources and my own imagination. ;)_
