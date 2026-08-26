//#region node_modules/.nitro/vite/services/ssr/assets/rules-D1_lUvHP.js
/**
* Centralized Link Mate business rules.
* Locked values — do not duplicate these numbers in UI components.
*/
var STANDARD_ID_VALUE_BDT = 11e3;
var PACKAGE_IDS = [
	"builder",
	"turbo",
	"super_turbo",
	"hyper_turbo"
];
var PACKAGES = {
	builder: {
		id: "builder",
		name: "Builder",
		amountBdt: 11e3,
		idCount: 1,
		placementRuleVersion: "v1",
		structureSummary: "1 ID. You are the root. Level 1 requires 3 personal sponsors.",
		receives: "One membership ID. Invite 3 direct members to complete Level 1.",
		locked: true
	},
	turbo: {
		id: "turbo",
		name: "Turbo",
		amountBdt: 44e3,
		idCount: 4,
		placementRuleVersion: "v1",
		structureSummary: "4 IDs — 1 root ID + 3 internal Level-1 IDs.",
		receives: "Four IDs. Your first ID internally sponsors the other three, which can complete its Level 1.",
		locked: true
	},
	super_turbo: {
		id: "super_turbo",
		name: "Super Turbo",
		amountBdt: 143e3,
		idCount: 13,
		placementRuleVersion: "v1",
		structureSummary: "13 IDs — 1 root + 3 first generation + 9 second generation.",
		receives: "Thirteen IDs placed as 1 root, 3 under the root, and 9 under those positions.",
		locked: true
	},
	hyper_turbo: {
		id: "hyper_turbo",
		name: "Hyper Turbo",
		amountBdt: 242e3,
		idCount: 22,
		placementRuleVersion: "v1-partial",
		structureSummary: "22 IDs. Confirmed: first 13 follow Super Turbo (1 + 3 + 9). Remaining 9 internal placements are configurable.",
		receives: "Twenty-two IDs. The first 13 are placed now. The remaining 9 stay unplaced until placement rules are finalized.",
		locked: true
	}
};
var PACKAGE_LIST = PACKAGE_IDS.map((id) => PACKAGES[id]);
var LEVELS = [
	{
		level: 1,
		generation: 1,
		generationLabel: "1st",
		requiredMembers: 3,
		rate: .08,
		rateLabel: "8%"
	},
	{
		level: 2,
		generation: 2,
		generationLabel: "2nd",
		requiredMembers: 9,
		rate: .06,
		rateLabel: "6%"
	},
	{
		level: 3,
		generation: 3,
		generationLabel: "3rd",
		requiredMembers: 27,
		rate: .03,
		rateLabel: "3%"
	},
	{
		level: 4,
		generation: 4,
		generationLabel: "4th",
		requiredMembers: 54,
		rate: .02,
		rateLabel: "2%"
	},
	{
		level: 5,
		generation: 5,
		generationLabel: "5th",
		requiredMembers: 108,
		rate: .012,
		rateLabel: "1.2%"
	},
	{
		level: 6,
		generation: 6,
		generationLabel: "6th",
		requiredMembers: 162,
		rate: .01,
		rateLabel: "1%"
	},
	{
		level: 7,
		generation: 7,
		generationLabel: "7th",
		requiredMembers: 216,
		rate: .01,
		rateLabel: "1%"
	},
	{
		level: 8,
		generation: 8,
		generationLabel: "8th",
		requiredMembers: 270,
		rate: .01,
		rateLabel: "1%"
	},
	{
		level: 9,
		generation: 9,
		generationLabel: "9th",
		requiredMembers: 324,
		rate: .01,
		rateLabel: "1%"
	}
];
function getLevel(level) {
	const rule = LEVELS.find((l) => l.level === level);
	if (!rule) throw new Error(`Unknown level ${level}`);
	return rule;
}
/** Integer BDT. Locked examples: 8% × 11,000 = 880. */
function commissionPerMember(joiningAmountBdt = STANDARD_ID_VALUE_BDT, rate) {
	return Math.round(joiningAmountBdt * rate);
}
function fullLevelCommission(level, joiningAmountBdt = STANDARD_ID_VALUE_BDT) {
	const rule = getLevel(level);
	return commissionPerMember(joiningAmountBdt, rule.rate) * rule.requiredMembers;
}
function ordinalGeneration(n) {
	return [
		"",
		"1st",
		"2nd",
		"3rd",
		"4th",
		"5th",
		"6th",
		"7th",
		"8th",
		"9th"
	][n] ?? `${n}th`;
}
//#endregion
export { STANDARD_ID_VALUE_BDT as a, getLevel as c, PACKAGE_LIST as i, ordinalGeneration as l, PACKAGES as n, commissionPerMember as o, PACKAGE_IDS as r, fullLevelCommission as s, LEVELS as t };
