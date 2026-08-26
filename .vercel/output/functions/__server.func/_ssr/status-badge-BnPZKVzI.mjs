import { o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as Badge } from "./badge-S67-CHGd.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/status-badge-BnPZKVzI.js
var import_jsx_runtime = require_jsx_runtime();
var map = {
	LOCKED: {
		tone: "locked",
		label: "Locked"
	},
	IN_PROGRESS: {
		tone: "accent",
		label: "In Progress"
	},
	ELIGIBLE: {
		tone: "warning",
		label: "Eligible"
	},
	COMPLETED: {
		tone: "success",
		label: "Completed"
	},
	RELEASED: {
		tone: "success",
		label: "Released"
	},
	HELD: {
		tone: "held",
		label: "Held"
	},
	PENDING: {
		tone: "held",
		label: "Pending"
	},
	active: {
		tone: "success",
		label: "Active"
	},
	placed: {
		tone: "accent",
		label: "Placed"
	},
	pending_config: {
		tone: "warning",
		label: "Unplaced"
	},
	posted: {
		tone: "success",
		label: "Posted"
	},
	completed: {
		tone: "success",
		label: "Completed"
	}
};
function StatusBadge({ status }) {
	const m = map[status] ?? {
		tone: "neutral",
		label: status
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		tone: m.tone,
		children: m.label
	});
}
//#endregion
export { StatusBadge as t };
