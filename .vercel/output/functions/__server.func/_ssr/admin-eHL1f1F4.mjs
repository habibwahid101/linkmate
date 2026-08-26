import { r as createServerFn } from "./ssr.mjs";
import { t as authMiddleware } from "./middleware-Bb4nqKHv.mjs";
import { t as createSsrRpc } from "./createSsrRpc-B2Izd0c7.mjs";
import { cn as _enum, gn as object, hn as number, pn as literal, yn as string } from "../_libs/@better-auth/core+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin-eHL1f1F4.js
var getAdminOverview = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("e5bf6ef5ca6f7c26de29c1c6b19ec76887c31a9570882199379930e50283a51d"));
var adminListUsers = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("9cd091d0a1b175bd96dcf2adffc8f997cf0f77ac2515ad72b0b8464750ecd0f5"));
var adminListIds = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("e9d13511ffe3d08ccb74d51a894757c5c0fc79d8ccf4279b99852eb7eccae2b5"));
var adminListPurchases = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("1ec5ee082bc6465673c72d432e01df1c4c0d885374ba899e2a9681986d64dba3"));
var adminListCommissions = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(object({ status: string().optional() }).optional()).handler(createSsrRpc("78f596f95c34f3b694d47191581af232a78717850eeaf43d47d7227c6723320f"));
var adminListWallets = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("e21c08ccc1fc399eda27c4fa5ab0247c905ac9b85163060db5dd0df9d33d5dbe"));
var adminListTransactions = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("b290c3ecb384acb9c608cac762eee5cf2f9526835e95a8ec7775920fe1d2dc9f"));
var adminListAudit = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("37c92527c9884f78c60f96e106fcb0e9cd450184c2c311caf257fe5d3b43a814"));
var adminGetSettings = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("7c6b82e0ce0bba37c904ef67f1d4882c6dde8ee39f59dcea6d97c8935c479940"));
var adminUpdateSetting = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	key: string(),
	value: string(),
	confirm: literal(true)
})).handler(createSsrRpc("298d982d6fd8f17cccca62dc2ec1c725a519509f0b532d1034a89249eddcd4b5"));
var adminSetRole = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	userId: string(),
	role: _enum(["member", "admin"])
})).handler(createSsrRpc("ad071b116bb6bfd69b4fa28ecbf96275a634abb71cb7bcc43cb484d3985c37e0"));
var adminLedgerAdjustment = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	memberId: string(),
	amount: number().int(),
	reason: string().min(3).max(200),
	confirm: literal(true)
})).handler(createSsrRpc("16f22eeafed779aa9ebfc81e71141a091ba1e5aca9e54abb59917473c344ffe6"));
var adminNetwork = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(object({ memberId: string().optional() }).optional()).handler(createSsrRpc("0e80bf548162b554218c68b6e881693310a8c22de11b0df003d2c1290b890a16"));
var adminReports = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("775544cd4797e6667cb2288df4214dbe8b6899e0d473eb91c8dfb6631a4a4fe5"));
var adminListNotifications = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("15a27df3bcbac659a77bb61500dcfb9b1e62eb397a492d579be8c3048a9872a5"));
//#endregion
export { adminListIds as a, adminListTransactions as c, adminNetwork as d, adminReports as f, getAdminOverview as h, adminListCommissions as i, adminListUsers as l, adminUpdateSetting as m, adminLedgerAdjustment as n, adminListNotifications as o, adminSetRole as p, adminListAudit as r, adminListPurchases as s, adminGetSettings as t, adminListWallets as u };
