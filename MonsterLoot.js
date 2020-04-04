/*
MonsterLoot
A Roll20 script to generate loot from monsters and NPCs. This script and its contents are permissible under
the Fan Content Policy. Portions of the data used are property of and © Wizards of the Coast LLC
https://company.wizards.com/fancontentpolicy

On Github:	https://github.com/blawson69
Contact me: https://app.roll20.net/users/1781274/ben-l

Like this script? Become a patron:
    https://www.patreon.com/benscripts
*/

var MonsterLoot = MonsterLoot || (function () {
    'use strict';

    //---- INFO ----//

    var version = '1.3.3',
    debugMode = false,
    MARKERS,
    ALT_MARKERS = [{name:'red', tag: 'red', url:"#C91010"}, {name: 'blue', tag: 'blue', url: "#1076C9"}, {name: 'green', tag: 'green', url: "#2FC910"}, {name: 'brown', tag: 'brown', url: "#C97310"}, {name: 'purple', tag: 'purple', url: "#9510C9"}, {name: 'pink', tag: 'pink', url: "#EB75E1"}, {name: 'yellow', tag: 'yellow', url: "#E5EB75"}, {name: 'dead', tag: 'dead', url: "X"}],
    styles = {
        box:  'background-color: #fff; border: 1px solid #000; padding: 8px 10px; border-radius: 6px; margin-left: -40px; margin-right: 0px;',
        title: 'padding: 0 0 10px 0; color: darkolivegreen; font-size: 1.25em; font-weight: bold; font-family: "Comic Sans MS", cursive, sans-serif;',
        name: 'color: darkolivegreen; font-size: 1.25em; font-weight: bold; font-family: "Comic Sans MS", cursive, sans-serif;',
        button: 'background-color: #000; border-width: 0px; border-radius: 5px; padding: 5px 8px; color: #fff; text-align: center;',
        textButton: 'background-color: transparent; border: none; padding: 0; color: #591209; text-decoration: underline;',
        buttonWrapper: 'text-align: center; margin: 10px 0; clear: both;',
        resultBox: 'margin: 4px 3px; padding: 2px 6px; border: 1px solid #c1c1c1; border-radius: 9px; font-variant: small-caps; color: #545454;',
        result: 'font-size: 1.125em; font-weight: bold; cursor: pointer; font-family: "Lucida Console", Monaco, monospace;',
        hr: 'margin: 10px 2px 8px; border-top: 1px dashed darkolivegreen;',
        alert: 'color: #C91010; font-size: 1.5em; font-weight: bold; font-variant: small-caps; text-align: center;'
    },

    checkInstall = function () {
        if (!_.has(state, 'MonsterLoot')) state['MonsterLoot'] = state['MonsterLoot'] || {};
        if (typeof state['MonsterLoot'].monsters == 'undefined') state['MonsterLoot'].monsters = [];
        if (typeof state['MonsterLoot'].looted == 'undefined') state['MonsterLoot'].looted = [];
        if (typeof state['MonsterLoot'].extracted == 'undefined') state['MonsterLoot'].extracted = [];
        if (typeof state['MonsterLoot'].allowFumbles == 'undefined') state['MonsterLoot'].allowFumbles = true;
        if (typeof state['MonsterLoot'].showPlayersRolls == 'undefined') state['MonsterLoot'].showPlayersRolls = true;
        if (typeof state['MonsterLoot'].useMarker == 'undefined') state['MonsterLoot'].useMarker = false;
        if (typeof state['MonsterLoot'].addMarker == 'undefined') state['MonsterLoot'].addMarker = false;
        if (typeof state['MonsterLoot'].marker == 'undefined') state['MonsterLoot'].marker = 'dead';
        MARKERS = JSON.parse(Campaign().get("token_markers"));

		if (debugMode) {
			var d = new Date();
			showDialog('Debug Mode', 'Monster Loot v' + version + ' loaded at ' + d.toLocaleTimeString() + '<br><a style=\'' + styles.textButton + '\' href="!spoils --config">Show config</a>', 'GM');
            state['MonsterLoot'].looted = [];
            state['MonsterLoot'].extracted = [];
		}

        createMacro();
        if (_.size(state['MonsterLoot'].monsters) == 0) commandSetup();
        if (typeof LootGenerator != 'undefined' && typeof LootGenerator.generateCoins == 'undefined') {
            showDialog('Upgrade Needed', 'MonsterLoot cannot use LootGenerator in its current version. <a style=\'' + styles.textButton + '\' href="https://github.com/blawson69/LootGenerator">Please upgrade now.</a>', 'GM');
        }
        log('--> MonsterLoot v' + version + ' <-- Initialized');
    },

    //----- INPUT HANDLER -----//

    handleInput = function (msg) {
        if (msg.type == 'api' && msg.content.startsWith('!spoils')) {
			var parms = msg.content.split(/\s+/i);
			if (parms[1]) {
				switch (parms[1]) {
					case '--loot':
                        commandLootBody(msg);
						break;
					case '--extract':
                        commandExtractVenom(msg);
						break;
					case '--config':
                        if (playerIsGM(msg.playerid)) commandConfig(msg);
						break;
                    case '--set-marker':
                        if (playerIsGM(msg.playerid)) setMarker(msg);
                        break;
                    case '--markers':
                        if (playerIsGM(msg.playerid)) showMarkers(msg);
                        break;
					case '--import':
                        if (playerIsGM(msg.playerid)) commandImport();
						break;
					case '--export':
                        if (playerIsGM(msg.playerid)) commandExport();
						break;
					case '--reset':
                        if (playerIsGM(msg.playerid)) commandSetup();
				}
			}
		}
    },

    commandLootBody = function (msg) {
        // --id|monster id --char|PC id --roll_mod|0/-1/+1
        var token_id = '', parms = msg.content.replace('!spoils', '').split(/\s+\-\-/);
        var looter, looter_id = null, roll_mod = null, roll_result, roll_display;
        _.each(parms, function (cmd) {
            var parts = cmd.split('|');
            if (parts[0] == 'id') token_id = parts[1];
            if (parts[0] == 'char') looter_id = parts[1];
            if (parts[0] == 'roll_mod') roll_mod = parts[1];
        });

        var token = getObj('graphic', token_id);
        if (!token) {
            showDialog('', 'Not a valid token.', msg.who);
            return;
        }

        if (_.find(state['MonsterLoot'].looted, function (id) { return id == token_id; })) {
            showDialog('', token.get('name') + ' has already been looted.', msg.who);
            return;
        }

        // Validate selected token as character
        var char = getObj('character', token.get('represents'));
        if (!char) {
            showDialog('', 'Token does not represent a character!', msg.who);
            return;
        }
        var is_shaped = isShapedSheet(), poison_effect = '', message, loot = [], treasure = [], coins = '';
        var char_id = char.get('id'), monster = getMonster(char), type = getType(char), is_npc = getAttrByName(char_id, (is_shaped ? 'is_npc' : 'npc')) == '1';
        var charAttrs = findObjs({type: 'attribute', characterid: char_id}, {caseInsensitive: true});

        // Validate chosen (or default) character as looter
        var looters = getCharsFromPlayerID(msg.playerid, token.get('pageid'));
        if (_.size(looters) == 1) looter_id = looters[0].get('id');
        if (looter_id == null) {
            if (_.size(looters) == 0) {
                message = 'You have no usable characters with a token on this page.';
            } else {
                // If more than one character, make character selection
                message = '<div style="' + styles.buttonWrapper + '"><a style="' + styles.button + '" href="!spoils --loot --id|' + token_id + ' --char|?{Select character';
                _.each(looters, function (looter) {
                    message += '|' + looter.get('name') + ',' + looter.get('id');
                });
                message += '}" title="Select which character is looting ' + token.get('name') + '.">Choose Character</a></div>';
            }
            showDialog('', message, msg.who);
            return;
        }
        looter = getObj('character', looter_id);
        var looter_name = looter.get('name');

        if (is_npc && roll_mod == null) {
            message = '<div style="' + styles.buttonWrapper + '">' + looter_name + ': <a style="' + styles.button + '" href="!spoils --loot --id|' + token_id + ' --char|' + looter_id + ' --roll_mod|?{Advantage or Disadvantage|Neither,0|Advantage,+1|Disadvantage,-1}" title="' + looter_name + ' will make a ' + monster.skill + ' check to loot ' + token.get('name') + '.">' + monster.skill + ' Check</a></div>';
            showDialog('', message, msg.who);
            return;
        }

        if (is_npc) {
            var human = new RegExp('^(' + HUMAN_LIKE.join('|') + ').*$', 'i');
            if (hasLootGen() && (monster.type.match(/^(?:humanoid|giant)$/i) != null || monster.name.match(human) != null)) {
                var mod = getMods(), dieroll = randomInteger(100),
                loot_level = (parseInt(monster.cr) > 17 ? '4' :(parseInt(monster.cr) > 11 ? '3' : (parseInt(monster.cr) > 5 ? '2' : '1')));
                if (mod.coins.search(/(show|less|more)/i) != -1) coins = LootGenerator.generateCoins(dieroll, mod.coins, false, loot_level);
                if (mod.mundane.search(/(show|less|more)/i) != -1) treasure.push(LootGenerator.generateMundane(dieroll, mod.mundane, false, loot_level));
                if (mod.magic.search(/(show|less|more)/i) != -1 && parseInt(monster.cr) >= 2) treasure.push(LootGenerator.generateMagicItems(dieroll, mod.magic, loot_level));
            }

            // Get any special items stored in the GM notes
            treasure.push(processGMNotes(token.get('gmnotes')));

            // Get any weapons from the Actions section
            var nat = new RegExp('^(' + NATURAL_WEAPONS.join('|') + ').*$', 'i'), weapons = [];
            var actions = _.filter(charAttrs, function (attr) {
                return attr.get('name').match(/^repeating_(npc)?action_[^_]+_name$/) !== null && attr.get('current').match(nat) == null
                && attr.get('current').match(/(\(recharge|\(costs|day\)).*$/gi) == null;
            });
            _.each(actions, function (action) { weapons.push(action.get('current').replace(/\s\([^\)]+\)/i, '').replace(/poisoned\s/i, '')); });
            treasure.push(weapons);

            // Get rations and poison, if any
            if (typeof monster.poison != 'undefined') poison_effect = monster.poison;
            if (parseInt(monster.rations) != 0) {
                if (monster.rations.toString() == '1') treasure.push('Rations');
                else treasure.push('Rations (@' + monster.rations + '@)');
            }

            // Roll skill check for amount of spoils
            var spoils = [], num_spoils = 0, count, skill_mod = getSkillMod(looter_id, monster.skill);
            roll_result = rollSkillCheck(skill_mod + '|' + monster.skill, roll_mod);
            var skill_check_dc = parseInt(monster.cr) >= 2 ? 12 + (parseInt(monster.cr) / 2) : 12;
            roll_display = '<div style="' + styles.resultBox + '"><span style=\'' + styles.result + (roll_result.base == 1 ? 'color: red;' : (roll_result.base == 20 ? 'color: green;' : '')) + '\' title="' + roll_result.formula + '">' + roll_result.final + '</span> ' + roll_result.skill + ' Check' + (roll_result.adv_dis == '-1' ? ' <span style="cursor: pointer;" title="Disadvantage">[Dis]</span> ' : (roll_result.adv_dis == '+1' ? ' <span style="cursor: pointer;" title="Advantage">[Adv]</span>' : '')) + '</div>';

            if (roll_result.final >= skill_check_dc - 5) num_spoils = (_.size(monster.spoils) == 0 ? 0 : (_.size(monster.spoils) == 1 ? 0 : Math.floor(_.size(monster.spoils) / 2)));
            if (roll_result.final >= skill_check_dc) num_spoils = _.size(monster.spoils);

            for (count = 0; count < num_spoils; count++) {
                var name = monster.spoils[count].name;
                if (typeof monster.spoils[count].desc != 'undefined') name += '|' + monster.spoils[count].desc;
                spoils.push(name);
            }
            treasure.push(spoils);

        } else { // PC
            var nat = new RegExp('^(?:' + NATURAL_WEAPONS.join('|') + ').*$', 'i'), gear = [];
            if (isShapedSheet()) {
                // Weapons and ammo, excluding natural ones
                var weapons = _.filter(charAttrs, function (attr) { return attr.get('name').match(/^repeating_offense_[^_]+_name$/) !== null && attr.get('current').match(nat) == null; });
                _.each(weapons, function (item) { gear.push(item.get('current')); });
                var ammo = _.filter(charAttrs, function (attr) { return attr.get('name').match(/^repeating_ammo_[^_]+_name$/) !== null; });
                _.each(ammo, function (item) { gear.push(item.get('current') + ' (@1d8@)'); });

                // Equipment
                var equip = _.filter(charAttrs, function (attr) { return attr.get('name').match(/^repeating_equipment_[^_]+_name$/) !== null; });
                _.each(equip, function (item) { gear.push(item.get('current')); });

                // Utility items
                var util = _.filter(charAttrs, function (attr) { return attr.get('name').match(/^repeating_utility_[^_]+_name$/) !== null; });
                _.each(util, function (item) { gear.push(item.get('current')); });

            } else { // OGL
                // Equipment
                var equip = _.filter(charAttrs, function (attr) { return attr.get('name').match(/^repeating_equipment_[^_]+_name$/) !== null; });
                _.each(equip, function (item) { gear.push(item.get('current')); });
            }
            treasure.push(gear);
            coins = getCurrency(char);
        }

        if (coins != '') loot.push(coins);
        treasure = processItems(treasure);
        if (_.size(treasure) > 0) loot.push(treasure);
        loot = _.flatten(loot);

        var title = 'Spoils from ' + token.get('name');
        message = looter_name + ', you got: ' + enumerateItems(loot).join(', ');
        if (_.size(loot) == 0) message = looter_name + ', you found nothing of use.';
        if (typeof roll_display != 'undefined' && state['MonsterLoot'].showPlayersRolls) message += '<br>' + roll_display;

        // Extracting poison is a completely different operation!
        if (poison_effect != '') {
            message += '<hr style="' + styles.hr + '">Venom can be extracted from ' + (char.get('name').match(/^[aeiou].*$/i) != null ? 'an ' : 'a ') + char.get('name') + '. You must have an empty vial to proceed.';
            message += '<div style=\'' + styles.buttonWrapper + '\'><a style=\'' + styles.button + '\' href="!spoils --extract --id|' + token_id + '" title="Roll to attempt safe extraction of the venom">Attempt Extraction</a></div>';
        }

        showDialog(title, message);
        state['MonsterLoot'].looted.push(token_id);
        if (state['MonsterLoot'].useMarker) token.set('status_' + state['MonsterLoot'].marker, state['MonsterLoot'].addMarker);
        if (hasLootGen()) LootGenerator.saveLoot(title, coins, treasure, looter_name);
    },

    commandExtractVenom = function (msg) {
        // --char|PC id --roll_mod|0/-1/+1
        var token_id = '', looter, looter_id = null, roll_mod = null,
        parms = msg.content.replace('!spoils', '').split(/\s+\-\-/);
        _.each(parms, function (cmd) {
            var parts = cmd.split('|');
            if (parts[0] == 'id') token_id = parts[1];
            if (parts[0] == 'char') looter_id = parts[1];
            if (parts[0] == 'roll_mod') roll_mod = parts[1];
        });

        var token = getObj('graphic', token_id);
        if (!token) {
            showDialog('', 'Not a valid token.', msg.who);
            return;
        }

        if (_.find(state['MonsterLoot'].extracted, function (id) { return id == token_id; })) {
            showDialog('', token.get('name') + ' has already been drained of venom, or destroyed in a failed attempt.', msg.who);
            return;
        }

        // Validate selected token as character
        var char = getObj('character', token.get('represents'));
        if (!char) {
            showDialog('', 'Token does not represent a character!', msg.who);
            return;
        }

        // Validate chosen (or default) character as looter
        var looters = getCharsFromPlayerID(msg.playerid, token.get('pageid'));
        if (_.size(looters) == 1) looter_id = looters[0].get('id');
        if (looter_id == null) {
            if (_.size(looters) == 0) {
                message = 'You have no usable characters with a token on this page.';
            } else {
                // If more than one character, make character selection
                message = '<div style="' + styles.buttonWrapper + '"><a style="' + styles.button + '" href="!spoils --extract --id|' + token_id + ' --char|?{Select character';
                _.each(looters, function (looter) {
                    message += '|' + looter.get('name') + ',' + looter.get('id');
                });
                message += '}" title="Select which character is attempting the extraction.">Choose Character</a></div>';
            }
            showDialog('', message, msg.who);
            return;
        }
        looter = getObj('character', looter_id);
        var looter_name = looter.get('name');

        if (roll_mod == null) {
            message = '<div style="' + styles.buttonWrapper + '">' + looter_name + ': <a style="' + styles.button + '" href="!spoils --extract --id|' + token_id + ' --char|' + looter_id + ' --roll_mod|?{Advantage or Disadvantage|Neither,0|Advantage,+1|Disadvantage,-1}" title="' + looter_name + ' will make a Nature check to extract venom from ' + token.get('name') + '.">Nature Check</a></div>';
            showDialog('', message, msg.who);
            return;
        }

        // Roll skill check
        var message, title, monster = getMonster(char);
        var skill_mod = getSkillMod(looter_id, 'Nature'), monster_cr = getCRAsNumber(monster.cr);
        var roll_result = rollSkillCheck(skill_mod + '|Nature', roll_mod);
        var roll_display = '<div style="' + styles.resultBox + '"><span style=\'' + styles.result + (roll_result.base == 1 ? 'color: red;' : (roll_result.base == 20 ? 'color: green;' : '')) + '\' title="' + roll_result.formula + '">' + roll_result.final + '</span> Nature Check' + (roll_result.adv_dis == '-1' ? ' <span style="cursor: pointer;" title="Disadvantage">[Dis]</span> ' : (roll_result.adv_dis == '+1' ? ' <span style="cursor: pointer;" title="Advantage">[Adv]</span>' : '')) + '</div>';

        // DMG gives a flat DC of 20, but let's give some wiggle room
        // based on the monster's challenge rating
        var dc_mod = monster_cr == 0 ? -3 : monster_cr / 5 - 2;
        if (roll_result.final >= 20 + dc_mod) {
            title = 'Extraction Successful';
            message = looter_name + ', you got: ' + monster.name + ' Venom.<br><br>This venom has the following affect:<br>' + monster.poison;
        } else if (roll_result.base == 1 && state['MonsterLoot'].allowFumbles) {
            title = '☠️ <span style="color: crimson;">Poisoned!</span>';
            var desc = monster.poison;
            var diceExp = desc.replace(/.*\d{1,2}\s\(([^\)]+)\).*/gi, '$1');
            message = desc.replace(/\d{1,2}\s\([^\)]+\)/i, '<span style=\'' + styles.result + '\' title="' + diceExp + '">' + rollDice(diceExp) + '</span>').replace(/target/i, looter_name);
        } else {
            title = 'Extraction Failed';
            message = looter_name + ', you did not succeed in extracting venom from ' + token.get('name') + '.';
        }

        showDialog(title, message + (state['MonsterLoot'].showPlayersRolls ? '<br>' + roll_display : ''));
        if (title == 'Extraction Successful' && hasLootGen()) LootGenerator.saveLoot(monster.name + ' (Venom)', '', [monster.name + ' Venom'], looter_name);
        state['MonsterLoot'].extracted.push(token_id);
    },

    // Get all player controlled characters that are not "utility characters"
    getCharsFromPlayerID = function (player_id, page_id) {
        var char_tokens = [], chars = findObjs({type: 'character', archived: false});
        _.each(findObjs({type: 'graphic', pageid: page_id}), function (token) { if (token.get('represents') !== '') char_tokens.push(token.get('represents')); });
        chars = _.filter(chars, function (char) {
            var controllers = char.get('controlledby').split(',');
            var str_attr = findObjs({type: 'attribute', characterid: char.get('id'), name: 'strength'}, {caseInsensitive: true});
            var str = (_.size(str_attr) > 0) ? str_attr[0].get('current') : 0;
            if (playerIsGM(player_id)) return (_.indexOf(char_tokens, char.get('id')) != -1 && char.get('controlledby') != '' && parseInt(str) > 0);
            else return (_.find(controllers, function (x) { return x == player_id; }) && _.indexOf(char_tokens, char.get('id')) != -1 && parseInt(str) > 0);
        });
        return chars;
    },

    getMonster = function (char) {
        var monster;
        if (getAttrByName(char.get('id'), (isShapedSheet() ? 'is_npc' : 'npc')) == '1') {
            var monster = _.find(state['MonsterLoot'].monsters, function (monster) { return monster.name == char.get('name'); });
            if (!monster) {
                // Unknown monster, so estimate by Type:
                //'Humanoid', 'Beast', 'Giant', 'Dragon', 'Fey', 'Undead', 'Fiend', 'Monstrosity', 'Construct', 'Aberration', 'Celestial', 'Elemental', 'Ooze', 'Plant'
                monster = {name: char.get('name'), type: getType(char), cr: getChallengeRating(char), spoils: []};
            }

            monster.skill = getSkillCheck(monster.type);
            monster.rations = '0';
            if (monster.type.match(/^(?:dragon|beast|plant)$/i) != null) monster.rations = getRationsAmt(char);
            if (monster.type.match(/^(?:humanoid|fiend|giant|dragon)$/i) != null) {
                monster.coins = true;
                monster.mundane = true;
                if (parseInt(monster.loot_level) > 2) monster.magic = true;
            }
        }
        return monster;
    },

    getCRAsNumber = function (cr) {
        var newCR;
        if (cr == '1/8') newCR = 0.125;
        else if (cr == '1/4') newCR = 0.25;
        else if (cr == '1/2') newCR = 0.5;
        else newCR = parseInt(cr);
        return newCR;
    },

    processItems = function (loot) {
        var diceExp, parts, retLoot = [],
        tmpLoot = denumerateItems(_.shuffle(_.compact(_.flatten(loot))));

        // Check for die roll expressions
        _.each(tmpLoot, function(item) {
            var tmp = item;
            if (item.search(/\@(.+)\@/gi) != -1) {
                diceExp = item.replace(/.*\@(.+)\@.*/gi, '$1');
                tmp = item.replace('@' + diceExp + '@', rollDice(diceExp));
            }
            parts = tmp.split('|');
            if (typeof parts[1] != 'undefined') {
                tmp = '<i style="cursor: help;" title="' + parts[1] + '">' + parts[0] + '</i>';
            }
            retLoot.push(tmp);
        });

        return retLoot;
    },

    processGMNotes = function (notes) {
        var text = unescape(notes).trim();
        text = text.replace(/<\/?(p|br|span|div|pre|img|code|b|i)[^>]*>/gi, '');
        return _.compact(text.split(/\,\s*/g));
    },

    getType = function (char) {
        // Assumes char is NPC
        var char_type = '', char_id = char.get('id');
        if (isShapedSheet()) char_type = getAttrByName(char_id, 'type');
        else {
            var npc_type = getAttrByName(char_id, 'npc_type'); // Medium humanoid (goblinoid), Chaotic Evil
            char_type = npc_type.split(/\s+/)[1];
        }
        return char_type.toLowerCase();
    },

    getSize = function (char) {
        // Assumes char is NPC
        var char_size = '', char_id = char.get('id');
        if (isShapedSheet()) char_size = getAttrByName(char_id, 'type');
        else {
            var npc_type = getAttrByName(char_id, 'npc_type'); // Medium humanoid (goblinoid), Chaotic Evil
            char_size = npc_type.split(/\s+/)[0];
        }
        return char_size.toLowerCase();
    },

    getRationsAmt = function (char) {
        // Assumes char is NPC
        var rations = '1';
        switch (getSize(char)) {
            case 'small':
            rations = '1d4';
            break;
            case 'medium':
            rations = '1d6';
            break;
            case 'large':
            rations = '2d6';
            break;
            case 'huge':
            rations = '4d6';
            break;
            case 'gargantuan':
            rations = '10d6';
        }
        return rations;
    },

    getSkillCheck = function (type) {
        // Assumes char is NPC
        //dragon/monstrosity/construct/aberration/elemental/ooze/plant: Arcana check
        var skill = 'Arcana';
        if (type.match(/^(?:humanoid|beast|giant)$/i) != null) skill = 'Nature';
        if (type.match(/^(?:fey|undead|fiend|celestial)$/i) != null) skill = 'Religion';
        return skill;
    },

    getChallengeRating = function (char) {
        // Assumes char is NPC
        var char_id = char.get('id'), is_shaped = isShapedSheet();
        var challenge_rating = getAttrByName(char_id, 'challenge_rating_from_srd');
        if (challenge_rating == '') challenge_rating = getAttrByName(char_id, (is_shaped ? 'challenge' : 'npc_challenge'));
        if (challenge_rating == '') {
            // Last resort: Use number of HP die to estimate challenge rating
            challenge_rating = getAttrByName(char_id, (is_shaped ? 'hp_hpformula' : 'npc_hpformula')).split('d')[0];
            challenge_rating = parseInt(challenge_rating) / 2;
        }
        return (challenge_rating == '' ? '0' : challenge_rating);
    },

    getCurrency = function (char) {
        if (isShapedSheet()) {
            var coins = [], charAttrs = findObjs({type: 'attribute', characterid: char.get('id')}, {caseInsensitive: true});
            var denoms = _.filter(charAttrs, function (attr) { return attr.get('name').match(/^repeating_currency_[^_]+_acronym$/) !== null; });
            _.each(denoms, function (denom) {
                var currency_id = denom.get('name').split('_')[2];
                var amt = getAttrByName(char.get('id'), 'repeating_currency_' + currency_id + '_quantity') || '0';
                coins.push(amt + ' ' + denom.get('current').toLowerCase());
            });
        } else {

        }
        return coins.join(', ');
    },

    getMods = function () {
        var mods = hasLootGen() ? LootGenerator.getModDefaults() : {};
        if (!mods.coins) mods.coins = 'show-coins';
        if (!mods.mundane) mods.mundane = 'show-mundane';
        if (!mods.magic) mods.magic = 'less-magic';
        return mods;
    },

    isShapedSheet = function () {
        var is_shaped = false, char = findObjs({type: 'character'})[0];
        if (char) {
            var charAttrs = findObjs({type: 'attribute', characterid: char.get('id')}, {caseInsensitive: true});
            if (_.find(charAttrs, function (x) { return x.get('name') == 'character_sheet' && x.get('current').search('Shaped') != -1; })) is_shaped = true;
        }
        return is_shaped;
    },

    hasLootGen = function () {
        var retval = false;
        if (typeof LootGenerator != 'undefined' && typeof LootGenerator.generateCoins != 'undefined') retval = true;
        return retval;
    },

    rollDice = function (exp) {
        exp = exp.split(/\D/gi);
        var roll, num = (exp[0]) ? parseInt(exp[0]) : 1,
        die = (exp[1]) ? parseInt(exp[1]) : 6,
        plus = (exp[2]) ? parseInt(exp[2]) : 0;
        roll = (num == 1) ? randomInteger(die) : randomInteger(die * num - (num - 1)) + (num - 1);
        return roll + plus;
    },

    getSkillMod = function (char_id, skill) {
        var charAttrs = findObjs({type: 'attribute', characterid: char_id}, {caseInsensitive: true});
        if (isShapedSheet()) {
            var skill = _.find(charAttrs, function (attr) { return (attr.get('name').match(/^repeating_skill_[^_]+_name$/) !== null && attr.get('current') == skill); });
            var skill_id = skill.get('name').replace(/^repeating_skill_([^_]+)_name$/, '$1');
            return getAttrByName(char_id, 'repeating_skill_' + skill.get('name').split('_')[2] + '_total_with_sign', 'current') || '0';
        } else { //OGL sheet
            return getAttrByName(char_id, skill.toLowerCase() + '_bonus', 'current') || '0';
        }
    },

    rollSkillCheck = function (skill_mod, adv_dis = '0') {
        // example +3|Nature
        skill_mod = skill_mod.split('|');
        var end_result = {base: 0, mod: parseInt(skill_mod[0]), skill: skill_mod[1].replace(/~/g, ' '), adv_dis: adv_dis};
        end_result.roll1 = randomInteger(20),
        end_result.roll2 = randomInteger(20);

        end_result.base = end_result.roll1;
        if (end_result.adv_dis == '+1') end_result.base = (end_result.roll1 < end_result.roll2) ? end_result.roll2 : end_result.roll1;
        if (end_result.adv_dis == '-1') end_result.base = (end_result.roll1 < end_result.roll2) ? end_result.roll1 : end_result.roll2;

        end_result.final = end_result.base + end_result.mod;
        var mod = (end_result.mod > 0 ? '+ ' + end_result.mod : (end_result.mod < 0 ? '- ' + Math.abs(end_result.mod) : '+ 0'));

        end_result.formula = (end_result.adv_dis != '0' ? '2' : '1') + 'd20' + ((end_result.adv_dis == '+1') ? 'kh1' : (end_result.adv_dis == '-1' ? 'kl1' : '')) + ' '
            +  mod + '[' + end_result.skill.toLowerCase() + '] = (' + (end_result.adv_dis != '0' ? end_result.roll1 + '+' +  end_result.roll2 : end_result.base) + ')'
            + mod.replace(/\s/g, '') + (end_result.adv_dis != '0' ? ' = ' + end_result.base + mod.replace(/\s/g, '') : '');
        return end_result;
    },

    showDialog = function (title, content, whisperTo = '') {
        // Outputs a pretty box in chat with a title and content
        var gm = /\(GM\)/i;
        title = (title == '') ? '' : '<div style=\'' + styles.title + '\'>' + title + '</div>';
        var body = '<div style=\'' + styles.box + '\'>' + title + '<div>' + content + '</div></div>';
        if (whisperTo.length > 0) {
            whisperTo = '/w ' + (gm.test(whisperTo) ? 'GM' : '"' + whisperTo + '"') + ' ';
            sendChat('MonsterLoot', whisperTo + body, null, {noarchive:true});
        } else  {
            sendChat('MonsterLoot', body);
        }
    },

    enumerateItems = function (items) {
        // Collects multiple instances into one instance with an item count
        var uniqItems, retItems = [], count;
        uniqItems = _.uniq(items);
        _.each(uniqItems, function(item) {
            count = _.size(_.filter(items, function (x) { return x == item; }));
            if (count > 1) retItems.push(item + ' (' + count + ')');
            else retItems.push(item);
        });
        return retItems;
    },

    denumerateItems = function (items) {
        // Takes an array of enumerated items and expands it by count
        var tmpMonsters = [], re = /^[^\(]+\(\d+\)$/;
        _.each(items, function (item) {
            if (item.match(re)) {
                var parts = item.split(/\s*\(/);
                var count = parseInt(parts[1].replace(')', ''));
                var name = (count == 1 && parts[0].endsWith('s')) ? parts[0].replace(/s$/, '') : parts[0];
                for (var x = 0; x < count; x++) {
                    tmpMonsters.push(name);
                }
            } else {
                tmpMonsters.push(item);
            }
        });
        return tmpMonsters;
    },

    setMarker = function (msg) {
        var marker = msg.content.split(/\s+/i).pop().toLowerCase().replace('=', '::');
        var status_markers = _.pluck(MARKERS, 'tag');
        _.each(_.pluck(ALT_MARKERS, 'tag'), function (x) { status_markers.push(x); });
        if (_.find(status_markers, function (tmp) {return tmp === marker; })) {
            state['MonsterLoot'].marker = marker;
        } else {
            showAdminDialog('Error', 'The status marker "' + marker + '" is invalid. Please try again.');
        }
        commandConfig(msg);
    },

    showMarkers = function (msg) {
        var message = '<table style="border: 0; width: 100%;" cellpadding="0" cellspacing="2">';
        _.each(ALT_MARKERS, function (marker) {
            message += '<tr><td>' + getMarker(marker, 'margin-right: 10px;') + '</td><td style="white-space: nowrap; width: 100%;">' + marker.name + '</td>';
            if (marker.tag == state['MonsterLoot'].marker) {
                message += '<td style="text-align: center;">Current</td>';
            } else {
                message += '<td style="text-align: center; white-space: nowrap; padding: 7px;"><a style="' + styles.button + '" href="!spoils --set-marker ' + marker.tag + '">Set Marker</a></td>';
            }
            message += '</tr>';
        });

        _.each(MARKERS, function (icon) {
            message += '<tr><td>' + getMarker(icon, 'margin-right: 10px;') + '</td><td style="white-space: nowrap; width: 100%;">' + icon.name + '</td>';
            if (icon.tag == state['MonsterLoot'].marker) {
                message += '<td style="text-align: center;">Current</td>';
            } else {
                message += '<td style="text-align: center; white-space: nowrap; padding: 7px;"><a style="' + styles.button + '" href="!spoils --set-marker ' + icon.tag.replace('::','=') + '">Set Marker</a></td>';
            }
            message += '</tr>';
        });

        message += '<tr><td colspan="3" style="text-align: center; padding: 7px;"><a style="' + styles.button + '" href="!spoils config">&#9668; Back</a></td></tr>';
        message += '</table>';
        showDialog('Choose Torch Marker', message, 'GM');
    },

    getMarker = function (marker, style = '') {
        var marker_style = 'width: 24px; height: 24px;' + style;
        var return_marker = '<img src="" width="24" height="24" style="' + marker_style + ' border: 1px solid #ccc;" alt=" " />';
        if (typeof marker != 'undefined' && typeof marker.tag != 'undefined') {
            var status_markers = _.pluck(MARKERS, 'tag'),
            alt_marker = _.find(ALT_MARKERS, function (x) { return x.tag == marker.tag; });

            if (_.find(status_markers, function (x) { return x == marker.tag; })) {
                var icon = _.find(MARKERS, function (x) { return x.tag == marker.tag; });
                return_marker = '<img src="' + icon.url + '" width="24" height="24" style="' + marker_style + '" />';
            } else if (typeof alt_marker !== 'undefined') {
                if (alt_marker.url === 'X') {
                    marker_style += 'color: #C91010; font-size: 30px; line-height: 24px; font-weight: bold; text-align: center; padding-top: 0px; overflow: hidden;';
                    return_marker = '<div style="' + marker_style + '">X</div>';
                } else {
                    marker_style += 'background-color: ' + alt_marker.url + '; border: 1px solid #fff; border-radius: 50%;';
                    return_marker = '<div style="' + marker_style + '"></div>';
                }
            }
        }
        return return_marker;
    },

    commandConfig = function (msg) {
        var message = '', err = '', marker_style = 'margin: 5px 10px 0 0; display: block; float: left;',
        parms = msg.content.split(/\s*\-\-/i);
        _.each(parms, function (x) {
            var action = x.trim().split(/\s*\|\s*/i);
            if (action[0] == 'fumble-toggle') state['MonsterLoot'].allowFumbles = !state['MonsterLoot'].allowFumbles;
            if (action[0] == 'show-toggle') state['MonsterLoot'].showPlayersRolls = !state['MonsterLoot'].showPlayersRolls;
            if (action[0] == 'marker-toggle') state['MonsterLoot'].useMarker = !state['MonsterLoot'].useMarker;
            if (action[0] == 'add-toggle') state['MonsterLoot'].addMarker = !state['MonsterLoot'].addMarker;
            if (action[0] == 'macro') createMacro('config');
        });

        if (err != '') {
            message += '<p style=\'' + styles.msg + '\'>' + err + '</p>';
        }

        // Options
        message += '<b>Extraction Fumbles:</b> <a style=\'' + styles.textButton + '\' href="!spoils --config --fumble-toggle" title="Turn poison extraction fumbles ' + (state['MonsterLoot'].allowFumbles ? 'off' : 'on') + '">' + (state['MonsterLoot'].allowFumbles ? 'ON' : 'OFF') + '</a><br>';
        message += 'On a natural 1, a failed attempt to extract poison will ' + (state['MonsterLoot'].allowFumbles ? '' : '<i>not</i> ') + 'poison the character instead.<br><br>';

        message += '<b>Show Results:</b> <a style=\'' + styles.textButton + '\' href="!spoils --config --show-toggle" title="' + (state['MonsterLoot'].showPlayersRolls ? 'Hide' : 'Show') + ' skill check roll results to players">' + (state['MonsterLoot'].showPlayersRolls ? 'ON' : 'OFF') + '</a><br>';
        message += 'Players will ' + (state['MonsterLoot'].showPlayersRolls ? '' : '<i>not</i> ') + 'be shown the roll results of all skill checks.<br><hr style="' + styles.hr + '">';

        // Marker
        message += '<div style=\'' + styles.title + '\'>Marker</div>';
        var curr_marker = _.find(MARKERS, function (x) { return x.tag == state['MonsterLoot'].marker; });
        if (typeof curr_marker == 'undefined') curr_marker = _.find(ALT_MARKERS, function (x) { return x.tag == state['MonsterLoot'].marker; });
        if (state['MonsterLoot'].useMarker) {
            message += getMarker(curr_marker, marker_style);
            if (typeof curr_marker == 'undefined') message += '<b style="color: #c00;">Warning:</b> The token marker "' + state['MonsterLoot'].marker + '" is invalid!';
            else message += '"' + curr_marker.name + '" marker will be ' + (state['MonsterLoot'].addMarker ? '<a style=\'' + styles.textButton + '\' href="!spoils --config --add-toggle" title="Change to removing marker">added</a> to' : '<a style=\'' + styles.textButton + '\' href="!spoils --config --add-toggle" title="Change to adding marker">removed</a> from') + ' the token when a body is looted.';

            message += '<div style="' + styles.buttonWrapper + '"><a style="' + styles.button + '" href="!spoils --markers" title="This may result in a very long list...">Choose Marker</a></div>';
            message += '<a style=\'' + styles.textButton + '\' href="!spoils --config --marker-toggle" title="Turn this feature off">Turn off</a>';
        } else {
            message += 'You can either add or remove a token marker when a body is looted. <a style=\'' + styles.textButton + '\' href="!spoils --config --marker-toggle" title="Turn this feature on and configure">Turn on</a>';
        }
        message += '<hr style="' + styles.hr + '">';

        // Macro
        message += (_.size(findObjs({type: 'macro', name: 'Loot-Body'})) == 0 ? '<div style=\'' + styles.buttonWrapper + '\'><a style="' + styles.button + '" href="!spoils --config --macro" title="Create macro for looting bodies">Create Player Macro</a></div><hr style="' + styles.hr + '">' : '');

        // Import/Reset
        message += '<p>You currently have <i>' + (_.size(state['MonsterLoot'].monsters) == 1 ? '1 monster' : _.size(state['MonsterLoot'].monsters) + ' monsters') + '</i> in your bestiary.<p>';
        message += '<div style=\'' + styles.buttonWrapper + '\'><a style="' + styles.button + '" href="!spoils --import" title="Add monsters to the bestiary">Import Data</a> <a style="' + styles.button + '" href="!spoils --reset" title="Reset bestiary to the default database of monsters">Reset Bestiary</a></div>';

        message += '<p>See the <a style="' + styles.textButton + '" href="https://github.com/blawson69/MonsterLoot">documentation</a> for complete instructions.</p>';
        showDialog('Options', message, 'GM');
	},

    commandImport = function (msg) {
        // Import items from handouts
        var m_count = 0, errs = [];
        var handouts = findObjs({type: 'handout', archived: false});
        var bestiaries = _.filter(handouts, function (handout) { return handout.get('name').match(/^Bestiary.*$/i) != null; });
        _.each(bestiaries, function (handout) {
            handout.get('notes', function (notes) {
                var items = processHandout(notes);
                _.each(items, function (item) {
                    if (item.search(/\|/) > 0) {
                        let parts = item.split(/\s*\|\s*/), tmpMonster = {};
                        if (_.size(parts) == 4 || _.size(parts) == 5) {
                            tmpMonster.name = parts[0];
                            tmpMonster.type = parts[1];
                            tmpMonster.cr = parts[2];
                            tmpMonster.spoils = [];
                            var spoils = parts[3].split('::');
                            _.each(spoils, function (item) {
                                var bits = item.split('~');
                                var spoil = {name: bits[0]};
                                if (typeof bits[1] != 'undefined') spoil.desc = bits[1];
                                tmpMonster.spoils.push(spoil);
                            });
                            if (parts[4] != '') tmpMonster.poison = parts[4];

                            if (tmpMonster.type.match(/^(humanoid|beast|giant|dragon|fey|undead|fiend|celestial|monstrosity|construct|aberration|elemental|ooze|plant)$/i) != null
                            && tmpMonster.cr.match(/^(1\/8|1\/4|1\/2|\d{1,2})$/) != null) {
                                state['MonsterLoot'].monsters = _.reject(state['MonsterLoot'].monsters, function (x) { return x.name == tmpMonster.name; });
                                state['MonsterLoot'].monsters.push(tmpMonster);
                                m_count++;
                            } else errs.push(item.substr(0, 16) + (item.length > 16 ? '...' : ''));
                        } else errs.push(item.substr(0, 16) + (item.length > 16 ? '...' : ''));
                    } else errs.push(item.substr(0, 16) + (item.length > 16 ? '...' : ''));
                });
            });
        });

        setTimeout(function () {
            var title = 'Import Result', message = 'You imported ' + (m_count == 1 ? '1 monster' : m_count + ' monsters') + '.';
            if (_.size(errs) > 0) {
                message += (_.size(errs) == 1 ? '1 incorrectly formatted monster was' : _.size(errs) + ' incorrectly formatted monsters were') + ' not imported:<ul>';
                _.each(errs, function (err) { message += '<li>' + err + '</li>'; });
                message += '</ul>';
            }
            showDialog(title, message, 'GM');
        }, 250);
    },

    commandExport = function () {
        var bestiary = findObjs({type: 'handout', name: 'Exported Bestiary', archived: false})[0];
        if (!bestiary) bestiary = createObj("handout", {name: 'Exported Bestiary'});
        if (bestiary) {
            var parsedData = '';
            _.each(state['MonsterLoot'].monsters, function (monster) { parsedData += stringifyForExport(monster); });
            bestiary.set({ notes: parsedData });
            showDialog('Export Complete', 'Bestiary has exported successfully to "Exported Bestiary".', 'GM');
        }
    },

    stringifyForExport = function (monster) {
        var tmp = '<p>' + monster.name + '|' + monster.type + '|' + monster.cr + '|';
        var spoils = [];
        _.each(monster.spoils, function (item) {
            var spoil = item.name;
            if (typeof item.desc != 'undefined') spoil += '~' + item.desc;
            spoils.push(spoil);
        });
        tmp += spoils.join('::');
        tmp += (typeof monster.poison != 'undefined' ? '|' + monster.poison : '') + '</p>';
        return tmp;
    },

    processHandout = function (notes = '') {
        var retval = [], text = notes.trim();
        text = text.replace(/<p[^>]*>/gi, '<p>').replace(/\n(<p>)?/gi, '</p><p>').replace(/<br>/gi, '</p><p>');
        text = text.replace(/<\/?(span|div|pre|img|code|b|i|h1|h2|h3|h4|h5|ol|ul|pre)[^>]*>/gi, '');
        if (text != '' && /<p>.*?<\/p>/g.test(text)) retval = text.match(/<p>.*?<\/p>/g).map( l => l.replace(/^<p>(.*?)<\/p>$/,'$1'));
        return _.compact(retval);
    },

    createMacro = function (action = '') {
        var macro = findObjs({type: 'macro', name: 'Loot-Body'});
        if (_.size(macro) == 0) {
            var gm = _.find(findObjs({type: 'player'}), function (char) { return playerIsGM(char.get('id')); });
            createObj("macro", { name: 'Loot-Body', playerid: gm.get('id'), action: '!spoils --loot --id|@{target|Monster to loot|token_id}', visibleto: 'all' });
            if (action != '') commandConfig({content: '!spoils --config'});
            else return true;
        } else return false;
    },

    commandSetup = function () {
        var title, message;
        if (_.size(state['MonsterLoot'].monsters) == 0) {
            title = 'First Install';
            message = 'Thank you for choosing <b>Monster Loot!</b> The monster database has been populated and a "Loot-Body" macro has been created for your players to use. <div style="' + styles.buttonWrapper + '"><a style="' + styles.button + '" href="!spoils --config">Show Config</a></div>';
        } else {
            title = 'Reset Complete';
            message = 'The database has reset to the original monster database.';
        }
        log('MonsterLoot: Building monsters database...');
        state['MonsterLoot'].monsters = MONSTERS;
        showDialog(title, message, 'GM');
    },

    // ---- MONSTER DATABASE ---- //

    HUMAN_LIKE = ['vampire', 'devil', 'ghoul', 'hag', 'lich', 'satyr', 'wight', 'wraith', 'yuan-ti', 'zombie'],
    NATURAL_WEAPONS = ['multiattack', 'unarmed strike', '.*sneak attack', 'bite', 'beak', 'claw', 'tail', 'fist', '.*rock', 'constrict', 'tusk', 'hooves', 'horns', 'crush', 'slam', 'talons', 'gore', 'stomp', 'ram', 'maul', '.*touch', '.*visage', '.*presence', '.*kiss', '.*drain', '.*sight', '.*form', '.*leap', '.*cloud', 'devour', 'swallow', '.*roar', 'tentacle', 'tendril', '.*spore', 'sting', 'spit', 'fling', 'cantrip', 'spell', 'pseudopod', 'shock', 'invisibility', 'charm', 'etherealness', '.*spine', 'hook', 'drop', 'proboscis', 'leadership'],

    MONSTERS = [{name:'Aboleth',type:'Aberration',cr:'10',spoils:[{name:'Aboleth Hide',desc:'No immediate use. Can be crafted into Mariner\'s armor.'},{name:'Aboleth Tentacle',desc:'Used as a whip, underwater only. On a successful hit, target takes @1d6+3@ bludgeoning damage and succeed on a DC14 Constitution Saving throw or be diseased as per the Aboleth tentacle attack.'}]},{name:'Acolyte',type:'Humanoid',cr:'1/4',spoils:[]},{name:'Adult Black Dragon',type:'Dragon',cr:'14',spoils:[{name:'Adult Black Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Adult Black Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Acid Resistance.'},{name:'Adult Black Dragon Hide',desc:'No immediate use. Can be crafted into +2 armor that provides acid resistance.'},{name:'Adult Black Dragon Heart',desc:'No immediate use. Can be used to craft a Staff of Withering.'}]},{name:'Adult Blue Dracolich',type:'Undead',cr:'17',spoils:[]},{name:'Adult Blue Dragon',type:'Dragon',cr:'16',spoils:[{name:'Adult Blue Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Adult Blue Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Lightning Resistance.'},{name:'Adult Blue Dragon Hide',desc:'No immediate use. Can be crafted into +2 armor that provides lightning resistance.'},{name:'Adult Blue Dragon Fang',desc:'No immediate use. Can be crafted into a Javelin of Lightning.'}]},{name:'Adult Brass Dragon',type:'Dragon',cr:'13',spoils:[{name:'Adult Brass Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Adult Brass Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Fire Resistance.'},{name:'Adult Brass Dragon Hide',desc:'No immediate use. Can be crafted into +2 armor that provides fire resistance.'}]},{name:'Adult Bronze Dragon',type:'Dragon',cr:'15',spoils:[{name:'Adult Bronze Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Adult Bronze Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Lightning Resistance.'},{name:'Adult Bronze Dragon Hide',desc:'No immediate use. Can be crafted into +2 armor that provides lightning resistance.'}]},{name:'Adult Copper Dragon',type:'Dragon',cr:'14',spoils:[{name:'Adult Copper Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Adult Copper Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Lightning Resistance.'},{name:'Adult Copper Dragon Hide',desc:'No immediate use. Can be crafted into +2 armor that provides acid resistance.'}]},{name:'Adult Gold Dragon',type:'Dragon',cr:'17',spoils:[{name:'Adult Gold Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Adult Gold Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Fire Resistance.'},{name:'Adult Gold Dragon Hide',desc:'No immediate use. Can be crafted into +2 armor that provides fire resistance.'},{name:'Adult Gold Dragon Heart',desc:'No immediate use. Can be used to craft a Sun Blade weapon.'}]},{name:'Adult Green Dragon',type:'Dragon',cr:'15',spoils:[{name:'Adult Green Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Adult Green Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Poison Resistance.'},{name:'Adult Green Dragon Heart',desc:'No immediate use. Can be used to craft a Dagger of Venom.'},{name:'Adult Green Dragon Hide',desc:'No immediate use. Can be crafted into +2 armor that provides poison resistance.'}]},{name:'Adult Red Dragon',type:'Dragon',cr:'17',spoils:[{name:'Adult Red Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Adult Red Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Fire Resistance.'},{name:'Adult Red Dragon Hide',desc:'No immediate use. Can be crafted into +2 armor that provides fire resistance.'},{name:'Adult Red Dragon Heart',desc:'No immediate use. Can be used to craft a Flame Tongue weapon or a Staff of Fire.'}]},{name:'Adult Silver Dragon',type:'Dragon',cr:'16',spoils:[{name:'Adult Silver Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Adult Silver Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Cold Resistance.'},{name:'Adult Silver Dragon Hide',desc:'No immediate use. Can be crafted into +2 armor that provides cold resistance.'}]},{name:'Adult White Dragon',type:'Dragon',cr:'13',spoils:[{name:'Adult White Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Adult White Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Cold Resistance.'},{name:'Adult White Dragon Hide',desc:'No immediate use. Can be crafted into +2 armor that provides cold resistance.'},{name:'Adult White Dragon Heart',desc:'No immediate use. Can be used to craft a Staff of Frost.'}]},{name:'Air Elemental',type:'Elemental',cr:'5',spoils:[{name:'Air Elemental Mote',desc:'No immediate use. Can be used in crafting Armor of Force Resistance, Boots of Speed, Ring of Feather Falling, or Ring of Free Action.'}]},{name:'Ancient Black Dragon',type:'Dragon',cr:'21',spoils:[{name:'Ancient Black Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Ancient Black Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Acid Resistance.'},{name:'Ancient Black Dragon Hide',desc:'No immediate use. Can be crafted into +3 armor that provides acid resistance.'},{name:'Ancient Black Dragon Heart',desc:'No immediate use. Can be used to craft a Staff of Withering.'}]},{name:'Ancient Blue Dragon',type:'Dragon',cr:'23',spoils:[{name:'Ancient Blue Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Ancient Blue Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Lightning Resistance.'},{name:'Ancient Blue Dragon Hide',desc:'No immediate use. Can be crafted into +3 armor that provides lightning resistance.'},{name:'Ancient Blue Dragon Fang',desc:'No immediate use. Can be crafted into a Javelin of Lightning.'}]},{name:'Ancient Brass Dragon',type:'Dragon',cr:'20',spoils:[{name:'Ancient Brass Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Ancient Brass Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Fire Resistance.'},{name:'Ancient Brass Dragon Hide',desc:'No immediate use. Can be crafted into +3 armor that provides fire resistance.'}]},{name:'Ancient Bronze Dragon',type:'Dragon',cr:'22',spoils:[{name:'Ancient Bronze Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Ancient Bronze Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Lightning Resistance.'},{name:'Ancient Bronze Dragon Hide',desc:'No immediate use. Can be crafted into +3 armor that provides lightning resistance.'}]},{name:'Ancient Copper Dragon',type:'Dragon',cr:'21',spoils:[{name:'Ancient Copper Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Ancient Copper Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Lightning Resistance.'},{name:'Ancient Copper Dragon Hide',desc:'No immediate use. Can be crafted into +3 armor that provides acid resistance.'}]},{name:'Ancient Gold Dragon',type:'Dragon',cr:'24',spoils:[{name:'Ancient Gold Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Ancient Gold Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Fire Resistance.'},{name:'Ancient Gold Dragon Hide',desc:'No immediate use. Can be crafted into +3 armor that provides fire resistance.'},{name:'Ancient Gold Dragon Heart',desc:'No immediate use. Can be used to craft a Sun Blade weapon.'}]},{name:'Ancient Green Dragon',type:'Dragon',cr:'22',spoils:[{name:'Ancient Green Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Ancient Green Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Poison Resistance.'},{name:'Ancient Green Dragon Heart',desc:'No immediate use. Can be used to craft a Dagger of Venom.'},{name:'Ancient Green Dragon Hide',desc:'No immediate use. Can be crafted into +3 armor that provides poison resistance.'}]},{name:'Ancient Red Dragon',type:'Dragon',cr:'24',spoils:[{name:'Ancient Red Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Ancient Red Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Fire Resistance.'},{name:'Ancient Red Dragon Hide',desc:'No immediate use. Can be crafted into +3 armor that provides fire resistance.'},{name:'Ancient Red Dragon Heart',desc:'No immediate use. Can be used to craft a Flame Tongue weapon or a Staff of Fire.'}]},{name:'Ancient Silver Dragon',type:'Dragon',cr:'23',spoils:[{name:'Ancient Silver Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Ancient Silver Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Cold Resistance.'},{name:'Ancient Silver Dragon Hide',desc:'No immediate use. Can be crafted into +3 armor that provides cold resistance.'}]},{name:'Ancient White Dragon',type:'Dragon',cr:'20',spoils:[{name:'Ancient White Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Ancient White Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Cold Resistance.'},{name:'Ancient White Dragon Hide',desc:'No immediate use. Can be crafted into +3 armor that provides cold resistance.'},{name:'Ancient White Dragon Heart',desc:'No immediate use. Can be used to craft a Frost Brand sword or a Staff of Frost.'}]},{name:'Androsphinx',type:'Monstrosity',cr:'17',spoils:[{name:'Androsphinx Hide'},{name:'Androsphinx Pinion (@1d4@)',desc:'No immediate use. Can be crafted into a +3 arrow or bolt.'}]},{name:'Animated Armor',type:'Construct',cr:'1',spoils:[{name:'Tattered Set of Plate Armor',desc:'Must be mended before use.'}]},{name:'Ankheg',type:'Monstrosity',cr:'2',spoils:[{name:'Anhkeg Acid',desc:'Enough for one vial. Acts as a Vial of Acid. Can be crafted into a Vial of Potent Acid that deals 3d6 acid damage on a hit.'},{name:'Anhkeg Mandible',desc:'Used as a shortsword. For the first @1d3+3@ successful hits, will give an additional 1d6 acid damage.'}]},{name:'Ape',type:'Beast',cr:'1/2',spoils:[{name:'Ape Pelt'}]},{name:'Archmage',type:'Humanoid',cr:'12',spoils:[{name:'Mage\'s Robes'}]},{name:'Assassin',type:'Humanoid',cr:'8',spoils:[{name:'Thieves\' Tools'},{name:'Poisoner\'s Kit'}]},{name:'Awakened Shrub',type:'Plant',cr:'0',spoils:[]},{name:'Awakened Tree',type:'Plant',cr:'2',spoils:[{name:'Awakened Shrub Limb',desc:'Used as a quarterstaff.'}]},{name:'Axe Beak',type:'Beast',cr:'1/4',spoils:[{name:'Axe Beak Pinions (@1d6@)'},{name:'Axe Beak Talons (@1d2@)'},{name:'Axe Beak Beak',desc:'No immediate use. Can be crafted into an axe.'}]},{name:'Azer',type:'Elemental',cr:'2',spoils:[{name:'Azer Beard',desc:'No immediate use. Can be used in crafting an Eversmoking Bottle.'}]},{name:'Baboon',type:'Beast',cr:'0',spoils:[{name:'Baboon Hide'}]},{name:'Badger',type:'Beast',cr:'0',spoils:[{name:'Badger Pelt'}]},{name:'Balor',type:'Fiend',cr:'19',spoils:[{name:'Demon Ichor',desc:'Enough for one vial. Can be used as a Vial of Acid.'}]},{name:'Bandit',type:'Humanoid',cr:'1/8',spoils:[{name:'Tattered Leather Armor',desc:'Must be mended before use.'}]},{name:'Bandit Captain',type:'Humanoid',cr:'2',spoils:[{name:'Tattered Studded Leather Armor',desc:'Must be mended before use.'}]},{name:'Barbed Devil',type:'Fiend',cr:'5',spoils:[{name:'Hellish Ichor',desc:'No immediate use.'},{name:'Barbed Devil Barb (@1d4@)',desc:'Nine Hells only. No immediate use. Can be crafted into a +2 arrow, bold, or dart.'}]},{name:'Basilisk',type:'Monstrosity',cr:'3',spoils:[{name:'Basilisk Fang',desc:'Acts as a dagger. Can be crafted into a dagger that deals an additional 3 (1d6) poison damage on a hit.'},{name:'Basilisk Eye',desc:'When held toward a target, can cast Flesh to Stone (DC 12). This consumes the eye.'}]},{name:'Bat',type:'Beast',cr:'0',spoils:[{name:'Bat Wings (@1d2@)'}]},{name:'Bearded Devil',type:'Fiend',cr:'3',spoils:[{name:'Hellish Ichor',desc:'No immediate use.'},{name:'Bearded Devil Beard',desc:'Nine Hells only. No immediate use. Can be used to craft a +1 Wand of the War Mage.'}]},{name:'Behir',type:'Monstrosity',cr:'11',spoils:[{name:'Behir Fangs (@1d2@)',desc:'Acts as a shortsword. Can be crafted into a +1 shortsword that deals an additional 1d10 lightning damage on a hit.'},{name:'Behir Hide',desc:'No immediate use. Can be crafted into Leather Armor that grants Lightning Resistance.'},{name:'Behir Blood',desc:'No immediate use. Can be used in crafting a Wand of Lightning Bolts.'},{name:'Behir Stomach',desc:'No immediate use. Can be crafted into a Bag of Devouring.'}]},{name:'Berserker',type:'Humanoid',cr:'2',spoils:[{name:'Tattered Hide Armor',desc:'Must be mended before use.'}]},{name:'Black Bear',type:'Beast',cr:'1/2',spoils:[{name:'Black Bear Pelt'},{name:'Black Bear Claws (@1d4@)'}]},{name:'Black Dragon Wyrmling',type:'Dragon',cr:'2',spoils:[{name:'Black Dragon Wyrmling Head',desc:'Hunting trophy or collector\'s item.'},{name:'Black Dragon Wyrmling Hide',desc:'No immediate use. Can be crafted into armor that provides acid resistance.'}]},{name:'Black Pudding',type:'Ooze',cr:'4',spoils:[{name:'Vials of Black Pudding Pudding (@1d2@)',desc:'Used as an acid that deals 2d8 acid damage on a hit. Can disolve 1 cubic foot of nonmagical metal or wood when poured on such items or surfaces.'}]},{name:'Blink Dog',type:'Fey',cr:'1/4',spoils:[{name:'Blink Dog Hide',desc:'No immediate use. 5 hides can be used in crafting a Cloak of Displacement.'}]},{name:'Blood Hawk',type:'Beast',cr:'1/8',spoils:[{name:'Blood Hawk Pinions (@1d6@)'},{name:'Blood Hawk Talons (@1d2@)'}]},{name:'Blue Dragon Wyrmling',type:'Dragon',cr:'3',spoils:[{name:'Blue Dragon Wyrmling Head',desc:'Hunting trophy or collector\'s item.'},{name:'Blue Dragon Wyrmling Hide',desc:'No immediate use. Can be crafted into armor that provides lightning resistance.'}]},{name:'Boar',type:'Beast',cr:'1/4',spoils:[{name:'Boar Hide'},{name:'Boar Fat'},{name:'Boar Tusks (@1d2@)'}]},{name:'Bone Devil',type:'Fiend',cr:'9',spoils:[{name:'Hellish Ichor',desc:'No immediate use.'},{name:'Bone Devil Hide',desc:'Nine Hells only. No immediate use. Can be crafted into leather armor that grants resistance to bludgeoning, slashing and piercing damage from weapons that aren\'t silvered.'},{name:'Bone Devil Bone',desc:'No immediate use. Can be crafted into a +2 Rod of the Pact Keeper.'}]},{name:'Brass Dragon Wyrmling',type:'Dragon',cr:'1',spoils:[{name:'Brass Dragon Wyrmling Head',desc:'Hunting trophy or collector\'s item.'},{name:'Brass Dragon Wyrmling Hide',desc:'No immediate use. Can be crafted into armor that provides fire resistance.'}]},{name:'Bronze Dragon Wyrmling',type:'Dragon',cr:'2',spoils:[{name:'Bronze Dragon Wyrmling Head',desc:'Hunting trophy or collector\'s item.'},{name:'Bronze Dragon Wyrmling Hide',desc:'No immediate use. Can be crafted into armor that provides lightning resistance.'}]},{name:'Brown Bear',type:'Beast',cr:'1',spoils:[{name:'Brown Bear Pelt'},{name:'Brown Bear Claws (@1d4@)'}]},{name:'Bugbear',type:'Humanoid',cr:'1',spoils:[{name:'Tattered Shield',desc:'Must be mended before use.'},{name:'Tattered Hide Armor',desc:'Must be mended before use.'},{name:'Bugbear Ears (@1d2@)',desc:'Hunting trophy or collector\'s item.'},{name:'Bugbear Tusks (@1d2@)',desc:'Grants advantage on Intimidation checks made against goblinoids when held or worn outwardly.'}]},{name:'Bulette',type:'Monstrosity',cr:'5',spoils:[{name:'Bulette Scales (@1d4@)',desc:'Hunting trophy or collector\'s item.'},{name:'Bulette Head Plate',desc:'Used as a shield. Can be crafted into a shield that provides tremorsense in a 60 ft. radius when held touching the ground.'}]},{name:'Camel',type:'Beast',cr:'1/8',spoils:[{name:'Camel Hide'}]},{name:'Carrion Crawler',type:'Monstrosity',cr:'2',spoils:[{name:'Carrion Crawler Tentacles (@1d2@)',desc:'Used as a whip. The first @1d3+2@ uses deal an additional 1d4+2 poison damage and the target must succeed on a DC 13 Constution saving throw or be poisoned for 1 minute. Until this poison ends, the target is paralyzed. The target can repeat the saving throw on each of its turns, ending the poison on itself on a success.'}],poison:'Target must succeed on a DC 13 Constitution saving throw or be poisoned for 1 minute. Until this poison ends, the target is paralyzed. The target can repeat the saving throw at the end of each of its turns, ending the poison on itself on a success.'},{name:'Cat',type:'Beast',cr:'0',spoils:[{name:'Cat Pelt'}]},{name:'Cave Bear',type:'Beast',cr:'2',spoils:[{name:'Cave Bear Pelt'},{name:'Cave Bear Claws (@1d4@)'}]},{name:'Centaur',type:'Monstrosity',cr:'2',spoils:[{name:'Arrows (@1d6@)'},{name:'Centaur Hide',desc:'No immediate use. Can be crafted into Bracers of Archery.'}]},{name:'Chain Devil',type:'Fiend',cr:'8',spoils:[{name:'Hellish Ichor',desc:'No immediate use.'},{name:'Chain Devil Chains (@1d4@)',desc:'Nine Hells only. Used as an improvised weapon (STR) that does 1d8 bludgeoning damage and 1d6 piercing damage on a hit.'}]},{name:'Chimera',type:'Monstrosity',cr:'6',spoils:[{name:'Chimera Hide'},{name:'Chimera Pinions (@1d6@)',desc:'No immediate use. Can be crafted into arrows or bolts that deal an additional 1d8 fire damage.'},{name:'Goat Head'},{name:'Lion Head',desc:'Requires attunement. When attuned, can be used to cast Fear (save DC 15) once per day from the head.'},{name:'Dragon Head',desc:'Requires attunement. When attuned, can be used to cast Fireball (save DC 15) once per day from the head.'}]},{name:'Chuul',type:'Aberration',cr:'4',spoils:[{name:'Chuul Pincers (@1d2@)',desc:'Used as a Greataxe.'},{name:'Chuul Headplate',desc:'No immediate use. Can be crafted into a helmet that grants Detect Magic with double the distance (3/day).'}]},{name:'Clay Golem',type:'Construct',cr:'9',spoils:[{name:'Lumps of Clay (@1d6@)'}]},{name:'Cloaker',type:'Aberration',cr:'8',spoils:[{name:'Cloaker Tail',desc:'Used as a flail, but whithers away when exposed to sunlight.'},{name:'Cloaker Hide',desc:'No immediate use. Can be crafted into a Cloak of Displacement.'}]},{name:'Cloud Giant',type:'Giant',cr:'9',spoils:[{name:'Cloud Giant Toes (@1d4@)',desc:'Hunting trophy or collector\'s item.'},{name:'Cloud Giant Fingernails (@1d4@)',desc:'No immediate use. Can be crafted into Potion of Cloud Giant Strength.'},{name:'Cloud Giant Heart',desc:'No immediate use. Can be used in crafting a Belt of Cloud Giant Strength.'}]},{name:'Cockatrice',type:'Monstrosity',cr:'1/2',spoils:[{name:'Cockatrice Pinions (@1d6@)',desc:'No immediate use. Can be crafted into arrows or bolts. On a hit, the target must succeed on a DC 11 Constitution saving throw against being magically petrified. On a failed save, the creature begins to turn to stone and is restrained. It must repeat the saving throw at the end of its next turn. On a success, the effect ends. On a failure, the creature is petrified for 24 hours. This property can be used only once. Retrieved arrows function as normal arrows.'}]},{name:'Commoner',type:'Humanoid',cr:'0',spoils:[]},{name:'Constrictor Snake',type:'Beast',cr:'1/4',spoils:[{name:'Constrictor Snake Skin'},{name:'Snake Tongue',desc:'Used as a spell component.'}]},{name:'Copper Dragon Wyrmling',type:'Dragon',cr:'1',spoils:[{name:'Copper Dragon Wyrmling Head',desc:'Hunting trophy or collector\'s item.'},{name:'Copper Dragon Wyrmling Hide',desc:'No immediate use. Can be crafted into armor that provides acid resistance.'}]},{name:'Couatl',type:'Celestial',cr:'4',spoils:[{name:'Couatl Pinions (@1d6@)',desc:'No immediate use. Can be crafted into arrows or bolts that deliver an additional 1d6 radiant damage on a hit.'},{name:'Couatl Hide',desc:'No immediate use. Can be crafted into leather armor that grants resistance to radiant damage.'},{name:'Couatl Heart',desc:'No immediate use. Can be crafted into a Stone of Good Luck.'}]},{name:'Crab',type:'Beast',cr:'0',spoils:[]},{name:'Crocodile',type:'Beast',cr:'1/2',spoils:[{name:'Crocodile Hide'},{name:'Crocodile Teeth (@1d4@)'}]},{name:'Cult Fanatic',type:'Humanoid',cr:'2',spoils:[{name:'Tattered Leather Armor',desc:'Must be mended before use.'}]},{name:'Cultist',type:'Humanoid',cr:'1/8',spoils:[{name:'Tattered Leather Armor',desc:'Must be mended before use.'}]},{name:'Darkmantle',type:'Monstrosity',cr:'1/2',spoils:[{name:'Darkmantle Hide',desc:'No immediate use. 6 hides can be crafted into a cloak that gives advantage on Dexterity (Stealth) checks made to hide in rocky terrain.'},{name:'Darkmantle Eye',desc:'No immediate use, Can be crafted into an amulet or circlet that allows the wearer to cast Darkness (3/day) in a 15 ft. radius. Darkvision cannot penetrate this darkness, nor natural light illuminate it. If any of the darkness overlaps an area of light created by a spell of 2nd level or lower, the spell creating the light is dispelled.'}]},{name:'Death Dog',type:'Monstrosity',cr:'1',spoils:[{name:'Death Dog Heads (@1d2@)',desc:'Hunting trophy or collector\'s item.'},{name:'Death Dog Tongues (@1d2@)',desc:'No immediate use. 4 can be used to craft a Weapon of Warning.'}]},{name:'Deep Gnome',type:'Humanoid',cr:'1/2',spoils:[{name:'Tattered Chain Shirt',desc:'Must be mended before use.'},{name:'Deep Gnome Hide',desc:'No immediate use. 3 hides can be crafted into a cloak that gives advantage on Dexterity (Stealth) checks made to hide in rocky terrain.'}]},{name:'Deer',type:'Beast',cr:'0',spoils:[{name:'Deer Hide'},{name:'Deer Antlers (@1d2@)'}]},{name:'Deva',type:'Celestial',cr:'10',spoils:[{name:'Deva Pinions (@1d6@)',desc:'No immediate use. Can be crafted into +2 arrows or bolts that deal an extra 2d8 radiant damage on a hit, or into a Quall\'s Feather Token.'},{name:'Deva Hide',desc:'No immediate use. Can be crafted into leather armor that grants resistance to bludgeoning, piercing, and slashing from nonmagical attacks.'}]},{name:'Dire Wolf',type:'Beast',cr:'1',spoils:[{name:'Dire Wolf Hide'}]},{name:'Djinni',type:'Elemental',cr:'11',spoils:[]},{name:'Doppelganger',type:'Monstrosity',cr:'3',spoils:[{name:'Doppelganger Hide',desc:'No immediate use. Can be crafted into armor or clothing that grants advantage on Deception checks when used as a disguise.'}]},{name:'Draft Horse',type:'Beast',cr:'1/4',spoils:[{name:'Horse Hide'}]},{name:'Dragon Turtle',type:'Dragon',cr:'17',spoils:[{name:'Dragon Turtle Hide',desc:'No immediate use. Can be crafted into 2 sets of +2 armor that provides fire resistance.'},{name:'Dragon Turtle Shell Scale',desc:'No immediate use. Can be crafted into a +2 shield that provides fire resistance.'}]},{name:'Dretch',type:'Fiend',cr:'1/4',spoils:[]},{name:'Drider',type:'Monstrosity',cr:'6',spoils:[{name:'Drider Legs (@1d8@)',desc:'Used as a mace.'},{name:'Drider Silk',desc:'No immediate use. Can be used in creating Heward\'s Handy Haversack.'}]},{name:'Drow',type:'Humanoid',cr:'1/4',spoils:[{name:'Tattered Chain Shirt',desc:'Must be mended before use.'}]},{name:'Druid',type:'Humanoid',cr:'2',spoils:[]},{name:'Dryad',type:'Fey',cr:'1',spoils:[{name:'Dryad Hide',desc:'No immediate use. Can be crafted into armor that grants advantage on saving throws against spells and other magical effects.'},{name:'Dryad Heart',desc:'No immediate use. Can be crafted into a potion that grants immunity to Charm and other mind control effects for 1 hour.'}]},{name:'Duergar',type:'Humanoid',cr:'1',spoils:[{name:'Tattered Scale Mail',desc:'Must be mended before use.'},{name:'Tattered Shield',desc:'Must be mended before use.'},{name:'Vial of Duergar Blood',desc:'No immediate use. Can be crafted into a Potion of Growth.'},{name:'Duergar Heart',desc:'No immediate use. Can be used in crafting a Potion of Invisibility.'}]},{name:'Dust Mephit',type:'Elemental',cr:'1/2',spoils:[{name:'Mote of Elemental Dust',desc:'No immediate use. Used as a material component for a Conjure Minor Elementals spell, or in crafting an Elemental Gem for summoning earth or air elementals.'}]},{name:'Eagle',type:'Beast',cr:'0',spoils:[{name:'Eagle Pinions (@1d6@)'},{name:'Eagle Talons (@1d2@)'}]},{name:'Earth Elemental',type:'Elemental',cr:'5',spoils:[{name:'Mote of Elemental Dust',desc:'No immediate use. Used as a material component for a Conjure Elementals spell, or in crafting an Elemental Gem for summoning earth elementals.'}]},{name:'Efreeti',type:'Elemental',cr:'11',spoils:[]},{name:'Elephant',type:'Beast',cr:'4',spoils:[{name:'Elephant Hide'},{name:'Elephant Tusks (@1d2@)'}]},{name:'Elk',type:'Beast',cr:'1/4',spoils:[{name:'Elk Hide'},{name:'Elk Antlers (@1d2@)'}]},{name:'Erinyes',type:'Fiend',cr:'12',spoils:[]},{name:'Ettercap',type:'Monstrosity',cr:'2',spoils:[{name:'Ettercap Hide',desc:'No immediate use. Can be crafted into a pair of boots that allows the wearer to ignore movement restrictions caused by webbing.'},{name:'Ettercap Silk Gland',desc:'Can be used @1d3+2@ times to shoot webbing at a 30/60 ft. range. Larger or smaller creatures only. On a hit, the creature is restrained by webbing. As an action, the restrained creature can make a DC 11 Strength check, escaping from the webbing on a success. The effect ends if the webbing is destroyed. It has AC 10, 5 hit points, is vulnerable to fire damage and immune to bludgeoning, poison and psychic damage.'}],poison:'Target must succeed on a DC 11 Constitution saving throw or be poisoned for 1 minute. The creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.'},{name:'Ettin',type:'Giant',cr:'4',spoils:[{name:'Ettin Toes (@1d4@)',desc:'Hunting trophy or collector\'s item.'},{name: 'Ettin Eyes (@1d4@)', desc: 'No immediate use. 2 can be used to craft Goggles of Night.'}]},{name:'Fire Elemental',type:'Elemental',cr:'5',spoils:[{name:'Ember of Elemental Fire',desc:'No immediate use. Used as a material component for a Conjure Elementals spell, or in crafting an Elemental Gem for summoning fire elementals. Can be used in crafting Alchemist\'s Fire.'}]},{name:'Fire Giant',type:'Giant',cr:'9',spoils:[{name:'Fire Giant Toes (@1d4@)',desc:'Hunting trophy or collector\'s item.'},{name:'Fire Giant Fingernails (@1d4@)',desc:'No immediate use. Can be crafted into Potion of Fire Giant Strength.'},{name:'Fire Giant Heart',desc:'No immediate use. Can be used in crafting a Belt of Fire Giant Strength.'}]},{name:'Flesh Golem',type:'Construct',cr:'5',spoils:[{name:'Flesh Golum Heart',desc:'No immediate use. Can be crafted into an amulet that provides advantage on all saving throws against effects that would alter the wearer\'s form.'}]},{name:'Flying Snake',type:'Beast',cr:'1/8',spoils:[{name:'Flying Snake Skin'},{name:'Flying Snake Wings (@1d2@)'},{name:'Snake Tongue',desc:'Used as a spell component.'}]},{name:'Flying Sword',type:'Construct',cr:'1/4',spoils:[{name:'Tattered Longsword',desc:'Must be mended before use.'}]},{name:'Frog',type:'Beast',cr:'0',spoils:[]},{name:'Frost Giant',type:'Giant',cr:'8',spoils:[{name:'Frost Giant Toes (@1d4@)',desc:'Hunting trophy or collector\'s item.'},{name:'Frost Giant Fingernails (@1d4@)',desc:'No immediate use. Can be crafted into Potion of Frost Giant Strength.'},{name:'Frost Giant Heart',desc:'No immediate use. Can be used in crafting a Belt of Frost Giant Strength.'}]},{name:'Gargoyle',type:'Elemental',cr:'2',spoils:[{name:'Gargoyle Chunks (@1d4@)',desc:'Used as sling stones.'},{name:'Gargoyle Wings (@1d2@)',desc:'3 can be crafted into armor that provides resistance to bludgeoning, piercing, and slashing from nonmagical attacks that aren\'t adamantine.'}]},{name:'Gelatinous Cube',type:'Ooze',cr:'2',spoils:[{name:'Vials of Gelatinous Cube Residue (@1d2@)',desc:'Used as acid, but deals 3d6 acid damage on a hit.'}]},{name:'Ghast',type:'Undead',cr:'2',spoils:[{name:'Ghast Claw (@1d2@)',desc:'No immediate use. Can be crafted into a dagger that will paralyze a creature (other than undead) for 1 minute unless it succeeds on a DC 10 Constitution saving throw. The target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.'}]},{name:'Ghost',type:'Undead',cr:'4',spoils:[{name:'Ectoplasm',desc:'No immediate use. Can be crafted into a Potion of Necrotic Resistance, or a poison that deals 2d6 necrotic damage when applied to a weapon or ammunition. There is enough for one coating and is used up on a successful hit.'}]},{name:'Ghoul',type:'Undead',cr:'1',spoils:[{name:'Ghoul Claw (@1d2@)',desc:'No immediate use. Can be crafted into a dagger that will paralyze a creature (other than undead) for 1 minute unless it succeeds on a DC 10 Constitution saving throw. The target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.'}]},{name:'Giant Ape',type:'Beast',cr:'7',spoils:[{name:'Giant Ape Pelt'}]},{name:'Giant Badger',type:'Beast',cr:'1/4',spoils:[{name:'Giant Badger Pelt'}]},{name:'Giant Bat',type:'Beast',cr:'1/4',spoils:[{name:'Giant Bat Hide'},{name:'Giant Bat Wings (@1d2@)'}]},{name:'Giant Boar',type:'Beast',cr:'2',spoils:[{name:'Giant Boar Hide'},{name:'Giant Boar Fat'},{name:'Giant Boar Tusks (@1d2@)'}]},{name:'Giant Centipede',type:'Beast',cr:'1/4',spoils:[],poison:'Target must succeed on a DC 11 Constitution saving throw or take 10 (3d6) poison damage. If the poison damage reduces the target to 0 hit points, the target is stable but poisoned for 1 hour, even after regaining hit points, and is paralyzed while poisoned in this way.'},{name:'Giant Constrictor Snake',type:'Beast',cr:'2',spoils:[{name:'Giant Constrictor Snake Skin'}]},{name:'Giant Crab',type:'Beast',cr:'1/8',spoils:[{name:'Giant Crab Claws (@1d2@)'},{name:'Giant Crab Shell',desc:'No immediate use. Can be crafted into a shield.'}]},{name:'Giant Crocodile',type:'Beast',cr:'5',spoils:[{name:'Giant Crocodile Hide'},{name:'Giant Crocodile Teeth (@1d4@)'}]},{name:'Giant Eagle',type:'Beast',cr:'1',spoils:[{name:'Giant Eagle Pinions (@1d6@)'},{name:'Giant Eagle Talons (@1d2@)'}]},{name:'Giant Elk',type:'Beast',cr:'2',spoils:[{name:'Giant Elk Hide'},{name:'Giant Elk Antlers (@1d2@)'}]},{name:'Giant Fire Beetle',type:'Beast',cr:'0',spoils:[{name:'Giant Fire Beetle Shell'},{name:'Giant Fire Beetle Glands (@1d2@)',desc:'Used as a light source. Will continue to glow for @1d6@ days after death, providing bright light in a 10 ft. radius and dim light for an additional 10 ft.'}]},{name:'Giant Frog',type:'Beast',cr:'1/4',spoils:[{name:'Giant Frog Skin'}]},{name:'Giant Goat',type:'Beast',cr:'1/2',spoils:[{name:'Giant Goat Hide'},{name:'Giant Goat Horns (@1d2@)'}]},{name:'Giant Hyena',type:'Beast',cr:'1',spoils:[{name:'Giant Hyena Pelt'}]},{name:'Giant Lizard',type:'Beast',cr:'1/4',spoils:[{name:'Giant Lizard Skin'},{name:'Giant Lizard Tail'}]},{name:'Giant Octopus',type:'Beast',cr:'1',spoils:[{name:'Giant Octopus Hide'},{name:'Giant Octopus Tentacles (@1d4@)'},{name:'Giant Octopus Beak'}]},{name:'Giant Owl',type:'Beast',cr:'1/4',spoils:[{name:'Giant Owl Pinions (@1d6@)'},{name:'Giant Owl Talons (@1d2@)'}]},{name:'Giant Poisonous Snake',type:'Beast',cr:'1/4',spoils:[{name:'Giant Poisonous Snake Skin'}],poison:'Target must make a DC 11 Constitution saving throw, taking 10 (3d6) poison damage on a failed save, or half as much damage on a successful one.'},{name:'Giant Rat',type:'Beast',cr:'1/8',spoils:[{name:'Giant Rat Pelt'},{name:'Giant Rat Tail'}]},{name:'Giant Scorpion',type:'Beast',cr:'3',spoils:[{name:'Giant Scorpion Shell'},{name:'Giant Scorpion Claws (@1d2@)'}],poison:'Target must make a DC 12 Constitution saving throw, taking 22 (4d10) poison damage on a failed save, or half as much damage on a successful one.'},{name:'Giant Sea Horse',type:'Beast',cr:'1/2',spoils:[{name:'Giant Sea Horse Hide'}]},{name:'Giant Shark',type:'Beast',cr:'5',spoils:[{name:'Giant Shark Hide'},{name:'Giant Shark Teeth (@1d4@)'}]},{name:'Giant Spider',type:'Beast',cr:'1',spoils:[{name:'Giant Spider Pincers (@1d2@)',desc:'No immediate use. Used as a dagger.'},{name:'Giant Spider Silk',desc:'No immediate use. Can be used to craft a Potion of Climbing or Slippers of Spider Climbing.'}],poison:'Target must make a DC 11 Constitution saving throw, taking 9 (2d8) poison damage on a failed save, or half as much damage on a successful one. If the poison damage reduces the target to 0 hit points, the target is stable but poisoned for 1 hour, even after regaining hit points, and is paralyzed while poisoned in this way.'},{name:'Giant Toad',type:'Beast',cr:'1',spoils:[{name:'Giant Toad Hide'}]},{name:'Giant Vulture',type:'Beast',cr:'1',spoils:[{name:'Giant Vulture Pinions (@1d6@)'},{name:'Giant Vulture Talons (@1d2@)'}]},{name:'Giant Wasp',type:'Beast',cr:'1/2',spoils:[{name:'Giant Wasp Wings (@1d2@)'},{name:'Giant Wasp Stinger',desc:'No immediate use. Used as a dagger.'}],poison:'Target must make a DC 11 Constitution saving throw, taking 10 (3d6) poison damage on a failed save, or half as much damage on a successful one. If the poison damage reduces the target to 0 hit points, the target is stable but poisoned for 1 hour, even after regaining hit points, and is paralyzed while poisoned in this way.'},{name:'Giant Weasel',type:'Beast',cr:'1/8',spoils:[{name:'Giant Weasel Pelt'}]},{name:'Giant Wolf Spider',type:'Beast',cr:'1/4',spoils:[{name:'Giant Wolf Spider Pincers (@1d2@)',desc:'No immediate use. Used as a dagger.'},{name:'Giant Wolf Spider Silk',desc:'No immediate use. Can be used to craft a Potion of Climbing or Slippers of Spider Climbing.'}],poison:'Target must make a DC 11 Constitution saving throw, taking 7 (2d6) poison damage on a failed save, or half as much damage on a successful one. If the poison damage reduces the target to 0 hit points, the target is stable but poisoned for 1 hour, even after regaining hit points, and is paralyzed while poisoned in this way.'},{name:'Gibbering Mouther',type:'Aberration',cr:'2',spoils:[{name:'Vials of Gibbering Mouther Spittle (@1d2@)',desc:'Can be thrown within range (20/60 ft.) where it explodes in a blinding flash of light on impact. Each creature within 5 feet of the flash must succeed on a DC 13 Dexterity saving throw or be blinded until the end of your next turn.'},{name:'Gibbering Mouther Ichor',desc:'No immediate use. Can be used in crafting a +1 Rod of the Pact Keeper.'}]},{name:'Glabrezu',type:'Fiend',cr:'9',spoils:[]},{name:'Gladiator',type:'Humanoid',cr:'5',spoils:[{name:'Tattered Studded Leather Armor',desc:'Must be mended before use.'},{name:'Tattered Shield',desc:'Must be mended before use.'}]},{name:'Gnoll',type:'Humanoid',cr:'1/2',spoils:[{name:'Tattered Hide Armor',desc:'Must be mended before use.'},{name:'Tattered Shield',desc:'Must be mended before use.'}]},{name:'Goat',type:'Beast',cr:'0',spoils:[{name:'Goat Hide'},{name:'Goat Horns (@1d2@)'}]},{name:'Goblin',type:'Humanoid',cr:'1/4',spoils:[{name:'Tattered Leather Armor',desc:'Must be mended before use.'},{name:'Tattered Shield',desc:'Must be mended before use.'}]},{name:'Gold Dragon Wyrmling',type:'Dragon',cr:'3',spoils:[{name:'Gold Dragon Wyrmling Head',desc:'Hunting trophy or collector\'s item.'},{name:'Gold Dragon Wyrmling Hide',desc:'No immediate use. Can be crafted into armor that provides fire resistance.'}]},{name:'Gorgon',type:'Monstrosity',cr:'5',spoils:[{name:'Gorgon Horns (@1d2@)',desc:'Hunting trophy or collector\'s item.'},{name:'Gorgon Scales (@1d4@)',desc:'No immediate use. Can be crafted into a Potion of Invulnerability.'}]},{name:'Gray Ooze',type:'Ooze',cr:'1/2',spoils:[{name:'Vial of Gray Ooze Residue',desc:'Used as acid.'}]},{name:'Green Dragon Wyrmling',type:'Dragon',cr:'2',spoils:[{name:'Green Dragon Wyrmling Head',desc:'Hunting trophy or collector\'s item.'},{name:'Green Dragon Wyrmling Hide',desc:'No immediate use. Can be crafted into armor that provides poison resistance.'}]},{name:'Green Hag',type:'Fey',cr:'3',spoils:[{name: 'Green Hag Eyes (@1d2@)', desc: 'No immediate use. 2 can be used to craft Goggles of Night.'},{name:'Green Hag Nose',desc:'When worn like a mask, allows the wearer to mimic animal sounds and human voices. A creature that hears the sounds can tell they are imitations with a successful DC 14 Insight check.'}]},{name:'Grick',type:'Monstrosity',cr:'2',spoils:[{name:'Grick Tentacles (@1d4@)',desc:'Used as a flail.'},{name:'Grick Hide',desc:'No immediate use. Can be crafted into a cloak that gives advantage on Dexterity checks made to hide in rocky terrain.'}]},{name:'Griffon',type:'Monstrosity',cr:'2',spoils:[{name:'Griffon Hide'},{name:'Griffon Pinions (@1d6@)',desc:'No immediate use. Can be crafted into +1 arrows or bolts, Quall\'s Feather Token, or used to craft the Figurine of Wondrous Power (bronze griffon).'},{name:'Griffon Eyes (@1d2@)',desc:'No immediate use. 2 can be used in crafting Eyes of the Eagle.'}]},{name:'Grimlock',type:'Humanoid',cr:'1/4',spoils:[{name:'Grimlok Hide',desc:'No immediate use. Can be crafted into a cloak that gives advantage on Dexterity checks made to hide in rocky terrain.'}]},{name:'Guard',type:'Humanoid',cr:'1/8',spoils:[{name:'Tattered Chain Shirt',desc:'Must be mended before use.'},{name:'Tattered Shield',desc:'Must be mended before use.'}]},{name:'Guardian Naga',type:'Monstrosity',cr:'10',spoils:[{name:'Guardian Naga Hide',desc:'No immediate use. Can be crafted into +1 armor that grants resistance to poison damage.'},{name:'Guardian Naga Heart',desc:'When consumed, acts as a Potion of Vitality.'}]},{name:'Gynosphinx',type:'Monstrosity',cr:'11',spoils:[{name:'Gynosphinx Hide'},{name:'Gynosphinx Pinions (@1d6@)',desc:'No immediate use. Can be crafted into a +3 arrows or bolts.'}]},{name:'Half-Red Dragon Veteran',type:'Humanoid',cr:'5',spoils:[{name:'Tattered Plate Armor',desc:'Must be mended before use.'}]},{name:'Harpy',type:'Monstrosity',cr:'1',spoils:[{name:'Harpy Pinions (@1d6@)',desc:'Can be crafted into arrows or bolts that, on a hit, cause the target to make saving throws against Charm or other mond control effects at disadvantage.'},{name:'Harpy Ears (@1d2@)',desc:'No immediate use. Can be crafted into an amulet or circlet that grants advantage on saving throws against Charm or other mind controlling effects when worn.'},{name:'Harpy Eyes (@1d2@)',desc:'No immediate use. 2 can be used to craft Eyes of Charming.'}]},{name:'Hawk',type:'Beast',cr:'0',spoils:[{name:'Hawk Pinions (@1d6@)'},{name:'Hawk Talons (@1d2@)'}]},{name:'Hell Hound',type:'Fiend',cr:'3',spoils:[{name:'Hell Hound Ears (@1d2@)',desc:'Hunting trophy or collector\'s item.'},{name:'Hell Hound Hide',desc:'No immediate use. Can be crafted into armor or a cloak that grants fire resistance to the wearer.'}]},{name:'Hezrou',type:'Fiend',cr:'8',spoils:[]},{name:'Hill Giant',type:'Giant',cr:'5',spoils:[{name:'Hill Giant Toes (@1d4@)',desc:'Hunting trophy or collector\'s item.'},{name:'Hill Giant Fingernails (@1d4@)',desc:'No immediate use. Can be crafted into Potion of Hill Giant Strength.'},{name:'Hill Giant Heart',desc:'No immediate use. Can be used in crafting a Belt of Hill Giant Strength.'}]},{name:'Hippogriff',type:'Monstrosity',cr:'1',spoils:[{name:'Hippogriff Pinions (@1d6@)',desc:'No immediate use. Can be crafted into +1 arrows or bolts.'},{name:'Hippogriff Hide',desc:'No immediate use. Can be used to craft the Saddle of the Cavalier.'}]},{name:'Hobgoblin',type:'Humanoid',cr:'1/2',spoils:[{name:'Tattered Chain Mail',desc:'Must be mended before use.'},{name:'Tattered Shield',desc:'Must be mended before use.'}]},{name:'Homunculus',type:'Construct',cr:'0',spoils:[{name:'Lumps of Clay (@1d2@)'},{name:'Mandrake Root'}]},{name:'Horned Devil',type:'Fiend',cr:'11',spoils:[]},{name:'Hunter Shark',type:'Beast',cr:'2',spoils:[{name:'Hunter Shark Hide'},{name:'Hunter Shark Teeth (@1d4@)'}]},{name:'Hydra',type:'Monstrosity',cr:'8',spoils:[{name:'Hydra Hide',desc:'No immediate use. Can be crafted into armor that allows the wearer to ignore harsh terrain in water invironments.'},{name:'Hydra Heads (@1d5@)',desc:'Hunting trophy or collector\'s item. Can be crafted into a helmet that grants advantage on intimidation checks.'},{name:'Hydra Blood',desc:'No immediate use. Can be crafted into a Potion of Regeneration, which works like the Regenerate spell on the drinker.'}]},{name:'Hyena',type:'Beast',cr:'0',spoils:[{name:'Hyena Hide'}]},{name:'Ice Devil',type:'Fiend',cr:'14',spoils:[]},{name:'Ice Mephit',type:'Elemental',cr:'1/2',spoils:[{name:'Shard of Elemental Ice',desc:'No immediate use. Used as a material component for a Conjure Minor Elementals spell, or in crafting an Elemental Gem for summoning water or air elementals.'}]},{name:'Imp',type:'Fiend',cr:'1',spoils:[]},{name:'Incubus',type:'Fiend',cr:'4',spoils:[{name:'Incubus Claw',desc:'Used as a sickle that deals 1d6 slashing damage.'},{name:'Incubus Lips',desc:'No immediate use. Can be used to craft a lipstick that can be used to kiss a willing target. The target must make a DC 15 Constitution saving throw against this magic, taking 32 (5d10 + 5) psychic damage on a failed save, or half as much damage on a successful one. The target\'s hit point maximum is reduced by an amount equal to the damage taken. This reduction lasts until the target finishes a long rest. The target dies if this effect reduces its hit point maximum to 0. The lips make enough lipstick for @1d2+1@ uses.'},{name:'Incubus Eyes (@1d2@)',desc:'No immediate use. Can be used in crafting Eyes of Charming.'}]},{name:'Invisible Stalker',type:'Elemental',cr:'6',spoils:[]},{name:'Iron Golem',type:'Construct',cr:'16',spoils:[{name:'Iron Golem Shell',desc:'No immediate use. Can be crafted into armor that provides resistance to bludgeoning, piercing, and slashing from nonmagical attacks that aren\'t adamantine.'}]},{name:'Jackal',type:'Beast',cr:'0',spoils:[{name:'Jackal Hide'}]},{name:'Killer Whale',type:'Beast',cr:'3',spoils:[{name:'Killer Whale Hide'},{name:'Killer Whale Teeth (@1d4@)'}]},{name:'Knight',type:'Humanoid',cr:'3',spoils:[{name:'Tattered Plate Armor',desc:'Must be mended before use.'}]},{name:'Kobold',type:'Humanoid',cr:'1/8',spoils:[]},{name:'Kraken',type:'Monstrosity',cr:'23',spoils:[{name:'Kraken Tentacle Tips (@1d4@)',desc:'Used as a whip. Can be crafted into a +2 whip that allows the weilder to grapple a Large or smaller opponent (escape DC 18). The wielder of the whip can use a bonus action to cast Shocking Grasp through the whip. Once the whip has used this property three times, it can\’t be used again until the next dawn.'},{name:'Vials of Kraken Ink (@1d4+4@)',desc:'Used as an Oil of Slipperiness.'},{name:'Kraken Hide (@1d4@)',desc:'No immediate use. Can be crafted into +3 armor that grants resistance to lightning damage.'},{name:'Kraken Eye',desc:'No immediate use. Can be crafted into a helmet that allows the wearer to use Control Weather as the spell with no components once per day. This effect cannot be used again until the next dawn.'}]},{name:'Lamia',type:'Monstrosity',cr:'4',spoils:[{name:'Lamia Hide'},{name:'Lamia Finger',desc:'No immediate use. Can be crafted into a short staff (5 ft. reach) that, when used to touch a creature (normal attack, no damage), curses them for 1 hour. Until the curse ends, the target has disadvantage on Wisdom saving throws and all ability checks. Once used, this property can\'t be used again until the next dawn.'}]},{name:'Lemure',type:'Fiend',cr:'0',spoils:[]},{name:'Lich',type:'Undead',cr:'21',spoils:[{name:'Lich Claw',desc:'Used as a +2 handaxe that deals an extra 2d6 cold damage. The target must succeed on a DC 18 Constitution saving throw or be paralyzed for 1 minute. The target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.'},{name:'Lich Tongue',desc:'No immediate use. Can be crafted into an amulet or circlet that can tether the wearer to the target of its choice withen 30 ft. Whenever the wearer takes damage, the target must make a DC 18 Constitution saving throw. On a failed save, the wearer takes half the damage (rounded down), and the target takes the remaining damage. This tether lasts until initiative count 20 on the next round or until the wearer and the target are no longer within range. Once used, this property can\'t be used again until the next dawn.'}]},{name:'Lion',type:'Beast',cr:'1',spoils:[{name:'Lion Pelt'},{name:'Lion Teeth (@1d4@)'}]},{name:'Lizard',type:'Beast',cr:'0',spoils:[]},{name:'Lizardfolk',type:'Humanoid',cr:'1/2',spoils:[{name:'Tattered Shield',desc:'Must be mended before use.'}]},{name:'Mage',type:'Humanoid',cr:'6',spoils:[]},{name:'Magma Mephit',type:'Elemental',cr:'1/2',spoils:[{name:'Lump of Elemental Magma',desc:'No immediate use. Used as a material component for a Conjure Minor Elementals spell, or in crafting an Elemental Gem for summoning earth or fire elementals.'}]},{name:'Magmin',type:'Elemental',cr:'1/2',spoils:[{name:'Lump of Elemental Magma',desc:'No immediate use. Used as a material component for a Conjure Minor Elementals spell, or in crafting an Elemental Gem for summoning earth or fire elementals.'}]},{name:'Mammoth',type:'Beast',cr:'6',spoils:[{name:'Mammoth Hide'},{name:'Mammoth Tusks (@1d2@)'}]},{name:'Manticore',type:'Monstrosity',cr:'3',spoils:[{name:'Manticore Hide',desc:'No immediate use. Can be crafted into armor or a cloak that grants advantage on Animal Handling checks made to tame griffons and wyverns.'},{name:'Manticore Spikes (@1d8@)',desc:'Act as bolts or darts that deal +2 damage. They break upon use and cannot be recovered.'},{name:'Manticore Tail',desc:'No immediate use. Can be crafted into a Quiver of Ehlonna.'}]},{name:'Marilith',type:'Fiend',cr:'16',spoils:[]},{name:'Mastiff',type:'Beast',cr:'1/8',spoils:[{name:'Mastiff Pelt'}]},{name:'Medusa',type:'Monstrosity',cr:'6',spoils:[{name:'Medusa Head',desc:'When a creature that can see the medusa\'s eyes starts its turn within 30 feet of the medusa, it must make a DC 14 Constitution saving throw. If the saving throw fails by 5 or more, the creature is instantly petrified. Otherwise, a creature that fails the save begins to turn to stone and is restrained. The restrained creature must repeat the saving throw at the end of its next turn, becoming petrified on a failure or ending the effect on a success. The petrification lasts until the creature is freed by the greater restoration spell or other magic.'}]},{name:'Merfolk',type:'Humanoid',cr:'1/8',spoils:[]},{name:'Merrow',type:'Monstrosity',cr:'2',spoils:[{name:'Merrow Hide',desc:'No immediate use. Can be crafted into Mariner\'s Armor.'}]},{name:'Mimic',type:'Monstrosity',cr:'2',spoils:[]},{name:'Minotaur',type:'Monstrosity',cr:'3',spoils:[{name:'Minotaur Hide'},{name:'Minotaur Horns (@1d2@)',desc:'Hunting trophy or collector\'s item.'},{name:'Minotaur Eyes (@1d2@)',desc:'No immediate use. Can be crafted into a Potion of The Path, which has the following effects: You have can perfectly recall every route they have taken within the past 8 hours, and automatically succeed on ability checks made to escape a maze or similar areas.'}]},{name:'Minotaur Skeleton',type:'Undead',cr:'2',spoils:[]},{name:'Mule',type:'Beast',cr:'1/8',spoils:[{name:'Mule Hide'}]},{name:'Mummy',type:'Undead',cr:'3',spoils:[{name:'Mummy Fist',desc:'Used as a club that deals an additional 3d6 necrotic damage on a hit. If the target is a creature, it must succeed on a DC 12 Constitution saving throw or be cursed with mummy rot. The cursed target can\'t regain hit points, and its hit point maximum decreases by 10 (3d6) for every 24 hours that elapse. If the curse reduces the target\'s hit point maximum to 0, the target dies, and its body turns to dust. The curse lasts until removed by the remove curse spell or other magic. The fist can be used @1d4+2@ times before it crumbles to dust.'}]},{name:'Mummy Lord',type:'Undead',cr:'15',spoils:[{name:'Mummy Lord Fist',desc:'Used as a +1 club that deals an additional 6d6 necrotic damage on a hit. If the target is a creature, it must succeed on a DC 16 Constitution saving throw or be cursed with mummy rot. The cursed target can\'t regain hit points, and its hit point maximum decreases by 10 (3d6) for every 24 hours that elapse. If the curse reduces the target\'s hit point maximum to 0, the target dies, and its body turns to dust. The curse lasts until removed by the remove curse spell or other magic. The fist can be used @1d4+2@ times before it crumbles to dust.'},{name:'Mummy Lord Head',desc:'If the target can see the mummy lord head, it must succeed on a DC 16 Wisdom saving throw against this magic or become frightened until the end of the weilder\'s next turn. If the target fails the saving throw by 5 or more, it is also paralyzed for the same duration. A target that succeeds on the saving throw is immune to the Dreadful Glare of all mummies and mummy lords for the next 24 hours.'}]},{name:'Nalfeshnee',type:'Fiend',cr:'13',spoils:[]},{name:'Night Hag',type:'Fiend',cr:'5',spoils:[{name:'Night Hag Hide',desc:'No immediate use. Can be crafted into armor or a cloak that grants resistance to cold and fire damage.'},{name:'Heartstone',desc:'This lustrous black gem allows its possessor to become ethereal. The touch of a heartstone also cures any disease. Once either effect is used, the heartstone can\'t be used for either purpose until the next dawn.'}]},{name:'Nightmare',type:'Fiend',cr:'3',spoils:[{name:'Nightmare Hide',desc:'No immediate use. Can be crafted into armor that grants resistance to fire.'},{name:'Nightmare Hoof',desc:'Used as a greatclub that deals an additional 2d6 fire damage.'}]},{name:'Noble',type:'Humanoid',cr:'1/8',spoils:[{name:'Breastplate'}]},{name:'Ochre Jelly',type:'Ooze',cr:'2',spoils:[{name:'Vials of Ochre Jelly Oil (@1d2@)',desc:'No immediate use. Can be crafted into Oil of Slipperiness.'}]},{name:'Octopus',type:'Beast',cr:'0',spoils:[]},{name:'Ogre',type:'Giant',cr:'2',spoils:[{name:'Ogre Toes (@1d4@)',desc:'Hunting trophy or collector\'s item.'},{name: 'Ogre Eyes (@1d2@)', desc: 'No immediate use. 2 can be used to craft Goggles of Night.'},{name:'Ogre Heart',desc:'No immediate use. Can be used in crafting Gauntlets of Ogre Strength.'}]},{name:'Ogre Zombie',type:'Undead',cr:'2',spoils:[]},{name:'Oni',type:'Giant',cr:'7',spoils:[{name:'Tattered Chain Mail',desc:'Must be mended before use.'},{name:'Oni Claws (@1d4@)',desc:'Used as daggers. Considered magical in terms of overcoming damage resistance.'},{name:'Oni Blood',desc:'Used in crafting a Potion of Greater Healing.'}]},{name:'Orc',type:'Humanoid',cr:'1/2',spoils:[{name:'Tattered Hide Armor',desc:'Must be mended before use.'}]},{name:'Otyugh',type:'Aberration',cr:'5',spoils:[{name:'Otyugh Tentacles (@1d2@)',desc:'Used as a flail that has the heavy property and deals an additional 1d8 piercing damage.'},{name:'Otyugh Eyes (@1d6@)',desc:'No immediate use. Can be crafted into a Potion of Mind Reading. 10 eyes are used to craft a Robe of Eyes.'}]},{name:'Owl',type:'Beast',cr:'0',spoils:[{name:'Owl Pinions (@1d6@)'},{name:'Owl Talons (@1d2@)'}]},{name:'Owlbear',type:'Monstrosity',cr:'3',spoils:[{name:'Owlbear Pinions (@1d6@)'},{name: 'Owlbear Eyes (@1d2@)', desc: 'No immediate use. 2 can be used to craft Goggles of Night.'},{name:'Owlbear Hide',desc:'No immediate use. Can be crafted by elves into Boots of Elvenkind.'}]},{name:'Panther',type:'Beast',cr:'1/4',spoils:[{name:'Panther Pelt'}]},{name:'Pegasus',type:'Celestial',cr:'2',spoils:[{name:'Pegasus Hide'},{name:'Pegasus Pinions (@1d6@)',desc:'No immediate use. Can be crafted into +1 arrows or bolts. Can be used to craft Winged Boots.'}]},{name:'Phase Spider',type:'Monstrosity',cr:'3',spoils:[{name:'Phase Spider Fangs (@1d2@)',desc:'Used as a dagger.'},{name:'Phase Spider Silk',desc:'No immediate use. Can be used in crafting a Bag of Holding, Bag of Tricks, or a Robe of Useful Items.'}],poison:'Target must make a DC 11 Constitution saving throw, taking 18 (4d8) poison damage on a failed save, or half as much damage on a successful one. If the poison damage reduces the target to 0 hit points, the target is stable but poisoned for 1 hour, even after regaining hit points, and is paralyzed while poisoned in this way.'},{name:'Pit Fiend',type:'Fiend',cr:'20',spoils:[{name:'Pit fiend Hide',desc:'No immediate use. Can be crafted into +2 armor that grants resistance to fire.'},{name:'Pit Fiend Claw',desc:'Used as a battleaxe'},{name:'Pit Fiend Heart',desc:'No immediate use. Can be crafted into an Antimagic Amulet that grants the wearer advantage on saving throws against spells and magic effects.'}]},{name:'Planetar',type:'Celestial',cr:'16',spoils:[{name:'Planetar Pinions (@1d6@)',desc:'No immediate use. Can be crafted into +2 arrows or bolts that deal an additional 3d8 radiant damage, or into a Quall\'s Feather Token.'},{name:'Planetar Hide',desc:'No immediate use. Can be crafted into armor or clothing that grants resistance to bludgeoning, piercing, and slashing from nonmagical attacks.'}]},{name:'Plesiosaurus',type:'Beast',cr:'2',spoils:[{name:'Plesiosaur Hide'},{name:'Plesiosaur Fins (@1d2@)'}]},{name:'Poisonous Snake',type:'Beast',cr:'1/8',spoils:[{name:'Snake Skin'},{name:'Snake Tongue',desc:'Used as a spell component.'}],poison:'Target must make a DC 10 Constitution saving throw, taking 5 (2d4) poison damage on a failed save, or half as much damage on a successful one.'},{name:'Polar Bear',type:'Beast',cr:'2',spoils:[{name:'Polar Bear Pelt'},{name:'Polar Bear Claws (@1d4@)'}]},{name:'Pony',type:'Beast',cr:'1/8',spoils:[{name:'Pony Hide'}]},{name:'Priest',type:'Humanoid',cr:'2',spoils:[{name:'Tattered Chain Shirt',desc:'Must be mended before use.'}]},{name:'Pseudodragon',type:'Dragon',cr:'1/4',spoils:[{name:'Pseudodragon Heart',desc:'No immediate use. Can be used in crafting a Pearl of Power'}],poison:'Target must succeed on a DC 11 Constitution saving throw or become poisoned for 1 hour. If the saving throw fails by 5 or more, the target falls unconscious for the same duration, or until it takes damage or another creature uses an action to shake it awake.'},{name:'Purple Worm',type:'Monstrosity',cr:'15',spoils:[{name:'Purple Worm Hide'},{name:'Purple Worm Tooth (@1d4@)',desc:'Used as a maul.'},{name:'Purple Worm Stomach Lining',desc:'No immediate use. Can be crafted into armor or clothing that grants resistance to acid damage.'}],poison:'Target must make a DC 19 Constitution saving throw, taking 42 (12d6) poison damage on a failed save, or half as much damage on a successful one.'},{name:'Quasit',type:'Fiend',cr:'1',spoils:[]},{name:'Rakshasa',type:'Fiend',cr:'13',spoils:[{name:'Rakshasa Hide',desc:'No immediate use. Can be crafted into armor or a cloak that grants resistance to bludgeoning, piercing, slashing damage from nonmagical attacks. However, it will leave the wearer vulnerable to piercing damage from magical weapons weilded by good creatures.'},{name:'Rakshasa Claw',desc:'Used as a sicle that does 1d6 damage, and the target is cursed if it is a creature. The magical curse takes effect whenever the target takes a short or long rest, filling the target\'s thoughts with horrible images and dreams. The cursed target gains no benefit from finishing a short or long rest. The curse lasts until it is lifted by a remove curse spell or similar magic. The curse property works for @1d3+2@ times before wearing off.'},{name:'Rakshasa Heart',desc:'No immediate use. Can be crafted into an Antimagic Amulet that grants the wearer advantage on saving throws against spells and magic effects.'}]},{name:'Rat',type:'Beast',cr:'0',spoils:[]},{name:'Raven',type:'Beast',cr:'0',spoils:[{name:'Raven Pinions (@1d6@)'}]},{name:'Red Dragon Wyrmling',type:'Dragon',cr:'4',spoils:[{name:'Red Dragon Wyrmling Head',desc:'Hunting trophy or collector\'s item.'},{name:'Red Dragon Wyrmling Hide',desc:'No immediate use. Can be crafted into armor that provides fire resistance.'}]},{name:'Reef Shark',type:'Beast',cr:'1/2',spoils:[{name:'Reef Shark Hide'},{name:'Reef Shark Teeth (@1d4@)'}]},{name:'Remorhaz',type:'Monstrosity',cr:'11',spoils:[{name:'Remorhaz Fangs (@1d4@)',desc:'Used as a +1 dagger.'},{name:'Remorhaz Hide',desc:'No immediate use. Can be crafted into armor that grants resistance to fire and cold damage.'}]},{name:'Rhinoceros',type:'Beast',cr:'2',spoils:[{name:'Rhinoceros Hide'},{name:'Rhinoceros Horn'}]},{name:'Riding Horse',type:'Beast',cr:'1/4',spoils:[{name:'Horse Hide'}]},{name:'Roc',type:'Monstrosity',cr:'11',spoils:[{name:'Roc Talons (@1d2@)',desc:'Used as a battle axe that does an additional 1d8 slashing damage. When equipped, grants advantage on Charisma checks made against giants.'},{name:'Roc Pinions (@1d6@)',desc:'No immediate use. Can be crafted into +3 arrows or bolts. 3 pinions can be crafted into a Potion of Flying.'}]},{name:'Roper',type:'Monstrosity',cr:'5',spoils:[{name:'Roper Hide',desc:'No immediate use. Can be crafted into armor a cloak that gives advantage on Dexterity (Stealth) checks made to hide in rocky terrain.'},{name:'Roper Tendrils (@1d4@)',desc:'Used like a whip with a 50 ft. reach. On a hit, the creature is grappled (escape DC 15). Until the grapple ends, the target is restrained and has disadvantage on Strength checks and Strength saving throws. On subsequent turns, the tendril pulls the grappled creature up to 25 ft. toward the wielder until it is within 5 ft.  Once used, the tendril becomes useless.'}]},{name:'Rug of Smothering',type:'Construct',cr:'2',spoils:[{name:'Tattered Rug'}]},{name:'Rust Monster',type:'Monstrosity',cr:'1/2',spoils:[{name:'Rust Monster Antennae (@1d2@)',desc:'Used to touch a nonmagical metal objects. If the object isn\'t being worn or carried, the touch destroys a 1-foot cube of it. If the object is being worn or carried by a creature, the creature can make a DC 11 Dexterity saving throw to avoid being touched. If the object touched is either metal armor or a metal shield being worn or carried, its takes a permanent and cumulative −1 penalty to the AC it offers. Armor reduced to an AC of 10 or a shield that drops to a +0 bonus is destroyed. If the object touched is a held metal weapon, the weapon takes a permanent and cumulative −1 penalty to damage rolls. If its penalty drops to −5, the weapon is destroyed. Once used, the antenna becomes useless.'}]},{name:'Saber-toothed Tiger',type:'Beast',cr:'2',spoils:[{name:'Saber-toothed Tiger Hide'}]},{name:'Sahuagin',type:'Humanoid',cr:'1/2',spoils:[{name:'Sahuagin Hide'},{name:'Sahuagin Skull',desc:'No immediate use. Can be crafted into a helmit that grants the effect of a Speak with Animals spell, but only works on sharks. Once used, this property can\'t be used again until the next dawn.'}]},{name:'Salamander',type:'Elemental',cr:'5',spoils:[{name:'Lumps of Elemental Magma (@1d2@)',desc:'No immediate use. Used as a material component for a Conjure Minor Elementals spell, or in crafting an Elemental Gem for summoning earth or fire elementals. Can be used in crafting Alchemist\'s Fire.'}]},{name:'Satyr',type:'Fey',cr:'1/2',spoils:[]},{name:'Scorpion',type:'Beast',cr:'0',spoils:[]},{name:'Scout',type:'Humanoid',cr:'1/2',spoils:[{name:'Tattered Leather Armor',desc:'Must be mended before use.'}]},{name:'Sea Hag',type:'Fey',cr:'2',spoils:[]},{name:'Sea Horse',type:'Beast',cr:'0',spoils:[]},{name:'Shadow',type:'Undead',cr:'1/2',spoils:[{name:'Ectoplasm',desc:'No immediate use. Can be crafted into a Potion of Necrotic Resistance, or a poison that deals 2d6 necrotic damage when applied to a weapon or ammunition. There is enough for one coating and is used up on a successful hit.'}]},{name:'Shambling Mound',type:'Plant',cr:'5',spoils:[{name:'Shambling Mound Root-Stem',desc:'When held, provides resistance to lightning damage. Can be crafted into an Amulet of Lightning Absorption. If an attack on the wearer would inflict lightning damage, it instead heals the wearer for the same amouht of points.'}]},{name:'Shield Guardian',type:'Construct',cr:'7',spoils:[{name:'Shield Guardian Finger',desc:'Used like a Ring of Spell Storing but will only hold 1 spell at a time, and only spells of 4th level or lower.'}]},{name:'Shrieker',type:'Plant',cr:'0',spoils:[]},{name:'Silver Dragon Wyrmling',type:'Dragon',cr:'2',spoils:[{name:'Silver Dragon Wyrmling Head',desc:'Hunting trophy or collector\'s item.'},{name:'Silver Dragon Wyrmling Hide',desc:'No immediate use. Can be crafted into armor that provides cold resistance.'}]},{name:'Skeleton',type:'Undead',cr:'1/4',spoils:[{name:'Bones (@1d6@)'}]},{name:'Smoke Mephit',type:'Elemental',cr:'1/4',spoils:[{name:'Puff of Elemental Smoke',desc:'No immediate use. Used as a material component for a Conjure Minor Elementals spell, or in crafting an Elemental Gem for summoning air or fire elementals.'}]},{name:'Solar',type:'Celestial',cr:'21',spoils:[{name:'Solar Pinions (@1d6@)',desc:'No immediate use. Can be crafted into +2 arrows or bolts that deal an additional 6d8 radiant damage, or into a Quall\'s Feather Token.'},{name:'Solar Hide',desc:'No immediate use. Can be crafted into armor or clothing that grants resistance to radiant damage, and bludgeoning, piercing, and slashing from nonmagical attacks.'}]},{name:'Specter',type:'Undead',cr:'1',spoils:[{name:'Ectoplasm',desc:'No immediate use. Can be crafted into a Potion of Necrotic Resistance, or a poison that deals 3d6 necrotic damage when applied to a weapon or ammunition. There is enough for one coating and is used up on a successful hit.'}]},{name:'Spider',type:'Beast',cr:'0',spoils:[]},{name:'Spirit Naga',type:'Monstrosity',cr:'8',spoils:[{name:'Spirit Naga Hide',desc:'No immediate use. Can be crafted into +1 armor that grants resistance to poison damage.'},{name:'Spirit Naga Heart',desc:'When consumed, acts as a Potion of Vitality.'}],poison:'Target must make a DC 13 Constitution saving throw, taking 31 (7d8) poison damage on a failed save, or half as much damage on a successful one.'},{name:'Sprite',type:'Fey',cr:'1/4',spoils:[]},{name:'Spy',type:'Humanoid',cr:'1',spoils:[{name:'Disguise Kit'},{name:'Thieves\' Tools'}]},{name:'Steam Mephit',type:'Elemental',cr:'1/4',spoils:[{name:'Puff of Elemental Steam',desc:'No immediate use. Used as a material component for a Conjure Minor Elementals spell, or in crafting an Elemental Gem for summoning water or fire elementals.'}]},{name:'Stirge',type:'Beast',cr:'1/8',spoils:[{name:'Stirge Wings (@1d2@)'}]},{name:'Stone Giant',type:'Giant',cr:'7',spoils:[{name:'Stone Giant Toes (@1d4@)',desc:'Hunting trophy or collector\'s item.'},{name: 'Stone Giant Eyes (@1d2@)', desc: 'No immediate use. 2 can be used to craft Goggles of Night.'},{name:'Stone Giant Fingernails (@1d4@)',desc:'No immediate use. Can be crafted into Potion of Stone Giant Strength.'},{name:'Stone Giant Heart',desc:'No immediate use. Can be used in crafting a Belt of Stone Giant Strength.'}]},{name:'Stone Golem',type:'Construct',cr:'10',spoils:[{name:'Stone Golem Heart',desc:'When worn around the neck, acts as an amulet allowing the wearer to cast Slow as the spell with no components (saving throw DC 17).'}]},{name:'Storm Giant',type:'Giant',cr:'13',spoils:[{name:'Storm Giant Toes (@1d4@)',desc:'Hunting trophy or collector\'s item.'},{name:'Storm Giant Fingernails (@1d4@)',desc:'No immediate use. Can be crafted into Potion of Storm Giant Strength.'},{name:'Storm Giant Heart',desc:'No immediate use. Can be used in crafting a Belt of Storm Giant Strength.'}]},{name:'Succubus',type:'Fiend',cr:'4',spoils:[{name:'Succubus Claw',desc:'Used as a sickle that deals 1d6 slashing damage.'},{name:'Succubus Lips',desc:'No immediate use. Can be used to craft a lipstick that can be used to kiss a willing target. The target must make a DC 15 Constitution saving throw against this magic, taking 32 (5d10 + 5) psychic damage on a failed save, or half as much damage on a successful one. The target\'s hit point maximum is reduced by an amount equal to the damage taken. This reduction lasts until the target finishes a long rest. The target dies if this effect reduces its hit point maximum to 0. The lips make enough lipstick for @1d2+1@ uses.'},{name:'Succubus Eyes (@1d2@)',desc:'No immediate use. Can be used in crafting Eyes of Charming.'}]},{name:'Svirfneblin',type:'Humanoid',cr:'1/2',spoils:[{name:'Tattered Chain Shirt',desc:'Must be mended before use.'},{name:'Svirfneblin Hide',desc:'No immediate use. 3 hides can be crafted into a cloak that gives advantage on Dexterity (Stealth) checks made to hide in rocky terrain.'}]},{name:'Tarrasque',type:'Monstrosity',cr:'30',spoils:[{name:'Tarrasque Blood',desc:'Used as a Potion of Supreme Healing.'},{name:'Tarrasque Eye',desc:'No immediate use. Can be crafted into a Helmet or Circlet of Luck. If the wearer fails a saving throw, it can choose to succeed instead. Once this property is used, it cannot be used again until the next dawn.'},{name:'Tarrasque Hide',desc:'No immediate use. Can be crafted into +3 armor that grants advantage on saving throws against spells and other magical effects.'},{name:'Tarrasque Carapace',desc:'No immediate use. Can be crafted into a +2 Shield of Turning. Any time the wielder is targeted by a magic missile spell, a line spell, or a spell that requires a ranged attack roll, roll a d6. On a 1 to 5, the wielder is unaffected. On a 6, the wielder is unaffected, and the effect is reflected back at the caster as though it originated from the wielder, turning the caster into the target.'}]},{name:'Thug',type:'Humanoid',cr:'1/2',spoils:[{name:'Tattered Leather Armor',desc:'Must be mended before use.'}]},{name:'Tiger',type:'Beast',cr:'1',spoils:[{name:'Tiger Pelt'},{name:'Tiger Teeth (@1d4@)'}]},{name:'Treant',type:'Plant',cr:'9',spoils:[{name:'Treant Limbs (@1d2@)',desc:'Can be used as a +1 greatclub.'},{name:'Treant Heart',desc:'No immediate use. Can be crafted into a Staff of Trees. Once per day, this staff can be used to animate one tree within 60 feet. This tree has the same statistics as a treant, except it has Intelligence and Charisma scores of 1, can\'t speak, and has only the Slam action option. The animated tree acts as an ally to the owner of the staff. The tree remains animate for 1 day or until it dies; until the staff owner dies or is more than 120 feet from the tree; or until the staff owner takes a bonus action to turn it back into an inanimate tree. The tree then takes root if possible.'}]},{name:'Tribal Warrior',type:'Humanoid',cr:'1/8',spoils:[{name:'Tattered Hide Armor',desc:'Must be mended before use.'}]},{name:'Triceratops',type:'Beast',cr:'5',spoils:[{name:'Triceratops Hide'},{name:'Triceratops Horns (@1d3@)'}]},{name:'Troll',type:'Giant',cr:'5',spoils:[{name: 'Troll Eyes (@1d2@)', desc: 'No immediate use. 2 can be used to craft Goggles of Night.'},{name:'Troll Chunks (@1d2@)',desc:'If not cooked thoroughly or cured in acid, will regrow into a troll within 48 hours. Regrowth can be delayed by searing one side every hour.'},{name:'Vials of Troll Blood',desc:'No immediate use. Can be crafted into a Potion of Greater Healing.'},{name:'Troll Heart',desc:'No immediate use. Can be used in crafting an Amulet of Health or an Elixir of Health.'}]},{name:'Tyrannosaurus Rex',type:'Beast',cr:'8',spoils:[{name:'Tyrannosaurus Rex Hide'},{name:'Tyrannosaurus Rex Claws (@1d4@)'}]},{name:'Unicorn',type:'Celestial',cr:'5',spoils:[{name:'Unicorn Hide',desc:'No immediate use. Can be crafted into armor or a cloak that grants advantage against Charm or other mind control effects. Once per day, the wearer can choose to heal themselves for 2d8+2 points. This also removes all diseases and neutralizes all poisons affecting the wearer. This property can\'t be used again until the next dawn.'},{name:'Unicorn Horn',desc:'Can be used as a +2 shortsword. The horn can also be used to heal (3/day) for 2d8+2 points, removing all diseases and neutralizing all potions affecting the creature touched.'},{name:'Unicorn Heart',desc:'No immediate use. Can be crafted into an Amulet of Teleportation that has one charge, reset daily at dawn.'}]},{name:'Vampire',type:'Undead',cr:'13',spoils:[{name:'Vampire Eyes (@1d2@)',desc:'No immediate use. Can be crafted into a Potion of Gaseous Form.'},{name:'Vampire Heart',desc:'No immediate use. Can be crafted into a Potion of Polymorph, having the effect of a Polymorph spell on the drinker. The effect lasts for 1 hour.'}]},{name:'Vampire Spawn',type:'Undead',cr:'5',spoils:[{name:'Vampire Spawn Eyes (@1d2@)',desc:'No immediate use. Can be crafted into a Potion of Gaseous Form.'}]},{name:'Veteran',type:'Humanoid',cr:'3',spoils:[{name:'Tattered Splint Armor',desc:'Must be mended before use.'}]},{name:'Violet Fungus',type:'Plant',cr:'1/4',spoils:[{name:'Violet Fungus Stalks (@1d4@)',desc:'Used as a whip that delivers an additional 1d8 necrotic damage. After @1d2+1@ successful hits, this extra property fades and the stalk works just like a normal whip.'}]},{name:'Vrock',type:'Fiend',cr:'6',spoils:[{name:'Vrock Talon',desc:'May be used as a sickle.'},{name:'Vrock Larynx',desc:'Used like a whistle that emits a horrific screech. Each creature within 20 feet of it that can hear it and that isn\'t a demon must succeed on a DC 14 Constitution saving throw or be stunned until the end of the user\'s next turn. Can be used @1d4+2@ times before disentegrating.'},{name:'Vrock Spore Sac',desc:'Can be thrown with a range of 20/60 ft. On impact it breaks open, releasing a 15-foot-radius cloud of toxic spore. The spores spread around corners. Each creature in that area must succeed on a DC 14 Constitution saving throw or become poisoned. While poisoned in this way, a target takes 5 (1d10) poison damage at the start of each of its turns. A target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. Emptying a vial of holy water on the target also ends the effect on it.'}]},{name:'Vulture',type:'Beast',cr:'0',spoils:[{name:'Vulture Pinions (@1d6@)'},{name:'Vulture Talons (@1d2@)'}]},{name:'Warhorse',type:'Beast',cr:'1/2',spoils:[{name:'Horse Hide'}]},{name:'Warhorse Skeleton',type:'Undead',cr:'1/2',spoils:[]},{name:'Water Elemental',type:'Elemental',cr:'5',spoils:[{name:'Vial of Elemental Water',desc:'No immediate use. Used as a material component for a Conjure Elementals spell, or in crafting an Elemental Gem for summoning water elementals.'}]},{name:'Weasel',type:'Beast',cr:'0',spoils:[{name:'Weasel Pelt'}]},{name:'Werebear',type:'Humanoid',cr:'5',spoils:[]},{name:'Wereboar',type:'Humanoid',cr:'4',spoils:[]},{name:'Wererat',type:'Humanoid',cr:'2',spoils:[]},{name:'Weretiger',type:'Humanoid',cr:'4',spoils:[]},{name:'Werewolf',type:'Humanoid',cr:'3',spoils:[]},{name:'White Dragon Wyrmling',type:'Dragon',cr:'2',spoils:[{name:'White Dragon Wyrmling Head',desc:'Hunting trophy or collector\'s item.'},{name:'White Dragon Wyrmling Hide',desc:'No immediate use. Can be crafted into armor that provides cold resistance.'}]},{name:'Wight',type:'Undead',cr:'3',spoils:[]},{name:'Will-o\'-Wisp',type:'Undead',cr:'2',spoils:[{name:'Will-o\'-Wisp Mote',desc:'No immediate use. Can be used in crafting a Driftglobe or a Lantern of Revealing.'}]},{name:'Winter Wolf',type:'Monstrosity',cr:'3',spoils:[{name:'Winter Wolf Hide',desc:'No immediate use. Can be crafted into armor or a cloak that grants resistance to cold and advantage on Dexterity (Stealth) checks made to hide in snowy terrain.'}]},{name:'Wolf',type:'Beast',cr:'1/4',spoils:[{name:'Wolf Pelt'}]},{name:'Worg',type:'Monstrosity',cr:'1/2',spoils:[{name:'Worg Hide',desc:'No immediate use. Can be crafted into armor or a cloak that grants advantage on Persuasion checks on goblins or hobgoblins.'}]},{name:'Wraith',type:'Undead',cr:'5',spoils:[{name:'Wraith Essence',desc:'Can be crafted into an amulet that can create a specter from a humanoid that has died violently within the hour. This specter is under the control of the possessor of the amulet.'}]},{name:'Wyvern',type:'Dragon',cr:'6',spoils:[{name:'Wyvern Head',desc:'Hunting trophy or collector\'s item.'},{name:'Wyvern Tail',desc:'No immediate use. Can be crafted into a Dagger of Venom.'},{name:'Wyvern Wings (@1d2@)',desc:'No immediate use. Can be crafted into Wings of Flying.'}],poison:'Target must make a DC 15 Constitution saving throw, taking 24 (7d6) poison damage on a failed save, or half as much damage on a successful one.'},{name:'Xorn',type:'Elemental',cr:'5',spoils:[{name:'Stones from the Xorn\'s Stomach (@1d4@)',desc:'Can be used as +2 sling stones.'},{name:'Xorn hide',desc:'No immediate use. Can be crafted into Bracers of Defense or used in crafting a Portable Hole.'}]},{name:'Young Black Dragon',type:'Dragon',cr:'7',spoils:[{name:'Young Black Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Young Black Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Acid Resistance.'},{name:'Young Black Dragon Hide',desc:'No immediate use. Can be crafted into armor that provides acid resistance.'}]},{name:'Young Blue Dragon',type:'Dragon',cr:'9',spoils:[{name:'Young Blue Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Young Blue Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Lightning Resistance.'},{name:'Young Blue Dragon Hide',desc:'No immediate use. Can be crafted into armor that provides lightning resistance.'},{name:'Young Blue Dragon Fang',desc:'No immediate use. Can be crafted into a Javelin of Lightning.'}]},{name:'Young Brass Dragon',type:'Dragon',cr:'6',spoils:[{name:'Young Brass Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Young Brass Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Fire Resistance.'},{name:'Young Brass Dragon Hide',desc:'No immediate use. Can be crafted into armor that provides fire resistance.'}]},{name:'Young Bronze Dragon',type:'Dragon',cr:'8',spoils:[{name:'Young Bronze Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Young Bronze Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Lightning Resistance.'},{name:'Young Bronze Dragon Hide',desc:'No immediate use. Can be crafted into armor that provides lightning resistance.'}]},{name:'Young Copper Dragon',type:'Dragon',cr:'7',spoils:[{name:'Young Copper Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Young Copper Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Acid Resistance.'},{name:'Young Copper Dragon Hide',desc:'No immediate use. Can be crafted into armor that provides acid resistance.'}]},{name:'Young Gold Dragon',type:'Dragon',cr:'10',spoils:[{name:'Young Gold Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Young Gold Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Fire Resistance.'},{name:'Young Gold Dragon Hide',desc:'No immediate use. Can be crafted into +1 armor that provides fire resistance.'}]},{name:'Young Green Dragon',type:'Dragon',cr:'8',spoils:[{name:'Young Green Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Young Green Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Poison Resistance.'},{name:'Young Green Dragon Heart',desc:'No immediate use. Can be used to craft a Dagger of Venom.'},{name:'Young Green Dragon Hide',desc:'No immediate use. Can be crafted into armor that provides poison resistance.'}]},{name:'Young Red Dragon',type:'Dragon',cr:'10',spoils:[{name:'Young Red Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Young Red Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Fire Resistance.'},{name:'Young Red Dragon Hide',desc:'No immediate use. Can be crafted into +1 armor that provides fire resistance.'}]},{name:'Young Silver Dragon',type:'Dragon',cr:'9',spoils:[{name:'Young Silver Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Young Silver Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Cold Resistance.'},{name:'Young Silver Dragon Hide',desc:'No immediate use. Can be crafted into armor that provides cold resistance.'}]},{name:'Young White Dragon',type:'Dragon',cr:'6',spoils:[{name:'Young White Dragon Head',desc:'Hunting trophy or collector\'s item.'},{name:'Young White Dragon Blood',desc:'No immediate use. Can be crafted into a Potion of Cold Resistance.'},{name:'Young White Dragon Hide',desc:'No immediate use. Can be crafted into armor that provides cold resistance.'}]},{name:'Zombie',type:'Undead',cr:'1/4',spoils:[]}],

    //---- PUBLIC FUNCTIONS ----//

    registerEventHandlers = function () {
		on('chat:message', handleInput);
	};

    return {
		checkInstall: checkInstall,
		registerEventHandlers: registerEventHandlers
	};
}());

on("ready", function () {
    MonsterLoot.checkInstall();
    MonsterLoot.registerEventHandlers();
});
