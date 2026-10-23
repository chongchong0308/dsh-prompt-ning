import { createHash } from "node:crypto";

export function sha256(text) {
	return createHash("sha256").update(String(text), "utf8").digest("hex");
}

export function short(hash) {
	return String(hash || "").slice(0, 12);
}
