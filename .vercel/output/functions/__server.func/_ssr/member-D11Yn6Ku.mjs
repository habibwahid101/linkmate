import { r as createServerFn } from "./ssr.mjs";
import { t as authMiddleware } from "./middleware-Bb4nqKHv.mjs";
import { t as createSsrRpc } from "./createSsrRpc-B2Izd0c7.mjs";
import { cn as _enum, gn as object, yn as string } from "../_libs/@better-auth/core+[...].mjs";
import { r as PACKAGE_IDS } from "./rules-D1_lUvHP.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/member-D11Yn6Ku.js
var packageIdSchema = _enum(PACKAGE_IDS);
var getDashboard = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("86db50d1f2d24e1ff6c686f959d1deeded490f33a3712d88f1aca56f39609483"));
var listMyIds = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("68de69563b849c9d25bb2c4a24227101c06b46785ce60316f294fde0e2ba340b"));
var getTeam = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(object({ memberId: string().optional() }).optional()).handler(createSsrRpc("3a00cf749df67a8fed37e98aca9a4be897f1469682e52f43b0ce230aeb738c81"));
var getWallet = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("abc933f88cf98a8fd67497082515ff86cc247120ac480162193e88ae7e13c129"));
var getLevels = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(object({ memberId: string().optional() }).optional()).handler(createSsrRpc("8dfa7b2718dcddc6017608d5413d0401c3def42514777e9bb42aa711c308e4c9"));
var purchasePackage = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	packageId: packageIdSchema,
	referralCode: string().optional()
})).handler(createSsrRpc("76fa4f17d3221cc5d8699b50df864f96ecf1d24850958f1514eb92c9cd4c3f95"));
var loadSampleNetwork = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("819b48561282beef1f60deb000118bd3d5ba4b763cd4d6aee6f7aedb1480ab66"));
var simulateDirectJoin = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	sponsorMemberId: string(),
	name: string().min(2).max(80),
	packageId: packageIdSchema.optional()
})).handler(createSsrRpc("6c3320491b52342635bf4ec32b09d0fc66af52e5aea56dbe2ef2f80c6cc21a8a"));
var getInvite = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("d545ed3b52c29245e3b31c383075eaf80f9cf3072fcfc5f9d87dd4f0311eeafb"));
var getEarningsByLevel = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("6bb56d8abc3a4b00b19941d7d54c71d85943c5a2dca1fd14b8dfc8eaf50c426d"));
//#endregion
export { getTeam as a, loadSampleNetwork as c, getLevels as i, purchasePackage as l, getEarningsByLevel as n, getWallet as o, getInvite as r, listMyIds as s, getDashboard as t, simulateDirectJoin as u };
